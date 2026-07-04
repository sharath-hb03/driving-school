# Multi-Tenant DSMS — Complete Rebuild Prompt (Part by Part)

Use each part **in sequence** in a single conversation. Each part builds on the previous.

---

## PART 1 — Project Overview & Tech Stack

```
Build a multi-tenant Driving School Management System (DSMS) as a Progressive Web App (PWA) deployed on Cloudflare Pages + Pages Functions (Workers) with a D1 (SQLite) database, R2 object storage, and KV cache.

TECH STACK
- Frontend: React + Vite, React Router v6, TailwindCSS, Lucide icons, date-fns, react-hot-toast
- Backend: Cloudflare Pages Functions (edge serverless), D1 SQLite, R2, KV, OneSignal push, Cloudinary (certificates)
- Auth: JWT sessions stored in httpOnly cookies, PBKDF2 password hashing

MULTI-TENANCY MODEL
There are three tiers:

1. SUPER ADMIN (you — the platform owner)
   - Single global super-admin account (seeded, not created through UI)
   - Can create / edit / deactivate Driving Schools
   - Can create / reset admin accounts for each school
   - Has a dedicated dashboard to see all schools, their status, student counts, and revenue at a glance
   - Logs in at /login — the system detects the super_admin role and routes to /super-admin

2. SCHOOL ADMIN (the driving school owner / manager)
   - Scoped to exactly one school (school_id on every row)
   - Full access to their school's data: students, instructors, vehicles, schedule, payments, holidays, enquiries, packages, staff, certificates, vehicle documents
   - Can add staff users (role = 'staff') scoped to the same school
   - Cannot see any other school's data
   - Logs in at /login — system routes to /dashboard

3. SCHOOL STAFF (sub-role inside a school)
   - Same dashboard as admin but without destructive actions (no delete school, no add staff) — match the existing per-role rules from the original system

4. STUDENT PORTAL (role = 'student')
   - Read-only view of their own profile, lessons, fees, licence tracking, certificate
   - Login at /login — routes to /portal

5. INSTRUCTOR PORTAL (role = 'instructor')
   - Calendar of assigned classes, mark attendance, view availability/time-off, manage certificates for their students
   - Login at /login — routes to /portal

KEY CONSTRAINT: Every DB table (except super-admin tables and the schools table itself) MUST have a school_id column that is always set and always filtered in every query. No query may ever return data from a different school. Enforce this at the API middleware level, not just in individual handlers.

IMPORTANT DESIGN RULES
- Keep every page, flow, modal, and UX interaction IDENTICAL to the original single-tenant system for school admins and portals — the only addition is the super-admin tier.
- The app must be installable as a PWA (manifest + service worker).
- Use the same premium design system: brand color #4f46e5 (indigo-600), clean cards, skeleton loaders, confirm dialogs, Lucide icons, Inter/Outfit font from Google Fonts.
- All monetary values displayed in Indian Rupees (₹).
- Mobile-first responsive layout.
```

---

## PART 2 — Database Schema (D1 / SQLite migrations)

