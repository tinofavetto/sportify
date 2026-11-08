const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const phase = require('../plan-phase.js');

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '../examples/phase-fictional.json'), 'utf8'));
const plan = fixture.plan;
const anchor = { '2026-11-06': { type: 'B', seed: true } };

function ids(items) { return (items || []).map(it => it.ex); }

test('Europe/Berlin calendar date, including the CET midnight after UTC', () => {
  assert.equal(phase.berlinISO(new Date('2026-11-07T22:30:00Z')), '2026-11-07');
  assert.equal(phase.berlinISO(new Date('2026-11-07T23:30:00Z')), '2026-11-08');
  assert.equal(phase.weekday('2026-11-06'), 5);
  assert.equal(phase.weekday('2026-11-07'), 6);
  assert.equal(phase.weekday('2026-11-09'), 1);
});

test('anchored last B Fri 2026-11-06 follows Mon/Wed/Sat continuously, not Mo/Wed/Fri and not a weekly reset', () => {
  const expect = {
    '2026-11-07': 'cardio',
    '2026-11-08': 'rest',
    '2026-11-09': 'A',
    '2026-11-10': 'cardio',
    '2026-11-11': 'B',
    '2026-11-13': 'recovery',
    '2026-11-14': 'A',
    '2026-11-16': 'B',
    '2026-11-18': 'A',
    '2026-11-21': 'B'
  };
  for (const [date, slot] of Object.entries(expect)) {
    assert.equal(phase.plannedType(plan, date, anchor), slot, date);
    assert.equal(phase.typeOf(plan, date, anchor), slot, date);
  }
  assert.equal(phase.typeOf(plan, '2026-11-06', anchor), 'B');
  assert.equal(phase.weekday('2026-11-16'), 1);
  assert.notEqual(phase.plannedType(plan, '2026-11-16', anchor), 'A');
});

test('2026-11-07 replaces the Saturday interval with a flat walk and does not prescribe the heavy leg session', () => {
  const day = phase.resolvePlan(plan, '2026-11-07');
  assert.equal(day._dayType, 'cardio');
  assert.equal(day._skipLegs, true);
  assert.match(day._dayNote, /kein automatisches schweres Beintraining/);
  assert.equal(day.sessions.cardio.name, 'Fiktiv locker gehen');
  assert.equal(day.sessions.cardio.rec.incline, 1);
  assert.equal(day.sessions.cardio.segments.step, 0);
  assert.equal(day.sessions.cardio.walkOnly, true);
  assert.deepEqual(ids(day._optionalItems), ['fiktiv-technik']);
  assert.equal(day.exercises['fiktiv-technik'].n, 'Fiktive Technik');
  assert.ok(ids(day.sessions.A.items).includes('fiktiv-bein'));
  assert.notEqual(phase.plannedType(plan, '2026-11-07', anchor), 'interval');
  assert.notEqual(phase.plannedType(plan, '2026-11-07', anchor), 'A');
  assert.notEqual(phase.plannedType(plan, '2026-11-07', anchor), 'B');
});

test('phase replaces sessions, warm-up and exercise cues from its effective date only', () => {
  const before = phase.resolvePlan(plan, '2026-11-06');
  const after = phase.resolvePlan(plan, '2026-11-09');
  assert.deepEqual(ids(before.sessions.A.items), ['fiktiv-bein', 'fiktiv-druecken']);
  assert.equal(before.sessions.A.name, 'Fiktiv A');
  assert.equal(before.warmSteps[0].t, 'Basis warm');
  assert.deepEqual(before.exercises['fiktiv-druecken'].cues, ['Basis-Cue']);
  assert.equal(before._phaseFrom, null);
  assert.deepEqual(ids(after.sessions.A.items), ['fiktiv-druecken', 'fiktiv-technik']);
  assert.equal(after.sessions.A.name, 'Fiktiv A neu');
  assert.equal(after.sessions.B.name, 'Fiktiv B neu');
  assert.equal(after.warmSteps[0].t, 'Phase warm');
  assert.deepEqual(after.exercises['fiktiv-druecken'].cues, ['Phase: kontrolliert, nicht bis zum Versagen.']);
  assert.equal(after.exercises['fiktiv-druecken'].n, 'Fiktives Drücken');
  assert.equal(after.exercises['fiktiv-technik'].n, 'Fiktive Technik');
  assert.equal(after._phaseFrom, '2026-11-09');
  assert.equal(after.week['2'], 'Cardio Basis');
  assert.equal(after.week['5'], 'Aktive Erholung');
  assert.equal(after.sessions.cardio.name, 'Fiktiv Walk');
  assert.equal(after.sessions.recovery.segments.step, 0);
});

