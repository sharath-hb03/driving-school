-- Migration 0007: Add source to enquiries table
ALTER TABLE enquiries ADD COLUMN source TEXT NOT NULL DEFAULT 'web';