```
Write ALL the SQL migration files for the multi-tenant DSMS. Create them as numbered files: 0001_init.sql, 0002_schools.sql, etc.

SCHEMA REQUIREMENTS

--- 0001_init.sql — Core tables ---

PRAGMA foreign_keys = ON;

-- Platform-level super admin (not scoped to any school)
CREATE TABLE IF NOT EXISTS super_admins (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Driving schools (tenants)
CREATE TABLE IF NOT EXISTS schools (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,          -- URL-safe identifier, used in display
  phone         TEXT,
  email         TEXT,
  address       TEXT,
  logo_key      TEXT,                          -- R2 key for school logo
  active        INTEGER NOT NULL DEFAULT 1,    -- 1 = active, 0 = suspended
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- School-level users (admin + staff)
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  school_id     TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'staff',   -- admin | staff
  password_hash TEXT NOT NULL,
  onesignal_subscription_id TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Packages (course offerings), scoped per school
CREATE TABLE IF NOT EXISTS packages (
  id            TEXT PRIMARY KEY,
  school_id     TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  license_type  TEXT NOT NULL DEFAULT 'both',    -- 2W | 4W | both
  fee           REAL NOT NULL DEFAULT 0,
  total_classes INTEGER NOT NULL DEFAULT 10,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Instructors, scoped per school
CREATE TABLE IF NOT EXISTS instructors (
  id            TEXT PRIMARY KEY,
  school_id     TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  phone         TEXT,
  email         TEXT,
  password_hash TEXT,
  license_type  TEXT NOT NULL DEFAULT 'both',
  active        INTEGER NOT NULL DEFAULT 1,
  notes         TEXT,
  work_days     TEXT NOT NULL DEFAULT '1,2,3,4,5,6',
  work_start    TEXT NOT NULL DEFAULT '06:00',
  work_end      TEXT NOT NULL DEFAULT '20:00',
  onesignal_subscription_id TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_instructors_login_email
  ON instructors(email) WHERE password_hash IS NOT NULL;

-- Vehicles, scoped per school
CREATE TABLE IF NOT EXISTS vehicles (
  id             TEXT PRIMARY KEY,
  school_id      TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  vehicle_number TEXT NOT NULL,
  model          TEXT,
  license_type   TEXT NOT NULL DEFAULT '4W',
  status         TEXT NOT NULL DEFAULT 'available',
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Students, scoped per school
CREATE TABLE IF NOT EXISTS students (
  id            TEXT PRIMARY KEY,
  school_id     TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  phone         TEXT,
  email         TEXT,
  password_hash TEXT,
  address       TEXT,
  license_type  TEXT NOT NULL DEFAULT '4W',
  joining_date  TEXT,
  package_id    TEXT REFERENCES packages(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'active',
  photo_key     TEXT,
  notes         TEXT,
  discount      REAL NOT NULL DEFAULT 0,
  ll_number     TEXT,
  ll_test_date  TEXT,
  ll_test_time  TEXT,
  ll_status     TEXT,
  ll_expiry     TEXT,
  ll_instructor_id TEXT REFERENCES instructors(id) ON DELETE SET NULL,
  dl_test_date  TEXT,
  dl_test_time  TEXT,
  dl_status     TEXT,
  dl_number     TEXT,
  dl_expiry     TEXT,
  dl_instructor_id TEXT REFERENCES instructors(id) ON DELETE SET NULL,
  onesignal_subscription_id TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_login_email
  ON students(email) WHERE password_hash IS NOT NULL;

-- Classes (lessons), scoped per school
CREATE TABLE IF NOT EXISTS classes (
  id            TEXT PRIMARY KEY,
  school_id     TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id    TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  instructor_id TEXT REFERENCES instructors(id) ON DELETE SET NULL,
  vehicle_id    TEXT REFERENCES vehicles(id) ON DELETE SET NULL,
  scheduled_at  TEXT NOT NULL,
  duration_min  INTEGER NOT NULL DEFAULT 45,
  status        TEXT NOT NULL DEFAULT 'scheduled',
  notes         TEXT,
  reminded_at   TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Payments, scoped per school
CREATE TABLE IF NOT EXISTS payments (
  id          TEXT PRIMARY KEY,
  school_id   TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id  TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  amount      REAL NOT NULL,
  method      TEXT NOT NULL DEFAULT 'cash',
  paid_at     TEXT NOT NULL DEFAULT (datetime('now')),
  note        TEXT,
  receipt_key TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Holidays, scoped per school
CREATE TABLE IF NOT EXISTS holidays (
  id        TEXT PRIMARY KEY,
  school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  date      TEXT NOT NULL,
  name      TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (school_id, date)
);

-- Instructor time-off, scoped per school
CREATE TABLE IF NOT EXISTS instructor_time_off (
  id            TEXT PRIMARY KEY,
  school_id     TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  instructor_id TEXT NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  start_date    TEXT NOT NULL,
  end_date      TEXT NOT NULL,
  reason        TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (instructor_id, start_date)
);

-- Vehicle documents, scoped per school
CREATE TABLE IF NOT EXISTS vehicle_documents (
  id          TEXT PRIMARY KEY,
  school_id   TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  vehicle_id  TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  doc_type    TEXT NOT NULL,
  provider    TEXT,
  doc_number  TEXT,
  amount      REAL,
  start_date  TEXT,
  expiry_date TEXT NOT NULL,
  file_key    TEXT,
  notes       TEXT,
  reminded_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Certificates, scoped per school
CREATE TABLE IF NOT EXISTS certificates (
  id                   TEXT PRIMARY KEY,
  school_id            TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id           TEXT NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
  package_id           TEXT REFERENCES packages(id) ON DELETE SET NULL,
  certificate_no       TEXT NOT NULL UNIQUE,
  student_name         TEXT NOT NULL,
  course_name          TEXT,
  license_type         TEXT,
  classes_completed    INTEGER,
  total_classes        INTEGER,
  issued_on            TEXT NOT NULL,
  issued_by            TEXT,
  cloudinary_public_id TEXT NOT NULL,
  cloudinary_url       TEXT NOT NULL,
  image_url            TEXT NOT NULL,
  download_url         TEXT NOT NULL,
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Enquiries, scoped per school
CREATE TABLE IF NOT EXISTS enquiries (
  id          TEXT PRIMARY KEY,
  school_id   TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL,
  message     TEXT,
  status      TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','contacted','converted')),
  staff_notes TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Create all needed indexes
CREATE INDEX IF NOT EXISTS idx_users_school       ON users(school_id);
CREATE INDEX IF NOT EXISTS idx_packages_school    ON packages(school_id);
CREATE INDEX IF NOT EXISTS idx_instructors_school ON instructors(school_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_school    ON vehicles(school_id);
CREATE INDEX IF NOT EXISTS idx_students_school    ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_classes_school     ON classes(school_id);
CREATE INDEX IF NOT EXISTS idx_classes_scheduled  ON classes(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_classes_student    ON classes(student_id);
CREATE INDEX IF NOT EXISTS idx_classes_instructor ON classes(instructor_id);
CREATE INDEX IF NOT EXISTS idx_payments_school    ON payments(school_id);
CREATE INDEX IF NOT EXISTS idx_payments_student   ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_holidays_school    ON holidays(school_id);
CREATE INDEX IF NOT EXISTS idx_timeoff_instructor ON instructor_time_off(instructor_id);
CREATE INDEX IF NOT EXISTS idx_vehdocs_vehicle    ON vehicle_documents(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehdocs_expiry     ON vehicle_documents(expiry_date);
CREATE INDEX IF NOT EXISTS idx_enquiries_school   ON enquiries(school_id);
CREATE INDEX IF NOT EXISTS idx_certificates_student ON certificates(student_id);

--- 0002_seed.sql — Super admin seed ---
-- Insert the initial super admin account. Password: change this before production.
-- Password hash format: pbkdf2:<salt>:<hash> (same algorithm used for all users)
-- Generate via: node -e "require('./functions/_lib/auth').hashPassword('yourpassword').then(console.log)"
INSERT OR IGNORE INTO super_admins (id, email, name, password_hash)
VALUES ('super_1', 'admin@dsms.app', 'Super Admin', '<run hash generation and paste here>');
```

