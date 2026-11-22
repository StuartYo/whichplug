import { SCENARIOS, evaluate, summarize, solve, placementFromHome, listCircuits, circuitOf, VOLTS } from './engine.js';
import { LIBRARY, sampleHome, emptyHome } from './data.js';

const KEY = 'whichplug.v1';
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtA = (a) => a.toFixed(1);

const ICON = {
  check: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  alert: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  zap: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>',
  x: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
  undo: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>',
};

const STATUS_TEXT = {
  ok: { label: 'OK', icon: ICON.check },
  tight: { label: 'Heater over 80%', icon: ICON.alert },
  trip: { label: 'Will trip', icon: ICON.zap },
};

let state = load() || { home: sampleHome(), scenario: 'morning' };
let plan = null;        // last solver result
let showPlan = false;   // view the table with the plan applied

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
}
function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}
function changed() {
  plan = null;
  showPlan = false;
  save();
  render();
}

function currentPlacement() {
  return showPlan && plan ? plan.placement : placementFromHome(state.home);
}

function outletLabel(id) {
  const o = state.home.outlets.find((x) => x.id === id);
  return o ? `${o.room}: ${o.name}` : 'Unknown outlet';
}

// ---------- Render ----------
function render() {
  renderScenarios();
  renderBreakers();
  renderLoads();
  renderDevices();
  renderPlan();
  renderSelects();
}

function renderScenarios() {
  $('#scenarios').innerHTML = SCENARIOS.map((s) => `<button type="button" role="tab" aria-selected="${s.id === state.scenario}" data-s="${s.id}">${s.label}</button>`).join('');
  const note = $('#view-note');
  if (showPlan && plan) note.innerHTML = '<strong>Showing the plan.</strong> Rows with a yellow tint changed.';
  else if (state.scenario === 'all') note.textContent = 'Worst case: every device on at once, heaters on High. For reference only.';
  else note.textContent = 'Showing how things are plugged in now.';
}

function renderBreakers() {
  const h = state.home;
  if (!h.outlets.length) {
    $('#breakers').innerHTML = '<p class="empty">No outlets yet. Add the outlets in each room, then map which breaker each one is on.</p>';
    return;
  }
  const circuits = listCircuits(h);
  $('#breakers').innerHTML = circuits.map((c) => {
    const outs = h.outlets.filter((o) => circuitOf(o) === c.id);
    return `<div class="breaker${c.assumed ? ' assumed' : ''}">
      <div class="breaker-head"><span class="breaker-name">${esc(c.assumed ? c.label : c.label)}</span><span class="amps-tag">${c.amps} A${c.assumed ? ' assumed' : ''}</span></div>
      ${c.assumed ? '<p class="assumed-note">Not mapped. Counted as one shared 15 A breaker until you map it.</p>' : ''}
      <ul>${outs.map((o) => `<li><span>${esc(o.name)}</span><span class="room">${esc(o.room)}</span></li>`).join('')}</ul>
    </div>`;
  }).join('');
}

function loadRows(placement, scenarioId) {
  return evaluate(state.home, placement, scenarioId);
}

function statusPill(status) {
  const s = STATUS_TEXT[status];
  return `<span class="status s-${status}">${s.icon}${s.label}</span>`;
}

function renderLoads() {
  const placement = currentPlacement();
  const rows = loadRows(placement, state.scenario);
  const basePl = placementFromHome(state.home);
  const baseRows = loadRows(basePl, state.scenario);
  if (!rows.length) {
    $('#loads').innerHTML = '<p class="empty">Add outlets to see the load on each breaker.</p>';
    return;
  }
  $('#loads').innerHTML = `<table class="load-table">
    <thead><tr><th>Breaker</th><th class="num">Amps</th><th class="num hide-sm">Rating</th><th>Status</th></tr></thead>
    <tbody>${rows.map((r) => {
      const b = baseRows.find((x) => x.id === r.id);
      const moved = showPlan && plan && b && b.devices.map((d) => d.id + d.watts).join() !== r.devices.map((d) => d.id + d.watts).join();
      const pct = Math.min(100, r.fraction * 100);
      const devs = r.devices.length ? r.devices.map((d) => `${esc(d.name)} ${d.watts} W`).join(' · ') : 'Nothing on in this routine';
      return `<tr class="${r.watts ? '' : 'idle'}${moved ? ' changed' : ''}">
        <td><div class="load-name">${esc(r.label)}</div><div class="load-devs">${devs}</div>
          <div class="bar" role="img" aria-label="${Math.round(r.fraction * 100)}% of ${r.amps} amp rating"><div class="bar-fill fill-${r.status}" style="width:${pct}%"></div><div class="bar-mark"></div></div></td>
        <td class="num">${fmtA(r.ampsDrawn)} A</td>
        <td class="num hide-sm">${r.amps} A</td>
        <td>${statusPill(r.status)}</td>
      </tr>`;
    }).join('')}</tbody></table>`;
}

