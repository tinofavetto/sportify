// Datumsphasen und Tagesausnahmen für plan/current.json.
// Reine Funktionen, ohne Trainingsverlauf und ohne persönliche Plandaten.
// Wochentage: "0" = Sonntag … "6" = Samstag (wie Date.getDay()).
// Schema: docs/plan-phasen.md
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SportifyPhase = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const WD_NAME = {
    so: 0, su: 0, sun: 0, sonntag: 0,
    mo: 1, mon: 1, montag: 1,
    di: 2, tu: 2, tue: 2, dienstag: 2,
    mi: 3, we: 3, wed: 3, mittwoch: 3,
    do: 4, th: 4, thu: 4, donnerstag: 4,
    fr: 5, fri: 5, freitag: 5,
    sa: 6, sat: 6, samstag: 6
  };
  const SKIP = new Set(['phases', 'exceptions', 'dayOverrides']);
  const REPLACE = ['warmup', 'supersetNote', 'notInPlan', 'muscleTarget', 'warmSteps', 'notes', 'planStart'];
  const SHALLOW = ['goal', 'rules', 'sleep', 'steps', 'supplements', 'deload'];

  function pad(n) { return String(n).padStart(2, '0'); }
  function safeKey(k) { return k !== '__proto__' && k !== 'constructor' && k !== 'prototype'; }
  function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function isISO(s) { return typeof s === 'string' && ISO.test(s); }

  function berlinISO(now) {
    const d = now instanceof Date ? now : new Date(now);
    if (isNaN(d.getTime())) throw new Error('ungültiges Datum');
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(d);
    const g = t => parts.find(p => p.type === t).value;
    return g('year') + '-' + g('month') + '-' + g('day');
  }

  function weekday(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
  }

  function addDays(iso, n) {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + n, 12));
    return dt.getUTCFullYear() + '-' + pad(dt.getUTCMonth() + 1) + '-' + pad(dt.getUTCDate());
  }

  function normWd(k) {
    if (typeof k === 'number' && k >= 0 && k <= 6) return String(k);
    const s = String(k).trim().toLowerCase();
    if (/^[0-6]$/.test(s)) return s;
    if (Object.prototype.hasOwnProperty.call(WD_NAME, s)) return String(WD_NAME[s]);
    return null;
  }

  function asWeekMap(week) {
    const w = {};
    if (!week) return w;
    if (Array.isArray(week)) {
      week.forEach((v, i) => { if (v != null && i <= 6) w[String(i)] = v; });
      return w;
    }
    for (const [k, v] of Object.entries(week)) {
      const wd = normWd(k);
      if (wd != null && v != null) w[wd] = v;
    }
    return w;
  }

  function mergeSchedule(dst, src) {
    dst.schedule = dst.schedule ? asWeekMap(dst.schedule) : {};
    for (const [k, v] of Object.entries(src || {})) {
      if (!safeKey(k)) continue;
      const wd = normWd(k);
      if (wd == null) continue;
      if (v == null) delete dst.schedule[wd];
      else dst.schedule[wd] = v;
    }
  }

  function mergeWeek(dst, src) {
    dst.week = asWeekMap(dst.week);
    for (const [k, v] of Object.entries(src || {})) {
      if (!safeKey(k)) continue;
      const wd = normWd(k);
      if (wd == null) continue;
      if (v == null) delete dst.week[wd];
      else dst.week[wd] = v;
    }
  }

  function mergeKeyed(dst, field, src) {
    dst[field] = Object.assign({}, dst[field] || {});
    for (const [k, v] of Object.entries(src || {})) {
      if (!safeKey(k)) continue;
      if (v == null) delete dst[field][k];
      else dst[field][k] = clone(v);
    }
  }

  function mergeExercises(dst, src) {
    dst.exercises = Object.assign({}, dst.exercises || {});
    for (const [id, v] of Object.entries(src || {})) {
      if (!safeKey(id)) continue;
      if (v == null) { delete dst.exercises[id]; continue; }
      dst.exercises[id] = Object.assign({}, dst.exercises[id] || {}, clone(v));
    }
  }

  function applyOverlay(dst, src, day) {
    if (!src || typeof src !== 'object') return dst;
    if (src.schedule) mergeSchedule(dst, src.schedule);
    if (src.week) mergeWeek(dst, src.week);
    if (src.sessions) mergeKeyed(dst, 'sessions', src.sessions);
    if (src.extras) mergeKeyed(dst, 'extras', src.extras);
    if (src.exercises) mergeExercises(dst, src.exercises);
    for (const k of REPLACE) if (src[k] !== undefined) dst[k] = clone(src[k]);
    for (const k of SHALLOW) {
      if (src[k] && typeof src[k] === 'object') dst[k] = Object.assign({}, dst[k] || {}, clone(src[k]));
    }
    if (src.note && !day) dst._phaseNote = String(src.note);
    if (!day) return dst;
    if (src.type != null && src.type !== '') dst._dayType = String(src.type);
    if (src.title) dst._dayTitle = String(src.title);
    if (src.note) dst._dayNote = String(src.note);
    if (src.skipLegs) dst._skipLegs = true;
    if (src.factor != null) dst._factor = +src.factor;
    if (src.setFactor != null) dst._setFactor = +src.setFactor;
    if (Array.isArray(src.forbid)) dst._forbid = src.forbid.map(String);
    if (Array.isArray(src.optionalItems)) dst._optionalItems = clone(src.optionalItems);
    if (src.session && dst._dayType) {
      dst.sessions = Object.assign({}, dst.sessions || {});
      dst.sessions[dst._dayType] = clone(src.session);
    }
    if (Array.isArray(src.items) && dst._dayType) {
      dst.sessions = Object.assign({}, dst.sessions || {});
      const cur = dst.sessions[dst._dayType] || { name: dst._dayType };
      dst.sessions[dst._dayType] = Object.assign({}, cur, { items: clone(src.items) });
    }
    return dst;
  }

  function baseCopy(plan) {
    const dst = {};
    for (const [k, v] of Object.entries(plan || {})) {
      if (!safeKey(k) || SKIP.has(k)) continue;
      dst[k] = clone(v);
    }
    if (dst.schedule) dst.schedule = asWeekMap(dst.schedule);
    return dst;
  }

  function phasesFor(plan, date) {
    const list = Array.isArray(plan && plan.phases) ? plan.phases : [];
    return list.filter(p => p && isISO(p.from) && p.from <= date && (!p.until || (isISO(p.until) && date <= p.until)))
      .sort((a, b) => a.from < b.from ? -1 : a.from > b.from ? 1 : String(a.id || '').localeCompare(String(b.id || '')));
  }

  function exceptionFor(plan, date) {
    const bag = plan && (plan.exceptions || plan.dayOverrides);
    if (!bag || typeof bag !== 'object') return null;
    const x = bag[date];
    return x && typeof x === 'object' ? x : null;
  }

  const resolvedCache = new WeakMap();
  function resolvePlan(plan, date) {
    const src = plan && typeof plan === 'object' ? plan : {};
    let byDate = resolvedCache.get(src);
    if (!byDate) { byDate = new Map(); resolvedCache.set(src, byDate); }
    if (byDate.has(date)) return byDate.get(date);
    const dst = baseCopy(src);
    const applied = isISO(date) ? phasesFor(src, date) : [];
    for (const p of applied) applyOverlay(dst, p, false);
    const ex = isISO(date) ? exceptionFor(src, date) : null;
    if (ex) applyOverlay(dst, ex, true);
    dst._phases = applied.map(p => p.id || p.from);
    dst._phaseFrom = applied.length ? applied[applied.length - 1].from : null;
    byDate.set(date, dst);
    return dst;
  }

  function scheduleSlot(plan, date) {
    const resolved = resolvePlan(plan, date);
    let slot;
    let legacy = false;
    if (resolved._dayType) slot = resolved._dayType;
    else if (resolved.schedule && Object.keys(resolved.schedule).length) {
      const x = resolved.schedule[String(weekday(date))];
      slot = x == null || x === '' ? 'rest' : String(x);
    } else {
      legacy = true;
      const wd = weekday(date);
      if (wd === 1 || wd === 3 || wd === 5) slot = 'AB';
      else if (wd === 2 || wd === 4) slot = 'cardio';
      else if (wd === 6) slot = 'interval';
      else slot = 'rest';
    }
    if (!resolved._dayType && resolved._forbid && resolved._forbid.includes(slot)) slot = 'rest';
    return { slot, resolved, legacy };
  }

  function hasExplicitType(logs, date) {
    const dy = logs && logs[date];
    return !!(dy && dy.type);
  }
  function explicitStrength(logs, date) {
    const dy = logs && logs[date];
    if (!dy || (dy.type !== 'A' && dy.type !== 'B')) return null;
    return dy.type;
  }

  function abLetter(plan, date, logs) {
    const start = plan && isISO(plan.planStart) ? plan.planStart : addDays(date, -400);
    const from = start <= date ? start : addDays(date, -400);
    let letter = null;
    for (let k = from; k <= date; k = addDays(k, 1)) {
      if (hasExplicitType(logs, k) && k < date) {
        const s = explicitStrength(logs, k);
        if (s) letter = s;
        continue;
      }
      const slot = scheduleSlot(plan, k).slot;
      if (slot === 'A' || slot === 'B') {
        letter = slot;
        if (k === date) return letter;
        continue;
      }
      if (slot === 'AB') {
        letter = letter === 'A' ? 'B' : 'A';
        if (k === date) return letter;
      }
    }
    return letter || 'A';
  }

  function plannedType(plan, date, logs) {
    if (!plan || !isISO(date)) return 'rest';
    const slot = scheduleSlot(plan, date).slot;
    if (slot !== 'AB') return slot;
    return abLetter(plan, date, logs || {});
  }

  function typeOf(plan, date, logs) {
    const dy = logs && logs[date];
    if (dy && dy.type) return String(dy.type);
    return plannedType(plan, date, logs || {});
  }

  return {
    berlinISO, weekday, addDays, normWd, resolvePlan, scheduleSlot, plannedType, abLetter, typeOf
  };
});
