-- ============================================================
-- Seed: Super Admin account
-- IMPORTANT: Replace the password_hash before running in production!
-- Generate a real hash by running:
--   node scripts/hash-password.js YourPassword123
-- Then paste the output below.
-- Default password for development: Admin@1234
-- ============================================================

-- The hash below is for: Admin@1234  (CHANGE IN PRODUCTION!)
-- Format: salt_hex:derived_key_hex  (PBKDF2-SHA256, 100000 iterations)
INSERT OR IGNORE INTO super_admins (id, email, name, password_hash)
VALUES (
  'super_1',
  'admin@dsms.app',
  'Super Admin',
  'cab75dcf0878b295d3c9fdcb35447262:3847cd8aafcc282c3bad329e84cf3506fb4e9576d504f4f31aaa91a32fe9c9fb'
);

-- To generate a real hash, run:
--   node scripts/hash-password.js Admin@1234
-- Then replace REPLACE_WITH_REAL_HASH_FROM_scripts/hash-password.js above.
