# ShiftSync

ShiftSync is a multi-location staff scheduling platform built for the Priority Soft full-stack assessment.

## Live Links

- Frontend: [https://priority-soft-shift-sync.vercel.app/](https://priority-soft-shift-sync.vercel.app/)
- Backend API: [https://priority-soft.onrender.com/](https://priority-soft.onrender.com/)
- Source Code: [https://github.com/EbenGitHub/priority-soft](https://github.com/EbenGitHub/priority-soft)

## Review Notes

### Admin Operations

There is an admin-only operations page in the app:

- Sidebar navigation: `Operations`
- Route: `/dashboard/operations`

Available controls:

- `Delete All Data`
- `Seed Users Only`
- `Seed Shifts`
- `Seed Notifications`
- `Seed Audit & Swaps`
- `Seed All Demo Data`

Recommended admin login:

- `admin@coastaleats.com`
- `password123`

### Demo Logins

All seeded demo users use:

- Password: `password123`

Roles and emails:

- `ADMIN`: `admin@coastaleats.com`
- `MANAGER`: `eastmanager@coastaleats.com`
- `MANAGER`: `westmanager@coastaleats.com`
- `STAFF`: `sarah@coastaleats.com`
- `STAFF`: `john@coastaleats.com`
- `STAFF`: `maria@coastaleats.com`
- `STAFF`: `noah@coastaleats.com`
- `STAFF`: `emma@coastaleats.com`
- `STAFF`: `leo@coastaleats.com`
- `STAFF`: `priya@coastaleats.com`
- `STAFF`: `ava@coastaleats.com`

### Reviewer Docs

The reviewer should read:

- [BRIEF_DOCUMENTATION.md](/Users/mac/per/priority-soft/BRIEF_DOCUMENTATION.md)
  - login instructions
  - known limitations
  - ambiguity decisions
- [SEED_SCENARIOS.md](/Users/mac/per/priority-soft/SEED_SCENARIOS.md)
  - seeded evaluator walkthroughs
- [ASSESSMENT_COVERAGE.md](/Users/mac/per/priority-soft/ASSESSMENT_COVERAGE.md)
  - requirement and scenario coverage status

### Important Limitation

- Password handling is intentionally simplified for the assessment. Demo credentials are not stored with production-grade hashing/encryption because implementation time was focused on scheduling logic, constraint enforcement, realtime workflows, and audit behavior.

## Supporting Docs

- [BRIEF_DOCUMENTATION.md](/Users/mac/per/priority-soft/BRIEF_DOCUMENTATION.md)
- [SEED_SCENARIOS.md](/Users/mac/per/priority-soft/SEED_SCENARIOS.md)
- [ASSESSMENT_COVERAGE.md](/Users/mac/per/priority-soft/ASSESSMENT_COVERAGE.md)
