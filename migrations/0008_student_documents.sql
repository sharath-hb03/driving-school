-- Migration 0008: Student documents (DL/LL paperwork) + LL application profile
-- Students upload their own documents from the portal; admin/staff view them.

-- One row per (student, doc_type). Uploading the same type again replaces it.
CREATE TABLE IF NOT EXISTS student_documents (
  id          TEXT PRIMARY KEY,
  school_id   TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id  TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  doc_type    TEXT NOT NULL,
  file_key    TEXT NOT NULL,           -- Cloudinary URL of the image/PDF
  file_format TEXT,                    -- pdf / jpg / png … (drives icon vs thumbnail)
  doc_number  TEXT,                    -- e.g. Aadhaar / document number
  notes       TEXT,                    -- optional note from the student
  uploaded_by TEXT NOT NULL DEFAULT 'student',  -- 'student' | 'staff'
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(student_id, doc_type)
);
CREATE INDEX IF NOT EXISTS idx_studocs_student ON student_documents(student_id);
CREATE INDEX IF NOT EXISTS idx_studocs_school  ON student_documents(school_id);

-- Learner's Licence application details (mirrors the Sarathi LL "General" form),
-- stored as a JSON blob: { personal:{…}, present:{…}, permanent:{…} }.
ALTER TABLE students ADD COLUMN ll_profile TEXT;
