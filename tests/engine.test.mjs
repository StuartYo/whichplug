import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, summarize, solve, placementFromHome, ruleIssues, listCircuits } from '../engine.js';
import { sampleHome } from '../data.js';

test('1500 W heater alone on a 15 A circuit is above the 80% guideline but under the rating', () => {
  const home = { circuits: [{ id: 'c', label: 'C', amps: 15 }], outlets: [{ id: 'o', name: 'O', room: 'R', circuitId: 'c' }],
    devices: [{ id: 'h', name: 'Heater', watts: 1500, lowWatts: 750, kind: 'heater', outletId: 'o', when: ['evening'] }] };
  const row = evaluate(home, placementFromHome(home), 'evening')[0];
  assert.equal(row.ampsDrawn, 12.5);
  assert.equal(row.status, 'tight');
});

test('two outlets on one breaker are added together', () => {
  const home = { circuits: [{ id: 'c', label: 'C', amps: 15 }],
    outlets: [{ id: 'a', name: 'A', room: 'R', circuitId: 'c' }, { id: 'b', name: 'B', room: 'R', circuitId: 'c' }],
    devices: [
      { id: 'h', name: 'Heater', watts: 1500, kind: 'heater', outletId: 'a', when: ['morning'] },
      { id: 'k', name: 'Hair dryer', watts: 1500, kind: 'appliance', outletId: 'b', when: ['morning'] },
    ] };
  const row = evaluate(home, placementFromHome(home), 'morning')[0];
  assert.equal(row.watts, 3000);
  assert.equal(row.status, 'trip');
});

test('unmapped outlets in a room are assumed to share one 15 A breaker', () => {
  const home = { circuits: [], outlets: [{ id: 'a', name: 'A', room: 'Den' }, { id: 'b', name: 'B', room: 'Den' }], devices: [] };
  const cs = listCircuits(home);
  assert.equal(cs.length, 1);
  assert.equal(cs[0].amps, 15);
  assert.equal(cs[0].assumed, true);
});

test('a heater on a power strip is a hard issue', () => {
  const home = sampleHome();
  const issues = ruleIssues(home, placementFromHome(home));
  assert.ok(issues.some((i) => i.level === 'hard' && i.deviceId === 'd1'));
});

test('solver never puts a heater on a strip and clears every trip in the sample', () => {
  const home = sampleHome();
  const before = summarize(home, placementFromHome(home));
  assert.ok(before.tripCount > 0);
  const r = solve(home);
  assert.ok(r.ok);
  assert.equal(r.summary.hard, 0);
  assert.equal(r.summary.tripCount, 0);
  assert.equal(r.summary.tightCount, 0);
  for (const d of home.devices.filter((x) => x.kind === 'heater')) assert.equal(r.placement[d.id].strip, false);
});

test('sample plan: bedroom heater to the 20 A window outlet, kettle to the other counter', () => {
  const r = solve(sampleHome());
  assert.equal(r.placement.d1.outletId, 'win');
  assert.deepEqual(r.placement.d1.lowIn, []);
  assert.equal(r.placement.d9.outletId, 'kr');
});

test('solver refuses search spaces that are too large', () => {
  const outlets = Array.from({ length: 12 }, (_, i) => ({ id: 'o' + i, name: 'O' + i, room: 'R', circuitId: 'c' }));
  const devices = Array.from({ length: 8 }, (_, i) => ({ id: 'd' + i, name: 'D' + i, watts: 100, kind: 'small', outletId: 'o0', strip: true, when: ['evening'], movable: true }));
  const r = solve({ circuits: [{ id: 'c', label: 'C', amps: 15 }], outlets, devices });
  assert.equal(r.ok, false);
});
