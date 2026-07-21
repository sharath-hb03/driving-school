-- ============================================================
-- Instrukt — multi-tenant D1 (SQLite) schema
-- Run: npm run db:local   (local)   /   npm run db:remote   (prod)
-- ============================================================

PRAGMA foreign_keys = ON;

-- ===== PLATFORM LEVEL =====

CREATE TABLE IF NOT EXISTS super_admins (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS schools (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  phone      TEXT,
  email      TEXT,
  address    TEXT,
  logo_key   TEXT,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===== SCHOOL LEVEL (all have school_id) =====

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  school_id     TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'staff',
  password_hash TEXT NOT NULL,
  pushify_sub   TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS packages (
  id            TEXT PRIMARY KEY,
  school_id     TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  license_type  TEXT NOT NULL DEFAULT 'both',
  fee           REAL NOT NULL DEFAULT 0,
  total_classes INTEGER NOT NULL DEFAULT 10,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

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
  pushify_sub   TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_instructors_login_email ON instructors(email) WHERE password_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS vehicles (
  id             TEXT PRIMARY KEY,
  school_id      TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  vehicle_number TEXT NOT NULL,
  model          TEXT,
  license_type   TEXT NOT NULL DEFAULT '4W',
  status         TEXT NOT NULL DEFAULT 'available',
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS students (
  id              TEXT PRIMARY KEY,
  school_id       TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  phone           TEXT,
  email           TEXT,
  password_hash   TEXT,
  address         TEXT,
  license_type    TEXT NOT NULL DEFAULT '4W',
  joining_date    TEXT,
  package_id      TEXT REFERENCES packages(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'active',
  photo_key       TEXT,
  notes           TEXT,
  discount        REAL NOT NULL DEFAULT 0,
  ll_number       TEXT,
  ll_test_date    TEXT,
  ll_test_time    TEXT,
  ll_status       TEXT,
  ll_expiry       TEXT,
  ll_instructor_id TEXT REFERENCES instructors(id) ON DELETE SET NULL,
  dl_test_date    TEXT,
  dl_test_time    TEXT,
  dl_status       TEXT,
  dl_number       TEXT,
  dl_expiry       TEXT,
  dl_instructor_id TEXT REFERENCES instructors(id) ON DELETE SET NULL,
  pushify_sub     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_login_email ON students(email) WHERE password_hash IS NOT NULL;

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

CREATE TABLE IF NOT EXISTS payments (
  id         TEXT PRIMARY KEY,
  school_id  TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  amount     REAL NOT NULL,
  method     TEXT NOT NULL DEFAULT 'cash',
  paid_at    TEXT NOT NULL DEFAULT (datetime('now')),
  note       TEXT,
  receipt_key TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS holidays (
  id         TEXT PRIMARY KEY,
  school_id  TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  date       TEXT NOT NULL,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(school_id, date)
);

CREATE TABLE IF NOT EXISTS instructor_time_off (
  id            TEXT PRIMARY KEY,
  school_id     TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  instructor_id TEXT NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  start_date    TEXT NOT NULL,
  end_date      TEXT NOT NULL,
  reason        TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

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
  instructor_name      TEXT,
  signatory_name       TEXT,
  cloudinary_public_id TEXT NOT NULL,
  cloudinary_url       TEXT NOT NULL,
  image_url            TEXT NOT NULL,
  download_url         TEXT NOT NULL,
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS enquiries (
  id          TEXT PRIMARY KEY,
  school_id   TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL,
  message     TEXT,
  status      TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','contacted','converted')),
  staff_notes TEXT,
  source      TEXT NOT NULL DEFAULT 'web',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===== INDEXES =====
CREATE INDEX IF NOT EXISTS idx_users_school        ON users(school_id);
CREATE INDEX IF NOT EXISTS idx_packages_school     ON packages(school_id);
CREATE INDEX IF NOT EXISTS idx_instructors_school  ON instructors(school_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_school     ON vehicles(school_id);
CREATE INDEX IF NOT EXISTS idx_students_school     ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_classes_school      ON classes(school_id);
CREATE INDEX IF NOT EXISTS idx_classes_scheduled   ON classes(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_classes_student     ON classes(student_id);
CREATE INDEX IF NOT EXISTS idx_classes_instructor  ON classes(instructor_id);
CREATE INDEX IF NOT EXISTS idx_classes_status      ON classes(status);
CREATE INDEX IF NOT EXISTS idx_payments_school     ON payments(school_id);
CREATE INDEX IF NOT EXISTS idx_payments_student    ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_holidays_school     ON holidays(school_id);
CREATE INDEX IF NOT EXISTS idx_timeoff_instructor  ON instructor_time_off(instructor_id);
CREATE INDEX IF NOT EXISTS idx_vehdocs_vehicle     ON vehicle_documents(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehdocs_expiry      ON vehicle_documents(expiry_date);
CREATE INDEX IF NOT EXISTS idx_enquiries_school    ON enquiries(school_id);
CREATE INDEX IF NOT EXISTS idx_certs_student       ON certificates(student_id);
