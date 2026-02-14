const express = require('express');
const { body } = require('express-validator');
const { authenticate, requireTeacher } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const ScheduleService = require('../services/schedule.service');

const router = express.Router();

/**
 * POST /api/schedules
 * Create a new schedule
 */
router.post(
  '/',
  authenticate,
  requireTeacher,
  [
    body('sessionType').isIn(['lecture', 'td', 'lab']),
    body('subjectName').notEmpty(),
    body('year').isInt({ min: 1, max: 5 }),
    body('sectionOrGroup').notEmpty(),
    body('dayOfWeek').isInt({ min: 0, max: 6 }),
    body('startTime').matches(/^\d{2}:\d{2}$/),
    body('endTime').matches(/^\d{2}:\d{2}$/),
  ],
  validate,
  (req, res) => {
    const schedule = ScheduleService.createSchedule({
      ...req.body,
      teacherId: req.user.id,
    });
    res.status(201).json({ schedule });
  }
);

/**
 * GET /api/schedules
 * Get all schedules for current teacher
 */
router.get('/', authenticate, requireTeacher, (req, res) => {
  const schedules = ScheduleService.getSchedulesForTeacher(req.user.id);
  res.json({ schedules });
});

/**
 * GET /api/schedules/today
 * Get today's scheduled sessions
 */
router.get('/today', authenticate, requireTeacher, (req, res) => {
  const schedules = ScheduleService.getTodaySchedules(req.user.id);
  res.json({ schedules });
});

/**
 * GET /api/schedules/upcoming
 * Get upcoming sessions (next 7 days)
 */
router.get('/upcoming', authenticate, requireTeacher, (req, res) => {
  const schedules = ScheduleService.getUpcomingSchedules(req.user.id);
  res.json({ schedules });
});

/**
 * GET /api/schedules/:id
 * Get a specific schedule
 */
router.get('/:id', authenticate, requireTeacher, (req, res) => {
  const schedule = ScheduleService.getScheduleById(req.params.id);
  if (!schedule || schedule.teacherId !== req.user.id) {
    return res.status(404).json({ error: 'Schedule not found' });
  }
  res.json({ schedule });
});

/**
 * PUT /api/schedules/:id
 * Update a schedule
 */
router.put('/:id', authenticate, requireTeacher, (req, res) => {
  const updated = ScheduleService.updateSchedule(req.params.id, req.user.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Schedule not found' });
  }
  res.json({ schedule: updated });
});

/**
 * DELETE /api/schedules/:id
 * Delete a schedule
 */
router.delete('/:id', authenticate, requireTeacher, (req, res) => {
  const deleted = ScheduleService.deleteSchedule(req.params.id, req.user.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Schedule not found' });
  }
  res.json({ success: true, message: 'Schedule deleted' });
});

module.exports = router;