---

## PART 3 — Auth System, JWT Middleware & Role-based Routing

```
Build the authentication system for the multi-tenant DSMS. The system has five roles: super_admin, admin, staff, student, instructor.

BACKEND — functions/_lib/auth.js
- PBKDF2 password hashing (same as original): salt:hash in hex, 100,000 iterations, SHA-256
- JWT creation and verification using AUTH_SECRET env var
- JWT payload must include: { id, role, school_id } — school_id is null for super_admin

BACKEND — functions/api/auth/login.js  (POST /api/auth/login)
- Accept { email, password }
- Check super_admins table first (role = 'super_admin', school_id = null)
- Then check users table (role = 'admin' | 'staff', include school_id)
- Then check students table (role = 'student', include school_id)
- Then check instructors table (role = 'instructor', include school_id)
- On match: set httpOnly cookie 'session' with a signed JWT (24h expiry)
- Return { user: { id, name, email, role, school_id, school_name } }

BACKEND — functions/api/_middleware.js
- Run on every /api/* request
- Parse the 'session' cookie and verify JWT
- Attach ctx.data.user = { id, role, school_id }
- If school_id is set, attach ctx.data.schoolId = school_id (used by all handlers)
- If the route is a super_admin-only route (/api/super-admin/*), block non-super_admin users with 403
- If the route is a portal route (/api/portal/*), only allow student and instructor roles
- Otherwise block student and instructor roles from staff routes

FRONTEND — src/context/AuthContext.jsx
- On mount, call GET /api/auth/me to restore session
- The me endpoint returns { user: { id, name, email, role, school_id, school_name } }
- Expose: user, loading, logout()

FRONTEND — src/App.jsx  (routes)
- /login  → Login page (all roles)
- /super-admin  → SuperAdminLayout > SuperAdminDashboard  (requires role = super_admin)
- /super-admin/schools  → SchoolsList  (super_admin only)
- /super-admin/schools/:id  → SchoolDetail  (super_admin only)
- /  → Dashboard  (requires admin | staff)
- /students  → Students
- /students/:id  → StudentDetail
- /schedule  → Schedule
- /payments  → Payments
- /vehicles  → Vehicles
- /instructors  → Instructors
- /holidays  → Holidays
- /enquiries  → Enquiries
- /settings  → Settings
- /portal  → PortalProtected (student or instructor)
- * → redirect to /

FRONTEND — Route guards:
- <SuperAdminProtected> — blocks non-super_admin, wraps with <SuperAdminLayout>
- <SchoolProtected> — blocks student/instructor and super_admin, wraps with <Layout> (the original school layout)
- <PortalProtected> — only student and instructor roles, wraps with <PortalLayout>
- After login, redirect based on role:
  - super_admin → /super-admin
  - admin | staff → /
  - student | instructor → /portal
```

---

## PART 4 — Super Admin Panel

