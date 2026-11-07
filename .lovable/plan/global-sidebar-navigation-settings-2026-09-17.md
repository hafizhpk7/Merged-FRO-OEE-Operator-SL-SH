# Global Sidebar Navigation & Settings

## What will change

- Add a fixed left sidebar shared by every dashboard page.
- Add smooth expanded and compact modes, with icons-only tooltips in compact mode.
- Add active navigation for Live Monitor, OEE Analytics, and role-gated Shift Performance.
- Move role switching and light/dark theme controls into the sidebar footer.
- Add a User Management action that opens a read-only prototype dialog.
- Keep the current page headers focused on page context, filters, and breadcrumbs.

## Behavior

- Expanded width: approximately 256px; compact width: approximately 80px.
- Main content automatically follows the sidebar width without overlap.
- Shift Performance appears only for Section Head.
- Role and theme changes update the whole app immediately.
- On smaller screens, navigation remains accessible without covering page content.

## Technical details

- Extend the existing global app state with sidebar and theme state.
- Build the sidebar with existing TanStack links, design-system controls, Lucide icons, tooltips, popover, and dialog.
- Mount the shared layout around the route outlet and remove duplicate role/theme controls from page headers.
- Verify active states, collapse transitions, role-gated navigation, dark mode, and representative page navigation.
