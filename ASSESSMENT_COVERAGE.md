# ShiftSync Assessment Coverage

## Implemented

- User roles: Admin, Manager, Staff
- Multi-location staff certification
- Staff skills
- Staff recurring and one-off availability
- Manager-scoped location views
- Admin global views
- Shift creation
- Manual assignment
- Per-shift publish/unpublish
- Week-level publish/unpublish
- Double-booking checks
- 10-hour rest rule
- Skill/location/availability checks
- Clear constraint messages
- Alternative assignment suggestions
- Swap requests
- Drop requests
- Pending swap/drop limit of 3
- Drop expiry before shift start
- Swap cancellation when manager edits a shift
- Staff-initiated cancellation of pending swap/drop requests
- Overtime warnings and hard blocks
- 6th/7th consecutive day handling
- Fairness analytics
- Real-time schedule mutation refresh
- Real-time notification updates
- Transaction-level same-staff assignment conflict protection
- Notification center with preferences and read/unread state
- Timezone-aware shift storage/display
- Overnight shift handling
- Audit trail with shift history and admin export
- Seeded demo data for locations, users, shifts, swaps, notifications, audit logs

## Partially Implemented

- Schedule publishing:
  The app now supports week-level publish/unpublish, but the UX is still centered on shift cards rather than a full weekly calendar grid.

- Overtime what-if impact:
  Warnings appear before assignment and labor dashboards update, but the UI does not yet isolate the exact marginal assignment delta in a dedicated panel.

## Remaining Gaps

- Headcount needed per shift:
  Current data model is still one assigned staff member per shift record. A full headcount implementation needs either:
  1. grouped shift slots, or
  2. a separate assignment table.

- Editable shift workflow:
  The app supports create/assign/publish, but not a full manager edit form for changing an existing shift’s date/time/skill/headcount before cutoff.

- Email simulation depth:
  Notification preferences support `in-app` vs `in-app + email`, but email is simulated at the preference/notification level and not shown as a separate outbound mail log.

## Decisions / Assumptions

- Historical audit data is preserved even if staffing/location relationships later change.
- Desired hours are treated as a planning target, not a hard scheduling constraint.
- Consecutive-day logic counts any worked shift day the same regardless of duration.
- If a pending swap is cancelled or rejected, original assignments remain unchanged until an approved reassignment occurs.
- Location timezone is treated as the authoritative timezone for shifts. Availability records carry an explicit timezone for DST-safe interpretation.

## Evaluation Scenarios

- Sunday Night Chaos:
  Seeded Sunday Miami close, pending drop workflow, manager notifications, and assignment suggestion flow are present.

- Overtime Trap:
  Seeded high-hours cook schedule, manager overtime warnings, and dashboard overtime cards are present.

- Timezone Tangle:
  Seeded cross-timezone employee, timezone-aware display, UTC storage, and DST-safe availability interpretation are present.

- Simultaneous Assignment:
  Staff-level advisory locking now serializes same-staff assignments so overlapping concurrent requests result in one winner and one immediate conflict response.

- Fairness Complaint:
  Premium shifts are tagged in analytics and fairness distribution is visible in the manager scheduling dashboard.

- Regret Swap:
  Staff can cancel a pending swap/drop before approval and the original assignment remains intact.

## Deliverables Status

- Working application:
  Codebase is ready for split deployment, but the actual public deployment URL depends on your chosen hosts and environment configuration.

- Source code:
  Present in the repository.

- Seed data:
  Present and idempotent for users, locations, shifts, swaps, notifications, and audit logs.

- Brief documentation:
  Added in `BRIEF_DOCUMENTATION.md` and `SEED_SCENARIOS.md`.

- Submission packaging:
  Must still be handled by you at send time.
