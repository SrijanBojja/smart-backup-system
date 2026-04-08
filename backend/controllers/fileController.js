const db = require('../config/db');
const fs = require('fs');
const crypto = require('crypto');

const uploadFile = (req, res) => {
    const user_id = req.body.user_id;

    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    const original_name = req.file.originalname;
    const file_type = req.file.mimetype;
    const file_size = req.file.size;
    const localFilePath = req.file.path;

    // Generate file hash
    const fileBuffer = fs.readFileSync(localFilePath);
    const file_hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Temporary local path as s3_url
    const s3_url = localFilePath;

    // Step 1: Check if file already exists for this user
    const checkFileQuery = `
        SELECT * FROM files 
        WHERE user_id = ? AND original_name = ?
    `;

    db.query(checkFileQuery, [user_id, original_name], (err, fileResults) => {
        if (err) {
            return res.status(500).json({ message: 'File check failed', error: err.message });
        }

        // ============================
        // CASE 1: FILE ALREADY EXISTS
        // ============================
        if (fileResults.length > 0) {
            const existingFile = fileResults[0];
            const file_id = existingFile.file_id;
            const nextVersion = existingFile.latest_version + 1;

            // Update latest version in files table
            const updateFileQuery = `
                UPDATE files 
                SET latest_version = ? 
                WHERE file_id = ?
            `;

            db.query(updateFileQuery, [nextVersion, file_id], (err2) => {
                if (err2) {
                    return res.status(500).json({ message: 'Failed to update file version', error: err2.message });
                }

                // Insert new version into file_versions
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
                        message: `New file version uploaded successfully`,
                        file: {
                            file_id,
                            original_name,
                            version: nextVersion,
                            file_type
                        }
                    });
                });
            });
        }

        // ============================
        // CASE 2: NEW FILE
        // ============================
        else {
            const insertFileQuery = `
                INSERT INTO files (user_id, original_name, file_type, latest_version)
                VALUES (?, ?, ?, 1)
            `;

            db.query(insertFileQuery, [user_id, original_name, file_type], (err4, result) => {
                if (err4) {
                    return res.status(500).json({ message: 'File upload failed', error: err4.message });
                }

                const file_id = result.insertId;

                const insertVersionQuery = `
                    INSERT INTO file_versions 
                    (file_id, version_number, s3_url, file_size, file_hash)
                    VALUES (?, ?, ?, ?, ?)
                `;

                db.query(insertVersionQuery, [file_id, 1, s3_url, file_size, file_hash], (err5) => {
                    if (err5) {
                        return res.status(500).json({ message: 'Initial version save failed', error: err5.message });
                    }

                    return res.status(201).json({
                        message: 'File uploaded successfully as Version 1',
                        file: {
                            file_id,
                            original_name,
                            version: 1,
                            file_type
                        }
                    });
                });
            });
        }
    });
};
const restoreFileVersion = (req, res) => {
    const { file_id, version_number } = req.body;

    if (!file_id || !version_number) {
        return res.status(400).json({ message: 'file_id and version_number are required' });
    }

    // Step 1: Check if that version exists
    const checkVersionQuery = `
        SELECT * FROM file_versions
        WHERE file_id = ? AND version_number = ?
    `;

    db.query(checkVersionQuery, [file_id, version_number], (err, results) => {
        if (err) {
            return res.status(500).json({ message: 'Version check failed', error: err.message });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'Requested version not found' });
        }

        const versionData = results[0];

        // Step 2: Mark that version as restored
        const restoreQuery = `
            UPDATE file_versions
            SET is_restored = TRUE
            WHERE file_id = ? AND version_number = ?
        `;

        db.query(restoreQuery, [file_id, version_number], (err2) => {
            if (err2) {
                return res.status(500).json({ message: 'Restore failed', error: err2.message });
            }

            // Step 3: Save restore action in backup_history
            const historyQuery = `
                INSERT INTO backup_history (file_id, version_id, action_type, notes)
                VALUES (?, ?, 'RESTORE', ?)
            `;

            const noteText = `Restored Version ${version_number}`;

            db.query(historyQuery, [file_id, versionData.version_id, noteText], (err3) => {
                if (err3) {
                    return res.status(500).json({ message: 'Restore history save failed', error: err3.message });
                }

                return res.status(200).json({
                    message: `Version ${version_number} restored successfully`,
                    restored_file: {
                        file_id,
                        version_number,
                        s3_url: versionData.s3_url,
                        file_hash: versionData.file_hash
                    }
                });
            });
        });
    });
};
// Get all versions of a file
const getFileVersions = (req, res) => {
    const { file_id } = req.params;

    const query = `
        SELECT version_id, version_number, s3_url, file_size, file_hash, created_at
        FROM file_versions
        WHERE file_id = ?
        ORDER BY version_number DESC
    `;

    db.query(query, [file_id], (err, results) => {
        if (err) {
            return res.status(500).json({
                message: 'Failed to fetch file versions',
                error: err.message
            });
        }

        res.status(200).json({
            message: 'File versions fetched successfully',
            versions: results
        });
    });
};

// Get backup history / timeline
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
            message: 'Backup history fetched successfully',
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
                message: 'Failed to analyze backup frequency',
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
            message: 'Backup frequency suggestion generated successfully',
            user_id,
            uploads_last_7_days: uploadCount,
            suggestion
        });
    });
};
module.exports = {
    uploadFile,
    restoreFileVersion,
    getFileVersions,
    getBackupHistory,
    suggestBackupFrequency
};