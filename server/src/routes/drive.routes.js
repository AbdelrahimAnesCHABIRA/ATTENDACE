const express = require('express');
const { authenticate, requireTeacher } = require('../middleware/auth.middleware');
const DriveService = require('../services/drive.service');
const { findTeacherById } = require('../services/store.service');
const config = require('../config');

const router = express.Router();

/**
 * GET /api/drive/folders
 * List root attendance folder structure
 */
router.get('/folders', authenticate, requireTeacher, async (req, res) => {
  try {
    const teacher = findTeacherById(req.user.id);
    if (!teacher || !teacher.googleTokens) {
      return res.status(401).json({ error: 'Google Drive not connected' });
    }

    const driveService = new DriveService(teacher.googleTokens.access_token);
    const rootFolder = await driveService.findFolder(`Attendance-${config.academicYear}`);

    if (!rootFolder) {
      return res.json({ folders: [], message: 'No attendance folders found' });
    }

    const subFolders = await driveService.listFilesInFolder(rootFolder.id);
    res.json({ rootFolder, subFolders });
  } catch (error) {
    console.error('Drive folders error:', error);
    res.status(500).json({ error: 'Failed to list Drive folders' });
  }
});

/**
 * GET /api/drive/folder/:folderId/files
 * List files in a specific folder
 */
router.get('/folder/:folderId/files', authenticate, requireTeacher, async (req, res) => {
  try {
    const teacher = findTeacherById(req.user.id);
    if (!teacher || !teacher.googleTokens) {
      return res.status(401).json({ error: 'Google Drive not connected' });
    }

    const driveService = new DriveService(teacher.googleTokens.access_token);
    const files = await driveService.listFilesInFolder(req.params.folderId);
    res.json({ files });
  } catch (error) {
    console.error('Drive files error:', error);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

/**
 * GET /api/drive/sheet/:spreadsheetId
 * Read attendance data from a spreadsheet
 */
router.get('/sheet/:spreadsheetId', authenticate, requireTeacher, async (req, res) => {
  try {
    const teacher = findTeacherById(req.user.id);
    if (!teacher || !teacher.googleTokens) {
      return res.status(401).json({ error: 'Google Drive not connected' });
    }

    const driveService = new DriveService(teacher.googleTokens.access_token);
    const records = await driveService.readAttendanceSheet(req.params.spreadsheetId);
    res.json({ records, total: records.length });
  } catch (error) {
    console.error('Drive sheet error:', error);
    res.status(500).json({ error: 'Failed to read spreadsheet' });
  }
});

module.exports = router;