function renderDevices() {
  const h = state.home;
  if (!h.devices.length) {
    $('#devices').innerHTML = '<p class="empty">Nothing plugged in yet. Add a device below.</p>';
    return;
  }
  const placement = currentPlacement();
  const outletOpts = (sel) => h.outlets.map((o) => `<option value="${esc(o.id)}"${o.id === sel ? ' selected' : ''}>${esc(o.room)}: ${esc(o.name)}</option>`).join('');
  $('#devices').innerHTML = `<table class="dev-table">
    <thead><tr><th>Device</th><th class="num">Watts</th><th>Outlet</th><th></th></tr></thead>
    <tbody>${h.devices.map((d) => {
      const p = placement[d.id];
      const flags = [];
      if (p.strip) flags.push(`<span class="flag${d.kind === 'heater' ? ' bad' : ''}">${d.kind === 'heater' ? 'Heater on a power strip' : 'Power strip'}</span>`);
      flags.push(`<span class="flag">${(d.when || []).map((w) => (w === 'morning' ? 'Morning' : 'Evening')).join(' + ') || 'Not used'}</span>`);
      if (d.movable) flags.push('<span class="flag">Can move</span>');
      if (p.lowIn && p.lowIn.length) flags.push(`<span class="flag">Low in ${p.lowIn.join(' + ')}</span>`);
      return `<tr>
        <td><div class="dev-name">${esc(d.name)}</div><div class="dev-flags">${flags.join('')}</div></td>
        <td class="num"><input type="number" min="1" max="3000" value="${d.watts}" data-watts="${esc(d.id)}" aria-label="Watts for ${esc(d.name)}"></td>
        <td><select data-outlet="${esc(d.id)}" aria-label="Outlet for ${esc(d.name)}"${showPlan ? ' disabled' : ''}>${outletOpts(p.outletId)}</select></td>
        <td><button class="icon-btn" type="button" data-del="${esc(d.id)}" aria-label="Remove ${esc(d.name)}">${ICON.x}</button></td>
      </tr>`;
    }).join('')}</tbody></table>`;
}

function countLine(sum) {
  return { trips: sum.tripCount, tight: sum.tightCount, strip: sum.hard };
}

function describeChange(ch) {
  const d = state.home.devices.find((x) => x.id === ch.deviceId);
  const parts = [];
  const from = ch.from;
  const to = ch.to;
  let title;
  if (from.outletId !== to.outletId) title = `Move ${d.name} to ${outletLabel(to.outletId)}`;
  else if (from.strip && !to.strip) title = `Plug ${d.name} straight into the wall`;
  else title = `Keep ${d.name} where it is`;
  if (from.outletId !== to.outletId) {
    const fromC = circuitOf(state.home.outlets.find((o) => o.id === from.outletId));
    const toC = circuitOf(state.home.outlets.find((o) => o.id === to.outletId));
    const cl = (id) => (listCircuits(state.home).find((c) => c.id === id) || {}).label;
    parts.push(fromC === toC ? 'Same breaker, but frees a plug.' : `That outlet is on ${cl(toC)}, not ${cl(fromC)}.`);
  }
  if (from.strip && !to.strip) parts.push('Straight into the wall, not a power strip.');
  if (to.lowIn && to.lowIn.length) parts.push(`Set it to Low (${d.lowWatts} W) during ${to.lowIn.map((w) => (w === 'morning' ? 'the morning rush' : 'the evening')).join(' and ')}.`);
  return { title, why: parts.join(' ') };
}

function leftovers(sum) {
  const out = [];
  for (const s of SCENARIOS) {
    if (s.id === 'all') continue;
    for (const r of sum.byScenario[s.id]) {
      if (r.status === 'ok') continue;
      out.push(`${s.label}: ${r.label} carries ${fmtA(r.ampsDrawn)} A (${r.devices.map((d) => d.name).join(', ')}). Don't run these at the same time.`);
    }
  }
  return out;
}

