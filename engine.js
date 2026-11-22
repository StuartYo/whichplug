// WhichPlug engine: circuit load math + plug-plan solver.
// Pure functions, no DOM. Used by the app (browser) and by tests/eval (Node).

export const VOLTS = 120;
export const SAFE_FRACTION = 0.8; // keep a circuit at or under 80% of the breaker rating
export const PLUGS_PER_OUTLET = 2; // a standard duplex wall outlet
export const HIGH_DRAW_WATTS = 1000;

export const SCENARIOS = [
  { id: 'morning', label: 'Morning rush' },
  { id: 'evening', label: 'Evening' },
  { id: 'all', label: 'Everything at once' },
];

// Which circuit an outlet belongs to. Unmapped outlets are grouped per room
// into one assumed 15 A circuit (worst case: the whole room shares a breaker).
export function circuitOf(outlet) {
  return outlet.circuitId ? outlet.circuitId : `unknown:${outlet.room}`;
}

export function listCircuits(home) {
  const out = new Map();
  for (const c of home.circuits) out.set(c.id, { ...c, assumed: false });
  for (const o of home.outlets) {
    const id = circuitOf(o);
    if (!out.has(id)) out.set(id, { id, label: `${o.room} (not mapped yet)`, amps: 15, assumed: true });
  }
  return [...out.values()];
}

export function activeIn(device, scenarioId) {
  if (scenarioId === 'all') return true;
  return (device.when || []).includes(scenarioId);
}

// Watts a device draws in a scenario. A heater can be set to Low in specific routines.
// "Everything at once" always uses the High setting (worst case).
export function drawWatts(device, pl, scenarioId) {
  if (device.lowWatts && scenarioId !== 'all' && (pl.lowIn || []).includes(scenarioId)) return device.lowWatts;
  return device.watts;
}

// placement: { [deviceId]: { outletId, strip: bool, lowIn: [scenarioId] } }
export function placementFromHome(home) {
  const p = {};
  for (const d of home.devices) p[d.id] = { outletId: d.outletId, strip: !!d.strip, lowIn: [...(d.lowIn || [])] };
  return p;
}

export function evaluate(home, placement, scenarioId) {
  const outletById = new Map(home.outlets.map((o) => [o.id, o]));
  const circuits = listCircuits(home);
  const rows = circuits.map((c) => ({ ...c, watts: 0, continuousWatts: 0, devices: [] }));
  const rowById = new Map(rows.map((r) => [r.id, r]));
  for (const d of home.devices) {
    if (!activeIn(d, scenarioId)) continue;
    const pl = placement[d.id];
    const o = outletById.get(pl.outletId);
    if (!o) continue;
    const r = rowById.get(circuitOf(o));
    const w = drawWatts(d, pl, scenarioId);
    r.watts += w;
    if (isContinuous(d)) r.continuousWatts += w;
    r.devices.push({ id: d.id, name: d.name, watts: w, outletId: o.id });
  }
  for (const r of rows) Object.assign(r, rate(r.watts, r.continuousWatts, r.amps));
  return rows;
}

// Heaters run for hours, so they count as continuous loads.
export function isContinuous(device) {
  return device.kind === 'heater' || !!device.continuous;
}

// NEC 210.19(A)/210.20(A): continuous load x 125% + other load must fit the breaker rating.
// That is the source of the "80% rule": a circuit running only heaters should stay at or under 80%.
// trip: more current than the breaker rating. tight: fits the breaker but breaks the continuous-load rule.
export function rate(watts, continuousWatts, amps) {
  const ampsDrawn = watts / VOLTS;
  const designAmps = (continuousWatts * 1.25 + (watts - continuousWatts)) / VOLTS;
  const status = ampsDrawn > amps + 1e-9 ? 'trip' : designAmps > amps + 1e-9 ? 'tight' : 'ok';
  return { ampsDrawn, designAmps, limitAmps: amps * SAFE_FRACTION, fraction: ampsDrawn / amps, designFraction: designAmps / amps, status };
}

// Rule checks that do not depend on the scenario.
export function ruleIssues(home, placement) {
  const issues = [];
  const perOutlet = new Map();
  for (const d of home.devices) {
    const pl = placement[d.id];
    if (!perOutlet.has(pl.outletId)) perOutlet.set(pl.outletId, []);
    perOutlet.get(pl.outletId).push(d);
    if (d.kind === 'heater' && pl.strip) {
      issues.push({ level: 'hard', deviceId: d.id, text: `${d.name} is on a power strip or extension cord. Space heaters must plug straight into the wall.` });
    } else if (pl.strip && d.watts >= HIGH_DRAW_WATTS) {
      issues.push({ level: 'warn', deviceId: d.id, text: `${d.name} draws ${d.watts} W through a power strip. Plug it straight into the wall if you can.` });
    }
  }
  for (const [outletId, devs] of perOutlet) {
    const direct = devs.filter((d) => !placement[d.id].strip).length;
    if (direct > PLUGS_PER_OUTLET) {
      issues.push({ level: 'hard', outletId, text: `More than ${PLUGS_PER_OUTLET} plugs go straight into one outlet.` });
    }
  }
  return issues;
}

