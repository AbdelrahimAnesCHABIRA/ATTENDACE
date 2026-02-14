# University Attendance Management System

A QR code-based attendance management system for university sessions with Google Drive as the database backend, built-in anti-cheating mechanisms, and location verification.

## Features

- **QR Code Generation** — Teachers generate unique QR codes for each session
- **Google Drive Integration** — Attendance sheets auto-created in organized Drive folders
- **Geofencing** — Validates student GPS location within 100m of classroom
- **Anti-Cheating** — Detects duplicate devices (IP/MAC), location spoofing, and suspicious patterns
- **Silent Flagging** — Cheating students are flagged without notification
- **Teacher Dashboard** — Overview, schedule management, analytics, and reports
- **Student Module** — Simple QR scan → submit attendance flow
- **Real-time Tracking** — Live attendee count during active sessions
- **Export** — CSV/Excel export for attendance records

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, React Router, Recharts, Lucide Icons |
| **Backend** | Node.js, Express |
| **Database** | Google Drive (Sheets + Folders) + Local JSON store |
| **Auth** | Google OAuth 2.0 + JWT |
| **QR** | qrcode (server), html5-qrcode (client scanner) |
| **Location** | HTML5 Geolocation API + geolib |

## Project Structure

```
ATTENDANCE/
├── client/                    # React frontend
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   └── DashboardLayout.js
│   │   ├── context/
│   │   │   └── AuthContext.js
│   │   ├── pages/
│   │   │   ├── Login.js
│   │   │   ├── AuthCallback.js
│   │   │   ├── Dashboard.js
│   │   │   ├── Schedule.js
│   │   │   ├── QRCodes.js
│   │   │   ├── AttendanceRecords.js
│   │   │   ├── Analytics.js
│   │   │   ├── CheatingLogs.js
│   │   │   ├── Settings.js
│   │   │   └── StudentAttendance.js
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.js
│   │   ├── index.js
│   │   └── index.css
│   └── package.json
├── server/                    # Express backend
│   ├── src/
│   │   ├── config/
│   │   │   └── index.js
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js
│   │   │   └── validate.middleware.js
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   ├── session.routes.js
│   │   │   ├── attendance.routes.js
│   │   │   ├── schedule.routes.js
│   │   │   ├── analytics.routes.js
│   │   │   ├── cheating.routes.js
│   │   │   └── drive.routes.js
│   │   ├── services/
│   │   │   ├── store.service.js
│   │   │   ├── drive.service.js
│   │   │   ├── session.service.js
│   │   │   ├── schedule.service.js
│   │   │   └── anticheating.service.js
│   │   └── index.js
│   ├── data/                  # Local JSON data store
│   ├── .env.example
│   └── package.json
├── PROJECT_SPECIFICATION.md
├── package.json
└── .gitignore
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Google Cloud Console project with OAuth 2.0 credentials
- Google Drive API and Google Sheets API enabled

### 1. Setup Google Cloud

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable **Google Drive API** and **Google Sheets API**
4. Create **OAuth 2.0 credentials** (Web application type)
5. Add authorized redirect URI: `http://localhost:5000/api/auth/google/callback`
6. Copy your Client ID and Client Secret

### 2. Configure Environment

```bash
# Copy environment template
cd server
cp .env.example .env

# Edit .env and fill in your Google credentials
# GOOGLE_CLIENT_ID=your_client_id
# GOOGLE_CLIENT_SECRET=your_client_secret
```

### 3. Install Dependencies

```bash
# Install all dependencies (root, server, client)
npm run install:all
```

### 4. Run Development

```bash
# Start both server and client
npm run dev
```

- **Backend**: http://localhost:5000
- **Frontend**: http://localhost:3000

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/google` | Get Google OAuth URL |
| GET | `/api/auth/google/callback` | OAuth callback handler |
| GET | `/api/auth/me` | Get current user |
| PUT | `/api/auth/settings` | Update user settings |

### Sessions (QR Codes)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sessions/generate` | Generate QR code |
| GET | `/api/sessions/active` | Get active sessions |
| GET | `/api/sessions/history` | Get session history |
| POST | `/api/sessions/:id/deactivate` | Stop a session |
| POST | `/api/sessions/:id/extend` | Extend session time |

### Attendance
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/attendance/submit` | Submit attendance (student) |
| GET | `/api/attendance/session/:id` | Get session records |
| GET | `/api/attendance/student/:email` | Get student records |
| GET | `/api/attendance/stats` | Get overall stats |

### Schedules
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/schedules` | Create schedule |
| GET | `/api/schedules` | Get all schedules |
| GET | `/api/schedules/today` | Today's sessions |
| GET | `/api/schedules/upcoming` | Next 7 days |
| PUT | `/api/schedules/:id` | Update schedule |
| DELETE | `/api/schedules/:id` | Delete schedule |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/overview` | Dashboard stats |
| GET | `/api/analytics/trends` | Attendance trends |
| GET | `/api/analytics/courses` | Per-course stats |
| GET | `/api/analytics/low-attendance` | Low attendance students |

### Cheating Logs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cheating/violations` | Get violations |
| GET | `/api/cheating/suspicious` | Suspicious students |
| GET | `/api/cheating/stats` | Cheating stats |

## Google Drive Folder Structure

When teachers generate QR codes, the app automatically creates:

```
Google Drive/
├── Attendance-2025-2026/
│   ├── Year-1/
│   │   ├── Section-1/
│   │   │   └── Lectures/
│   │   │       └── Mathematics_LECTURE_2026-02-14.xlsx
│   │   ├── Group-A/
│   │   │   ├── TD/
│   │   │   └── Lab/
│   │   └── Group-B/
│   └── Year-2/
└── Cheating-Logs/
    └── violations_log.xlsx
```

## Anti-Cheating System

| Check | Method | Action |
|-------|--------|--------|
| **Location** | GPS geofencing (100m radius) | Flag if outside boundary |
| **Duplicate Device** | IP address tracking | Flag all associated students |
| **Time Window** | Submission timestamp | Flag if outside valid period |
| **Silent Flagging** | No error shown to student | Logged for teacher review |

## License

MIT
