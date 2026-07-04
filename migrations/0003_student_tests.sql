-- Migration 0003: student_tests — full test attempt history per student
CREATE TABLE IF NOT EXISTS student_tests (
  id          TEXT PRIMARY KEY,
  school_id   TEXT NOT NULL,
  student_id  TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK(type IN ('ll','dl')),   -- 'll' or 'dl'
  test_date   TEXT NOT NULL,
  test_time   TEXT,
  status      TEXT NOT NULL DEFAULT 'pending'            -- pending | passed | failed
               CHECK(status IN ('pending','passed','failed')),
  notes       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_student_tests_student ON student_tests(student_id, type, test_date);
CREATE INDEX IF NOT EXISTS idx_student_tests_school  ON student_tests(school_id, test_date);