```
Build the super admin panel. This is the platform owner's view — you (Sharath) are the only super admin. Match the premium design style of the rest of the app.

LAYOUT — src/components/SuperAdminLayout.jsx
- Dark sidebar (bg-slate-900) on desktop, bottom tab bar on mobile
- Sidebar nav items: Dashboard (Home icon), Schools (Building2 icon), Sign out
- Top bar: "Super Admin" badge in amber/gold, your name
- The sidebar should feel different from the school admin layout — use a darker, more authoritative aesthetic to signal the elevated privilege level

PAGES

1. src/pages/super-admin/SuperAdminDashboard.jsx  (route: /super-admin)
   - GET /api/super-admin/dashboard
   - Stat cards:
     • Total schools (active / suspended)
     • Total students across all schools
     • Total revenue collected across all schools this month
     • Total classes scheduled today across all schools
   - Table/list of schools with columns: School Name, Admin Email, Students, Revenue This Month, Status (Active / Suspended), Actions
   - Quick actions per school row: "View", "Suspend/Activate"
   - A "+ New School" button that opens the Create School modal

2. src/pages/super-admin/SchoolsList.jsx  (route: /super-admin/schools)
   - Full paginated list of all schools
   - Search by school name
   - Filters: All / Active / Suspended
   - Each school card shows: logo (or avatar initial), name, slug, phone, email, student count, active instructors, created date, status badge
   - Actions on each card: Edit School, Manage Admins, Suspend/Activate, Delete (with confirm dialog)

3. src/pages/super-admin/SchoolDetail.jsx  (route: /super-admin/schools/:id)
   - School info section with edit capability (name, phone, email, address, logo upload)
   - Stats section: total students, active students, instructors, vehicles, revenue this month, total revenue
   - Admin accounts section: list all users with role='admin' scoped to this school
     • Show: name, email, created date, last login (if tracked)
     • Actions: Reset Password (opens modal to set new password), Deactivate
   - "+ Add Admin" button: opens modal with fields: Name, Email, Password, Confirm Password
     • Creates a user row with role='admin', school_id = this school's id
   - Back button to /super-admin/schools

MODALS

CreateSchoolModal:
- Fields: School Name (required), Slug (auto-generated from name, editable), Phone, Email, Address
- On save: POST /api/super-admin/schools → creates school row
- After creation, optionally create the first admin account inline:
  • Admin Name, Admin Email, Admin Password
  • Creates user row with role='admin', school_id = new school's id

EditSchoolModal:
- Same fields as CreateSchoolModal, plus logo upload (R2 via existing upload endpoint)
- PUT /api/super-admin/schools/:id

CreateAdminModal:
- Fields: Name, Email, Password (min 8 chars), Role (admin only for school admins)
- POST /api/super-admin/schools/:schoolId/admins

ResetAdminPasswordModal:
- Fields: New Password, Confirm Password
- PUT /api/super-admin/schools/:schoolId/admins/:userId/reset-password

API ENDPOINTS (functions/api/super-admin/)
All routes require role = super_admin in JWT. No school_id filter needed (these are platform-wide).

GET  /api/super-admin/dashboard
  → aggregate stats + schools list with per-school counts

GET  /api/super-admin/schools
  → all schools with student_count, instructor_count, this_month_revenue

POST /api/super-admin/schools
  → create school (and optionally first admin)

GET  /api/super-admin/schools/:id
  → school detail + stats + admin users list

PUT  /api/super-admin/schools/:id
  → update school fields

DELETE /api/super-admin/schools/:id
  → delete school and all its data (CASCADE) — require confirm

PUT  /api/super-admin/schools/:id/status
  → { active: 0|1 } — suspend or reactivate

GET  /api/super-admin/schools/:id/admins
  → list users with school_id = id

POST /api/super-admin/schools/:id/admins
  → create admin user for this school

PUT  /api/super-admin/schools/:id/admins/:userId/reset-password
  → hash new password and update users row
```

---

## PART 5 — School Admin Panel: Dashboard, Students, Payments, Settings

