// Evaluation: generated apartments with known breaker maps.
// Question 1: will a breaker trip? How often do the two common ways of checking ("each outlet on its own",
//             "whole room on one breaker") disagree with the circuit-level check?
// Question 2: for the unsafe apartments, does the solver find a plan with no
//             trips and no continuous-load violations, and what does it change?
// Writes results.json (the only source for numbers in README / Devpost text).
import { writeFileSync } from 'node:fs';
import { summarize, solve, placementFromHome, naivePerOutlet, naiveRoomTotal } from '../engine.js';
import { sampleHome } from '../data.js';

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ROOMS = ['Bedroom', 'Bedroom 2', 'Living room', 'Kitchen', 'Office'];
const SMALL = [['Laptop', 90], ['Monitor', 40], ['TV', 150], ['Game console', 200], ['Lamp', 10], ['Phone charger', 20], ['Gaming PC', 500]];
const BIG = [['Hair dryer', 1500], ['Electric kettle', 1500], ['Microwave', 1100], ['Toaster', 1400], ['Coffee maker', 1200], ['Clothes iron', 1800]];

function makeHome(r, n) {
  const pick = (a) => a[Math.floor(r() * a.length)];
  const roomCount = 3 + Math.floor(r() * 2);
  const rooms = ROOMS.slice(0, roomCount);
  const outlets = [];
  for (const room of rooms) {
    const k = 2 + Math.floor(r() * 2);
    for (let i = 0; i < k; i++) outlets.push({ id: `${room}-${i}`.replace(/\s/g, ''), name: `${room} ${i + 1}`, room });
  }
  // Breakers: 3-5, each outlet assigned; some breakers cross rooms.
  const nb = 3 + Math.floor(r() * 3);
  const circuits = Array.from({ length: nb }, (_, i) => ({ id: `b${i + 1}`, label: `Breaker ${i + 1}`, amps: r() < 0.35 ? 20 : 15 }));
  rooms.forEach((room, ri) => {
    const home = circuits[ri % nb].id;
    for (const o of outlets.filter((x) => x.room === room)) o.circuitId = r() < 0.7 ? home : pick(circuits).id;
  });
  const devices = [];
  let id = 0;
  const add = (name, watts, extra) => {
    const o = pick(outlets.filter((x) => !extra.room || x.room === extra.room));
    devices.push({ id: `d${++id}`, name, watts, outletId: o.id, strip: !!extra.strip, when: extra.when, movable: !!extra.movable, kind: extra.kind || 'small', lowWatts: extra.lowWatts });
  };
  const heaters = 1 + Math.floor(r() * 2);
  for (let i = 0; i < heaters; i++) {
    const room = pick(rooms.filter((x) => x !== 'Kitchen'));
    add('Space heater', 1500, { kind: 'heater', lowWatts: 750, movable: true, room, strip: r() < 0.3, when: r() < 0.5 ? ['morning', 'evening'] : ['evening'] });
  }
  const bigs = 1 + Math.floor(r() * 3);
  for (let i = 0; i < bigs; i++) {
    const [name, w] = pick(BIG);
    add(name, w, { kind: 'appliance', movable: r() < 0.5, when: [pick(['morning', 'evening'])] });
  }
  const smalls = 2 + Math.floor(r() * 4);
  for (let i = 0; i < smalls; i++) {
    const [name, w] = pick(SMALL);
    add(name, w, { strip: true, when: ['evening'] });
  }
  return { name: `Generated home ${n}`, circuits, outlets, devices };
}

// Reference: does any real breaker carry more current than its rating in a routine?
function unsafeTruth(home, placement) {
  return summarize(home, placement).tripCount > 0;
}

