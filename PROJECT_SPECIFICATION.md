# University Attendance Management System - Project Specification

  

## Overview

A QR code-based attendance management system for university sessions that uses Google Drive as the database backend, with built-in anti-cheating mechanisms and location verification.

  

---

  

## System Architecture

  

### Data Storage

- **Backend**: Google Drive serves as the database

- **Storage Structure**: Hierarchical folders and Google Sheets

- **Access**: Teachers grant the app Drive API permissions to create and manage folders/sheets automatically

  

---

  

## Features & Workflows

  

### 1. Teacher Module

  

#### 1.1 Session Types

The system supports three types of teaching sessions:

- **Lecture**: Large class sessions

- **TD (Travaux Dirigés)**: Tutorial/discussion sessions

- **Lab (Travaux Pratiques)**: Laboratory/practical sessions

  

#### 1.2 QR Code Generation

  

##### A. Scheduled Sessions (Pre-configured)

When a teacher has already scheduled their timetable:

  

**For Lectures:**

- App automatically creates folder structure: `Year/Section/Lecture/`

- Example: `2025-2026/Year-2/Section-1/Lectures/"Lecture_Name"`

  

**For TD/Lab:**

- App automatically creates folder structure: `Year/Group/TD_or_Lab/`

- Example: `2025-2026/Year-2/Group-A/TD/`

  

**Process:**

1. Teacher selects the scheduled session from timetable

2. App generates unique QR code with session metadata

3. App creates corresponding Google Sheet in the appropriate Drive folder

4. QR code is displayed for students to scan

  

##### B. On-the-Fly Sessions (Unscheduled)

When a teacher needs to generate a QR code without prior scheduling:

  

**Process:**

1. Teacher clicks "Generate QR Code"

2. App prompts for session details:

   - Session type (Lecture/TD/Lab)

   - Year level

   - Section (for Lectures) OR Group (for TD/Lab)

   - Subject name

   - Date and time

3. App saves this configuration for future use