```
Rebuild the school admin panel. Every page and component must be IDENTICAL in functionality and UX to the original single-tenant version, with only one difference: all API calls and DB queries are automatically scoped to ctx.data.schoolId (set by the auth middleware from the JWT). The frontend never needs to send school_id — it comes from the session.

DASHBOARD — src/pages/Dashboard.jsx
GET /api/dashboard?date=YYYY-MM-DD
Returns for the logged-in user's school_id:
- stats: totalStudents, activeLearners, todayClasses, pendingPaymentsCount, newEnquiries
- stats (this month): newStudentsThisMonth, lessonsCompletedThisMonth, attendanceRate, upcomingClasses7d
- stats (money): collectedThisMonth, collectedLastMonth (for trend arrow), pendingPaymentsAmount, pendingPaymentsCount
- stats (fleet): vehiclesAvailable, vehiclesTotal, instructorsActive
- todayClasses: array of class rows with student_name, student_phone, instructor_name, vehicle_number, scheduled_at, status
- expiringDocs: vehicle documents expiring in ≤30 days (doc_type, expiry_date, vehicle_number)

Dashboard UI (same as original):
- Greeting + user name
- Primary stat cards (2-col grid): Total students, Active learners, Today's classes, Pending payments, New enquiries
- "This month" stat cards: New students, Lessons done, Attendance %, Next 7 days
- Money section: Collected this month (with trend arrow vs last month), Due to collect, Vehicles free / Instructors
- "Documents to renew" banner if any vehicle docs are expiring soon
- Today's schedule list with student avatar, name, time, instructor, vehicle, status badge, call button

STUDENTS — src/pages/Students.jsx + StudentDetail.jsx + StudentForm.jsx
GET /api/students → list filtered by school_id, with search and status filter (all/active/completed/inactive)
POST /api/students → create student (school_id from session)
GET /api/students/:id → full student detail + payments + classes + certificate, enforcing school_id match
PUT /api/students/:id → update, enforcing school_id
DELETE /api/students/:id → delete with cascade, enforcing school_id

StudentDetail page (identical to original):
- Photo upload (R2)
- Student info: name, phone, address, joining date, license type badge, status badge
- Quick actions: Call, WhatsApp, Book class
- Progress bar: completed_classes / total_classes from their package
- Certificate of completion section (CertificateCard component)
- Licence & RTO Tests section (LicenseCard component — see Part 6)
- Payments section: fee / paid / balance grid, discount display, payment history with delete
- Lessons section: full class list with attendance mark buttons, oldest first

PAYMENTS — src/pages/Payments.jsx + PaymentForm.jsx
GET /api/payments → list of students with balance > 0 (pending), or all payments, scoped to school
POST /api/payments → create payment record for a student
DELETE /api/payments/:id → delete, enforce school_id

Payments page (identical to original):
- Segmented filter: Pending / All
- Each row: student avatar, name, fee/paid/balance chips, "Add payment" button
- PaymentForm modal: amount (pre-filled with balance), method (cash/UPI/card/bank), date, note

SETTINGS — src/pages/Settings.jsx
This page is nearly identical to the original. Sections:
1. Notifications — enable OneSignal push alerts on this device, send tomorrow's class reminder
2. Packages — list, add (modal), edit (modal), delete. POST/PUT/DELETE /api/packages scoped to school
3. App — install PWA prompt
4. Account — show current user name/email/role, "Add staff member" (admin only), Sign out

"Add staff member" modal (admin only):
- Fields: Name, Email, Password (min 8), Role (Staff / Admin)
- POST /api/auth/register — must include school_id from session, creates user scoped to school
- Staff can only see their own school's data (same as admin, minus destructive actions)

School Profile section (admin only) — NEW addition to Settings:
- School name, phone, email, address (read-only display with an "Edit" button)
- Logo upload
- PUT /api/settings/school — admins can update their own school's profile info
- This does NOT allow changing slug or creating new schools — that is super-admin only
```

---

## PART 6 — School Admin Panel: Instructors, Vehicles, Schedule, Holidays, Enquiries

