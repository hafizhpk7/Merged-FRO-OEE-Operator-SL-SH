# Full-height dashboards and interactive maps

## Layout

- Make shared panels explicitly full-height flex columns, with min-height-safe bodies that stretch children.
- Convert OEE Trend, OEE by Line, Pareto, shift-performance, and line-detail chart wrappers to flexible full-size regions.
- Keep sensible minimum chart heights for smaller screens while allowing TV layouts to consume all remaining space.

## Map interaction

- Add a reusable zoom-and-pan map viewport around the existing isometric SVG scenes.
- Support cursor-anchored mouse-wheel and trackpad zoom with page scrolling suppressed over the map.
- Add drag-to-pan, touch-compatible interaction, centered zoom buttons, zoom limits, and reset behavior.
- Apply it to Group Site Map, Zone Map, and Production Floor Map without changing drill-down clicks or mock data.

## Verification

- Check analytics charts at desktop/TV height for internal bottom gaps.
- Verify zoom buttons, wheel zoom, drag pan, and existing map item clicks on all three map types.
- Confirm representative pages render without browser errors at desktop and compact widths.
