import React, { useState, useEffect } from 'react';
import { scheduleAPI } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, Edit2, CalendarDays, Clock, MapPin, X } from 'lucide-react';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SESSION_TYPES = ['lecture', 'td', 'lab'];

const emptyForm = {
  sessionType: 'lecture',
  subjectName: '',
  year: 1,
  sectionOrGroup: '',
  dayOfWeek: 1,
  startTime: '08:00',
  endTime: '10:00',
  classroomName: '',
  classroomLocation: { lat: '', lng: '' },
  recurrence: 'weekly',
  geofenceRadius: 100,
};

export default function Schedule() {
  const [schedules, setSchedules] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);

  const fetchSchedules = async () => {
    try {
      const res = await scheduleAPI.getAll();
      setSchedules(res.data.schedules || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSchedules(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...form,
        year: parseInt(form.year),
        dayOfWeek: parseInt(form.dayOfWeek),
        geofenceRadius: parseInt(form.geofenceRadius),
        classroomLocation:
          form.classroomLocation.lat && form.classroomLocation.lng
            ? { lat: parseFloat(form.classroomLocation.lat), lng: parseFloat(form.classroomLocation.lng) }
            : null,
      };

      if (editingId) {
        await scheduleAPI.update(editingId, data);
        toast.success('Schedule updated');
      } else {
        await scheduleAPI.create(data);
        toast.success('Schedule created');
      }

      setShowModal(false);
      setEditingId(null);
      setForm(emptyForm);
      fetchSchedules();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save schedule');
    }
  };

  const handleEdit = (schedule) => {
    setForm({
      ...schedule,
      classroomLocation: schedule.classroomLocation || { lat: '', lng: '' },
    });
    setEditingId(schedule.id);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this schedule?')) return;
    try {
      await scheduleAPI.delete(id);
      toast.success('Schedule deleted');
      fetchSchedules();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  // Group schedules by day
  const groupedByDay = {};
  schedules.forEach(s => {
    if (!groupedByDay[s.dayOfWeek]) groupedByDay[s.dayOfWeek] = [];
    groupedByDay[s.dayOfWeek].push(s);
  });

  if (loading) {
    return <div className="loading-container"><div className="spinner" /><p>Loading schedules...</p></div>;
  }

  return (
    <div className="fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Schedule Management</h2>
          <p>Manage your weekly teaching schedule</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(emptyForm); setEditingId(null); setShowModal(true); }}>
          <Plus size={18} /> Add Schedule
        </button>
      </div>

      {/* Weekly View */}
      {schedules.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <CalendarDays size={48} />
            <h3>No schedules yet</h3>
            <p>Create your first schedule by clicking "Add Schedule"</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {[1, 2, 3, 4, 5, 6, 0].map(day => {
            const daySessions = groupedByDay[day];
            if (!daySessions) return null;
            return (
              <div key={day} className="card">
                <h3 className="card-title" style={{ marginBottom: 16 }}>{DAYS[day]}</h3>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Subject</th>
                        <th>Type</th>
                        <th>Year</th>
                        <th>Section/Group</th>
                        <th>Time</th>
                        <th>Classroom</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {daySessions.sort((a, b) => a.startTime.localeCompare(b.startTime)).map(s => (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 600 }}>{s.subjectName}</td>
                          <td>
                            <span className={`badge ${s.sessionType === 'lecture' ? 'badge-info' : s.sessionType === 'td' ? 'badge-warning' : 'badge-success'}`}>
                              {s.sessionType.toUpperCase()}
                            </span>
                          </td>
                          <td>Year {s.year}</td>
                          <td>{s.sectionOrGroup}</td>
                          <td>
                            <Clock size={12} style={{ marginRight: 4 }} />
                            {s.startTime} - {s.endTime}
                          </td>
                          <td>{s.classroomName || '—'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(s)}>
                                <Edit2 size={14} />
                              </button>
                              <button className="btn btn-sm btn-danger" onClick={() => handleDelete(s.id)}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3 className="modal-title">{editingId ? 'Edit Schedule' : 'Add New Schedule'}</h3>
              <button className="btn-icon" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Session Type</label>
                  <select className="form-select" value={form.sessionType} onChange={e => setForm({ ...form, sessionType: e.target.value })}>
                    {SESSION_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Subject Name</label>
                  <input className="form-input" value={form.subjectName} onChange={e => setForm({ ...form, subjectName: e.target.value })} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Year</label>
                  <select className="form-select" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })}>
                    {[1,2,3,4,5].map(y => <option key={y} value={y}>Year {y}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{form.sessionType === 'lecture' ? 'Section' : 'Group'}</label>
                  <input className="form-input" value={form.sectionOrGroup} onChange={e => setForm({ ...form, sectionOrGroup: e.target.value })} placeholder={form.sessionType === 'lecture' ? 'e.g. 1' : 'e.g. A'} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Day of Week</label>
                  <select className="form-select" value={form.dayOfWeek} onChange={e => setForm({ ...form, dayOfWeek: e.target.value })}>
                    {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Recurrence</label>
                  <select className="form-select" value={form.recurrence} onChange={e => setForm({ ...form, recurrence: e.target.value })}>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-weekly</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Start Time</label>
                  <input type="time" className="form-input" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">End Time</label>
                  <input type="time" className="form-input" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} required />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Classroom Name</label>
                <input className="form-input" value={form.classroomName} onChange={e => setForm({ ...form, classroomName: e.target.value })} placeholder="e.g. Room 301" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label"><MapPin size={12} /> Classroom Latitude</label>
                  <input type="number" step="any" className="form-input" value={form.classroomLocation.lat} onChange={e => setForm({ ...form, classroomLocation: { ...form.classroomLocation, lat: e.target.value } })} placeholder="e.g. 36.7525" />
                </div>
                <div className="form-group">
                  <label className="form-label"><MapPin size={12} /> Classroom Longitude</label>
                  <input type="number" step="any" className="form-input" value={form.classroomLocation.lng} onChange={e => setForm({ ...form, classroomLocation: { ...form.classroomLocation, lng: e.target.value } })} placeholder="e.g. 3.0420" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Geofence Radius (meters)</label>
                <input type="number" className="form-input" value={form.geofenceRadius} onChange={e => setForm({ ...form, geofenceRadius: e.target.value })} min="10" max="1000" />
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingId ? 'Update' : 'Create'} Schedule</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
