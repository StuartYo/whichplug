# WhichPlug

Find out which outlets share a breaker, then get a plug plan that keeps space heaters off power strips and keeps every breaker under its limit.

Live demo: https://whichplug.vercel.app (no sign-up, no keys; "Load sample apartment" is the default)

## Why

U.S. fire departments responded to an average of 37,365 home fires involving heating equipment each year from 2020 to 2024, with about 417 deaths a year. Space heaters and heating stoves were involved in 30% of those fires but 73% of the deaths, and 46% of the fires happened between December and February ([NFPA findings, via ANSI](https://www.ansi.org/standards-news/member-updates/2-6-25-nfpa-releases-findings-on-home-heating-fires)).

The usual advice is "don't overload the circuit". Renters rarely know what the circuit is. Two outlets in different rooms can be on the same breaker, and the two halves of a bedroom can be on different ones. A watts-to-amps calculator can tell you a 1500 W heater draws 12.5 A, but not that the hair dryer you plug in across the room is on the same breaker.

## What it does

1. **Map your breakers.** Switch off one breaker, tick the outlets that lost power, enter the number on the switch (15 A or 20 A). Outlets you have not mapped are treated as one shared 15 A breaker per room, which is the worst case.
2. **Add what you plug in** and when you use it (morning rush, evening). Watts come from your label; the built-in list uses the top of the U.S. DOE typical-wattage ranges.
3. **Find a safe plug plan.** For devices you marked "Can move", WhichPlug tries every allowed outlet in the same room, plus Low settings for heaters, and picks the plan with no heater on a power strip, the fewest breakers over their rating, the fewest heater circuits over 80%, the fewest heater Low settings, then the fewest moves. It shows the before/after counts, the steps to take, and what still cannot be fixed by moving plugs ("don't run these at the same time").

### The rules it uses

- 120 V. A breaker trips when the current is above its rating.
- Heaters count as continuous loads. NEC 210.19(A)/210.20(A): continuous load x 125% + other load must fit the breaker. That is where the "80% rule" comes from, and why a 1500 W heater alone is already too much for a 15 A circuit on High (12.5 A x 1.25 = 15.6 A).
- A space heater must plug straight into the wall, never into a power strip or extension cord. This is a hard rule in code: the solver never offers a strip for a heater.

## How well it works

All numbers below come from `results.json`, written by `npm run eval`. The apartments are generated example data with known breaker maps (3-5 rooms, 3-5 breakers, 1-2 heaters, everyday appliances). The question "will a breaker trip?" was checked three ways.

| Check | Dev set (20 homes, 12 would trip) | Holdout set (20 homes, 11 would trip, run once after freezing the rules) |
|---|---|---|
| Each wall outlet on its own | missed 4 of 12 | missed 5 of 11 |
| Whole room as one 15 A breaker | missed 0, 0 false alarms | missed 2 of 11, 2 false alarms |
| WhichPlug (real breaker map) | reference | reference |

Plan search on the holdout set: 18 homes had a trip, a heater over 80%, or a heater on a strip. WhichPlug found a plan with no trip for 12 of them, cut breaker trips from 16 to 7 and heaters on power strips from 7 to 0, with 1.22 changes per home on average. The other 6 homes have two big appliances that are not movable on the same breaker; the app lists those pairs instead of pretending.

Sample apartment: 2 trips, 1 heater circuit over 80%, 1 heater on a strip before; 0, 0, 0 after three moves. 192 combinations checked.

## Run it

It is a static site with no build step and no dependencies.

```
npx serve .            # or any static server, then open http://localhost:3000
npm test               # engine tests (node --test)
npm run eval           # regenerates results.json
```

## Limitations

- U.S. 120 V homes only. It does not handle 240 V appliances, GFCI tripping, or AFCI nuisance trips.
- It trusts the watts you enter. Many hair dryers are 1875 W; check your label.
- "Move" means within the same room by default. The solver stops if there are more than 400,000 combinations and asks you to mark fewer devices as movable.
- It cannot see wiring faults. A warm outlet or a burnt smell is a reason to stop and call your landlord, whatever the numbers say.

## Built during LaunchPad Hacks

All code in this repository was written between 2026-11-22 and the submission deadline. There is no pre-existing code.

## Credits

- Heating fire numbers: NFPA (2020-2024 averages), as reported by ANSI.
- Appliance wattage ranges: U.S. DOE typical wattages list, as reproduced in Penn State EGEE 102 (`appliance_table.pdf`).
- Continuous-load rule: NEC 210.19(A) and 210.20(A).
- Icons: Lucide (ISC license), inlined as SVG. Fonts: Manrope and IBM Plex Mono (SIL Open Font License) via Google Fonts.
- AI assistance: Claude (Anthropic) helped write code and first drafts of the text. Design, rules, and test cases were reviewed and decided by the author.

## License

MIT
