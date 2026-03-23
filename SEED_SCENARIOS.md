# Seeded Evaluation Scenarios

## 1. Sunday Night Chaos

- Shift: Miami bartender shift on `2026-03-29` from `19:00` to `23:00`
- Seeded assignee: `leo@coastaleats.com`
- Seeded drop request reason: `Sunday night callout test scenario.`
- Fastest demo path:
  1. Sign in as `eastmanager@coastaleats.com`
  2. Open Miami shifts for March 29
  3. Unassign or review the pending drop on the Sunday close
  4. Try to assign an unavailable or unqualified staff member to trigger backend rule messaging
  5. Use the returned alternative suggestions to cover the shift quickly

## 2. Overtime Trap

- Staff: `priya@coastaleats.com`
- Seeded six high-hour cook shifts across LA and Seattle from `2026-03-24` through `2026-03-29`
- Demo path:
  1. Sign in as `westmanager@coastaleats.com`
  2. Open LA or Seattle schedule view
  3. Review overtime cards and manager notifications
  4. Attempt another cook assignment for Priya to surface warnings/blocking behavior

## 3. Timezone Tangle

- Staff: `emma@coastaleats.com`
- Certified locations:
  - NYC (`America/New_York`)
  - LA (`America/Los_Angeles`)
- Availability: recurring `09:00-17:00`
- Seeded shifts:
  - NYC shift on `2026-03-31` assigned to Emma
  - LA shift on `2026-04-01` left open
- Expected behavior:
  - Shift display uses the location timezone
  - The preview panel and staff views also show the viewer-local conversion
  - Availability is interpreted in the availability record’s timezone, not by the viewer browser timezone

## 4. Simultaneous Assignment

- Suggested staff for conflict demo: `maria@coastaleats.com` or `emma@coastaleats.com`
- Expected behavior:
  - If two managers try to assign the same staff member to overlapping shifts at the same time, one transaction wins
  - The second request now fails with a backend `Concurrent assignment conflict` message after staff-level advisory locking
  - The UI surfaces the failure immediately when the request returns

## 5. Fairness Complaint

- Premium shifts are Friday/Saturday evening shifts
- Seeded premium examples:
  - NYC Friday overnight bartender close on `2026-03-27`
  - NYC Saturday premium bartender shift on `2026-03-28`
  - Miami Friday premium bartender shift on `2026-03-27`
  - Miami premium shift on `2026-04-03`
- Demo path:
  1. Sign in as `eastmanager@coastaleats.com`
  2. Open the schedule dashboard fairness section
  3. Review premium distribution and desired-hours variance for bartenders and servers
  4. Use audit/history and schedule cards to verify who received Saturday night shifts

## 6. Regret Swap

- Seeded pending swap:
  - Initiator: `sarah@coastaleats.com`
  - Target: `ava@coastaleats.com`
  - Status: `PENDING_PEER`
  - Reason: `Would like to trade but may cancel before approval.`
- Expected behavior:
  - Sarah can cancel the pending workflow from the staff dashboard
  - Cancellation leaves the original assignment unchanged
  - Relevant parties receive cancellation notifications