function runSet(label, homes) {
  let unsafe = 0, aMiss = 0, aFalse = 0, bMiss = 0, bFalse = 0;
  let solved = 0, solvedNoTrip = 0, solvedNoLow = 0, totalChanges = 0, tripsBefore = 0, tripsAfter = 0, hardBefore = 0, hardAfter = 0, ms = 0, refused = 0;
  const cases = [];
  for (const home of homes) {
    const base = placementFromHome(home);
    const truth = unsafeTruth(home, base);
    const a = naivePerOutlet(home, base, 'morning') || naivePerOutlet(home, base, 'evening');
    const b = naiveRoomTotal(home, base, 'morning') || naiveRoomTotal(home, base, 'evening');
    if (truth) { unsafe++; if (!a) aMiss++; if (!b) bMiss++; } else { if (a) aFalse++; if (b) bFalse++; }
    const before = summarize(home, base);
    tripsBefore += before.tripCount; hardBefore += before.hard;
    const t0 = performance.now();
    const res = solve(home);
    ms += performance.now() - t0;
    if (!res.ok) { refused++; cases.push({ home: home.name, truth, refused: true }); continue; }
    tripsAfter += res.summary.tripCount; hardAfter += res.summary.hard;
    const clean = res.summary.tripCount === 0 && res.summary.tightCount === 0 && res.summary.hard === 0;
    const lows = Object.values(res.placement).reduce((n, p) => n + p.lowIn.length, 0);
    const noTrip = res.summary.tripCount === 0 && res.summary.hard === 0;
    if (truth || before.hard || before.tightCount) { if (noTrip) solvedNoTrip++; if (clean) solved++; if (clean && lows === 0) solvedNoLow++; totalChanges += res.changes.length; }
    cases.push({ home: home.name, unsafeBefore: truth, hardBefore: before.hard, tightBefore: before.tightCount, perOutletFlags: a, roomTotalFlags: b, planClean: clean, changes: res.changes.length, heaterLowRoutines: lows, combinationsChecked: res.searched });
  }
  const needFix = cases.filter((c) => c.unsafeBefore || c.hardBefore || c.tightBefore).length;
  return {
    set: label, homes: homes.length, unsafeBefore: unsafe,
    perOutletCheck: { missedUnsafe: aMiss, falseAlarms: aFalse },
    roomTotalCheck: { missedUnsafe: bMiss, falseAlarms: bFalse },
    solver: { homesNeedingFix: needFix, plansWithNoTrip: solvedNoTrip, cleanPlans: solved, cleanPlansWithoutLow: solvedNoLow, avgChanges: needFix ? +(totalChanges / needFix).toFixed(2) : 0, tripsBefore, tripsAfter, heaterOnStripBefore: hardBefore, heaterOnStripAfter: hardAfter, refused },
    cases,
  };
}

const dev = Array.from({ length: 20 }, (_, i) => makeHome(rng(1000 + i), i + 1));
const holdout = Array.from({ length: 20 }, (_, i) => makeHome(rng(9000 + i), i + 21));
const sample = sampleHome();
const sres = solve(sample);
const results = {
  generated: new Date().toISOString().slice(0, 10),
  note: 'Generated apartments (example data). The circuit-level check is the reference; it follows NEC 210.19(A)/210.20(A): continuous load x 125% + other load must fit the breaker.',
  sample: { changes: sres.changes, before: { trips: summarize(sample, placementFromHome(sample)).tripCount, tight: summarize(sample, placementFromHome(sample)).tightCount, heaterOnStrip: summarize(sample, placementFromHome(sample)).hard }, after: { trips: sres.summary.tripCount, tight: sres.summary.tightCount, heaterOnStrip: sres.summary.hard }, combinationsChecked: sres.searched },
  dev: runSet('dev (seeds 1000-1019, used while building)', dev),
  holdout: runSet('holdout (seeds 9000-9019, run once after freeze)', holdout),
};
writeFileSync(new URL('../results.json', import.meta.url), JSON.stringify(results, null, 2));
for (const k of ['dev', 'holdout']) {
  const r = results[k];
  console.log(k, 'unsafe', r.unsafeBefore, '/', r.homes, 'A', JSON.stringify(r.perOutletCheck), 'B', JSON.stringify(r.roomTotalCheck), 'solver', JSON.stringify(r.solver));
}
console.log('sample', JSON.stringify(results.sample.before), JSON.stringify(results.sample.after));