test('Tuesday stays on the inherited cardio session; the one-day walk does not leak', () => {
  const tue = phase.resolvePlan(plan, '2026-11-10');
  const sat = phase.resolvePlan(plan, '2026-11-14');
  assert.equal(phase.plannedType(plan, '2026-11-10', anchor), 'cardio');
  assert.equal(tue.sessions.cardio.name, 'Fiktiv Walk');
  assert.equal(tue.sessions.cardio.segments.step, 2);
  assert.equal(sat.sessions.cardio.name, 'Fiktiv Walk');
  assert.equal(phase.plannedType(plan, '2026-11-14', anchor), 'A');
});

test('resolve does not mutate the published plan or the training log', () => {
  const planSnap = JSON.stringify(plan);
  const log = { '2026-11-06': { type: 'B', sets: { 'fiktiv-ziehen': [{ done: true, w: 25, r: 8 }] } } };
  const logSnap = JSON.stringify(log);
  phase.plannedType(plan, '2026-11-21', log);
  phase.resolvePlan(plan, '2026-11-09');
  assert.equal(JSON.stringify(plan), planSnap);
  assert.equal(JSON.stringify(log), logSnap);
});

test('a plan without phases keeps its sessions and uses only configured strength weekdays', () => {
  const steffi = {
    planStart: '2026-11-02',
    schedule: { '0': 'rest', '1': 'rest', '2': 'AB', '3': 'cardio', '4': 'AB', '5': 'rest', '6': 'rest' },
    sessions: {
      A: { name: 'Steffi A', items: [{ ex: 'demo-a', sets: 2, lo: 8, hi: 10, rec: [[10, 8]] }] },
      B: { name: 'Steffi B', items: [{ ex: 'demo-b', sets: 2, lo: 8, hi: 10, rec: [[8, 8]] }] },
      rest: { desc: 'Ruhe' }
    }
  };
  const snap = JSON.stringify(steffi);
  assert.equal(phase.plannedType(steffi, '2026-11-02', {}), 'rest');
  assert.equal(phase.plannedType(steffi, '2026-11-03', {}), 'A');
  assert.equal(phase.plannedType(steffi, '2026-11-04', {}), 'cardio');
  assert.equal(phase.plannedType(steffi, '2026-11-05', {}), 'B');
  assert.equal(phase.plannedType(steffi, '2026-11-09', {}), 'rest');
  assert.equal(phase.plannedType(steffi, '2026-11-10', {}), 'A');
  assert.equal(phase.plannedType(steffi, '2026-11-12', {}), 'B');
  assert.equal(phase.resolvePlan(steffi, '2026-11-10').sessions.A.name, 'Steffi A');
  assert.equal(JSON.stringify(steffi), snap);
});

test('without a schedule the legacy Mon/Wed/Fri pattern remains, but unlogged strength days still alternate', () => {
  const legacy = { planStart: '2026-11-02', sessions: { A: { name: 'A', items: [] }, B: { name: 'B', items: [] } } };
  const logs = { '2026-11-06': { type: 'B' } };
  assert.equal(phase.scheduleSlot(legacy, '2026-11-09').legacy, true);
  assert.equal(phase.plannedType(legacy, '2026-11-07', logs), 'interval');
  assert.equal(phase.plannedType(legacy, '2026-11-08', logs), 'rest');
  assert.equal(phase.plannedType(legacy, '2026-11-09', logs), 'A');
  assert.equal(phase.plannedType(legacy, '2026-11-10', logs), 'cardio');
  assert.equal(phase.plannedType(legacy, '2026-11-11', logs), 'B');
  assert.equal(phase.plannedType(legacy, '2026-11-13', logs), 'A');
});

test('a logged non-strength day does not consume a letter; an explicit strength day re-anchors', () => {
  const p = {
    planStart: '2026-11-09',
    schedule: { '1': 'AB', '3': 'AB', '6': 'AB' }
  };
  const skipped = { '2026-11-09': { type: 'rest' } };
  assert.equal(phase.plannedType(p, '2026-11-11', skipped), 'A');
  const forced = { '2026-11-09': { type: 'B' } };
  assert.equal(phase.plannedType(p, '2026-11-11', forced), 'A');
  assert.equal(phase.typeOf(p, '2026-11-09', forced), 'B');
});