export function summarize(home, placement) {
  const byScenario = {};
  let tightCount = 0;
  let tripCount = 0;
  let peak = 0;
  for (const s of SCENARIOS) {
    const rows = evaluate(home, placement, s.id);
    byScenario[s.id] = rows;
    // "Everything at once" is shown for information; the plan is judged on real routines.
    if (s.id === 'all') continue;
    for (const r of rows) {
      if (r.status === 'tight') tightCount++;
      if (r.status === 'trip') tripCount++;
      peak = Math.max(peak, r.designFraction);
    }
  }
  const issues = ruleIssues(home, placement);
  const hard = issues.filter((i) => i.level === 'hard').length;
  return { byScenario, tightCount, tripCount, peak, issues, hard, safe: tripCount === 0 && tightCount === 0 && hard === 0 };
}

// ---------- Solver ----------
// Movable devices may go to any outlet in the rooms they are allowed in
// (default: their own room). Heaters always go straight into the wall; the solver
// may also switch a heater to its Low setting in a routine where it is needed.
// Objective (lexicographic): hard rule issues, circuits over the breaker rating,
// circuits over 80%, heater routines on Low, moves, strip use, peak load.

function candidateMoves(home, device) {
  const rooms = device.rooms && device.rooms.length ? device.rooms : [roomOfDevice(home, device)];
  const outlets = home.outlets.filter((o) => rooms.includes(o.room));
  const lowSets = device.kind === 'heater' && device.lowWatts ? subsets(device.when || []) : [[]];
  const strips = device.kind === 'heater' ? [false] : [false, true];
  const out = [];
  for (const o of outlets) for (const lowIn of lowSets) for (const st of strips) out.push({ outletId: o.id, lowIn, strip: st });
  return out;
}

function subsets(list) {
  let out = [[]];
  for (const x of list) out = out.concat(out.map((s) => [...s, x]));
  return out;
}

function roomOfDevice(home, device) {
  const o = home.outlets.find((x) => x.id === device.outletId);
  return o ? o.room : null;
}

function cost(home, base, placement) {
  const s = summarize(home, placement);
  let lows = 0;
  let moves = 0;
  let strips = 0;
  for (const d of home.devices) {
    const p = placement[d.id];
    lows += (p.lowIn || []).length;
    if (p.outletId !== base[d.id].outletId) moves++;
    if (p.strip) strips++;
  }
  return { key: [s.hard, s.tripCount, s.tightCount, lows, moves, strips, Math.round(s.peak * 1000)], summary: s };
}

function less(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

export const SEARCH_LIMIT = 400000;

export function solve(home) {
  const base = placementFromHome(home);
  const movable = home.devices.filter((d) => d.movable);
  const options = movable.map((d) => candidateMoves(home, d));
  let space = 1;
  for (const o of options) space *= Math.max(1, o.length);
  if (space > SEARCH_LIMIT) {
    return { ok: false, reason: `Too many combinations (${space.toLocaleString('en-US')}). Mark fewer devices as movable.`, searched: 0 };
  }
  const placement = { ...base };
  let best = null;
  let searched = 0;
  const walk = (i) => {
    if (i === movable.length) {
      searched++;
      const c = cost(home, base, placement);
      if (!best || less(c.key, best.key)) best = { key: c.key, summary: c.summary, placement: { ...placement } };
      return;
    }
    const d = movable[i];
    for (const opt of options[i]) {
      placement[d.id] = opt;
      walk(i + 1);
    }
    placement[d.id] = base[d.id];
  };
  walk(0);
  const changes = [];
  for (const d of home.devices) {
    const a = base[d.id];
    const b = best.placement[d.id];
    if (a.outletId !== b.outletId || a.strip !== b.strip || a.lowIn.join() !== b.lowIn.join()) changes.push({ deviceId: d.id, from: a, to: b });
  }
  return { ok: true, placement: best.placement, summary: best.summary, changes, searched, space };
}

// ---------- Naive checks (used for the comparison table) ----------
// Asks "will a breaker trip?" (more current than the rating), grouped the way people usually check:
// A: "each wall outlet on its own" (assumes every outlet is its own 15 A circuit).
// B: "the whole room on one 15 A circuit" (ignores that rooms are often split).
function naive(home, placement, scenarioId, groupOf) {
  const sums = new Map();
  for (const d of home.devices) {
    if (!activeIn(d, scenarioId)) continue;
    const p = placement[d.id];
    const g = groupOf(p.outletId);
    const s = sums.get(g) || { w: 0, c: 0 };
    const w = drawWatts(d, p, scenarioId);
    s.w += w;
    if (isContinuous(d)) s.c += w;
    sums.set(g, s);
  }
  return [...sums.values()].some((s) => rate(s.w, s.c, 15).status === 'trip');
}

export function naivePerOutlet(home, placement, scenarioId) {
  return naive(home, placement, scenarioId, (id) => id);
}

export function naiveRoomTotal(home, placement, scenarioId) {
  const roomOf = new Map(home.outlets.map((o) => [o.id, o.room]));
  return naive(home, placement, scenarioId, (id) => roomOf.get(id));
}
