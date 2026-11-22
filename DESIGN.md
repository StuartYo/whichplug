# WhichPlug design tokens

Starting point: Uber-inspired DESIGN.md from the local awesome-design-md library (black and white, pill controls), chosen because the user is a renter with a phone at the breaker panel, not a developer.

- Fonts: Manrope (UI, 400-800) and IBM Plex Mono (amps, watts, ratings; tabular numbers, right-aligned).
- Colors: ink #0b0b0b, body #555, mute #8a8a8a, line #e2e2e2, soft #f3f3f3, canvas #fff. One accent: signal yellow #f5c400 (focus ring, changed rows, logo).
- Status (always text + icon, never color alone): ok #137a3f on #e8f4ec, heater over 80% #9a5200 on #fbf0e1, will trip #c3122f on #fbe7ea.
- Radii: pill 999px (buttons, tags), 12px (panels), 6px (small tags/inputs).
- Layout: three columns on desktop (Breakers / Load / Plan) sharing one container edge; plan panel first on phones.
- Motion: only button press feedback; respects prefers-reduced-motion.
