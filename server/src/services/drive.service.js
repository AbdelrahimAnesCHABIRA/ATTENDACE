const { google } = require('googleapis');
const config = require('../config');

/**
 * Google Drive Service
 * Handles all interactions with Google Drive API
 */
class DriveService {
  constructor(accessToken) {
    const auth = new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      config.google.redirectUri
    );
    auth.setCredentials({ access_token: accessToken });

    this.drive = google.drive({ version: 'v3', auth });
    this.sheets = google.sheets({ version: 'v4', auth });
  }

  /**
   * Create a folder in Google Drive
   */
  async createFolder(name, parentId = null) {
    const fileMetadata = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
    };
    if (parentId) {
      fileMetadata.parents = [parentId];
    }

    const response = await this.drive.files.create({
      resource: fileMetadata,
      fields: 'id, name, webViewLink',
    });

    return response.data;
  }

  /**
   * Find a folder by name under a parent
   */
  async findFolder(name, parentId = null) {
    let query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    if (parentId) {
      query += ` and '${parentId}' in parents`;
    }

    const response = await this.drive.files.list({
      q: query,
      fields: 'files(id, name, webViewLink)',
      spaces: 'drive',
    });

    return response.data.files.length > 0 ? response.data.files[0] : null;
  }

  /**
   * Find or create a folder (ensures idempotency)
   */
  async findOrCreateFolder(name, parentId = null) {
    const existing = await this.findFolder(name, parentId);
    if (existing) return existing;
    return this.createFolder(name, parentId);
  }

  /**
   * Create the full folder structure for a session
   * Returns the leaf folder ID
   */
  async createFolderStructure(sessionType, year, sectionOrGroup, academicYear) {
    // Root: Attendance-2025-2026
    const rootFolder = await this.findOrCreateFolder(`Attendance-${academicYear}`);

    // Year level: Year-1, Year-2, etc.
    const yearFolder = await this.findOrCreateFolder(`Year-${year}`, rootFolder.id);

    if (sessionType === 'lecture') {
      // Section folder: Section-1, Section-2
      const sectionFolder = await this.findOrCreateFolder(
        `Section-${sectionOrGroup}`,
        yearFolder.id
      );
      // Lectures folder
      const lectureFolder = await this.findOrCreateFolder('Lectures', sectionFolder.id);
      return lectureFolder;
    } else {
      // Group folder: Group-A, Group-B
      const groupFolder = await this.findOrCreateFolder(
        `Group-${sectionOrGroup}`,
        yearFolder.id
      );
      // TD or Lab folder
      const typeFolder = await this.findOrCreateFolder(
        sessionType === 'td' ? 'TD' : 'Lab',
        groupFolder.id
      );
      return typeFolder;
    }
  }

  /**
   * Create a Google Spreadsheet for attendance with professional formatting
   */
  async createAttendanceSheet(title, folderId) {
    // Create spreadsheet with two sheets
    const spreadsheet = await this.sheets.spreadsheets.create({
      resource: {
        properties: {
          title,
          locale: 'en_US',
        },
        sheets: [
          {
            properties: {
              title: 'Attendance',
              sheetId: 0,
              gridProperties: { frozenRowCount: 2 },
            },
          },
          {
            properties: {
              title: 'Summary',
              sheetId: 1,
              gridProperties: { frozenRowCount: 1 },
            },
          },
        ],
      },
    });

    const spreadsheetId = spreadsheet.data.spreadsheetId;

    // Move to correct folder
    await this.drive.files.update({
      fileId: spreadsheetId,
      addParents: folderId,
      fields: 'id, parents',
    });

    // Parse session info from title (e.g., "Math_LECTURE_2026-02-14")
    const titleParts = title.split('_');
    const subjectName = titleParts[0] || 'N/A';
    const sessionType = titleParts[1] || 'N/A';
    const sessionDate = titleParts[2] || new Date().toISOString().split('T')[0];

    // Write title row + headers
    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Attendance!A1:H2',
      valueInputOption: 'RAW',
      resource: {
        values: [
          [`📋 ${subjectName} — ${sessionType} — ${sessionDate}`, '', '', '', '', '', '', ''],
          ['#', 'Student Name', 'Email', 'Status', 'Time', 'IP Address', 'GPS Lat', 'GPS Lng'],
        ],
      },
    });

    // Write Summary sheet
    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Summary!A1:B8',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [
          ['📊 Session Summary', ''],
          ['', ''],
          ['Subject', subjectName],
          ['Type', sessionType],
          ['Date', sessionDate],
          ['Total Present', '=COUNTIF(Attendance!D:D,"PRESENT")'],
          ['Total Flagged', '=COUNTIF(Attendance!D:D,"FLAGGED")'],
          ['Total Students', '=COUNTA(Attendance!B:B)-1'],
        ],
      },
    });

    // Apply formatting
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          // ── Attendance Sheet ──

          // Merge title row A1:H1
          {
            mergeCells: {
              range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 8 },
              mergeType: 'MERGE_ALL',
            },
          },
          // Title row style: dark blue bg, white bold text, 14pt
          {
            repeatCell: {
              range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 8 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.12, green: 0.25, blue: 0.69 },
                  textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 14 },
                  horizontalAlignment: 'CENTER',
                  verticalAlignment: 'MIDDLE',
                  padding: { top: 8, bottom: 8 },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,padding)',
            },
          },
          // Header row style: medium blue bg, white bold text, 10pt
          {
            repeatCell: {
              range: { sheetId: 0, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 8 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.23, green: 0.51, blue: 0.96 },
                  textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 10 },
                  horizontalAlignment: 'CENTER',
                  verticalAlignment: 'MIDDLE',
                  padding: { top: 4, bottom: 4 },
                  borders: {
                    bottom: { style: 'SOLID_MEDIUM', color: { red: 0.12, green: 0.25, blue: 0.69 } },
                  },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,padding,borders)',
            },
          },
          // Column widths: #=40, Name=200, Email=220, Status=90, Time=160, IP=130, Lat=100, Lng=100
          ...[40, 200, 220, 90, 160, 130, 100, 100].map((width, i) => ({
            updateDimensionProperties: {
              range: { sheetId: 0, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
              properties: { pixelSize: width },
              fields: 'pixelSize',
            },
          })),
          // Title row height
          {
            updateDimensionProperties: {
              range: { sheetId: 0, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
              properties: { pixelSize: 44 },
              fields: 'pixelSize',
            },
          },
          // Header row height
          {
            updateDimensionProperties: {
              range: { sheetId: 0, dimension: 'ROWS', startIndex: 1, endIndex: 2 },
              properties: { pixelSize: 32 },
              fields: 'pixelSize',
            },
          },
          // Conditional formatting: PRESENT → green bg
          {
            addConditionalFormatRule: {
              rule: {
                ranges: [{ sheetId: 0, startRowIndex: 2, startColumnIndex: 3, endColumnIndex: 4 }],
                booleanRule: {
                  condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: 'PRESENT' }] },
                  format: {
                    backgroundColor: { red: 0.82, green: 0.94, blue: 0.83 },
                    textFormat: { foregroundColor: { red: 0.1, green: 0.45, blue: 0.15 }, bold: true },
                  },
                },
              },
              index: 0,
            },
          },
          // Conditional formatting: FLAGGED → red bg
          {
            addConditionalFormatRule: {
              rule: {
                ranges: [{ sheetId: 0, startRowIndex: 2, startColumnIndex: 3, endColumnIndex: 4 }],
                booleanRule: {
                  condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: 'FLAGGED' }] },
                  format: {
                    backgroundColor: { red: 0.96, green: 0.82, blue: 0.82 },
                    textFormat: { foregroundColor: { red: 0.7, green: 0.1, blue: 0.1 }, bold: true },
                  },
                },
              },
              index: 1,
            },
          },
          // Alternating row colors for data rows
          {
            addBanding: {
              bandedRange: {
                range: { sheetId: 0, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: 8 },
                rowProperties: {
                  headerColor: { red: 0.23, green: 0.51, blue: 0.96 },
                  firstBandColor: { red: 1, green: 1, blue: 1 },
                  secondBandColor: { red: 0.94, green: 0.96, blue: 0.99 },
                },
              },
            },
          },

          // ── Summary Sheet ──

          // Merge summary title A1:B1
          {
            mergeCells: {
              range: { sheetId: 1, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 2 },
              mergeType: 'MERGE_ALL',
            },
          },
          // Summary title style
          {
            repeatCell: {
              range: { sheetId: 1, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 2 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.12, green: 0.25, blue: 0.69 },
                  textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 13 },
                  horizontalAlignment: 'CENTER',
                  verticalAlignment: 'MIDDLE',
                  padding: { top: 6, bottom: 6 },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,padding)',
            },
          },
          // Summary labels bold
          {
            repeatCell: {
              range: { sheetId: 1, startRowIndex: 2, endRowIndex: 8, startColumnIndex: 0, endColumnIndex: 1 },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true, fontSize: 11 },
                  padding: { top: 4, bottom: 4, left: 8 },
                },
              },
              fields: 'userEnteredFormat(textFormat,padding)',
            },
          },
          // Summary values
          {
            repeatCell: {
              range: { sheetId: 1, startRowIndex: 2, endRowIndex: 8, startColumnIndex: 1, endColumnIndex: 2 },
              cell: {
                userEnteredFormat: {
                  textFormat: { fontSize: 11 },
                  padding: { top: 4, bottom: 4 },
                },
              },
              fields: 'userEnteredFormat(textFormat,padding)',
            },
          },
          // Summary column widths
          {
            updateDimensionProperties: {
              range: { sheetId: 1, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
              properties: { pixelSize: 160 },
              fields: 'pixelSize',
            },
          },
          {
            updateDimensionProperties: {
              range: { sheetId: 1, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 },
              properties: { pixelSize: 200 },
              fields: 'pixelSize',
            },
          },
          // Summary title row height
          {
            updateDimensionProperties: {
              range: { sheetId: 1, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
              properties: { pixelSize: 40 },
              fields: 'pixelSize',
            },
          },
        ],
      },
    });

    return {
      spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
    };
  }

  /**
   * Append attendance record to spreadsheet
   */
  async appendAttendanceRecord(spreadsheetId, record) {
    // Get current row count to calculate student number
    let rowNum = '?';
    try {
      const existing = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Attendance!A:A',
      });
      rowNum = (existing.data.values?.length || 2) - 1; // subtract title + header
    } catch (e) { /* fallback */ }

    // Format time as readable string
    const time = new Date(record.timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
    });

    await this.sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Attendance!A:H',
      valueInputOption: 'RAW',
      resource: {
        values: [
          [
            rowNum,
            record.studentName,
            record.email,
            record.status,
            time,
            record.ipAddress,
            record.latitude,
            record.longitude,
          ],
        ],
      },
    });
  }

  /**
   * Create or get Cheating Logs spreadsheet
   */
  async getOrCreateCheatingLog(academicYear) {
    const rootFolder = await this.findOrCreateFolder(`Attendance-${academicYear}`);
    const cheatingFolder = await this.findOrCreateFolder('Cheating-Logs', rootFolder.id);

    // Check if violations log already exists
    const query = `name='violations_log' and '${cheatingFolder.id}' in parents and trashed=false`;
    const response = await this.drive.files.list({
      q: query,
      fields: 'files(id, name)',
    });

    if (response.data.files.length > 0) {
      return response.data.files[0].id;
    }

    // Create new violations log with professional formatting
    const spreadsheet = await this.sheets.spreadsheets.create({
      resource: {
        properties: { title: 'violations_log' },
        sheets: [
          {
            properties: {
              title: 'Violations',
              sheetId: 0,
              gridProperties: { frozenRowCount: 2 },
            },
          },
        ],
      },
    });

    const spreadsheetId = spreadsheet.data.spreadsheetId;

    await this.drive.files.update({
      fileId: spreadsheetId,
      addParents: cheatingFolder.id,
      fields: 'id, parents',
    });

    // Title + headers
    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Violations!A1:H2',
      valueInputOption: 'RAW',
      resource: {
        values: [
          ['🚨 Anti-Cheating Violation Log', '', '', '', '', '', '', ''],
          ['#', 'Student Name', 'Email', 'Violation Type', 'Details', 'Distance (m)', 'IP Address', 'Timestamp'],
        ],
      },
    });

    // Apply formatting
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          // Merge title row
          {
            mergeCells: {
              range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 8 },
              mergeType: 'MERGE_ALL',
            },
          },
          // Title style: dark red bg, white bold
          {
            repeatCell: {
              range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 8 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.7, green: 0.1, blue: 0.1 },
                  textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 13 },
                  horizontalAlignment: 'CENTER',
                  verticalAlignment: 'MIDDLE',
                  padding: { top: 6, bottom: 6 },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,padding)',
            },
          },
          // Header row: medium red bg, white bold
          {
            repeatCell: {
              range: { sheetId: 0, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 8 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.86, green: 0.15, blue: 0.15 },
                  textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 10 },
                  horizontalAlignment: 'CENTER',
                  verticalAlignment: 'MIDDLE',
                  padding: { top: 4, bottom: 4 },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,padding)',
            },
          },
          // Column widths
          ...[40, 180, 220, 140, 220, 90, 130, 160].map((width, i) => ({
            updateDimensionProperties: {
              range: { sheetId: 0, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
              properties: { pixelSize: width },
              fields: 'pixelSize',
            },
          })),
          // Title row height
          {
            updateDimensionProperties: {
              range: { sheetId: 0, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
              properties: { pixelSize: 40 },
              fields: 'pixelSize',
            },
          },
          // Alternating rows
          {
            addBanding: {
              bandedRange: {
                range: { sheetId: 0, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: 8 },
                rowProperties: {
                  headerColor: { red: 0.86, green: 0.15, blue: 0.15 },
                  firstBandColor: { red: 1, green: 1, blue: 1 },
                  secondBandColor: { red: 0.99, green: 0.93, blue: 0.93 },
                },
              },
            },
          },
        ],
      },
    });

    return spreadsheetId;
  }

  /**
   * Log a cheating violation
   */
  async logViolation(spreadsheetId, violation) {
    // Get row number
    let rowNum = '?';
    try {
      const existing = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Violations!A:A',
      });
      rowNum = (existing.data.values?.length || 2) - 1;
    } catch (e) { /* fallback */ }

    const time = new Date(violation.timestamp).toLocaleString('en-US', {
      dateStyle: 'short', timeStyle: 'medium',
    });

    await this.sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Violations!A:H',
      valueInputOption: 'RAW',
      resource: {
        values: [
          [
            rowNum,
            violation.studentName,
            violation.email,
            violation.violationType,
            violation.details,
            violation.distance || 'N/A',
            violation.ipAddress,
            time,
          ],
        ],
      },
    });
  }

  /**
   * Read all attendance records from a spreadsheet
   */
  async readAttendanceSheet(spreadsheetId) {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Attendance!A:H',
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) return [];

    const headers = rows[0];
    return rows.slice(1).map(row => {
      const record = {};
      headers.forEach((header, i) => {
        record[header] = row[i] || '';
      });
      return record;
    });
  }

  /**
   * List all files in a folder
   */
  async listFilesInFolder(folderId) {
    const response = await this.drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id, name, mimeType, webViewLink, createdTime)',
      orderBy: 'createdTime desc',
    });

    return response.data.files;
  }
}

module.exports = DriveService;
