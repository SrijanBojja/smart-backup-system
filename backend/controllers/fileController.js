const db = require('../config/db');
const fs = require('fs');
const crypto = require('crypto');
const s3 = require('../config/s3');

// ===============================
// S3 UPLOAD FUNCTION
// ===============================
const uploadToS3 = async (file) => {
  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: Date.now() + '-' + file.originalname,
    Body: fs.readFileSync(file.path),
    ContentType: file.mimetype
  };

  const data = await s3.upload(params).promise();
  return data.Location;
};

// ===============================
// UPLOAD FILE + VERSION HANDLING
// ===============================
const uploadFile = async (req, res) => {
  const user_id = req.body.user_id;

  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  try {
    const original_name = req.file.originalname;
    const file_type = req.file.mimetype;
    const file_size = req.file.size;

    // Upload to S3
    const s3_url = await uploadToS3(req.file);

    // Generate hash
    const fileBuffer = fs.readFileSync(req.file.path);
    const file_hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Check if file exists
    const checkFileQuery = `
      SELECT * FROM files
      WHERE user_id = ? AND original_name = ?
    `;

    db.query(checkFileQuery, [user_id, original_name], (err, fileResults) => {
      if (err) {
        return res.status(500).json({ message: 'File check failed', error: err.message });
      }

      // ============================
      // FILE EXISTS → NEW VERSION
      // ============================
      if (fileResults.length > 0) {
        const existingFile = fileResults[0];
        const file_id = existingFile.file_id;
        const nextVersion = existingFile.latest_version + 1;

        const updateFileQuery = `
          UPDATE files SET latest_version = ?
          WHERE file_id = ?
        `;

        db.query(updateFileQuery, [nextVersion, file_id], (err2) => {
          if (err2) {
            return res.status(500).json({ message: 'Update failed', error: err2.message });
          }

          const insertVersionQuery = `
            INSERT INTO file_versions
            (file_id, version_number, s3_url, file_size, file_hash)
            VALUES (?, ?, ?, ?, ?)
          `;

          db.query(insertVersionQuery, [file_id, nextVersion, s3_url, file_size, file_hash], (err3) => {
            if (err3) {
              return res.status(500).json({ message: 'Version save failed', error: err3.message });
            }

            return res.status(201).json({
              message: `New version uploaded`,
              file: { file_id, original_name, version: nextVersion }
            });
          });
        });
      }

      // ============================
      // NEW FILE
      // ============================
      else {
        const insertFileQuery = `
          INSERT INTO files (user_id, original_name, file_type, latest_version)
          VALUES (?, ?, ?, 1)
        `;

        db.query(insertFileQuery, [user_id, original_name, file_type], (err4, result) => {
          if (err4) {
            return res.status(500).json({ message: 'File insert failed', error: err4.message });
          }

          const file_id = result.insertId;

          const insertVersionQuery = `
            INSERT INTO file_versions
            (file_id, version_number, s3_url, file_size, file_hash)
            VALUES (?, ?, ?, ?, ?)
          `;

          db.query(insertVersionQuery, [file_id, 1, s3_url, file_size, file_hash], (err5) => {
            if (err5) {
              return res.status(500).json({ message: 'Version save failed', error: err5.message });
            }

            return res.status(201).json({
              message: 'File uploaded (v1)',
              file: { file_id, original_name, version: 1 }
            });
          });
        });
      }
    });

  } catch (error) {
    console.log("S3 FULL ERROR:", error);
    return res.status(500).json({
      message: 'Upload failed',
      error: error.message
    });
  }
};

// ===============================
// RESTORE FILE VERSION
// ===============================
const restoreFileVersion = (req, res) => {
  const { file_id, version_number } = req.body;

  const checkQuery = `
    SELECT * FROM file_versions
    WHERE file_id = ? AND version_number = ?
  `;

  db.query(checkQuery, [file_id, version_number], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Error checking version', error: err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'Version not found' });
    }

    const updateQuery = `
      UPDATE files SET latest_version = ?
      WHERE file_id = ?
    `;

    db.query(updateQuery, [version_number, file_id], (err2) => {
      if (err2) {
        return res.status(500).json({ message: 'Restore failed', error: err2.message });
      }

      return res.status(200).json({
        message: `Version ${version_number} restored successfully`
      });
    });
  });
};

// ===============================
// GET FILE VERSIONS
// ===============================
const getFileVersions = (req, res) => {
  const { file_id } = req.params;

  const query = `
    SELECT file_id, version_id, version_number, s3_url, file_size, file_hash, created_at
    FROM file_versions
    WHERE file_id = ?
    ORDER BY version_number DESC
  `;

  db.query(query, [file_id], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Fetch failed', error: err.message });
    }

    res.status(200).json({
      versions: results
    });
  });
};

// ===============================
// GET USER FILES
// ===============================
const getUserFiles = (req, res) => {
  const { user_id } = req.params;

  const query = `SELECT * FROM files WHERE user_id = ?`;

  db.query(query, [user_id], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Fetch failed', error: err.message });
    }

    res.status(200).json({
      files: results
    });
  });
};
const getBackupHistory = (req, res) => {
  const { file_id } = req.params;

  const query = `
    SELECT history_id, file_id, version_id, action_type, note, action_time
    FROM backup_history
    WHERE file_id = ?
    ORDER BY action_time DESC
  `;

  db.query(query, [file_id], (err, results) => {
    if (err) {
      return res.status(500).json({
        message: 'Failed to fetch backup history',
        error: err.message
      });
    }

    res.status(200).json({
      history: results
    });
  });
};
const suggestBackupFrequency = (req, res) => {
  const { user_id } = req.params;

  const query = `
    SELECT COUNT(*) AS upload_count
    FROM files
    WHERE user_id = ?
    AND created_at >= NOW() - INTERVAL 7 DAY
  `;

  db.query(query, [user_id], (err, results) => {
    if (err) {
      return res.status(500).json({
        message: 'Analysis failed',
        error: err.message
      });
    }

    const uploadCount = results[0].upload_count;
    let suggestion = '';

    if (uploadCount >= 5) {
      suggestion = 'Daily Backup Recommended';
    } else if (uploadCount >= 2) {
      suggestion = 'Weekly Backup Recommended';
    } else {
      suggestion = 'Monthly Backup Recommended';
    }

    res.status(200).json({
      uploads_last_7_days: uploadCount,
      suggestion
    });
  });
};
module.exports = {
  uploadFile,
  restoreFileVersion,
  getFileVersions,
  getUserFiles,
  getBackupHistory,
  suggestBackupFrequency
};
