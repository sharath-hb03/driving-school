-- Migration 0009: composite indexes for the D1 rows-read budget
-- Pairs with the range-based date filters in functions/api/dashboard.js and the
-- windowed scan in functions/api/notify/cron.js. Without these the rewritten queries
-- are correct but still fall back to scanning the school's whole history.
--
-- Every index below leads with the column the query filters on first (school_id for
-- tenant-scoped reads, status for the cron), so the second column narrows a range that
-- is already tenant-bounded.

-- Dashboard: today's classes, this/last month's lessons, attendance, next 7 days.
CREATE INDEX IF NOT EXISTS idx_classes_school_sched     ON classes(school_id, scheduled_at);

-- Cron: the now → now+26h reminder window. This is the one that stops the reminder
-- scan growing with the table.
CREATE INDEX IF NOT EXISTS idx_classes_status_sched     ON classes(status, scheduled_at);

-- Dashboard: collected this month / last month, and the grouped payment totals.
CREATE INDEX IF NOT EXISTS idx_payments_school_paid     ON payments(school_id, paid_at);

-- Dashboard: new students this month.
CREATE INDEX IF NOT EXISTS idx_students_school_join     ON students(school_id, joining_date);

-- Dashboard + students list: active-learner counts and status filtering.
CREATE INDEX IF NOT EXISTS idx_students_school_status   ON students(school_id, status);

-- Dashboard: leads this month / last month.
CREATE INDEX IF NOT EXISTS idx_enquiries_school_created ON enquiries(school_id, created_at);

-- Dashboard: new-enquiry count and the recent-leads list.
CREATE INDEX IF NOT EXISTS idx_enquiries_school_status  ON enquiries(school_id, status);

-- Superseded by the composites above: an index on (a, b) already serves every query
-- that filtered on a alone, so keeping both only costs extra rows written per insert.
DROP INDEX IF EXISTS idx_classes_school;
DROP INDEX IF EXISTS idx_classes_status;
DROP INDEX IF EXISTS idx_students_school;
DROP INDEX IF EXISTS idx_payments_school;
DROP INDEX IF EXISTS idx_enquiries_school;