```
Continue building the school admin panel — all pages scoped to school_id via session middleware.

INSTRUCTORS — src/pages/Instructors.jsx + InstructorScheduleModal.jsx + InstructorAvailability.jsx
GET /api/instructors → list for school, with assigned_students count
POST /api/instructors → create instructor for school
PUT /api/instructors/:id → update instructor (including portal email/password), enforce school_id
DELETE /api/instructors/:id → delete, enforce school_id

Instructor list page (identical to original):
- Avatar, name, license_type badge, active student count, phone
- Action buttons: Call, Calendar (opens InstructorScheduleModal), Edit (opens modal), Delete
- Add instructor modal fields: Name, Phone, License type (2W/4W/both), Notes, Login email, Password (optional — set to enable portal), Work days (pill selector Mon–Sat), Work start/end time
- InstructorScheduleModal: shows the instructor's weekly class schedule (WeekSchedule component) + their time-off entries + add time-off button
- Time-off supports date RANGES (start_date, end_date) — not just single days like the original

VEHICLES — src/pages/Vehicles.jsx + VehicleDocsModal.jsx
GET /api/vehicles → list with current document status, scoped to school
POST /api/vehicles → create vehicle for school
PUT /api/vehicles/:id → update (including status toggle: available/service), enforce school_id
DELETE /api/vehicles/:id → delete with document cascade, enforce school_id

Vehicle list page (identical to original):
- Car icon (green=available, amber=in-service), vehicle number, model, license type badge
- Document alert badges on card if any doc is expired or expiring ≤30 days
- Action buttons: toggle status, Documents (opens VehicleDocsModal), Edit, Delete
- VehicleDocsModal: shows 5 document types: Insurance, PUC, Fitness, Road Tax, Permit
  - Full renewal history per type
  - Add document record: provider, doc number, amount, start date, expiry date, file upload (R2)
  - Expiry status badge: Expired (red), ≤30 days (amber), >30 days (green)

SCHEDULE — src/pages/Schedule.jsx + ClassForm.jsx
GET /api/classes?from=ISO&to=ISO → classes in date range, scoped to school
POST /api/classes → create class (student, instructor, vehicle, datetime, duration)
PUT /api/classes/:id → update class or mark attendance (status: scheduled/attended/absent/cancelled)
DELETE /api/classes/:id → delete class, enforce school_id

Schedule page (identical to original):
- Week calendar navigator (Mon-start, 7 columns), dot indicator for days with classes
- Tap a day → show classes for that day below
- Each class card: time, duration, student avatar, student name, instructor, vehicle, status badge
- Action buttons: Present (green), Absent (red) for scheduled classes; Reset for others; Call student; Edit (pencil); Delete (trash)
- "Remind" button at top of day list → POST /api/notify/class-reminder with the selected date
- FAB (+) → open ClassForm to book a new class

ClassForm modal (identical to original):
- Student selector (search dropdown)
- Instructor selector — shows only instructors matching the student's license_type
  - Exclude instructors who have a class at the same time or are on time-off/holiday
- Vehicle selector — shows only vehicles matching license_type and status=available
  - Exclude vehicles already assigned at the same time
- Date picker (blocks holidays from the school's holiday list)
- Time picker with availability validation
- Duration (30/45/60/90 min options)
- Notes field

HOLIDAYS — src/pages/Holidays.jsx
GET /api/holidays → all holidays for school
POST /api/holidays → add holiday (date, name), scoped to school
DELETE /api/holidays/:id → remove holiday, enforce school_id

Holidays page (identical to original):
- Month calendar grid — red tiles for holiday dates
- Tap a normal day → add holiday modal (date pre-filled, name field)
- Tap a red day → confirm and remove holiday
- Upcoming holidays list below calendar

LICENCE & RTO TRACKING — LicenseCard.jsx component (used inside StudentDetail)
Displays and edits per-student:
- Learner's Licence (LL): test date, test time, assigned instructor, LL number, LL status (pending/passed/failed), LL expiry date
- Driving Licence (DL): DL test date, DL test time, assigned instructor, DL number, DL status, DL expiry date
- Edit button opens inline edit mode with all these fields
- PUT /api/students/:id/license — updates the LL/DL fields
- Instructor selector for LL/DL test shows instructors from this school

ENQUIRIES — src/pages/Enquiries.jsx
GET /api/enquiries?status=new|contacted|converted → filtered list for school
PUT /api/enquiries/:id → update status or staff_notes, enforce school_id
DELETE /api/enquiries/:id → delete, enforce school_id

Enquiries page (identical to original):
- Segmented filter: All / New / Contacted / Converted
- Each enquiry card: avatar, name, phone (tap to call), message, timestamp
- Status dropdown to change status
- WhatsApp button (opens wa.me link with pre-filled message using school name)
- Staff notes expand/collapse with save button
- Delete button with confirm dialog

Public enquiry form endpoint (no auth required):
POST /api/enquiries — receives { name, phone, message } from the landing page form
Must accept a school_id either from a URL parameter or a school slug. The landing page for each school should be at /[slug] or the default landing at / if school slug is embedded in the build config.
```

---

## PART 7 — Certificates, Student Portal, Instructor Portal, Push Notifications

