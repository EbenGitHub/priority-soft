# ShiftSync Brief Documentation

## Live Links

- Frontend: [https://priority-soft-shift-sync.vercel.app/](https://priority-soft-shift-sync.vercel.app/)
- Backend API: [https://priority-soft.onrender.com/](https://priority-soft.onrender.com/)
- Source Code: [https://github.com/EbenGitHub/priority-soft](https://github.com/EbenGitHub/priority-soft)

## Demo Logins

All seeded demo accounts use the password `password123`.

### Admin

- Role: `ADMIN`
- Email: `admin@coastaleats.com`

### Managers

- Role: `MANAGER`
- Email: `eastmanager@coastaleats.com`
- Scope: East Coast locations

- Role: `MANAGER`
- Email: `westmanager@coastaleats.com`
- Scope: West Coast locations

### Staff

- Role: `STAFF`
- Email: `sarah@coastaleats.com`
- Role: `STAFF`
- Email: `john@coastaleats.com`
- Role: `STAFF`
- Email: `maria@coastaleats.com`
- Role: `STAFF`
- Email: `noah@coastaleats.com`
- Role: `STAFF`
- Email: `emma@coastaleats.com`
- Role: `STAFF`
- Email: `leo@coastaleats.com`
- Role: `STAFF`
- Email: `priya@coastaleats.com`
- Role: `STAFF`
- Email: `ava@coastaleats.com`

## What Is Implemented

- Role-based access for admins, managers, and staff
- Multi-location staff certifications and skill-based assignment validation
- Recurring and one-off availability with timezone-aware handling
- Shift creation, editing, assignment, publish/unpublish, and weekly publish/unpublish
- Constraint enforcement for overlap, 10-hour rest, availability, skill, location certification, daily hours, weekly overtime warnings, and 6th/7th consecutive day logic
- Shift swap and drop workflows with peer acceptance, manager approval, cancellation, expiry, and notifications
- Notification center with persisted inbox, read/unread state, and user preferences
- Timezone-safe calendar handling, including overnight shifts
- Audit trail per shift and admin export/filtering
- Real-time schedule/notification refresh via websocket events
- Admin operations page for database reset and targeted reseeding

## Algorithms / Rule Logic

### Fairness distribution

- Premium shifts are defined as Friday and Saturday evening shifts.
- The fairness view compares premium-shift allocation across staff in the selected scope instead of only looking at total hours.
- Managers can investigate a specific employee and compare:
  - that employee's Saturday-night assignment count
  - the team average
  - the highest count in the team
- Desired hours are also compared against assigned hours, but desired hours are treated as a planning target rather than a hard block.

### Overtime and labor checks

- Daily hours:
  - over 8 hours generates a warning
  - over 12 hours is a hard block
- Weekly hours:
  - 35+ hours generates a warning
  - 40+ hours is highlighted as overtime exposure
- Consecutive days:
  - 6th consecutive day generates a warning
  - 7th consecutive day requires an explicit override reason
- Assignment and dashboard views both surface projected overtime impact before final confirmation.

### Assignment validation

- Assignment checks run in this order:
  - location certification
  - required skill
  - matching availability window
  - overlapping shift detection
  - 10-hour rest rule
  - daily-hour compliance
  - weekly overtime warning
  - consecutive-day warning / override requirement
- If validation fails, the UI shows the violated rule directly.
- Where possible, the backend also returns alternative qualified staff suggestions.

### Availability interpretation

- Availability is attached to an explicit location and therefore to that location's timezone.
- A recurring window like `9:00 AM - 5:00 PM` means `9:00 AM - 5:00 PM in that selected location's timezone`.
- Shift matching converts the shift against the availability location timezone, which keeps cross-timezone and DST handling predictable.

### Recurring weekly + one-off exceptions

- Staff can create two kinds of availability:
  - `Recurring weekly`
  - `One-off exception`
- Recurring weekly availability means:
  - a day of week is selected
  - a start and end time are selected
  - the rule repeats every week for that location
  - example: `Every Monday, 9:00 AM - 5:00 PM at Coastal Eats NYC`
- One-off exception availability means:
  - a specific date is selected
  - a start and end time are selected
  - the rule applies only on that single calendar date for that location
  - example: `March 31, 2026, 12:00 PM - 8:00 PM at Coastal Eats LA`
- The system stores both the selected location and its timezone with the availability record.
- Matching behavior:
  - recurring availability is matched by weekday in the availability location's timezone
  - one-off exception availability is matched only to that exact local date
  - the shift must fit fully inside the availability window
- Overnight handling:
  - if an availability end time is earlier than the start time, it is treated as a window that spills into the next day
  - the same rule is used for overnight shifts, so late-night / early-morning matching stays consistent
- DST handling:
  - recurring availability is interpreted using the stored location timezone rather than the viewer browser timezone
  - that keeps a rule like `9:00 AM - 5:00 PM` anchored to local restaurant time even when daylight saving changes occur
- Manager-facing effect:
  - the assignment modal uses these availability rules during candidate validation
  - staff who do not match the availability window are shown as unavailable or blocked instead of being treated as clean candidates
- Duplicate protection:
  - the backend prevents the same availability window from being added twice for the same user, location, type, and time range

### Publish / cutoff workflow

- Draft schedules can be created and edited freely before the cutoff window.
- Published schedules become locked inside the configured cutoff window.
- Inside the cutoff window:
  - edit, unassign, and unpublish actions require an override reason
  - the override reason is written to the audit trail
  - managers/admins are notified when a cutoff override is used
- Once a shift has already started, it is treated as a hard block rather than an override case.

### Concurrent assignment protection

- Same-staff assignment attempts are serialized with a staff-level database lock.
- If two managers try to assign the same person at nearly the same time, one wins and the other gets a conflict response after the system rechecks the updated schedule state.

## Known Limitations

- Email notifications are simulated as a user preference and notification type only. There is no separate outbound email log view.
- Deployment URL is environment-specific and should be filled in when you deploy the frontend and backend.
- Authentication is still demo-grade. Backend authorization and role checks are enforced, but the app still relies on submitted actor identity rather than a full JWT/session guard stack.
- Password handling is intentionally simplified for the assessment. Demo credentials are stored without production-grade hashing/encryption because the time was prioritized toward scheduling constraints, workflow logic, realtime updates, and audit behavior.
- Availability now stores explicit `locationId` plus timezone, but older rows created before that change may still rely on timezone fallback until they are reseeded or edited.
- The overtime workflow now includes what-if impact in assignment and dashboard views, but there is not yet a dedicated global planner screen for cross-location overtime simulation.
- Fairness investigation is now manager-readable, but it is currently focused on Saturday-night distribution in the selected location view rather than an arbitrary premium-shift query builder across all locations.
- Admin operations are destructive by design. `Delete All Data` preserves admin accounts only; other related data such as preferences and notifications are cleared.

## Admin Operations Page

Admins can use the in-app operations page from the dashboard side navigation at `/dashboard/operations`.

Available controls:

- delete all persisted data
- seed users only
- seed shifts
- seed notifications
- seed audit and swap data
- reseed the full demo dataset

## Assumptions / Decisions

- Historical records are preserved. If a staff member is later de-certified from a location, past shifts, notifications, and audit records remain unchanged.
- Desired hours are treated as a planning target for fairness and staffing insight, not as a hard scheduling block.
- Consecutive-day compliance counts any worked day equally, regardless of whether the shift was short or long.
- If a swap is edited indirectly because the underlying shift changes, the pending swap/drop request is cancelled and the original assignment remains until a new approved change is made.
- If a swap is accepted by the peer but not yet manager-approved, the original assignments still remain in force. If the initiator cancels during that window, the workflow is cancelled and nothing changes on the actual schedule.
- The location timezone is authoritative for shifts. Availability is now anchored to an explicit location and its timezone so recurring availability survives DST transitions predictably and cross-timezone interpretation is explicit.
- For a location near a timezone boundary, the configured location timezone is treated as the source of truth for scheduling and display.

## Intentional Ambiguities

### What happens to historical data when a staff member is de-certified from a location?

- Decision: historical records are preserved.
- Rationale: past schedules, audit logs, and notifications should remain historically correct even if current certifications change later.

### How should "desired hours" interact with availability windows?

- Decision: desired hours are a planning target, not an availability override.
- Rationale: availability controls when someone can be scheduled; desired hours influence fairness and staffing analytics only.

### When calculating consecutive days, does a 1-hour shift count the same as an 11-hour shift?

- Decision: yes, any worked day counts equally as one worked day.
- Rationale: the requirement speaks in consecutive days worked, not weighted day intensity.

### If a shift is edited after swap approval but before it occurs, what should happen?

- Decision: pending workflows are cancelled when the underlying shift changes; approved-and-applied schedules remain real schedule changes, and later edits follow the normal cutoff/audit rules.
- Rationale: once approval has been applied to the actual schedule, the system should treat it as the current truth rather than try to preserve an old swap intent invisibly.

### How should the system handle a location that spans a timezone boundary (e.g., a restaurant near a state line)?

- Decision: each location has one configured authoritative timezone.
- Rationale: operational scheduling needs one source of truth for storage, display, cutoff calculation, and availability matching.

## Deployment Notes

- Frontend deployment: [https://priority-soft-shift-sync.vercel.app/](https://priority-soft-shift-sync.vercel.app/)
- Backend deployment: [https://priority-soft.onrender.com/](https://priority-soft.onrender.com/)
- Repository: [https://github.com/EbenGitHub/priority-soft](https://github.com/EbenGitHub/priority-soft)
- The Next.js frontend is deployed separately from the Nest backend.
- The Nest backend is intended for a standard Node host rather than a Vercel serverless function entrypoint.