function renderPlan() {
  const before = summarize(state.home, placementFromHome(state.home));
  const el = $('#plan');
  if (!plan) {
    const issues = before.issues;
    const b = countLine(before);
    el.innerHTML = `
      <p class="plan-hint">${b.trips + b.tight + b.strip ? `Right now: <strong>${b.trips}</strong> breaker${b.trips === 1 ? '' : 's'} would trip, <strong>${b.tight}</strong> heater circuit${b.tight === 1 ? '' : 's'} over 80%, <strong>${b.strip}</strong> heater${b.strip === 1 ? '' : 's'} on a power strip.` : 'Right now nothing is over the limit.'} WhichPlug tries every allowed outlet and heater setting for the devices marked "Can move" and picks the plan with the fewest problems and the fewest changes.</p>
      ${issues.length ? `<ul class="issues">${issues.map((i) => `<li class="${i.level}">${ICON.alert}<span>${esc(i.text)}</span></li>`).join('')}</ul>` : ''}`;
    return;
  }
  if (!plan.ok) {
    el.innerHTML = `<p class="plan-hint">${esc(plan.reason)}</p>`;
    return;
  }
  const a = countLine(plan.summary);
  const b = countLine(before);
  const cls = (n, bad) => (n === 0 ? 'good' : bad);
  const steps = plan.changes.map(describeChange);
  const left = leftovers(plan.summary);
  const verdict = plan.summary.safe ? 'Safe plan found.' : plan.summary.tripCount === 0 && plan.summary.hard === 0 ? 'No breaker trips with this plan.' : 'Better, but not fully fixable by moving plugs.';
  el.innerHTML = `
    <div class="compare" role="group" aria-label="Before and after">
      <div><h4>Now</h4><dl>
        <dt>Breakers that trip</dt><dd class="${cls(b.trips, 'bad')}">${b.trips}</dd>
        <dt>Heater circuits over 80%</dt><dd class="${cls(b.tight, 'warn')}">${b.tight}</dd>
        <dt>Heaters on a strip</dt><dd class="${cls(b.strip, 'bad')}">${b.strip}</dd>
      </dl></div>
      <div><h4>With the plan</h4><dl>
        <dt>Breakers that trip</dt><dd class="${cls(a.trips, 'bad')}">${a.trips}</dd>
        <dt>Heater circuits over 80%</dt><dd class="${cls(a.tight, 'warn')}">${a.tight}</dd>
        <dt>Heaters on a strip</dt><dd class="${cls(a.strip, 'bad')}">${a.strip}</dd>
      </dl></div>
    </div>
    <p class="plan-verdict">${verdict}</p>
    ${steps.length ? `<ol class="plan-steps">${steps.map((s) => `<li><span><strong>${esc(s.title)}</strong><span class="why">${esc(s.why)}</span></span></li>`).join('')}</ol>` : '<p class="plan-hint">No changes needed.</p>'}
    ${left.length ? `<div class="leftover"><h4>Still over after the plan</h4><ul>${left.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
    <div class="plan-actions">
      <button class="btn small" type="button" id="btn-toggle">${showPlan ? 'Show how it is now' : 'Show the plan on the table'}</button>
      <button class="btn small" type="button" id="btn-apply">${ICON.check}I moved them, save the plan</button>
    </div>
    <p class="plan-meta">Checked ${plan.searched.toLocaleString('en-US')} combinations in your browser. Morning and evening routines are judged; "Everything at once" is shown for reference.</p>`;
}

function renderSelects() {
  const lib = $('#sel-lib');
  if (!lib.options.length) {
    lib.innerHTML = LIBRARY.map((x) => `<option value="${x.key}">${esc(x.name)}</option>`).join('');
    $('#form-device').watts.value = LIBRARY[0].watts;
  }
  $('#sel-outlet').innerHTML = state.home.outlets.map((o) => `<option value="${esc(o.id)}">${esc(o.room)}: ${esc(o.name)}</option>`).join('');
}

// ---------- Events ----------
document.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.s) { state.scenario = t.dataset.s; save(); render(); return; }
  if (t.dataset.del) {
    state.home.devices = state.home.devices.filter((d) => d.id !== t.dataset.del);
    changed();
    return;
  }
  switch (t.id) {
    case 'btn-sample': state = { home: sampleHome(), scenario: 'morning' }; changed(); break;
    case 'btn-new':
      if (state.home.devices.length && !confirm('Clear everything and start with an empty home?')) return;
      state = { home: emptyHome(), scenario: 'morning' }; changed();
      document.getElementById('add-outlet').open = true;
      break;
    case 'btn-solve': {
      t.disabled = true;
      t.lastChild.textContent = ' Checking every combination…';
      setTimeout(() => {
        plan = solve(state.home);
        showPlan = !!plan.ok;
        t.disabled = false;
        t.lastChild.textContent = ' Find a safe plug plan';
        render();
      }, 30);
      break;
    }
    case 'btn-toggle': showPlan = !showPlan; render(); break;
    case 'btn-apply': {
      for (const d of state.home.devices) Object.assign(d, { outletId: plan.placement[d.id].outletId, strip: plan.placement[d.id].strip, lowIn: plan.placement[d.id].lowIn });
      changed();
      break;
    }
    case 'btn-map': openMap(); break;
    default:
  }
});

document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.outlet) {
    const d = state.home.devices.find((x) => x.id === t.dataset.outlet);
    d.outletId = t.value;
    changed();
  } else if (t.dataset.watts) {
    const d = state.home.devices.find((x) => x.id === t.dataset.watts);
    const w = Math.round(Number(t.value));
    if (w > 0 && w <= 3000) { d.watts = w; if (d.lowWatts && d.lowWatts >= w) d.lowWatts = Math.round(w / 2); changed(); } else { t.value = d.watts; }
  } else if (t.id === 'sel-lib') {
    const item = LIBRARY.find((x) => x.key === t.value);
    const f = $('#form-device');
    f.watts.value = item.watts;
    f.movable.checked = item.kind === 'heater';
  }
});

let uid = Date.now();
const newId = (p) => `${p}${(uid++).toString(36)}`;

$('#form-outlet').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  state.home.outlets.push({ id: newId('o'), name: f.name.value.trim(), room: f.room.value.trim() });
  f.name.value = '';
  f.name.focus();
  changed();
});

$('#form-device').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  if (!state.home.outlets.length) { alert('Add an outlet first.'); return; }
  const item = LIBRARY.find((x) => x.key === f.lib.value);
  const when = ['morning', 'evening'].filter((w) => f[w].checked);
  const watts = Math.round(Number(f.watts.value));
  state.home.devices.push({
    id: newId('d'), name: item.name, watts, lowWatts: item.lowWatts ? Math.min(item.lowWatts, Math.round(watts / 2)) : undefined,
    kind: item.kind, outletId: f.outlet.value, strip: f.strip.checked, when, movable: f.movable.checked,
  });
  changed();
});

// ---------- Breaker mapping ----------
function openMap() {
  const h = state.home;
  const dlg = $('#map-dialog');
  if (!h.outlets.length) { alert('Add the outlets in each room first.'); return; }
  const rooms = [...new Set(h.outlets.map((o) => o.room))];
  $('#map-outlets').innerHTML = rooms.map((room) => `<div class="room-h">${esc(room)}</div>${h.outlets.filter((o) => o.room === room).map((o) => {
    const c = o.circuitId ? (h.circuits.find((x) => x.id === o.circuitId) || {}).label : '';
    return `<label class="chk"><input type="checkbox" name="o" value="${esc(o.id)}">${esc(o.name)}${c ? ` <span class="muted">(now ${esc(c)})</span>` : ''}</label>`;
  }).join('')}`).join('');
  const f = $('#form-map');
  let n = h.circuits.length + 1;
  while (h.circuits.some((x) => x.label.toLowerCase() === `breaker ${n}`)) n++;
  f.label.value = `Breaker ${n}`;
  $('#map-error').textContent = '';
  dlg.showModal();
}

$('#form-map').addEventListener('submit', (e) => {
  const f = e.target;
  if (e.submitter && e.submitter.value === 'cancel') return;
  const picked = [...f.querySelectorAll('input[name="o"]:checked')].map((x) => x.value);
  if (!picked.length) { e.preventDefault(); $('#map-error').textContent = 'Tick at least one outlet that lost power.'; return; }
  const label = f.label.value.trim() || `Breaker ${state.home.circuits.length + 1}`;
  let c = state.home.circuits.find((x) => x.label.toLowerCase() === label.toLowerCase());
  if (!c) { c = { id: newId('c'), label, amps: 15 }; state.home.circuits.push(c); }
  c.amps = Number(f.amps.value);
  for (const o of state.home.outlets) if (picked.includes(o.id)) o.circuitId = c.id;
  // drop breakers that no longer have outlets
  state.home.circuits = state.home.circuits.filter((x) => state.home.outlets.some((o) => o.circuitId === x.id));
  changed();
});

render();
// expose for debugging in the console
window.whichplug = { state: () => state, VOLTS };
