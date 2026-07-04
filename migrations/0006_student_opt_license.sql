-- Migration 0006: Add opt_for_license to students
ALTER TABLE students ADD COLUMN opt_for_license INTEGER NOT NULL DEFAULT 1;
