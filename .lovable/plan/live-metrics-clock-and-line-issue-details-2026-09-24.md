# Live metrics, clock, and line issue details

## Goal

Make the Zone Live Monitor behave like a real-time control view while keeping non-live periods as stable snapshots.

## Changes

- Add reusable live-display logic that:
  - shows the current local date and time in the header and updates it every second only when `Period = LIVE`;
  - refreshes a small, bounded fluctuation for OEE, Availability, Performance, and Quality every 30 seconds only in LIVE mode;
  - occasionally updates line and machine statuses on the isometric Zone and Production Floor maps during the same refresh, so map colors stay connected to the KPI movement;
  - keeps values unchanged for Today, This Week, and other snapshot periods;
  - briefly highlights each metric value after a live refresh without shifting the card layout.
- Extend the metric-card presentation to support:
  - a second muted caption line;
  - a short update-flash state;
  - an accessible interactive variant for the Lines Down card.
- On the Zone View KPI row:
  - drive Zone OEE, Availability, Performance, and Quality from the live metric simulation;
  - show “Compared to 30s ago”, “Compared to yesterday”, or “Compared to last week” beneath the Availability, Performance, and Quality difference values according to the selected period;
  - leave that extra comparison label hidden for periods without a specified comparison.
- Make Lines Down open a dialog with the current non-running lines, including line name, semantic status badge, downtime reason, and duration.
  - Include Down, Slow, and Idle states with distinct existing dashboard colors.
  - Sort issues by severity first—Down before Slow before Idle—and use longest downtime first within each status.
  - Provide a visible View Details affordance, close button, Escape support, and outside-click close behavior.
- Use deterministic mock issue details so the prototype remains stable across reloads and does not require any backend.

## Verification

- Confirm the LIVE timestamp advances every second, while snapshot-period timestamp text remains static.
- Confirm KPI values change only after a LIVE refresh and briefly flash without layout movement.
- Confirm map status colors update on selected live refreshes and remain synchronized with the issue list.
- Confirm each requested comparison label follows the selected period.
- Confirm the Lines Down dialog opens from keyboard/mouse, shows all required columns, and closes via X, Escape, and outside click.
- Check the Zone View at desktop and mobile widths and verify no browser errors.

## Technical details

- Keep all timing lifecycle cleanup inside React effects to avoid duplicate intervals.
- Clamp simulated percentages to valid bounds and derive OEE consistently from the three component metrics.
- Keep transient live status overrides in presentation state so the deterministic source dataset remains unchanged.
- Reuse the existing Dialog, Button, status tokens, and deterministic mock-data utilities.
