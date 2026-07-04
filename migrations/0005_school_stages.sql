-- Migration 0005: school stages configuration and student progress
ALTER TABLE schools ADD COLUMN stages TEXT;
ALTER TABLE students ADD COLUMN stage_progress TEXT;
