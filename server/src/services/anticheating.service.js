const geolib = require('geolib');
const config = require('../config');
const { getAttendanceStore, saveAttendanceStore, getCheatingStore, saveCheatingStore } = require('./store.service');

/**
 * Anti-Cheating Service
 * Handles location verification, duplicate detection, and violation logging
 */
class AntiCheatingService {
  /**
   * Validate student's location against classroom geofence
   * @returns {{ valid: boolean, distance: number }}
   */
  static validateLocation(studentLocation, classroomLocation, radius) {
    if (!studentLocation || !studentLocation.lat || !studentLocation.lng) {
      return { valid: false, distance: -1, reason: 'No location data' };
    }

    if (!classroomLocation || !classroomLocation.lat || !classroomLocation.lng) {
      // If no classroom location set, skip geofencing
      return { valid: true, distance: 0, reason: 'No classroom location configured' };
    }

    const distance = geolib.getDistance(
      { latitude: studentLocation.lat, longitude: studentLocation.lng },
      { latitude: classroomLocation.lat, longitude: classroomLocation.lng }
    );

    const geofenceRadius = radius || config.defaultGeofenceRadius;

    return {
      valid: distance <= geofenceRadius,
      distance,
      reason: distance > geofenceRadius
        ? `Student is ${distance}m away (limit: ${geofenceRadius}m)`
        : 'Within geofence',
    };
  }

  /**
   * Check for duplicate device (same IP or MAC in same session)
   * @returns {{ isDuplicate: boolean, duplicateOf: string[] }}
   */
  static checkDuplicateDevice(sessionId, ipAddress, macAddress) {
    const attendance = getAttendanceStore();
    const sessionRecords = attendance.filter(r => r.sessionId === sessionId);

    const duplicates = sessionRecords.filter(r =>
      (ipAddress && r.ipAddress === ipAddress) ||
      (macAddress && r.macAddress === macAddress)
    );

    if (duplicates.length > 0) {
      return {
        isDuplicate: true,
        duplicateOf: duplicates.map(d => d.email),
        reason: `Device already used by: ${duplicates.map(d => d.studentName).join(', ')}`,
      };
    }

    return { isDuplicate: false, duplicateOf: [], reason: 'No duplicates found' };
  }

  /**
   * Full validation pipeline for attendance submission
   */
  static async validateSubmission(params) {
    const {
      sessionId,
      studentName,
      email,
      ipAddress,
      macAddress,
      studentLocation,
      classroomLocation,
      geofenceRadius,
    } = params;

    const violations = [];

    // 1. Location validation
    const locationResult = this.validateLocation(
      studentLocation,
      classroomLocation,
      geofenceRadius
    );

    if (!locationResult.valid && locationResult.distance >= 0) {
      violations.push({
        type: 'Location Violation',
        details: locationResult.reason,
        distance: locationResult.distance,
      });
    }

    // 2. Duplicate device detection
    const duplicateResult = this.checkDuplicateDevice(sessionId, ipAddress, macAddress);

    if (duplicateResult.isDuplicate) {
      violations.push({
        type: 'Duplicate Device',
        details: duplicateResult.reason,
        distance: locationResult.distance >= 0 ? locationResult.distance : 0,
      });
    }

    // 3. Log violations if any
    if (violations.length > 0) {
      for (const v of violations) {
        this.logViolation({
          timestamp: new Date().toISOString(),
          sessionId,
          studentName,
          email,
          violationType: v.type,
          details: v.details,
          distance: v.distance,
          ipAddress,
          macAddress,
        });
      }

      // Also flag previous duplicates
      if (duplicateResult.isDuplicate) {
        for (const dupEmail of duplicateResult.duplicateOf) {
          const existingRecord = getAttendanceStore().find(
            r => r.sessionId === sessionId && r.email === dupEmail
          );
          if (existingRecord) {
            this.logViolation({
              timestamp: new Date().toISOString(),
              sessionId,
              studentName: existingRecord.studentName,
              email: dupEmail,
              violationType: 'Duplicate Device',
              details: `Same device used by ${studentName} (${email})`,
              distance: 0,
              ipAddress,
              macAddress,
            });
          }
        }
      }
    }

    return {
      isValid: violations.length === 0,
      violations,
      locationResult,
      duplicateResult,
    };
  }

  /**
   * Log a violation to the cheating store
   */
  static logViolation(violation) {
    const logs = getCheatingStore();
    logs.push({
      id: Date.now().toString(),
      ...violation,
    });
    saveCheatingStore(logs);
  }

  /**
   * Get all violations, optionally filtered
   */
  static getViolations(filters = {}) {
    let logs = getCheatingStore();

    if (filters.sessionId) {
      logs = logs.filter(l => l.sessionId === filters.sessionId);
    }
    if (filters.email) {
      logs = logs.filter(l => l.email === filters.email);
    }
    if (filters.violationType) {
      logs = logs.filter(l => l.violationType === filters.violationType);
    }
    if (filters.startDate) {
      logs = logs.filter(l => new Date(l.timestamp) >= new Date(filters.startDate));
    }
    if (filters.endDate) {
      logs = logs.filter(l => new Date(l.timestamp) <= new Date(filters.endDate));
    }

    return logs;
  }

  /**
   * Get students with multiple violations (suspicious patterns)
   */
  static getSuspiciousStudents(minViolations = 3) {
    const logs = getCheatingStore();
    const violationCount = {};

    logs.forEach(log => {
      if (!violationCount[log.email]) {
        violationCount[log.email] = {
          email: log.email,
          studentName: log.studentName,
          count: 0,
          violations: [],
        };
      }
      violationCount[log.email].count++;
      violationCount[log.email].violations.push(log);
    });

    return Object.values(violationCount)
      .filter(s => s.count >= minViolations)
      .sort((a, b) => b.count - a.count);
  }
}

module.exports = AntiCheatingService;
