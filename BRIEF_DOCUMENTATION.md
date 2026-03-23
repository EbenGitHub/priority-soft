# ShiftSync Brief Documentation

## Demo Logins

All seeded demo accounts use the password `password123`.

- Admin: `admin@coastaleats.com`
- East manager: `eastmanager@coastaleats.com`
- West manager: `westmanager@coastaleats.com`
- Staff: `sarah@coastaleats.com`
- Staff: `john@coastaleats.com`
- Staff: `maria@coastaleats.com`
- Staff: `noah@coastaleats.com`
- Staff: `emma@coastaleats.com`
- Staff: `leo@coastaleats.com`
- Staff: `priya@coastaleats.com`
- Staff: `ava@coastaleats.com`

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

## Known Limitations

- Email notifications are simulated as a user preference and notification type only. There is no separate outbound email log view.
- Deployment URL is environment-specific and should be filled in when you deploy the frontend and backend.

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
- The location timezone is authoritative for shifts. Availability is stored with an explicit timezone so recurring availability survives DST transitions predictably.
- For a location near a timezone boundary, the configured location timezone is treated as the source of truth for scheduling and display.

## Deployment Notes

- The Next.js frontend can be deployed separately from the Nest backend.
- The current Nest backend is intended for a standard Node host rather than a Vercel serverless function entrypoint.
