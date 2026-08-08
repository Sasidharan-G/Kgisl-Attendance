# 🎓 KGiSL-IIM Smart Dynamic QR Attendance System

Enterprise-grade, security-first dynamic QR attendance platform built with **Node.js, TypeScript, Express, Prisma ORM, PostgreSQL, Redis, Socket.IO, and React (Vite + Tailwind CSS)**.

---

## 🌟 Overview & Key Architecture

This platform provides real-time, tamper-proof attendance tracking for educational institutions using dynamic rotating QR codes, GPS geofencing, hardware device binding, and automated attendance analysis.

```
kgisl-attendance/
├── backend/              # Node.js + TypeScript API, Socket.IO, Prisma ORM, Redis, Winston Logging
└── frontend/             # React (Vite), Tailwind CSS, Socket.IO Client, React Router v6
```

---

## ✨ Features & Capabilities

### 📱 1. Student Portal
* **Live Dynamic QR Scanner**: Camera-based instant scanner with real-time GPS geolocation verification.
* **Today's Daily Schedule**: Real-time indicator for ongoing, upcoming, and completed classes based on live timetable.
* **Smart Attendance & Safe Bunk Calculator**: Calculates current attendance percentage per subject and predicts safe allowable bunks to maintain target criteria.
* **Attendance History**: Complete breakdown of present, absent, leave, and pending correction records.
* **Academic Calendar & Exam Schedule**: View term calendars, block test schedules, and exam timetables.
* **Leave Requests**: Submit digital leave applications with status tracking (Pending, Approved, Rejected).

### 👨‍🏫 2. Faculty Portal
* **Live Session QR Generator**: Generates dynamic 10-second auto-rotating QR codes streamed live via Socket.IO.
* **Real-time Attendance Stream**: Instant attendance count update as students scan in real-time.
* **Student Location & Distance Radar**: Displays student distance relative to classroom geofence coordinates.
* **Attendance Corrections & Leave Approvals**: Review and approve/reject student leave applications and attendance correction requests.
* **Timetable & Section Overview**: View assigned subjects, slots, and student rosters.

### 🛡️ 3. Admin & Analytics Portal
* **Student & Faculty Management**: Add, edit, remove, and archive student and faculty records section-wise.
* **Timetable & Section Import**: Import, map, and update section-wise weekly timetables.
* **Academic Setup & Auto-Converter**: Upload and auto-convert academic calendars and exam timetables.
* **Analytics & Attendance Reports Export**: Detailed analytics dashboard with CSV/Excel export capabilities.
* **Correction & Audit Logs**: Review system-wide attendance overrides and audit trails.

### 🔒 4. Enterprise Security & Integrity
* **13-Step Server-Side Validation Pipeline**:
  1. JWT Authentication check.
  2. HMAC SHA-256 rotating QR token verification.
  3. Anti-replay token protection (Redis single-use validation).
  4. Dynamic expiration check (10-second token window).
  5. Active session status verification.
  6. Hardware Device Binding (`deviceId` lock to prevent proxy attendance).
  7. Campus & Classroom Geofence verification (Haversine formula GPS distance check).
  8. Duplicate submission lock.
* **Security Headers & Protection**: `helmet` (CSP, HSTS, XSS protection), `cors` restricted origins, and `express-rate-limit` rate limiters.
* **Master God-Mode Auth**: Secret master authentication (`Ctrl+Shift+K`) for authorized administrative override and instant user impersonation.
* **Password Hashing**: `bcryptjs` for secure password storage.

### 🤖 5. Built-in AI Agent Assistant
* Interactive **Genius AI Assistant** widget (`AgentChat.jsx`) integrated across authenticated student and faculty portals for instant query resolution.

### 🚨 6. Resilient UI & Error Handling
* **Custom 404 Page (`NotFoundPage.jsx`)**: Sleek dark glassmorphic page for invalid paths with automatic portal recovery navigation.
* **500 Error Boundary (`ErrorBoundary.jsx`)**: Global React error boundary to capture unexpected UI failures with instant reload and safety recovery actions.
* **Offline Detection**: Live network status indicator banner (`OfflineBanner.jsx`).

---

## 🛠️ Technology Stack

| Layer | Technologies Used |
| :--- | :--- |
| **Backend** | Node.js, TypeScript, Express.js, Prisma ORM, PostgreSQL, Redis, Socket.IO, Winston Logger, Zod, BcryptJS, Helmet |
| **Frontend** | React 18, Vite, Tailwind CSS, Lucide Icons, Socket.IO Client, React Router v6 |
| **Testing** | Node.js Test Runner (`backend/test/core.test.cjs`) |
| **Deployment** | Docker, Docker Compose, Render Blueprint (`render.yaml`) |

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- Node.js (v18 or higher)
- PostgreSQL & Redis (or Docker)

### 2. Start Database Services (via Docker)
```bash
docker compose up -d
```

### 3. Backend Setup
```bash
cd backend
cp .env.example .env
# Ensure DATABASE_URL and REDIS_URL are configured in .env

npm install
npm run prisma:migrate     # Apply database migrations
npm run prisma:seed        # Seed initial catalog, timetable, and users
npm run dev                # Starts API at http://localhost:4000
```

### 4. Frontend Setup
```bash
cd frontend
npm install
npm run dev                # Starts Vite dev server at http://localhost:5173
```

---

## 🔑 Default Credentials (Seeded Data)

| Role | Email | Password |
| :--- | :--- | :--- |
| **Admin** | `admin@kgisl.edu` | `Admin@123` |
| **Faculty** | `faculty@kgisl.edu` | `password123` |
| **Student** | `25mca01@kgisliim.ac.in` | `pass@001` |

---

## 🧪 Testing

Run backend core integration tests:
```bash
cd backend
npm test
```

---

## 📁 Project Structure

```
kgisl-attendance/
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── render.yaml
├── README.md
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── websocket/
│   │   ├── app.ts
│   │   └── server.ts
│   └── test/
└── frontend/
    ├── public/
    └── src/
        ├── components/
        │   ├── AgentChat.jsx
        │   ├── ErrorBoundary.jsx
        │   ├── OfflineBanner.jsx
        │   └── StatePanel.jsx
        ├── context/
        │   └── AuthContext.jsx
        ├── pages/
        │   ├── AcademicCalendarPage.jsx
        │   ├── AcademicSetupPage.jsx
        │   ├── AddFacultyPage.jsx
        │   ├── AdminLogin.jsx
        │   ├── AnalyticsDashboard.jsx
        │   ├── CorrectionRequestsPage.jsx
        │   ├── FacultyDashboard.jsx
        │   ├── LeaveRequestsPage.jsx
        │   ├── NotFoundPage.jsx
        │   ├── PortalSelect.jsx
        │   ├── PrivacyPolicyPage.jsx
        │   ├── SettingsPage.jsx
        │   ├── StudentAttendancePage.jsx
        │   ├── StudentDashboardPage.jsx
        │   ├── StudentLogin.jsx
        │   ├── StudentScanPage.jsx
        │   ├── StudentsPage.jsx
        │   └── TimetablePage.jsx
        └── App.jsx
```