test('fixed A/B weekdays keep that letter and the next AB continues from it', () => {
  const p = {
    planStart: '2026-11-09',
    schedule: { '1': 'A', '3': 'AB', '6': 'B' }
  };
  assert.equal(phase.plannedType(p, '2026-11-09', {}), 'A');
  assert.equal(phase.plannedType(p, '2026-11-11', {}), 'B');
  assert.equal(phase.plannedType(p, '2026-11-14', {}), 'B');
  assert.equal(phase.plannedType(p, '2026-11-16', {}), 'A');
});

test('overlapping phases: later from wins, until is inclusive, weekday names are accepted', () => {
  const p = {
    planStart: '2026-11-01',
    schedule: { mo: 'AB', fr: 'AB' },
    sessions: { A: { name: 'alt', items: [{ ex: 'alt' }] }, cardio: { name: 'walk' } },
    phases: [
      { id: 'long', from: '2026-11-01', until: '2026-11-30', sessions: { A: { name: 'lang', items: [{ ex: 'lang' }] } }, schedule: { '1': 'cardio' } },
      { id: 'short', from: '2026-11-09', until: '2026-11-09', sessions: { A: { name: 'kurz', items: [{ ex: 'kurz' }] } } }
    ]
  };
  assert.equal(phase.resolvePlan(p, '2026-11-08').sessions.A.name, 'lang');
  assert.equal(phase.plannedType(p, '2026-11-09', {}), 'cardio');
  assert.equal(phase.resolvePlan(p, '2026-11-09').sessions.A.name, 'kurz');
  assert.equal(phase.resolvePlan(p, '2026-11-10').sessions.A.name, 'lang');
  assert.equal(phase.scheduleSlot(p, '2026-11-06').slot, 'AB');
  assert.equal(phase.plannedType(p, '2026-11-06', {}), 'A');
});

test('shallow merges keep unspecified deload and goal fields; null removes an extra', () => {
  const p = {
    planStart: '2026-11-01',
    deload: { start: '2026-10-01', cycleWeeks: 5, setFactor: 0.6, weightFactor: 0.9 },
    goal: { text: 'alt', protein: 140 },
    extras: { peloton: { name: 'Peloton', min: 20 }, arms: { name: 'Arme', min: 10 } },
    phases: [{
      from: '2026-11-09',
      deload: { start: '2026-12-01' },
      goal: { text: 'neu' },
      extras: { arms: null, core: { name: 'Core', min: 8 } }
    }]
  };
  const day = phase.resolvePlan(p, '2026-11-09');
  assert.equal(day.deload.start, '2026-12-01');
  assert.equal(day.deload.cycleWeeks, 5);
  assert.equal(day.goal.text, 'neu');
  assert.equal(day.goal.protein, 140);
  assert.equal(day.extras.peloton.name, 'Peloton');
  assert.equal(day.extras.arms, undefined);
  assert.equal(day.extras.core.name, 'Core');
  assert.equal(phase.resolvePlan(p, '2026-11-08').goal.text, 'alt');
});

test('forbid without an explicit type blocks a scheduled interval', () => {
  const p = {
    planStart: '2026-11-01',
    schedule: { '6': 'interval' },
    exceptions: { '2026-11-07': { forbid: ['interval'] } }
  };
  assert.equal(phase.plannedType(p, '2026-11-07', {}), 'rest');
  assert.equal(phase.plannedType(p, '2026-11-14', {}), 'interval');
});

test('an array week keeps untouched days when a phase overrides one weekday', () => {
  const p = {
    planStart: '2026-11-01',
    week: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'],
    phases: [{ from: '2026-11-09', week: { fr: 'Aktiv' } }]
  };
  const day = phase.resolvePlan(p, '2026-11-09');
  assert.equal(day.week['5'], 'Aktiv');
  assert.equal(day.week['1'], 'Montag');
  assert.equal(day.week['2'], 'Dienstag');
});

test('public app wires the resolver, Berlin today, and the service-worker cache', () => {
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.match(html, /<script src="plan-phase\.js"><\/script>/);
  assert.match(html, /SportifyPhase\.plannedType/);
  assert.match(html, /SportifyPhase\.berlinISO/);
  assert.match(html, /Europe\/Berlin/);
  assert.match(sw, /plan-phase\.js/);
  assert.doesNotMatch(sw, /sportify-0d0b46b5/);
  assert.doesNotMatch(html, /fiktiv-bein|private\.js/);
  assert.match(html, /APP_VER='20261108-1415'/);
});