4. App creates the folder structure (if it doesn't exist)

5. App generates QR code and creates attendance sheet

6. Next time this specific session occurs, teacher can select it from saved sessions

  

#### 1.3 Drive Folder Structure

  

```

Google Drive Root/

├── Attendance-2025-2026/

│   ├── Year-1/

│   │   ├── Section-1/

│   │   │   └── Lectures/

│   │   │       ├── Mathematics_2026-02-13.xlsx

│   │   │       └── Physics_2026-02-14.xlsx

│   │   ├── Group-A/

│   │   │   ├── TD/

│   │   │   │   └── Programming_TD_2026-02-13.xlsx

│   │   │   └── Lab/

│   │   │       └── Electronics_Lab_2026-02-15.xlsx

│   │   └── Group-B/

│   │       ├── TD/

│   │       └── Lab/

│   └── Year-2/

│       ├── Section-1/

│       ├── Section-2/

│       └── ...

└── Cheating-Logs/

    └── violations_log.xlsx

```

#### 1.4 Teacher Dashboard

The teacher dashboard serves as the central hub for managing all attendance-related activities, providing a comprehensive view of sessions, schedules, and attendance records.

##### Dashboard Overview

**Main Sections:**

1. **Home/Overview**
   - Quick stats: Today's sessions, upcoming sessions, recent attendance rates
   - Quick action button: "Generate QR Code Now"
   - Recent activity feed
   - Attendance alerts (low attendance warnings, flagged students)

2. **Schedule Management**
   - **Weekly/Monthly Calendar View**: Visual timetable showing all scheduled sessions
   - **Add New Schedule**: Create recurring sessions (weekly patterns)
   - **Edit Existing Sessions**: Modify session details, time, location
   - **Session Details Include**:
     - Session type (Lecture/TD/Lab)
     - Subject name
     - Year and Section/Group
     - Day and Time
     - Classroom location (GPS coordinates for geofencing)
     - Duration
     - Recurrence pattern (weekly, bi-weekly, custom)

3. **QR Code Generation Hub**
   - **Scheduled Sessions**: List of today's and upcoming sessions with one-click QR generation
   - **Saved Sessions**: Previously created sessions that can be quickly reused
   - **Quick Generate**: Create on-the-fly session QR codes
   - **Active QR Codes**: Currently active QR codes with countdown timers and student count
   - **QR History**: Archive of past generated QR codes

4. **Attendance Records**
   - **By Session**: View attendance for specific sessions
   - **By Student**: Track individual student attendance across all sessions
   - **By Course**: Overall attendance statistics per course
   - **Filters**: Date range, session type, year/group
   - **Export Options**: Download as Excel, PDF, CSV
   - **Real-time Updates**: Live attendance count as students scan

5. **My Courses**
   - List of all courses taught by the teacher
   - Each course displays:
     - Total sessions conducted
     - Average attendance rate
     - Number of students enrolled
     - Quick access to course folders in Drive
     - Link to specific year/section/group folders

6. **Analytics & Reports**
   - **Attendance Trends**: Graphs showing attendance over time
   - **Student Performance**: Identify students with low attendance
   - **Session Comparison**: Compare attendance across different session types
   - **Monthly Reports**: Automated summary reports
   - **Downloadable Charts**: Export visualizations

7. **Cheating Logs Access** (Authorized Teachers/Admins only)
   - View flagged students and violations
   - Filter by violation type, date, course
   - Review location violations and duplicate device attempts
   - Export cheating reports

8. **Settings & Preferences**
   - Profile management
   - Google Drive integration settings
   - Default session configurations
   - Notification preferences
   - Geofence radius customization (default: 100m)
   - QR code validity duration

##### Dashboard Features

**Search & Filter Capabilities:**
- Search by student name, email, session name, or date
- Multi-level filtering (year, section, group, session type)
- Quick date range selectors (Today, This Week, This Month, Custom)

**Notifications:**
- Session reminders (15 min before scheduled class)
- Low attendance alerts
- Suspicious activity notifications
- System updates and announcements

**Bulk Operations:**
- Generate QR codes for multiple sessions at once
- Export attendance for multiple sessions
- Send attendance summaries to students via email

**Mobile Responsive:**
- Full dashboard access on tablets and smartphones
- Optimized QR generation interface for mobile
- Touch-friendly session scheduling

##### User Interface Layout

```
┌─────────────────────────────────────────────────────────────┐
│  [Logo] Teacher Dashboard        [Profile] [Notifications]  │
├─────────────────────────────────────────────────────────────┤
│  📊 Overview  |  📅 Schedule  |  🔲 QR Codes  |  📈 Reports  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Today's Sessions                    Quick Actions           │
│  ┌──────────────────────┐           ┌──────────────┐        │
│  │ 📚 Mathematics       │           │ Generate QR  │        │
│  │ Year 2, Section 1    │           └──────────────┘        │
│  │ 10:00 - 12:00        │           ┌──────────────┐        │
│  │ [Generate QR]        │           │ View Reports │        │
│  └──────────────────────┘           └──────────────┘        │
│                                                               │
│  Recent Attendance                  Upcoming Sessions        │
│  ┌──────────────────────┐           ┌──────────────┐        │
│  │ 📊 85% Average       │           │ Tomorrow      │        │
│  │ Last 7 days          │           └──────────────┘        │
│  └──────────────────────┘                                    │
│                                                               │
│  Alerts & Notifications                                      │
│  ⚠️ 5 students flagged in Physics Lab (Feb 13)             │
│  ℹ️ Low attendance in TD Session (68%)                     │
└─────────────────────────────────────────────────────────────┘
```

##### Dashboard Workflows

**Scenario 1: Scheduled Session**
1. Teacher logs into dashboard
2. Sees today's "Mathematics Lecture" at 10:00 AM
3. Clicks "Generate QR" button
4. QR code appears with live student count
5. Students scan and count updates in real-time
6. After session, teacher reviews attendance directly from dashboard

**Scenario 2: Creating New Schedule**
1. Navigate to "Schedule" tab
2. Click "Add New Schedule"
3. Fill in session details (type, subject, year, group, time, location)
4. Set recurrence (e.g., "Every Monday 10:00-12:00")
5. Save - folders automatically created in Drive
6. Session appears in calendar view

**Scenario 3: Reviewing Attendance**
1. Go to "Attendance Records" → "By Course"
2. Select "Programming Course - Year 1"
3. View attendance table with all students
4. Filter by date range or session type
5. Export to Excel for grading purposes

---

  

### 2. Student Module

  

#### 2.1 Attendance Submission Process

  

**Step-by-step Flow:**

1. Student scans the QR code displayed by teacher

2. App opens attendance form requesting:

   - Full Name

   - University Email Address

3. Student submits the form

  

#### 2.2 Background Security Checks (Transparent to Student)

  

Upon submission, the app automatically captures and validates:

  

| Security Check | Data Collected | Purpose |

|---------------|----------------|---------|

| **IP Address** | Device IP | Prevent multiple submissions from same device |

| **MAC Address** | Device MAC | Unique device identification |

| **GPS Location** | Latitude/Longitude | Verify physical presence |

| **Timestamp** | Submission time | Prevent late/early submissions |

  

---

  

### 3. Anti-Cheating System

  

#### 3.1 Location Verification

- **Geofencing**: Creates a virtual circular boundary (radius = 100 meters) around the classroom location

- **Validation**: Student's GPS location must be within this 100m radius

- **Action if Outside Radius**:

  - Mark as **FLAGGED** in cheating logs

  - Do NOT mark attendance as present

  - Log the actual distance from classroom

  

#### 3.2 Duplicate Detection

- **IP/MAC Tracking**: Detects if multiple students submit from the same device

- **Action on Duplicate**:

  - Flag all students associated with that IP/MAC address

  - Log both the submitter and the potentially cheating students

  - Do NOT mark any of them as present

  

#### 3.3 Cheating Logs

  

**Log Structure:**

| Timestamp | Student Name | Email | Violation Type | Details | Distance (m) | IP Address | MAC Address |

|-----------|--------------|-------|----------------|---------|--------------|------------|-------------|

| 2026-02-13 10:15 | John Doe | john@uni.edu | Location Violation | Outside geofence | 450m | 192.168.1.5 | AA:BB:CC:DD:EE:FF |

| 2026-02-13 10:16 | Jane Smith | jane@uni.edu | Duplicate Device | Same IP/MAC as John Doe | 0m | 192.168.1.5 | AA:BB:CC:DD:EE:FF |

  

**Violation Types:**

1. **Location Violation**: Student > 100m from classroom

2. **Duplicate Device**: Multiple submissions from same IP/MAC

3. **Suspicious Pattern**: Multiple flags for same student

4. **Time Violation**: Submission outside valid time window

  

**Important**:

- Violations are logged silently (students don't see rejection messages)

- Flagged students appear unmarked in attendance sheet

- Only teachers/admins can access cheating logs

  

---

  

## Technical Requirements

  

### 4.1 Teacher App Requirements

- Google Drive API integration with OAuth 2.0

- QR Code generation library

- User authentication system

- Session management and scheduling interface

- Drive folder/sheet auto-creation capability

  

### 4.2 Student App Requirements

- QR Code scanner

- GPS/Location services access

- Network interface access (for IP/MAC collection)

- Web form interface

- Background data submission

  

### 4.3 Security & Privacy

- **Data Encryption**: All data transmitted over HTTPS

- **Permission Model**:

  - Students: Limited to attendance submission

  - Teachers: Read/Write access to their course folders

  - Admins: Full access including cheating logs

- **GDPR Compliance**:

  - Clear consent for location tracking

  - Data retention policies

  - Right to access collected data

  

### 4.4 Platform Options

- **Web Application**: React/Vue.js + Node.js backend



  

---

  

## Data Flow Diagram

  

```

Teacher Side:

[Teacher Login] → [Select/Create Session] → [Generate QR Code]

                                                    ↓

                                    [Create Drive Folder/Sheet]

                                                    ↓

                                        [Display QR Code]

  

Student Side:

[Scan QR Code] → [Enter Details] → [Submit Form]

                                        ↓

                        [Capture: IP, MAC, GPS, Timestamp]

                                        ↓

                            [Validation Engine]

                                ↙             ↘

                        [Valid]           [Invalid]

                            ↓                   ↓

                [Mark Present]      [Log to Cheating Logs]

                        ↓                   ↓

            [Update Drive Sheet]    [Flag Student(s)]

```

  

---

  

## Implementation Phases

  

### Phase 1: Core Infrastructure (Weeks 1-3)

- [ ] Set up Google Drive API integration

- [ ] Create authentication system for teachers

- [ ] Implement basic folder structure creation

- [ ] Develop QR code generation functionality

  

### Phase 2: Student Module (Weeks 4-5)

- [ ] Build QR scanner interface

- [ ] Create attendance submission form

- [ ] Implement data capture (IP, MAC, GPS)

- [ ] Connect to Drive sheet updates

  

### Phase 3: Security Features (Weeks 6-7)

- [ ] Implement geofencing logic

- [ ] Build duplicate detection system

- [ ] Create cheating logs infrastructure

- [ ] Add silent flagging mechanism

  

### Phase 4: Scheduling & UX (Weeks 8-9)

- [ ] Develop session scheduling interface

- [ ] Create saved sessions functionality

- [ ] Build teacher dashboard

- [ ] Implement reporting features

  

### Phase 5: Testing & Deployment (Weeks 10-12)

- [ ] Security testing and penetration testing

- [ ] User acceptance testing with pilot group

- [ ] Performance optimization

- [ ] Production deployment

  

---

  

## Success Metrics

  

- **Attendance Accuracy**: >95% correlation with manual attendance

- **Fraud Detection Rate**: Identify >90% of cheating attempts

- **User Adoption**: >80% of teachers use system within first semester

- **System Uptime**: 99.5% availability during class hours

- **Student Satisfaction**: <30 seconds average submission time

  

---

  

## Future Enhancements

  

1. **AI-Based Anomaly Detection**: Machine learning to identify suspicious patterns

2. **Facial Recognition**: Optional photo capture during attendance

3. **Bluetooth Beacons**: More accurate indoor location tracking

4. **Analytics Dashboard**: Attendance trends and insights

5. **Integration**: Connect with university's existing student information system

6. **Reporting**: Automated attendance reports and grade integration

7. **Multi-language Support**: Interface in multiple languages

  

---

  

## Risk Mitigation

  

| Risk | Impact | Mitigation Strategy |

|------|--------|---------------------|

| GPS Spoofing | High | Cross-reference with IP geolocation, add Bluetooth beacons |

| Drive API Quota Limits | Medium | Implement caching, batch operations |

| Privacy Concerns | High | Clear privacy policy, minimal data collection, data retention limits |

| Network Failures | Medium | Offline mode with sync when connected |

| Student Devices Without GPS | Medium | Fallback to IP-based location with manual review |

  

---

  

## Conclusion

  

This attendance management system provides a modern, automated solution that:

- ✅ Reduces manual attendance overhead for teachers

- ✅ Provides audit trail through Google Drive

- ✅ Prevents common cheating methods

- ✅ Maintains student privacy while ensuring security

- ✅ Scales across different session types and class sizes

  

**Next Steps**: Review this specification with stakeholders, validate technical feasibility, and begin Phase 1 implementation.