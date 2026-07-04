-- ============================================================
-- 0004 — Certificates of completion (image stored on Cloudinary)
-- One certificate per student; regeneration overwrites the row and
-- the Cloudinary asset (deterministic public_id). Name/course/date are
-- snapshotted so the certificate stays stable if the student changes later.
-- Run: wrangler d1 execute dsms-mt-db --local --file=./migrations/0004_certificates.sql
-- ============================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS certificates (
  id                   TEXT PRIMARY KEY,
  school_id            TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id           TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  package_id           TEXT REFERENCES packages(id) ON DELETE SET NULL,
  certificate_no       TEXT NOT NULL,                -- e.g. DSC-2026-0001
  student_name         TEXT NOT NULL,                -- snapshot at issue time
  course_name          TEXT,                         -- snapshot (package name)
  license_type         TEXT,                         -- snapshot (2W | 4W)
  classes_completed    INTEGER,                      -- snapshot
  total_classes        INTEGER,                      -- snapshot
  issued_on            TEXT NOT NULL,                -- YYYY-MM-DD
  issued_by            TEXT,                         -- system | admin:<id> | instructor:<id> | student:<id>
  instructor_name      TEXT,                         -- printed on certificate
  signatory_name       TEXT,                         -- authorised signatory printed on certificate
  cloudinary_public_id TEXT NOT NULL,
  cloudinary_url       TEXT NOT NULL,                -- uploaded SVG secure_url
  image_url            TEXT NOT NULL,                -- rasterized PNG (for <img> preview)
  download_url         TEXT NOT NULL,                -- PNG + fl_attachment (download)
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(school_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_certificates_student  ON certificates(student_id);
CREATE INDEX IF NOT EXISTS idx_certificates_school   ON certificates(school_id);
