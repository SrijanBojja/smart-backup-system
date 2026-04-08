const express = require('express');
const router = express.Router();

const {
    uploadFile,
    restoreFileVersion,
    getFileVersions,
    getBackupHistory,
    suggestBackupFrequency
} = require('../controllers/fileController');
const upload = require('../middleware/uploadMiddleware');


// Upload file
router.post('/upload', upload.single('file'), uploadFile);

// Restore file version
router.post('/restore', restoreFileVersion);

// Get all versions of a file
router.get('/versions/:file_id', getFileVersions);

// Get backup history of a file
router.get('/history/:file_id', getBackupHistory);

// Suggest backup frequency for a user
router.get('/suggest/:user_id', suggestBackupFrequency);
module.exports = router;