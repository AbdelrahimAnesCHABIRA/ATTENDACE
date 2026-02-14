const { v4: uuidv4 } = require('uuid');
const { getScheduleStore, saveScheduleStore } = require('./store.service');

/**
 * Schedule Service
 * Manages recurring session schedules for teachers
 */
class ScheduleService {
  /**
   * Create a new schedule
   */
  static createSchedule(scheduleData) {
    const schedule = {
      id: uuidv4(),
      teacherId: scheduleData.teacherId,
      sessionType: scheduleData.sessionType,       // lecture, td, lab
      subjectName: scheduleData.subjectName,
      year: scheduleData.year,
      sectionOrGroup: scheduleData.sectionOrGroup,
      dayOfWeek: scheduleData.dayOfWeek,             // 0=Sunday, 1=Monday, ...
      startTime: scheduleData.startTime,             // "10:00"
      endTime: scheduleData.endTime,                 // "12:00"
      classroomLocation: scheduleData.classroomLocation, // { lat, lng }
      classroomName: scheduleData.classroomName || '',
      recurrence: scheduleData.recurrence || 'weekly', // weekly, biweekly, custom
      geofenceRadius: scheduleData.geofenceRadius || 100,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const schedules = getScheduleStore();
    schedules.push(schedule);
    saveScheduleStore(schedules);

    return schedule;
  }

  /**
   * Get all schedules for a teacher
   */
  static getSchedulesForTeacher(teacherId) {
    const schedules = getScheduleStore();
    return schedules.filter(s => s.teacherId === teacherId && s.isActive);
  }

  /**
   * Get today's scheduled sessions for a teacher
   */
  static getTodaySchedules(teacherId) {
    const today = new Date().getDay(); // 0=Sunday
    const schedules = this.getSchedulesForTeacher(teacherId);
    return schedules.filter(s => s.dayOfWeek === today);
  }

  /**
   * Get upcoming sessions (next 7 days)
   */
  static getUpcomingSchedules(teacherId) {
    const schedules = this.getSchedulesForTeacher(teacherId);
    const today = new Date().getDay();
    const upcoming = [];

    for (let i = 0; i < 7; i++) {
      const dayOfWeek = (today + i) % 7;
      const daySessions = schedules.filter(s => s.dayOfWeek === dayOfWeek);
      daySessions.forEach(s => {
        upcoming.push({
          ...s,
          daysFromNow: i,
          date: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        });
      });
    }

    return upcoming;
  }

  /**
   * Update a schedule
   */
  static updateSchedule(scheduleId, teacherId, updates) {
    const schedules = getScheduleStore();
    const index = schedules.findIndex(s => s.id === scheduleId && s.teacherId === teacherId);
    if (index === -1) return null;

    schedules[index] = { ...schedules[index], ...updates, updatedAt: new Date().toISOString() };
    saveScheduleStore(schedules);
    return schedules[index];
  }

  /**
   * Delete a schedule (soft delete)
   */
  static deleteSchedule(scheduleId, teacherId) {
    const schedules = getScheduleStore();
    const index = schedules.findIndex(s => s.id === scheduleId && s.teacherId === teacherId);
    if (index === -1) return false;

    schedules[index].isActive = false;
    schedules[index].deletedAt = new Date().toISOString();
    saveScheduleStore(schedules);
    return true;
  }

  /**
   * Get schedule by ID
   */
  static getScheduleById(scheduleId) {
    const schedules = getScheduleStore();
    return schedules.find(s => s.id === scheduleId);
  }
}

module.exports = ScheduleService;