```
Build the certificate system, both portals, and push notifications — all scoped to school_id.

CERTIFICATES
CertificateCard.jsx component (used in StudentDetail and StudentPortal):
- If no certificate exists and student is eligible (status=completed):
  - Show "Generate Certificate" button
  - Optional: instructor selector dropdown
  - Admin can generate; student can self-generate from portal
- If certificate exists:
  - Show certificate image preview (Cloudinary image_url)
  - Download button (Cloudinary download_url with fl_attachment)
  - Regenerate button (admin only)
  - Show: certificate number, issued date, course name, license type, classes completed

POST /api/certificates/:studentId (admin/staff)
POST /api/portal/certificate (student self-generate)
POST /api/portal/certificate (instructor — specify student_id in body)
- All use the same generation logic:
  - Build SVG with: school name (from school record or CERT_SCHOOL_NAME env var), student name, course name, license type, classes completed, certificate number (format: [SCHOOL-SLUG-UPPERCASE]-YYYY-NNNN), issued date, signatory name (from CERT_SIGNATORY env var or the generating user's name)
  - Upload to Cloudinary with deterministic public_id = "certs/[school_slug]/[student_id]"
  - Rasterize to PNG for preview and download
  - Save/update certificates row with school_id

STUDENT PORTAL — src/pages/StudentPortal.jsx
GET /api/portal/me (role=student)
Returns:
- student: all profile fields including ll_*/dl_* fields, ll_instructor_name, dl_instructor_name, package_name, completed_classes, total_classes, net_fee, paid, balance, discount, package_fee
- payments: array of payment records
- classes: all booked lessons for this student, with instructor_name, instructor_phone, vehicle_number
- certificate: the student's certificate record if it exists

Portal page (identical to original):
- Next lesson countdown hero card (brand color banner with time remaining, instructor name, call button)
- Identity card: name, license type badge, status badge, phone, address, joining date
- Progress bar: completed / total lessons
- Certificate of completion card (CertificateCard — student can generate their own when course=completed)
- Licence & Tests card (read-only view of LL/DL tracking data with expiry badges)
- Fees card: fee / paid / balance grid + payment history list (read-only)
- My lessons list: all lessons sorted oldest-first, with status badge, instructor, vehicle, instructor phone

OneSignal push for students:
- On portal load: call getSubscriptionState(); if already opted in, refresh stored ID via POST /api/portal/push-subscribe; if not, prompt and subscribe
- POST /api/portal/push-subscribe → updates students.onesignal_subscription_id

INSTRUCTOR PORTAL — src/pages/InstructorPortal.jsx
GET /api/portal/me (role=instructor)
Returns:
- instructor: profile fields including work_days, work_start, work_end
- classes: all classes assigned to this instructor
- timeoff: their time-off date ranges
- holidays: upcoming school holidays (next 30 days)
- tests: students where this instructor is assigned as ll_instructor or dl_instructor (shows ll/dl test dates, LL/DL number, status)
- students: all students who have at least one class with this instructor, with certificate info

Portal page (identical to original):
- Summary card: instructor name, "N lessons today" subtitle
- Tab bar: Calendar | Tests | Certificates
- Calendar tab:
  - WeekSchedule component: week navigator, day selector, classes list for selected day
  - Each class: time, student name, vehicle, status badge
  - Actions on class card: Call student (if phone), Present button, Absent button
  - PUT /api/portal/classes/:id → mark attendance (only own classes, enforce instructor_id match)
  - Sidebar (desktop) / section below (mobile): Availability card showing work days/hours, upcoming time-off chips, school holidays chips
- Tests tab:
  - List of students where this instructor is assigned for LL or DL test
  - Shows: student name, test type (LL/DL), test date, test time, status badge, licence number if passed
- Certificates tab:
  - List of all students who have had at least one lesson with this instructor
  - Shows: student name, status badge, lessons progress
  - If no certificate: "Issue" button → POST /api/portal/certificate with { student_id }
  - If certificate exists: "Download" button → links to download_url

OneSignal push for instructors:
- Same pattern as students — subscribe on portal load, POST /api/portal/push-subscribe updates instructors.onesignal_subscription_id

PUSH NOTIFICATIONS — functions/api/notify/
POST /api/notify/subscribe → update users.onesignal_subscription_id for school staff
POST /api/notify/class-reminder (admin/staff)
  - Accept optional { date: 'YYYY-MM-DD' } — defaults to tomorrow
  - Find all scheduled classes on that date for this school
  - For each class, send push to student's and instructor's onesignal_subscription_id
  - Uses OneSignal REST API with ONESIGNAL_REST_API_KEY and ONESIGNAL_APP_ID
  - Returns { sent: true, count: N } or { sent: false, reason: '...' }

Vehicle document expiry alerts:
- Scheduled worker (cron trigger): daily at 08:00 IST
- Find all vehicle_documents where expiry_date is exactly 30 days from today, per school
- Send push notification to all staff/admin users in that school who have a onesignal_subscription_id set
```

---

## PART 8 — Landing Page, PWA Config, wrangler.toml, Final Polish

