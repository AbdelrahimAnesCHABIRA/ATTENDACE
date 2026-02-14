const fs = require('fs');
const path = require('path');
const cache = require('./cache.service');

/**
 * JSON file-based store with in-memory cache.
 * Reads hit cache; writes update cache and debounce to disk.
 */

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getFilePath(storeName) {
  return path.join(DATA_DIR, `${storeName}.json`);
}

function readFromDisk(storeName) {
  const filePath = getFilePath(storeName);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify([], null, 2));
    return [];
  }
  const data = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(data);
}

function writeToDisk(storeName, data) {
  const filePath = getFilePath(storeName);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Cached read — returns data from memory, falls back to disk
function readStore(storeName) {
  return cache.get(storeName, () => readFromDisk(storeName));
}

// Cached write — updates memory immediately, debounces disk write
function writeStore(storeName, data) {
  cache.set(storeName, data, (d) => writeToDisk(storeName, d));
}

// Force immediate disk write (for critical data)
function writeStoreImmediate(storeName, data) {
  cache.set(storeName, data, (d) => writeToDisk(storeName, d));
  cache.flush(storeName, (d) => writeToDisk(storeName, d));
}

// Teacher store
function getTeacherStore() {
  return readStore('teachers');
}

function saveTeacherStore(data) {
  writeStore('teachers', data);
}

function findTeacherByEmail(email) {
  const teachers = getTeacherStore();
  return teachers.find(t => t.email === email);
}

function findTeacherById(id) {
  const teachers = getTeacherStore();
  return teachers.find(t => t.id === id);
}

function addTeacher(teacher) {
  const teachers = getTeacherStore();
  teachers.push(teacher);
  writeStoreImmediate('teachers', teachers); // critical — flush immediately
  return teacher;
}

function updateTeacher(id, updates) {
  const teachers = getTeacherStore();
  const index = teachers.findIndex(t => t.id === id);
  if (index === -1) return null;
  teachers[index] = { ...teachers[index], ...updates };
  writeStoreImmediate('teachers', teachers); // critical — flush immediately
  return teachers[index];
}

// Session store (active QR sessions)
function getSessionStore() {
  return readStore('sessions');
}

function saveSessionStore(data) {
  writeStore('sessions', data);
}

// Schedule store
function getScheduleStore() {
  return readStore('schedules');
}

function saveScheduleStore(data) {
  writeStore('schedules', data);
}

// Attendance records store
function getAttendanceStore() {
  return readStore('attendance');
}

function saveAttendanceStore(data) {
  writeStore('attendance', data);
}

// Cheating logs store
function getCheatingStore() {
  return readStore('cheating_logs');
}

function saveCheatingStore(data) {
  writeStore('cheating_logs', data);
}

// Courses store
function getCourseStore() {
  return readStore('courses');
}

function saveCourseStore(data) {
  writeStore('courses', data);
}

// Flush all pending writes to disk (call on shutdown)
function flushAllStores() {
  const writers = {};
  ['teachers', 'sessions', 'schedules', 'attendance', 'cheating_logs', 'courses'].forEach(name => {
    writers[name] = (d) => writeToDisk(name, d);
  });
  cache.flushAll(writers);
}

module.exports = {
  getTeacherStore,
  saveTeacherStore,
  findTeacherByEmail,
  findTeacherById,
  addTeacher,
  updateTeacher,
  getSessionStore,
  saveSessionStore,
  getScheduleStore,
  saveScheduleStore,
  getAttendanceStore,
  saveAttendanceStore,
  getCheatingStore,
  saveCheatingStore,
  getCourseStore,
  saveCourseStore,
  flushAllStores,
};
