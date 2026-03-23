export const ADMIN_USERS_SELECT_SQL = `
  SELECT id, name, email, password, role, "desiredHours"
  FROM "users"
  WHERE role = 'ADMIN'
`;

export const RESET_TABLE_COUNTS_SQL = `
  SELECT 'audit_logs' AS table_name, COUNT(*)::int AS count FROM "audit_logs"
  UNION ALL SELECT 'swap_requests', COUNT(*)::int FROM "swap_requests"
  UNION ALL SELECT 'notifications', COUNT(*)::int FROM "notifications"
  UNION ALL SELECT 'notification_preferences', COUNT(*)::int FROM "notification_preferences"
  UNION ALL SELECT 'availabilities', COUNT(*)::int FROM "availabilities"
  UNION ALL SELECT 'shifts', COUNT(*)::int FROM "shifts"
  UNION ALL SELECT 'user_skills', COUNT(*)::int FROM "user_skills"
  UNION ALL SELECT 'user_locations', COUNT(*)::int FROM "user_locations"
  UNION ALL SELECT 'users', COUNT(*)::int FROM "users"
  UNION ALL SELECT 'skills', COUNT(*)::int FROM "skills"
  UNION ALL SELECT 'locations', COUNT(*)::int FROM "locations"
  UNION ALL SELECT 'schedule_settings', COUNT(*)::int FROM "schedule_settings"
`;

export const RESET_DATABASE_SQL = `
  TRUNCATE TABLE
    "audit_logs",
    "swap_requests",
    "notifications",
    "notification_preferences",
    "availabilities",
    "shifts",
    "user_skills",
    "user_locations",
    "users",
    "skills",
    "locations",
    "schedule_settings"
  RESTART IDENTITY CASCADE
`;

export const INSERT_ADMIN_USER_SQL = `
  INSERT INTO "users" ("id", "name", "email", "password", "role", "desiredHours")
  VALUES ($1, $2, $3, $4, $5, $6)
`;