```
Complete the multi-tenant DSMS with the public landing page, PWA setup, and infrastructure config.

LANDING PAGE — src/pages/Landing.jsx
The landing page is for the public (prospective students). In the multi-tenant system, each school can have its own landing page OR there is a single landing page for the default/configured school.

Implement it this way:
- The landing page reads school info from a GET /api/public/school-info endpoint (no auth)
- This endpoint returns the school name, phone, email, address, logo, and tagline for the "default school" configured via the LANDING_SCHOOL_SLUG env var
- If no school slug is configured, show a generic platform landing page
- The enquiry form on the landing page submits to POST /api/enquiries, passing the school slug in the request body so it gets routed to the right school's enquiry inbox
- All other content (courses, reasons, testimonials) is static as in the original

Landing page sections (identical to original):
1. Sticky navbar: school logo, name, nav links (Courses, Why Us, Enquire), Call Now button, Login link
2. Hero section: full-bleed background photo with overlay, school name as H1, tagline, "Enquire About Classes" + "WhatsApp Enquiry" CTAs, 3 feature tiles at bottom (6-day batches, 1:1 practice, Test prep)
3. Courses section: 4 course cards (Beginner, Refresher, License Prep, Flexible Batches), featured course spotlight with photo
4. Why Choose Us: bullet reasons with checkmarks, 2-photo collage, "Road-ready habits" dark card
5. Testimonials: 3 student quotes, 5-star ratings, Call Now button
6. Contact section: Call link, WhatsApp link, Address display, Enquiry form (Name, Phone, Message)
7. Footer: logo, school name, nav links

SEO (identical to original): title tag, meta description, keywords, og:* tags, JSON-LD LocalBusiness + DrivingSchool schema — all populated dynamically from the school info API response.

PWA SETUP
public/manifest.json:
- name: "DSMS", short_name: "DSMS"
- start_url: "/", display: "standalone", orientation: "portrait"
- background_color: "#f8fafc", theme_color: "#4f46e5"
- icons: 192x192 and 512x512 (generate placeholder icons)

public/sw.js — basic service worker:
- Cache-first for static assets (JS, CSS, images)
- Network-first for API calls (/api/*)
- Offline fallback page

src/main.jsx — register service worker on load

WRANGLER.TOML
name = "dsms-mt"
compatibility_date = "2024-09-23"
pages_build_output_dir = "dist"

[[d1_databases]]
binding = "DB"
database_name = "dsms-mt-db"
database_id = "<your-d1-id>"

[[r2_buckets]]
binding = "FILES"
bucket_name = "dsms-mt-files"

[[kv_namespaces]]
binding = "CACHE"
id = "<your-kv-id>"

[vars]
APP_NAME = "DriveSchool Manager"
ONESIGNAL_APP_ID = "<your-onesignal-app-id>"
CLOUDINARY_CLOUD_NAME = "<your-cloudinary-cloud>"
LANDING_SCHOOL_SLUG = ""     # Set to a school slug to show that school's info on the landing page

# Secrets (set via: wrangler pages secret put <NAME>):
# AUTH_SECRET               — long random string for JWT signing
# ONESIGNAL_REST_API_KEY    — OneSignal server key
# CLOUDINARY_API_KEY        — Cloudinary API key
# CLOUDINARY_API_SECRET     — Cloudinary API secret

PACKAGE.JSON SCRIPTS (match the original)
- "dev": "wrangler pages dev dist --d1=DB --kv=CACHE"
- "dev:vite": "vite"
- "build": "vite build"
- "pages:dev": "npm run build && npm run dev"
- "db:local": "wrangler d1 execute dsms-mt-db --local --file=./migrations/0001_init.sql"
- "db:remote": "wrangler d1 execute dsms-mt-db --file=./migrations/0001_init.sql"
- "db:seed:local": "wrangler d1 execute dsms-mt-db --local --file=./migrations/0002_seed.sql"

FINAL POLISH CHECKLIST
1. Every API endpoint that returns school data must validate that the requested resource belongs to the session's school_id. Return 404 (not 403) for resources that belong to other schools — never leak existence.
2. The super admin sees all schools but never has a school_id in their JWT — super-admin API routes must never filter by school_id.
3. The super admin panel uses a visually distinct layout (dark sidebar, gold/amber accents) vs the school admin layout (white sidebar, indigo accents).
4. All student/instructor portal URLs remain /portal — there are no school-specific URLs in the portal.
5. OneSignal: only send push notifications to subscription IDs belonging to the current school's users.
6. Cloudinary certificate public_id must be namespaced by school: certs/<school_slug>/<student_id> — prevents collisions across schools.
7. R2 file keys must be namespaced by school: schools/<school_id>/students/<student_id>/photo, schools/<school_id>/vehicles/<vehicle_id>/docs/<doc_id>, etc.
8. The Settings page for school admins should NOT show any super-admin options. The "Add staff" button creates users with school_id = session school_id.
9. Certificate serial numbers are per-school: <SCHOOL-SLUG-UPPER>-YYYY-NNNN (e.g. SDS-2026-0001). Each school has its own sequence starting at 0001.
10. The confirm dialog, toast notifications, skeleton loaders, empty states, modal system, DateTimePicker, WeekSchedule, InstructorAvailability, CertificateCard, LicenseCard, VehicleDocsModal, TestList, ClassForm, StudentForm, PaymentForm — all components must be carried over exactly as built in the original, with no regression in UX.
```
