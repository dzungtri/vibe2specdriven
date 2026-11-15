'use strict';
/* =========================================================
   CầmCố+ — Quản lý vay cầm cố cổ phiếu, tính lãi theo ngày
   Lãi ngày = Dư nợ gốc cuối ngày × Lãi suất năm / 365
   Quá hạn: lãi suất × hệ số phạt (mặc định 150%)
   Thanh toán: ưu tiên trừ lãi chưa trả trước, sau đó trừ gốc
   ========================================================= */

const KEY = 'camco.v1';
const DAY = 86400000;
const BASIS = 365;

// ---------- helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toDN = s => Math.round(Date.parse(s + 'T00:00:00Z') / DAY);
const fromDN = n => new Date(n * DAY).toISOString().slice(0, 10);
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const num = n => Math.round(n).toLocaleString('vi-VN');
const vnd = n => num(n) + ' ₫';
const short = n => {
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' tỷ';
  if (a >= 1e6) return (n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' tr';
  return num(n);
};
const pct = (x, d = 1) => (x * 100).toLocaleString('vi-VN', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';
const dmy = s => (s ? s.split('-').reverse().join('/') : '');
const uid = () => Math.random().toString(36).slice(2, 9);
const parseNum = v => Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const PALETTE = ['#2f6bff', '#7a5cff', '#12b76a', '#f79009', '#ef4f8b', '#0bb3c7', '#9b6b3f', '#5f6b85'];
const symColor = sym => PALETTE[[...sym].reduce((s, c) => s + c.charCodeAt(0), 0) % PALETTE.length];

// ---------- state ----------
function seed() {
  const t = toDN(todayStr());
  return {
    asOf: todayStr(),
    view: 'dashboard',
    selLoan: null,
    scenario: 0,
    holdings: [
      { sym: 'FPT', name: 'CTCP FPT', qty: 5000, price: 128500, prev: 127000, ratio: 50 },
      { sym: 'VCB', name: 'NH TMCP Ngoại thương Việt Nam', qty: 3000, price: 92300, prev: 92800, ratio: 50 },
      { sym: 'HPG', name: 'CTCP Tập đoàn Hòa Phát', qty: 20000, price: 26450, prev: 26100, ratio: 40 },
      { sym: 'MWG', name: 'CTCP Đầu tư Thế Giới Di Động', qty: 4000, price: 61200, prev: 62000, ratio: 40 },
      { sym: 'TCB', name: 'NH TMCP Kỹ thương Việt Nam', qty: 10000, price: 24100, prev: 23950, ratio: 45 },
      { sym: 'VNM', name: 'CTCP Sữa Việt Nam', qty: 2000, price: 63800, prev: 63800, ratio: 50 },
    ],
    banks: [
      { id: 'tcb', name: 'Techcombank', short: 'TCB', color: '#e3262f', rate: 9.5, overdue: 150, warn: 60, call: 70 },
      { id: 'vpb', name: 'VPBank', short: 'VPB', color: '#00a651', rate: 10.5, overdue: 150, warn: 60, call: 70 },
      { id: 'mb', name: 'MB Bank', short: 'MB', color: '#1e3f96', rate: 9.8, overdue: 150, warn: 60, call: 70 },
      { id: 'bidv', name: 'BIDV', short: 'BIDV', color: '#0a7e8c', rate: 8.9, overdue: 150, warn: 55, call: 65 },
    ],
    loans: [
      {
        id: uid(), code: 'HĐ-2026-001', bankId: 'tcb', principal: 340e6, rate: 9.5, startDate: fromDN(t - 75), termDays: 180,
        pledges: [{ sym: 'FPT', qty: 4000 }, { sym: 'VCB', qty: 2000 }],
        payments: [{ id: uid(), date: fromDN(t - 44), amount: 30e6, note: 'Trả lãi + một phần gốc' }],
      },
      {
        id: uid(), code: 'HĐ-2026-002', bankId: 'mb', principal: 150e6, rate: 9.8, startDate: fromDN(t - 196), termDays: 180,
        pledges: [{ sym: 'HPG', qty: 15000 }], payments: [],
      },
      {
        id: uid(), code: 'HĐ-2026-003', bankId: 'vpb', principal: 70e6, rate: 10.5, startDate: fromDN(t - 20), termDays: 90,
        pledges: [{ sym: 'MWG', qty: 3000 }], payments: [],
      },
    ],
  };
}
let state;
try { state = JSON.parse(localStorage.getItem(KEY)) || seed(); } catch { state = seed(); }
const save = () => localStorage.setItem(KEY, JSON.stringify(state));

const bankOf = id => state.banks.find(b => b.id === id) || { id, name: '(đã xóa)', short: '?', color: '#999', rate: 10, overdue: 150, warn: 60, call: 70 };
const holdingOf = sym => state.holdings.find(h => h.sym === sym);
const priceOf = (sym, shock = 0) => (holdingOf(sym)?.price || 0) * (1 + shock);

// ---------- interest engine ----------
function computeLoan(loan, asOfStr) {
  const bank = bankOf(loan.bankId);
  const start = toDN(loan.startDate);
  const asOf = toDN(asOfStr);
  const maturity = start + loan.termDays;
  const pays = [...loan.payments].sort((a, b) => a.date.localeCompare(b.date));
  const r = {
    bal: loan.principal, unpaid: 0, totalInt: 0, paidInt: 0, paidPrin: 0, rows: [],
    closed: false, closedDate: null, maturity: fromDN(maturity), notStarted: asOf < start,
    overdueDays: 0, dailyNow: 0, rateNow: loan.rate, payLog: [], daysElapsed: 0, daysLeft: maturity - asOf,
  };
  if (r.notStarted) { r.debt = 0; return r; }
  let pi = 0;
  for (let d = start; d <= asOf; d++) {
    let prinPaid = 0, intPaid = 0;
    while (pi < pays.length && toDN(pays[pi].date) <= d) {
      let amt = pays[pi].amount;
      const a = Math.min(amt, r.unpaid); r.unpaid -= a; amt -= a; r.paidInt += a; intPaid += a;
      const b = Math.min(amt, r.bal); r.bal -= b; amt -= b; r.paidPrin += b; prinPaid += b;
      r.payLog.push({ ...pays[pi], toInt: a, toPrin: b, excess: amt });
      pi++;
    }
    if (r.bal < 0.5) r.bal = 0;
    if (r.unpaid < 0.5) r.unpaid = 0;
    if (r.bal === 0 && r.unpaid === 0) { r.closed = true; r.closedDate = fromDN(d); break; }
    const overdue = d >= maturity;
    const rate = overdue ? loan.rate * bank.overdue / 100 : loan.rate;
    const interest = r.bal * rate / 100 / BASIS;
    if (d === asOf) { r.dailyNow = interest; r.rateNow = rate; break; }
    r.unpaid += interest; r.totalInt += interest;
    r.rows.push({ date: fromDN(d), bal: r.bal, rate, interest, cum: r.totalInt, unpaid: r.unpaid, prinPaid, intPaid, overdue });
  }
  // leftover payments after closure are ignored but logged
  while (pi < pays.length && toDN(pays[pi].date) <= asOf) { r.payLog.push({ ...pays[pi], toInt: 0, toPrin: 0, excess: pays[pi].amount }); pi++; }
  r.overdueDays = r.closed ? 0 : Math.max(0, asOf - maturity);
  r.daysElapsed = Math.max(0, (r.closed ? toDN(r.closedDate) : asOf) - start);
  r.daysLeft = maturity - asOf;
  r.debt = r.bal + r.unpaid;
  return r;
}

function analyze(shock = 0) {
  const res = state.loans.map(loan => {
    const c = computeLoan(loan, state.asOf);
    const bank = bankOf(loan.bankId);
    const mv = loan.pledges.reduce((s, p) => s + p.qty * priceOf(p.sym, shock), 0);
    const ltv = c.debt > 0 && mv > 0 ? c.debt / mv : 0;
    let status;
    if (c.notStarted) status = 'pending';
    else if (c.closed) status = 'closed';
    else if (ltv * 100 >= bank.call) status = 'call';
    else if (c.overdueDays > 0) status = 'overdue';
    else if (ltv * 100 >= bank.warn) status = 'warn';
    else status = 'ok';
    const dropToCall = c.debt > 0 && mv > 0 ? 1 - c.debt / (bank.call / 100 * mv) : null;
    const dropToWarn = c.debt > 0 && mv > 0 ? 1 - c.debt / (bank.warn / 100 * mv) : null;
    return { loan, bank, c, mv, ltv, status, dropToCall, dropToWarn };
  });
  const pledged = {};
  res.forEach(r => { if (r.status !== 'closed') r.loan.pledges.forEach(p => { pledged[p.sym] = (pledged[p.sym] || 0) + p.qty; }); });
  return { res, pledged };
}
const STATUS = {
  ok: 'An toàn', warn: 'Cảnh báo', call: 'Call margin', overdue: 'Quá hạn', closed: 'Đã tất toán', pending: 'Chờ giải ngân',
};
const badge = s => `<span class="badge ${s}">${STATUS[s]}</span>`;

// ---------- charts ----------
const charts = {};
function lineChart(id, labels, series, { h = 230, fmtY = short } = {}) {
  const W = 760, H = h, L = 58, R = 12, T = 12, B = 26;
  const n = labels.length;
  if (!n) return `<div class="empty"><div class="big">📉</div>Chưa có dữ liệu</div>`;
  const max = Math.max(1, ...series.flatMap(s => s.values)) * 1.1;
  const x = i => L + (n === 1 ? (W - L - R) / 2 : i * (W - L - R) / (n - 1));
  const y = v => T + (H - T - B) * (1 - v / max);
  let g = '';
  for (let k = 0; k <= 4; k++) {
    const v = max * k / 4, yy = y(v);
    g += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="#eef1f7"/><text class="axis" x="${L - 8}" y="${yy + 4}" text-anchor="end">${fmtY(v)}</text>`;
  }
  const step = Math.max(1, Math.ceil(n / 6));
  for (let i = 0; i < n; i += step) g += `<text class="axis" x="${x(i)}" y="${H - 6}" text-anchor="middle">${dmy(labels[i]).slice(0, 5)}</text>`;
  series.forEach((s, si) => {
    const pts = s.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    if (s.fill) g += `<defs><linearGradient id="gr${id}${si}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.color}" stop-opacity=".28"/><stop offset="1" stop-color="${s.color}" stop-opacity="0"/></linearGradient></defs><path d="M${x(0)},${y(0)} L${pts.join(' L')} L${x(n - 1)},${y(0)} Z" fill="url(#gr${id}${si})"/>`;
    g += `<polyline points="${pts.join(' ')}" fill="none" stroke="${s.color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" ${s.dash ? 'stroke-dasharray="5 4"' : ''}/>`;
  });
  g += `<line class="cursor" x1="0" x2="0" y1="${T}" y2="${H - B}" stroke="#0f1a33" stroke-opacity=".25" visibility="hidden"/>`;
  charts[id] = { labels, series, x, L, R, W, n };
  const legend = `<div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${s.name}</span>`).join('')}</div>`;
  return `${legend}<div class="chart" data-chart="${id}"><svg viewBox="0 0 ${W} ${H}">${g}</svg></div>`;
}
function barChart(id, labels, values, { h = 220, colors } = {}) {
  const W = 760, H = h, L = 58, R = 12, T = 12, B = 26;
  const n = labels.length;
  if (!n) return `<div class="empty">Chưa có dữ liệu</div>`;
  const max = Math.max(1, ...values) * 1.15;
  const bw = (W - L - R) / n;
  const y = v => T + (H - T - B) * (1 - v / max);
  let g = '';
  for (let k = 0; k <= 4; k++) {
    const v = max * k / 4, yy = y(v);
    g += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="#eef1f7"/><text class="axis" x="${L - 8}" y="${yy + 4}" text-anchor="end">${num(v / 1000)}k</text>`;
  }
  values.forEach((v, i) => {
    const yy = y(v);
    g += `<rect x="${L + i * bw + bw * .15}" y="${yy}" width="${bw * .7}" height="${Math.max(0, H - B - yy)}" rx="${Math.min(3, bw * .3)}" fill="${colors ? colors[i] : '#2f6bff'}"/>`;
  });
  const step = Math.max(1, Math.ceil(n / 6));
  for (let i = 0; i < n; i += step) g += `<text class="axis" x="${L + i * bw + bw / 2}" y="${H - 6}" text-anchor="middle">${dmy(labels[i]).slice(0, 5)}</text>`;
  g += `<line class="cursor" x1="0" x2="0" y1="${T}" y2="${H - B}" stroke="#0f1a33" stroke-opacity=".2" visibility="hidden"/>`;
  charts[id] = { labels, series: [{ name: 'Lãi phát sinh', color: '#2f6bff', values, fmt: vnd }], x: i => L + i * bw + bw / 2, L, R, W, n, bar: true };
  return `<div class="chart" data-chart="${id}"><svg viewBox="0 0 ${W} ${H}">${g}</svg></div>`;
}
function donut(items) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!total) return `<div class="empty"><div class="big">🗂️</div>Chưa có tài sản cầm cố</div>`;
  let a = -Math.PI / 2, paths = '';
  const R = 70, r = 46, c = 75;
  items.forEach(it => {
    const ang = it.value / total * Math.PI * 2;
    const a2 = a + ang - (items.length > 1 ? 0.02 : 0);
    const large = ang > Math.PI ? 1 : 0;
    const p = (rad, ang2) => `${c + rad * Math.cos(ang2)},${c + rad * Math.sin(ang2)}`;
    if (items.length === 1) paths += `<circle cx="${c}" cy="${c}" r="${(R + r) / 2}" fill="none" stroke="${it.color}" stroke-width="${R - r}"/>`;
    else paths += `<path d="M${p(R, a)} A${R},${R} 0 ${large} 1 ${p(R, a2)} L${p(r, a2)} A${r},${r} 0 ${large} 0 ${p(r, a)} Z" fill="${it.color}"/>`;
    a += ang;
  });
  paths += `<text x="${c}" y="${c - 2}" text-anchor="middle" font-size="15" font-weight="800" fill="#0f1a33">${short(total)}</text><text x="${c}" y="${c + 15}" text-anchor="middle" font-size="10" fill="#8a94ad">đang cầm cố</text>`;
  return `<div class="donut-wrap"><svg viewBox="0 0 150 150">${paths}</svg><div class="donut-list">${items.map(it => `<div class="it"><i style="width:10px;height:10px;border-radius:3px;background:${it.color};display:inline-block"></i><span>${esc(it.label)}</span><span>${pct(it.value / total)}</span></div>`).join('')}</div></div>`;
}
function bindCharts() {
  document.querySelectorAll('[data-chart]').forEach(el => {
    const cfg = charts[el.dataset.chart]; if (!cfg) return;
    const svg = el.querySelector('svg'), cur = svg.querySelector('.cursor'), tip = $('#tip');
    el.onmousemove = e => {
      const rect = svg.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width * cfg.W;
      const i = cfg.bar ? clamp(Math.floor((px - cfg.L) / ((cfg.W - cfg.L - cfg.R) / cfg.n)), 0, cfg.n - 1)
        : clamp(Math.round((px - cfg.L) / ((cfg.W - cfg.L - cfg.R) / Math.max(1, cfg.n - 1))), 0, cfg.n - 1);
      const xx = cfg.x(i); cur.setAttribute('x1', xx); cur.setAttribute('x2', xx); cur.setAttribute('visibility', 'visible');
      tip.innerHTML = `<div class="tt">${dmy(cfg.labels[i])}</div>` + cfg.series.map(s => `<div><span style="color:${s.color}">●</span> ${s.name}: <b>${(s.fmt || vnd)(s.values[i])}</b></div>`).join('');
      tip.classList.remove('hidden');
      tip.style.left = Math.min(e.clientX + 14, innerWidth - 290) + 'px'; tip.style.top = e.clientY + 14 + 'px';
    };
    el.onmouseleave = () => { tip.classList.add('hidden'); cur.setAttribute('visibility', 'hidden'); };
  });
}
function meter(ltv, bank) {
  const v = clamp(ltv * 100, 0, 100);
  const color = v >= bank.call ? 'var(--red)' : v >= bank.warn ? 'var(--amber)' : 'var(--green)';
  return `<div class="meter" style="--w:${bank.warn}%;--c:${bank.call}%"><div class="fill" style="width:${v}%;background:${color}"></div><div class="mark" style="left:${bank.warn}%"></div><div class="mark" style="left:${bank.call}%"></div></div>
  <div class="meter-legend"><span>LTV <b style="color:${color}">${pct(ltv)}</b></span><span>Cảnh báo ${bank.warn}% · Xử lý ${bank.call}%</span></div>`;
}
const symBadge = (sym, sub) => `<span class="sym"><span class="sym-badge" style="background:${symColor(sym)}">${esc(sym)}</span><span><div class="sym-name">${esc(sym)}</div>${sub ? `<div class="sym-sub">${esc(sub)}</div>` : ''}</span></span>`;
const bankDot = b => `<div class="bank-dot" style="background:${b.color}">${esc(b.short || b.name.slice(0, 3))}</div>`;

// ---------- views ----------
const NAV = [
  ['dashboard', '◧', 'Tổng quan'],
  ['loans', '₫', 'Khoản vay'],
  ['portfolio', '◔', 'Danh mục cổ phiếu'],
  ['scenario', '⚡', 'Kịch bản giá'],
  ['calculator', '∑', 'Máy tính lãi'],
  ['banks', '⌂', 'Ngân hàng'],
];
const TITLES = {
  dashboard: ['Tổng quan', 'Tình hình vay cầm cố và lãi tích lũy theo ngày'],
  loans: ['Khoản vay', 'Các hợp đồng cầm cố cổ phiếu với ngân hàng'],
  portfolio: ['Danh mục cổ phiếu', 'Cổ phiếu trong tài khoản chứng khoán & trạng thái phong tỏa'],
  scenario: ['Kịch bản giá', 'Stress-test: giá thị trường biến động thì LTV ra sao?'],
  calculator: ['Máy tính lãi', 'Ước tính lãi vay theo ngày & so sánh ngân hàng'],
  banks: ['Ngân hàng', 'Lãi suất, phạt quá hạn và ngưỡng cảnh báo'],
  loan: ['Chi tiết khoản vay', ''],
};

const V = {};

V.dashboard = () => {
  const { res, pledged } = analyze();
  const active = res.filter(r => !['closed', 'pending'].includes(r.status));
  const totalMV = state.holdings.reduce((s, h) => s + h.qty * h.price, 0);
  const pledgedMV = Object.entries(pledged).reduce((s, [sym, q]) => s + q * priceOf(sym), 0);
  const prin = active.reduce((s, r) => s + r.c.bal, 0);
  const unpaid = active.reduce((s, r) => s + r.c.unpaid, 0);
  const daily = active.reduce((s, r) => s + r.c.dailyNow, 0);
  const debt = prin + unpaid;
  const activeMV = active.reduce((s, r) => s + r.mv, 0);
  const ltv = activeMV ? debt / activeMV : 0;
  const freeLimit = state.holdings.reduce((s, h) => s + Math.max(0, h.qty - (pledged[h.sym] || 0)) * h.price * h.ratio / 100, 0);
  const totalPaidInt = res.reduce((s, r) => s + r.c.paidInt, 0);

  // daily interest last 60 days
  const end = toDN(state.asOf), N = 60, labels = [], vals = [], cols = [];
  const byDate = {};
  res.forEach(r => r.c.rows.forEach(row => { const k = row.date; byDate[k] = byDate[k] || { v: 0, od: false }; byDate[k].v += row.interest; byDate[k].od ||= row.overdue; }));
  for (let d = end - N; d < end; d++) { const k = fromDN(d); labels.push(k); vals.push(byDate[k]?.v || 0); cols.push(byDate[k]?.od ? '#f79009' : '#2f6bff'); }

  const alerts = [];
  res.forEach(r => {
    const L = `data-act="open-loan" data-id="${r.loan.id}"`;
    if (r.status === 'call') alerts.push(`<div class="alert red" ${L}><div class="ai">🚨</div><div><div class="at">${esc(r.loan.code)} chạm ngưỡng xử lý tài sản</div><div class="ad">LTV ${pct(r.ltv)} ≥ ${r.bank.call}%. Cần nộp thêm tiền/tài sản hoặc ${esc(r.bank.name)} có thể bán giải chấp.</div></div></div>`);
    else if (r.status === 'warn') alerts.push(`<div class="alert amber" ${L}><div class="ai">⚠️</div><div><div class="at">${esc(r.loan.code)} vượt ngưỡng cảnh báo</div><div class="ad">LTV ${pct(r.ltv)} — giá giảm thêm ${pct(Math.max(0, r.dropToCall))} sẽ bị xử lý.</div></div></div>`);
    if (r.c.overdueDays > 0 && !r.c.closed) alerts.push(`<div class="alert red" ${L}><div class="ai">⏰</div><div><div class="at">${esc(r.loan.code)} quá hạn ${r.c.overdueDays} ngày</div><div class="ad">Đang chịu lãi quá hạn ${pct(r.c.rateNow / 100, 2)}/năm (${r.bank.overdue}% lãi trong hạn). Lãi/ngày: ${vnd(r.c.dailyNow)}</div></div></div>`);
    else if (!r.c.closed && !r.c.notStarted && r.c.daysLeft <= 15) alerts.push(`<div class="alert blue" ${L}><div class="ai">📅</div><div><div class="at">${esc(r.loan.code)} sắp đáo hạn</div><div class="ad">Còn ${r.c.daysLeft} ngày (${dmy(r.c.maturity)}). Tổng cần trả: ${vnd(r.c.debt)}</div></div></div>`);
  });

  const donutItems = Object.entries(pledged).map(([sym, q]) => ({ label: sym, value: q * priceOf(sym), color: symColor(sym) })).sort((a, b) => b.value - a.value);

  return `
  <div class="grid g4">
    <div class="card kpi hero"><div class="label">Tổng dư nợ (gốc + lãi)</div><div class="value ticker">${short(debt)}</div><div class="foot">Gốc ${vnd(prin)}</div></div>
    <div class="card kpi"><div class="orb" style="background:var(--amber)"></div><div class="label">Lãi tích lũy chưa trả</div><div class="value ticker">${vnd(unpaid)}</div><div class="foot">+ <b>${vnd(daily)}</b> / ngày · Đã trả lãi ${short(totalPaidInt)}</div></div>
    <div class="card kpi"><div class="orb" style="background:var(--green)"></div><div class="label">Giá trị cầm cố</div><div class="value ticker">${short(pledgedMV)}</div><div class="foot">LTV tổng hợp <b>${pct(ltv)}</b> · Danh mục ${short(totalMV)}</div></div>
    <div class="card kpi"><div class="orb" style="background:var(--accent)"></div><div class="label">Hạn mức có thể vay thêm</div><div class="value ticker">${short(freeLimit)}</div><div class="foot">Từ cổ phiếu chưa phong tỏa</div></div>
  </div>

  <div class="grid g21 mt">
    <div class="card">
      <h3>Lãi phát sinh mỗi ngày <span class="hint">60 ngày gần nhất · <span style="color:#f79009">■</span> có khoản quá hạn</span></h3>
      ${barChart('daily', labels, vals, { colors: cols })}
    </div>
    <div class="card">
      <h3>Cảnh báo <span class="hint">${alerts.length} mục</span></h3>
      ${alerts.length ? alerts.join('') : `<div class="empty"><div class="big">✅</div>Mọi khoản vay đều an toàn</div>`}
    </div>
  </div>

  <div class="grid g21 mt">
    <div class="card">
      <h3>Khoản vay đang hoạt động <button class="btn sm" data-act="new-loan">+ Tạo khoản vay</button></h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Hợp đồng</th><th class="r">Dư nợ gốc</th><th class="r">Lãi chưa trả</th><th class="r">Lãi/ngày</th><th class="r">LTV</th><th>Đáo hạn</th><th>Trạng thái</th></tr></thead>
        <tbody>${active.length ? active.map(r => `
          <tr class="click ${r.c.overdueDays ? 'overdue-row' : ''}" data-act="open-loan" data-id="${r.loan.id}">
            <td><div class="row" style="gap:10px">${bankDot(r.bank).replace('bank-dot"', 'bank-dot" style="width:30px;height:30px;font-size:10px;border-radius:9px;background:' + r.bank.color + '"')}<div><div class="b">${esc(r.loan.code)}</div><div class="muted" style="font-size:12px">${esc(r.bank.name)} · ${r.loan.rate}%/năm</div></div></div></td>
            <td class="r">${vnd(r.c.bal)}</td><td class="r">${vnd(r.c.unpaid)}</td><td class="r">${vnd(r.c.dailyNow)}</td>
            <td class="r b">${pct(r.ltv)}</td><td>${dmy(r.c.maturity)}<div class="muted" style="font-size:12px">${r.c.daysLeft >= 0 ? 'còn ' + r.c.daysLeft + ' ngày' : 'quá ' + (-r.c.daysLeft) + ' ngày'}</div></td><td>${badge(r.status)}</td>
          </tr>`).join('') : `<tr><td colspan="7"><div class="empty">Chưa có khoản vay nào</div></td></tr>`}
        </tbody></table></div>
    </div>
    <div class="card"><h3>Phân bổ tài sản cầm cố</h3>${donut(donutItems)}</div>
  </div>`;
};

V.loans = () => {
  const { res } = analyze();
  const order = { call: 0, overdue: 1, warn: 2, ok: 3, pending: 4, closed: 5 };
  const list = [...res].sort((a, b) => order[a.status] - order[b.status]);
  return `
  <div class="row between" style="margin-bottom:16px"><div class="muted">${res.length} hợp đồng · ${res.filter(r => !['closed', 'pending'].includes(r.status)).length} đang hoạt động</div><button class="btn" data-act="new-loan">+ Tạo khoản vay mới</button></div>
  ${list.length ? `<div class="grid g3">${list.map(r => {
    const prog = clamp(r.c.daysElapsed / r.loan.termDays, 0, 1);
    return `<div class="card loan-card" data-act="open-loan" data-id="${r.loan.id}">
      <div class="loan-head">${bankDot(r.bank)}<div style="flex:1;min-width:0"><div class="loan-code">${esc(r.loan.code)}</div><div class="loan-sub">${esc(r.bank.name)} · ${r.loan.rate}%/năm · ${r.loan.termDays} ngày</div></div>${badge(r.status)}</div>
      <div class="loan-stats">
        <div class="stat"><div class="k">Dư nợ gốc</div><div class="v">${short(r.c.bal)}</div></div>
        <div class="stat"><div class="k">Lãi chưa trả</div><div class="v">${vnd(r.c.unpaid)}</div></div>
        <div class="stat"><div class="k">Lãi/ngày</div><div class="v">${vnd(r.c.dailyNow)}</div></div>
        <div class="stat"><div class="k">Giá trị TSĐB</div><div class="v">${short(r.mv)}</div></div>
      </div>
      ${r.status === 'closed' ? '' : meter(r.ltv, r.bank)}
      <div style="margin-top:14px" class="row between"><div class="chips">${r.loan.pledges.map(p => `<span class="chip">${esc(p.sym)} × ${num(p.qty)}</span>`).join('')}</div></div>
      <div style="margin-top:14px"><div class="row between" style="font-size:12px;margin-bottom:5px"><span class="muted">${dmy(r.loan.startDate)} → ${dmy(r.c.maturity)}</span><span class="b">${r.c.closed ? 'Tất toán ' + dmy(r.c.closedDate) : r.c.notStarted ? 'Chưa giải ngân' : r.c.daysLeft >= 0 ? 'Còn ' + r.c.daysLeft + ' ngày' : '<span class="neg">Quá hạn ' + (-r.c.daysLeft) + ' ngày</span>'}</span></div><div class="progress"><div style="width:${prog * 100}%;${r.c.overdueDays ? 'background:var(--red)' : ''}"></div></div></div>
    </div>`;
  }).join('')}</div>` : `<div class="card empty"><div class="big">🏦</div>Chưa có khoản vay. Hãy tạo khoản vay đầu tiên!</div>`}`;
};

V.loan = () => {
  const { res } = analyze();
  const r = res.find(x => x.loan.id === state.selLoan);
  if (!r) { state.view = 'loans'; return V.loans(); }
  const { loan, bank, c } = r;
  const rows = c.rows;
  const showAll = state.showAllRows;
  const shown = showAll ? [...rows].reverse() : [...rows].reverse().slice(0, 30);
  const accrual = rows.length ? lineChart('cum', rows.map(x => x.date), [
    { name: 'Lãi cộng dồn', color: '#7a5cff', values: rows.map(x => x.cum), fill: true },
    { name: 'Lãi chưa trả', color: '#f79009', values: rows.map(x => x.unpaid) },
  ]) : `<div class="empty"><div class="big">⏳</div>${c.notStarted ? 'Khoản vay chưa đến ngày giải ngân' : 'Chưa phát sinh ngày tính lãi nào'}</div>`;
  const balChart = rows.length ? lineChart('bal', rows.map(x => x.date), [
    { name: 'Dư nợ gốc', color: '#2f6bff', values: rows.map(x => x.bal), fill: true },
  ], { h: 170 }) : '';
  const projInt = c.bal * loan.rate / 100 / BASIS * Math.max(0, c.daysLeft);

  return `
  <span class="back" data-act="nav" data-v="loans">← Tất cả khoản vay</span>
  <div class="card">
    <div class="detail-head">
      ${bankDot(bank)}
      <div style="flex:1;min-width:200px"><h2>${esc(loan.code)} ${badge(r.status)}</h2><div class="muted">${esc(bank.name)} · Giải ngân ${dmy(loan.startDate)} · Kỳ hạn ${loan.termDays} ngày · Đáo hạn ${dmy(c.maturity)}</div></div>
      <div class="row">
        ${c.closed || c.notStarted ? '' : `<button class="btn green" data-act="pay" data-id="${loan.id}">💳 Trả nợ</button><button class="btn" data-act="payoff" data-id="${loan.id}">✔ Tất toán</button>`}
        <button class="btn ghost" data-act="csv" data-id="${loan.id}">⤓ Xuất CSV</button>
        <button class="btn soft-red" data-act="del-loan" data-id="${loan.id}">Xóa</button>
      </div>
    </div>
  </div>

  <div class="grid g4 mt">
    <div class="card kpi"><div class="label">Dư nợ gốc</div><div class="value ticker">${vnd(c.bal)}</div><div class="foot">Giải ngân ${vnd(loan.principal)} · đã trả gốc ${short(c.paidPrin)}</div></div>
    <div class="card kpi"><div class="orb" style="background:var(--amber)"></div><div class="label">Lãi chưa trả</div><div class="value ticker">${vnd(c.unpaid)}</div><div class="foot">Tổng lãi ${vnd(c.totalInt)} · đã trả ${short(c.paidInt)}</div></div>
    <div class="card kpi"><div class="orb" style="background:var(--accent2)"></div><div class="label">Lãi ngày ${dmy(state.asOf)}</div><div class="value ticker">${vnd(c.closed ? 0 : c.dailyNow)}</div><div class="foot">Lãi suất áp dụng ${c.rateNow.toLocaleString('vi-VN')}%/năm ${c.overdueDays ? '<span class="neg">(quá hạn)</span>' : ''}</div></div>
    <div class="card kpi"><div class="label">Giá trị tài sản đảm bảo</div><div class="value ticker">${short(r.mv)}</div><div class="foot">${r.dropToCall != null && !c.closed ? (r.dropToCall > 0 ? `Giá giảm <b class="neg">${pct(r.dropToCall)}</b> sẽ bị xử lý` : '<b class="neg">Đã vượt ngưỡng xử lý</b>') : '—'}</div></div>
  </div>

  <div class="grid g21 mt">
    <div class="card"><h3>Lãi cộng dồn theo ngày <span class="hint">${rows.length} ngày tính lãi</span></h3>${accrual}${balChart ? `<div style="margin-top:14px">${balChart}</div>` : ''}</div>
    <div>
      <div class="card payoff">
        <div class="label">Số tiền tất toán tại ${dmy(state.asOf)}</div>
        <div class="value">${vnd(c.debt)}</div>
        <div class="kv"><span class="k">Gốc</span><span class="v">${vnd(c.bal)}</span><span class="k">Lãi chưa trả</span><span class="v">${vnd(c.unpaid)}</span>
        ${!c.closed && c.daysLeft > 0 ? `<span class="k">Nếu giữ đến đáo hạn (+lãi ${c.daysLeft} ngày)</span><span class="v">${vnd(c.debt + projInt)}</span>` : ''}</div>
      </div>
      <div class="card mt"><h3>Tỷ lệ cho vay / TSĐB</h3>${meter(r.ltv, bank)}
        <div class="formula" style="margin-top:14px">Lãi ngày = Dư nợ gốc × ${loan.rate}% ÷ ${BASIS}<br/>= ${num(c.bal)} × ${loan.rate}% ÷ ${BASIS} = <b>${num(c.bal * loan.rate / 100 / BASIS)} ₫</b>${bank.overdue !== 100 ? `<br/>Quá hạn: × ${bank.overdue}% → ${(loan.rate * bank.overdue / 100).toLocaleString('vi-VN')}%/năm` : ''}</div>
      </div>
    </div>
  </div>

  <div class="grid g2 mt">
    <div class="card"><h3>Tài sản cầm cố (phong tỏa)</h3>
      <div class="table-wrap"><table><thead><tr><th>Mã</th><th class="r">Số lượng</th><th class="r">Giá</th><th class="r">Giá trị</th><th class="r">Tỷ lệ vay</th></tr></thead><tbody>
      ${loan.pledges.map(p => { const h = holdingOf(p.sym); return `<tr><td>${symBadge(p.sym, h?.name)}</td><td class="r">${num(p.qty)}</td><td class="r">${num(h?.price || 0)}</td><td class="r b">${vnd(p.qty * (h?.price || 0))}</td><td class="r">${h?.ratio ?? '—'}%</td></tr>`; }).join('')}
      </tbody></table></div>
    </div>
    <div class="card"><h3>Lịch sử thanh toán <span class="hint">Ưu tiên trừ lãi → gốc</span></h3>
      ${c.payLog.length || loan.payments.length ? `<div class="table-wrap"><table><thead><tr><th>Ngày</th><th class="r">Số tiền</th><th class="r">Trừ lãi</th><th class="r">Trừ gốc</th><th></th></tr></thead><tbody>
      ${[...loan.payments].sort((a, b) => b.date.localeCompare(a.date)).map(p => { const lg = c.payLog.find(x => x.id === p.id); return `<tr><td>${dmy(p.date)}${p.note ? `<div class="muted" style="font-size:12px">${esc(p.note)}</div>` : ''}</td><td class="r b">${vnd(p.amount)}</td><td class="r">${lg ? vnd(lg.toInt) : '<span class="muted">sau ngày tính</span>'}</td><td class="r">${lg ? vnd(lg.toPrin) : ''}${lg?.excess > 0.5 ? `<div class="pos" style="font-size:12px">thừa ${vnd(lg.excess)}</div>` : ''}</td><td class="r"><button class="icon-btn" title="Xóa" data-act="del-pay" data-id="${loan.id}" data-pid="${p.id}">×</button></td></tr>`; }).join('')}
      </tbody></table></div>` : `<div class="empty"><div class="big">🧾</div>Chưa có thanh toán</div>`}
    </div>
  </div>

  <div class="card mt">
    <h3>Bảng tính lãi hằng ngày <span class="row"><span class="hint">${showAll ? 'Tất cả' : '30 ngày gần nhất'}</span>${rows.length > 30 ? `<button class="btn sm ghost" data-act="toggle-rows">${showAll ? 'Thu gọn' : `Xem tất cả ${rows.length} ngày`}</button>` : ''}</span></h3>
    <div class="table-wrap"><table><thead><tr><th>Ngày</th><th class="r">Dư nợ gốc</th><th class="r">Lãi suất/năm</th><th class="r">Lãi trong ngày</th><th class="r">Lãi cộng dồn</th><th class="r">Lãi chưa trả</th><th class="r">Thanh toán</th></tr></thead><tbody>
    ${shown.length ? shown.map(x => `<tr class="${x.overdue ? 'overdue-row' : ''}"><td>${dmy(x.date)} ${x.overdue ? '<span class="badge overdue" style="margin-left:6px">QH</span>' : ''}</td><td class="r">${num(x.bal)}</td><td class="r">${x.rate.toLocaleString('vi-VN')}%</td><td class="r b">${num(x.interest)}</td><td class="r">${num(x.cum)}</td><td class="r">${num(x.unpaid)}</td><td class="r">${x.intPaid + x.prinPaid > 0 ? `<span class="pos">−${num(x.intPaid + x.prinPaid)}</span>` : ''}</td></tr>`).join('') : `<tr><td colspan="7"><div class="empty">Chưa có dữ liệu</div></td></tr>`}
    </tbody></table></div>
  </div>`;
};

V.portfolio = () => {
  const { pledged } = analyze();
  const total = state.holdings.reduce((s, h) => s + h.qty * h.price, 0);
  const totalPl = state.holdings.reduce((s, h) => s + (pledged[h.sym] || 0) * h.price, 0);
  const limit = state.holdings.reduce((s, h) => s + Math.max(0, h.qty - (pledged[h.sym] || 0)) * h.price * h.ratio / 100, 0);
  return `
  <div class="grid g3">
    <div class="card kpi hero"><div class="label">Tổng giá trị thị trường</div><div class="value">${vnd(total)}</div><div class="foot">${state.holdings.length} mã cổ phiếu</div></div>
    <div class="card kpi"><div class="orb" style="background:var(--amber)"></div><div class="label">Đang phong tỏa cầm cố</div><div class="value">${vnd(totalPl)}</div><div class="foot">${pct(total ? totalPl / total : 0)} danh mục</div></div>
    <div class="card kpi"><div class="orb" style="background:var(--green)"></div><div class="label">Hạn mức vay khả dụng</div><div class="value">${vnd(limit)}</div><div class="foot">= Giá trị khả dụng × tỷ lệ cho vay từng mã</div></div>
  </div>
  <div class="card mt">
    <h3>Cổ phiếu trong tài khoản <span class="row"><button class="btn sm ghost" data-act="tick">🎲 Mô phỏng phiên giao dịch</button><button class="btn sm" data-act="add-holding">+ Thêm mã</button></span></h3>
    <div class="table-wrap"><table>
      <thead><tr><th>Mã CK</th><th class="r">Sở hữu</th><th class="r">Đang cầm cố</th><th class="r">Khả dụng</th><th class="r">Giá (₫)</th><th class="r">+/-</th><th class="r">Giá trị</th><th class="r">Tỷ lệ vay</th><th class="r">Hạn mức khả dụng</th><th></th></tr></thead>
      <tbody>${state.holdings.map(h => {
        const pl = pledged[h.sym] || 0, free = Math.max(0, h.qty - pl), ch = h.prev ? h.price / h.prev - 1 : 0;
        return `<tr><td>${symBadge(h.sym, h.name)}</td><td class="r">${num(h.qty)}</td><td class="r">${pl ? `<span class="badge warn">${num(pl)}</span>` : '<span class="muted">0</span>'}</td><td class="r b">${num(free)}</td>
        <td class="r b">${num(h.price)}</td><td class="r ${ch > 0 ? 'pos' : ch < 0 ? 'neg' : 'muted'}">${ch > 0 ? '▲' : ch < 0 ? '▼' : ''} ${pct(Math.abs(ch), 2)}</td><td class="r">${vnd(h.qty * h.price)}</td><td class="r">${h.ratio}%</td><td class="r b">${vnd(free * h.price * h.ratio / 100)}</td>
        <td class="r"><button class="btn sm ghost" data-act="edit-holding" data-sym="${esc(h.sym)}">Sửa</button></td></tr>`;
      }).join('')}</tbody>
    </table></div>
  </div>`;
};

V.scenario = () => `
  <div class="card">
    <div id="scn-head">${scenarioHead()}</div>
    <input type="range" min="-70" max="30" step="1" value="${state.scenario}" id="scn-range" style="margin-top:12px"/>
    <div class="row between muted" style="font-size:12px"><span>−70%</span><span>Biên độ HOSE 1 phiên: ±7%</span><span>+30%</span></div>
  </div>
  <div id="scn-body">${scenarioBody()}</div>`;

function scenarioHead() {
  const s = state.scenario;
  return `<div class="row between"><div><div class="muted b" style="font-size:12px;text-transform:uppercase;letter-spacing:.5px">Biến động giá toàn bộ cổ phiếu cầm cố</div>
      <div class="big-num ${s < 0 ? 'neg' : s > 0 ? 'pos' : ''}">${s > 0 ? '+' : ''}${s}%</div></div>
      <div class="seg">${[-50, -30, -20, -10, -7, 0, 10].map(v => `<button class="${s === v ? 'on' : ''}" data-act="scn" data-v="${v}">${v > 0 ? '+' : ''}${v}%</button>`).join('')}</div>
    </div>`;
}

function scenarioBody() {
  const s = state.scenario / 100;
  const base = analyze(0).res.filter(r => !['closed', 'pending'].includes(r.status));
  const shocked = analyze(s).res.filter(r => !['closed', 'pending'].includes(r.status));
  const totalDebt = base.reduce((a, r) => a + r.c.debt, 0);
  const mv0 = base.reduce((a, r) => a + r.mv, 0), mv1 = shocked.reduce((a, r) => a + r.mv, 0);
  const nCall = shocked.filter(r => r.status === 'call').length, nWarn = shocked.filter(r => r.status === 'warn').length;
  return `
  <div class="grid g4 mt">
    <div class="card kpi"><div class="label">Giá trị TSĐB</div><div class="value">${short(mv1)}</div><div class="foot">Hiện tại ${short(mv0)}</div></div>
    <div class="card kpi"><div class="label">Tổng dư nợ</div><div class="value">${short(totalDebt)}</div><div class="foot">Không đổi theo giá</div></div>
    <div class="card kpi"><div class="orb" style="background:var(--amber)"></div><div class="label">Khoản bị cảnh báo</div><div class="value">${nWarn}</div><div class="foot">LTV ≥ ngưỡng cảnh báo</div></div>
    <div class="card kpi"><div class="orb" style="background:var(--red)"></div><div class="label">Khoản bị xử lý</div><div class="value ${nCall ? 'neg' : ''}">${nCall}</div><div class="foot">LTV ≥ ngưỡng call margin</div></div>
  </div>
  <div class="card mt"><h3>Tác động lên từng khoản vay</h3>
    <div class="table-wrap"><table><thead><tr><th>Hợp đồng</th><th class="r">Dư nợ</th><th class="r">TSĐB hiện tại</th><th class="r">TSĐB kịch bản</th><th class="r">LTV hiện tại</th><th class="r">LTV kịch bản</th><th class="r">Giá giảm tới call</th><th>Trạng thái</th><th style="width:200px"></th></tr></thead><tbody>
    ${shocked.length ? shocked.map((r, i) => { const b0 = base[i]; return `<tr class="click" data-act="open-loan" data-id="${r.loan.id}"><td class="b">${esc(r.loan.code)}<div class="muted" style="font-size:12px;font-weight:400">${esc(r.bank.name)}</div></td><td class="r">${vnd(r.c.debt)}</td><td class="r">${short(b0.mv)}</td><td class="r">${short(r.mv)}</td><td class="r">${pct(b0.ltv)}</td><td class="r b">${pct(r.ltv)}</td><td class="r ${b0.dropToCall < 0.15 ? 'neg' : ''}">${b0.dropToCall > 0 ? '−' + pct(b0.dropToCall) : 'Đã vượt'}</td><td>${badge(r.status)}</td><td>${meter(r.ltv, r.bank)}</td></tr>`; }).join('') : `<tr><td colspan="9"><div class="empty">Không có khoản vay đang hoạt động</div></td></tr>`}
    </tbody></table></div>
  </div>`;
}

V.calculator = () => {
  const c = state.calc ||= { amount: 500000000, rate: 9.5, days: 90 };
  const daily = c.amount * c.rate / 100 / BASIS;
  const total = daily * c.days;
  const pts = [], labs = [];
  const step = Math.max(1, Math.ceil(c.days / 60));
  for (let d = 0; d <= c.days; d += step) { labs.push(fromDN(toDN(state.asOf) + d)); pts.push(daily * d); }
  return `
  <div class="grid g2">
    <div class="card"><h3>Thông số khoản vay</h3>
      <div class="form-grid">
        <div class="field full"><label>Số tiền vay (₫)</label><input id="c-amount" inputmode="numeric" value="${num(c.amount)}" data-money/></div>
        <div class="field"><label>Lãi suất (%/năm)</label><input id="c-rate" type="number" step="0.1" value="${c.rate}"/></div>
        <div class="field"><label>Số ngày vay</label><input id="c-days" type="number" min="1" value="${c.days}"/></div>
      </div>
      <div class="row" style="margin-top:12px">${[30, 60, 90, 180, 360].map(d => `<button class="btn sm ghost" data-act="calc-days" data-v="${d}">${d} ngày</button>`).join('')}</div>
      <div class="formula" style="margin-top:16px">Lãi = Số tiền × Lãi suất năm ÷ ${BASIS} × Số ngày thực tế</div>
    </div>
    <div class="card payoff">
      <div class="label">Tổng lãi ${c.days} ngày</div><div class="value">${vnd(total)}</div>
      <div class="kv"><span class="k">Lãi mỗi ngày</span><span class="v">${vnd(daily)}</span><span class="k">Lãi ~ mỗi tháng (30 ngày)</span><span class="v">${vnd(daily * 30)}</span><span class="k">Tổng gốc + lãi</span><span class="v">${vnd(c.amount + total)}</span><span class="k">Ngày đáo hạn (từ ${dmy(state.asOf)})</span><span class="v">${dmy(fromDN(toDN(state.asOf) + c.days))}</span></div>
    </div>
  </div>
  <div class="grid g2 mt">
    <div class="card"><h3>Lãi cộng dồn</h3>${lineChart('calc', labs, [{ name: 'Lãi cộng dồn', color: '#7a5cff', values: pts, fill: true }], { h: 200 })}</div>
    <div class="card"><h3>So sánh ngân hàng <span class="hint">cùng số tiền & số ngày</span></h3>
      <div class="table-wrap"><table><thead><tr><th>Ngân hàng</th><th class="r">Lãi suất</th><th class="r">Lãi/ngày</th><th class="r">Tổng lãi</th></tr></thead><tbody>
      ${[...state.banks].sort((a, b) => a.rate - b.rate).map((b, i) => `<tr><td><div class="row" style="gap:8px"><span style="width:10px;height:10px;border-radius:3px;background:${b.color}"></span><b>${esc(b.name)}</b>${i === 0 ? '<span class="badge ok">Rẻ nhất</span>' : ''}</div></td><td class="r">${b.rate}%</td><td class="r">${vnd(c.amount * b.rate / 100 / BASIS)}</td><td class="r b">${vnd(c.amount * b.rate / 100 / BASIS * c.days)}</td></tr>`).join('')}
      </tbody></table></div>
    </div>
  </div>`;
};

V.banks = () => `
  <div class="row between" style="margin-bottom:16px"><div class="muted">Cấu hình áp dụng cho khoản vay mới (lãi suất) và đánh giá rủi ro (ngưỡng LTV)</div><button class="btn" data-act="add-bank">+ Thêm ngân hàng</button></div>
  <div class="grid g4">${state.banks.map(b => {
    const n = state.loans.filter(l => l.bankId === b.id).length;
    return `<div class="card"><div class="loan-head">${bankDot(b)}<div><div class="loan-code">${esc(b.name)}</div><div class="loan-sub">${n} hợp đồng</div></div></div>
      <div class="kv"><span class="k">Lãi suất cho vay</span><span class="v">${b.rate}%/năm</span><span class="k">Lãi quá hạn</span><span class="v">${b.overdue}% lãi gốc</span><span class="k">Ngưỡng cảnh báo</span><span class="v" style="color:var(--amber)">LTV ${b.warn}%</span><span class="k">Ngưỡng xử lý</span><span class="v neg">LTV ${b.call}%</span></div>
      <div class="row" style="margin-top:16px"><button class="btn sm ghost" data-act="edit-bank" data-id="${b.id}">Sửa</button>${n ? '' : `<button class="btn sm soft-red" data-act="del-bank" data-id="${b.id}">Xóa</button>`}</div></div>`;
  }).join('')}</div>`;

// ---------- render ----------
function render() {
  save();
  const v = state.view;
  const { res } = analyze();
  const nAlert = res.filter(r => ['call', 'overdue', 'warn'].includes(r.status)).length;
  $('#nav').innerHTML = NAV.map(([k, ic, label]) => `<button class="nav-item ${v === k || (v === 'loan' && k === 'loans') ? 'active' : ''}" data-act="nav" data-v="${k}"><span class="ic">${ic}</span>${label}${k === 'loans' && nAlert ? `<span class="count">${nAlert}</span>` : ''}</button>`).join('');
  const [t, st] = TITLES[v] || TITLES.dashboard;
  $('#title').textContent = t;
  $('#subtitle').textContent = st || (v === 'loan' ? `Lãi được tính đến hết ngày ${dmy(fromDN(toDN(state.asOf) - 1))}` : '');
  $('#asof').value = state.asOf;
  $('#main').innerHTML = (V[v] || V.dashboard)();
  bindCharts();
}

// ---------- modal & toast ----------
function openModal(html) { $('#modal-card').innerHTML = html; $('#modal').classList.remove('hidden'); setTimeout(() => $('#modal-card input:not([type=hidden])')?.focus(), 30); }
function closeModal() { $('#modal').classList.add('hidden'); $('#modal-card').innerHTML = ''; }
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), 2600); }

// ----- new loan -----
function newLoanModal() {
  const { pledged } = analyze();
  const avail = state.holdings.map(h => ({ ...h, free: Math.max(0, h.qty - (pledged[h.sym] || 0)) })).filter(h => h.free > 0);
  if (!state.banks.length) return toast('Hãy thêm ngân hàng trước');
  if (!avail.length) return toast('Không còn cổ phiếu khả dụng để cầm cố');
  const nextNo = String(state.loans.length + 1).padStart(3, '0');
  openModal(`
    <h2>Tạo khoản vay cầm cố</h2><div class="msub">Chọn cổ phiếu phong tỏa, hệ thống tính hạn mức và lãi dự kiến theo ngày.</div>
    <form data-form="loan">
      <div class="form-grid">
        <div class="field"><label>Số hợp đồng</label><input name="code" value="HĐ-${state.asOf.slice(0, 4)}-${nextNo}" required/></div>
        <div class="field"><label>Ngân hàng</label><select name="bankId">${state.banks.map(b => `<option value="${b.id}">${esc(b.name)} — ${b.rate}%/năm</option>`).join('')}</select></div>
        <div class="field"><label>Ngày giải ngân</label><input type="date" name="startDate" value="${state.asOf}" required/></div>
        <div class="field"><label>Kỳ hạn (ngày)</label><input type="number" name="termDays" min="1" value="180" required list="terms"/><datalist id="terms"><option value="30"/><option value="90"/><option value="180"/><option value="270"/><option value="360"/></datalist></div>
        <div class="field"><label>Lãi suất (%/năm)</label><input type="number" step="0.01" name="rate" value="${state.banks[0].rate}" required/></div>
      </div>
      <div style="margin-top:18px" class="b">Cổ phiếu cầm cố</div>
      <table class="pledge-table" style="margin-top:6px"><thead><tr><th>Mã</th><th class="r">Khả dụng</th><th class="r">Giá</th><th class="r">Tỷ lệ</th><th class="r">SL cầm cố</th><th></th></tr></thead><tbody>
      ${avail.map(h => `<tr><td>${symBadge(h.sym)}</td><td class="r">${num(h.free)}</td><td class="r">${num(h.price)}</td><td class="r">${h.ratio}%</td><td class="r"><input name="q_${esc(h.sym)}" data-sym="${esc(h.sym)}" data-max="${h.free}" type="number" min="0" max="${h.free}" step="100" value="0"/></td><td><button type="button" class="btn sm soft" data-act="max-q" data-sym="${esc(h.sym)}">Tối đa</button></td></tr>`).join('')}
      </tbody></table>
      <div class="field" style="margin-top:16px"><label>Số tiền vay (₫)</label><div class="row" style="flex-wrap:nowrap"><input name="principal" inputmode="numeric" data-money value="0"/><button type="button" class="btn soft" data-act="max-loan">Vay tối đa</button></div></div>
      <div class="preview" id="loan-preview"></div>
      <div class="modal-actions"><button type="button" class="btn ghost" data-act="close">Hủy</button><button class="btn" id="loan-submit">Giải ngân</button></div>
    </form>`);
  updateLoanPreview();
}
function loanFormData() {
  const f = $('[data-form=loan]'); if (!f) return null;
  const bank = bankOf(f.bankId.value);
  const pledges = [...f.querySelectorAll('[data-sym][data-max]')].map(i => ({ sym: i.dataset.sym, qty: clamp(Math.floor(parseNum(i.value)), 0, +i.dataset.max) })).filter(p => p.qty > 0);
  const mv = pledges.reduce((s, p) => s + p.qty * priceOf(p.sym), 0);
  const limit = pledges.reduce((s, p) => s + p.qty * priceOf(p.sym) * holdingOf(p.sym).ratio / 100, 0);
  return { f, bank, pledges, mv, limit, principal: parseNum(f.principal.value), rate: parseFloat(f.rate.value) || 0, termDays: parseInt(f.termDays.value) || 0 };
}
function updateLoanPreview() {
  const d = loanFormData(); if (!d) return;
  const daily = d.principal * d.rate / 100 / BASIS;
  const over = d.principal > d.limit + 0.5;
  const ltv = d.mv ? d.principal / d.mv : 0;
  $('#loan-preview').innerHTML = `<div class="kv">
    <span class="k">Giá trị cổ phiếu cầm cố</span><span class="v">${vnd(d.mv)}</span>
    <span class="k">Hạn mức tối đa</span><span class="v">${vnd(d.limit)}</span>
    <span class="k">LTV ban đầu</span><span class="v">${pct(ltv)} <span class="muted">(cảnh báo ${d.bank.warn}% · xử lý ${d.bank.call}%)</span></span>
    <span class="k">Lãi mỗi ngày</span><span class="v">${vnd(daily)}</span>
    <span class="k">Lãi dự kiến ${d.termDays} ngày</span><span class="v">${vnd(daily * d.termDays)}</span>
    <span class="k">Ngày đáo hạn</span><span class="v">${d.f.startDate.value ? dmy(fromDN(toDN(d.f.startDate.value) + d.termDays)) : '—'}</span>
  </div>${over ? `<div class="neg b" style="margin-top:10px">⚠ Số tiền vay vượt hạn mức cho phép</div>` : ''}`;
  $('#loan-submit').disabled = over || d.principal <= 0 || !d.pledges.length;
}

// ----- payment -----
function payModal(id, full) {
  const loan = state.loans.find(l => l.id === id);
  const c = computeLoan(loan, state.asOf);
  openModal(`
    <h2>${full ? 'Tất toán khoản vay' : 'Thanh toán khoản vay'}</h2><div class="msub">${esc(loan.code)} · ${esc(bankOf(loan.bankId).name)}</div>
    <form data-form="pay" data-id="${id}">
      <div class="preview" style="margin-top:0"><div class="kv"><span class="k">Dư nợ gốc</span><span class="v">${vnd(c.bal)}</span><span class="k">Lãi chưa trả đến ${dmy(state.asOf)}</span><span class="v">${vnd(c.unpaid)}</span><span class="k b">Tổng tất toán</span><span class="v b">${vnd(c.debt)}</span></div></div>
      <div class="form-grid" style="margin-top:16px">
        <div class="field"><label>Ngày thanh toán</label><input type="date" name="date" value="${state.asOf}" min="${loan.startDate}" ${full ? 'readonly' : ''} required/></div>
        <div class="field"><label>Số tiền (₫)</label><input name="amount" inputmode="numeric" data-money value="${num(full ? Math.ceil(c.debt) : Math.ceil(c.unpaid))}" ${full ? 'readonly' : ''} required/></div>
        <div class="field full"><label>Ghi chú</label><input name="note" value="${full ? 'Tất toán, giải chấp cổ phiếu' : ''}" placeholder="VD: Trả lãi tháng 11"/></div>
      </div>
      ${full ? '' : `<div class="row" style="margin-top:10px"><button type="button" class="btn sm soft" data-act="fill-amt" data-v="${Math.ceil(c.unpaid)}">Trả hết lãi</button><button type="button" class="btn sm soft" data-act="fill-amt" data-v="${Math.ceil(c.debt)}">Trả toàn bộ</button></div>
      <div class="muted" style="margin-top:10px;font-size:12.5px">Số tiền sẽ được trừ vào lãi chưa trả trước, phần còn lại trừ vào gốc. Lãi các ngày sau tính trên dư nợ gốc mới.</div>`}
      <div class="modal-actions"><button type="button" class="btn ghost" data-act="close">Hủy</button><button class="btn ${full ? '' : 'green'}">${full ? 'Xác nhận tất toán' : 'Ghi nhận thanh toán'}</button></div>
    </form>`);
}

// ----- holding -----
function holdingModal(sym) {
  const h = sym ? holdingOf(sym) : { sym: '', name: '', qty: 1000, price: 10000, ratio: 50 };
  const pl = sym ? analyze().pledged[sym] || 0 : 0;
  openModal(`
    <h2>${sym ? 'Cập nhật ' + esc(sym) : 'Thêm cổ phiếu vào tài khoản'}</h2><div class="msub">${sym && pl ? `Đang cầm cố ${num(pl)} cp — số lượng sở hữu không được thấp hơn.` : 'Thông tin cổ phiếu lưu ký tại công ty chứng khoán'}</div>
    <form data-form="holding" data-sym="${esc(sym || '')}">
      <div class="form-grid">
        <div class="field"><label>Mã CK</label><input name="sym" value="${esc(h.sym)}" ${sym ? 'readonly' : ''} required maxlength="6" style="text-transform:uppercase"/></div>
        <div class="field"><label>Tên doanh nghiệp</label><input name="name" value="${esc(h.name)}"/></div>
        <div class="field"><label>Số lượng sở hữu</label><input name="qty" type="number" min="${pl}" step="1" value="${h.qty}" required/></div>
        <div class="field"><label>Giá thị trường (₫)</label><input name="price" inputmode="numeric" data-money value="${num(h.price)}" required/></div>
        <div class="field"><label>Tỷ lệ cho vay (%)</label><input name="ratio" type="number" min="0" max="100" step="1" value="${h.ratio}" required/></div>
      </div>
      <div class="modal-actions">${sym && !pl ? `<button type="button" class="btn soft-red" style="margin-right:auto" data-act="del-holding" data-sym="${esc(sym)}">Xóa mã</button>` : ''}<button type="button" class="btn ghost" data-act="close">Hủy</button><button class="btn">Lưu</button></div>
    </form>`);
}

// ----- bank -----
function bankModal(id) {
  const b = id ? bankOf(id) : { name: '', short: '', color: '#2f6bff', rate: 10, overdue: 150, warn: 60, call: 70 };
  openModal(`
    <h2>${id ? 'Sửa ngân hàng' : 'Thêm ngân hàng'}</h2><div class="msub">Lãi suất mới chỉ áp dụng cho khoản vay tạo sau này.</div>
    <form data-form="bank" data-id="${id || ''}">
      <div class="form-grid">
        <div class="field"><label>Tên ngân hàng</label><input name="name" value="${esc(b.name)}" required/></div>
        <div class="field"><label>Viết tắt</label><input name="short" value="${esc(b.short)}" maxlength="5"/></div>
        <div class="field"><label>Lãi suất (%/năm)</label><input name="rate" type="number" step="0.01" value="${b.rate}" required/></div>
        <div class="field"><label>Lãi quá hạn (% lãi trong hạn)</label><input name="overdue" type="number" step="1" value="${b.overdue}" required/></div>
        <div class="field"><label>Ngưỡng cảnh báo LTV (%)</label><input name="warn" type="number" value="${b.warn}" required/></div>
        <div class="field"><label>Ngưỡng xử lý LTV (%)</label><input name="call" type="number" value="${b.call}" required/></div>
        <div class="field"><label>Màu nhận diện</label><input name="color" type="color" value="${b.color}" style="height:38px;padding:3px"/></div>
      </div>
      <div class="modal-actions"><button type="button" class="btn ghost" data-act="close">Hủy</button><button class="btn">Lưu</button></div>
    </form>`);
}

function exportCSV(id) {
  const loan = state.loans.find(l => l.id === id);
  const c = computeLoan(loan, state.asOf);
  const lines = [['Ngay', 'DuNoGoc', 'LaiSuatNam', 'LaiTrongNgay', 'LaiCongDon', 'LaiChuaTra', 'TraLai', 'TraGoc', 'QuaHan'].join(',')];
  c.rows.forEach(r => lines.push([dmy(r.date), Math.round(r.bal), r.rate, r.interest.toFixed(2), r.cum.toFixed(2), r.unpaid.toFixed(2), Math.round(r.intPaid), Math.round(r.prinPaid), r.overdue ? 1 : 0].join(',')));
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `lai-ngay-${loan.code}.csv` });
  a.click(); URL.revokeObjectURL(a.href);
}

// ---------- events ----------
document.addEventListener('click', e => {
  if (e.target.id === 'modal') return closeModal();
  const el = e.target.closest('[data-act]'); if (!el) return;
  const { act, id } = el.dataset;
  const A = {
    nav: () => { state.view = el.dataset.v; state.showAllRows = false; render(); scrollTo(0, 0); },
    'open-loan': () => { state.selLoan = id; state.view = 'loan'; state.showAllRows = false; render(); scrollTo(0, 0); },
    shift: () => { state.asOf = fromDN(toDN(state.asOf) + +el.dataset.d); render(); },
    today: () => { state.asOf = todayStr(); render(); },
    reset: () => { if (confirm('Xóa toàn bộ dữ liệu và khôi phục dữ liệu mẫu?')) { state = seed(); render(); toast('Đã khôi phục dữ liệu mẫu'); } },
    close: closeModal,
    'new-loan': newLoanModal,
    'max-q': () => { const i = $(`[data-form=loan] input[data-sym="${CSS.escape(el.dataset.sym)}"]`); i.value = i.dataset.max; updateLoanPreview(); },
    'max-loan': () => { const d = loanFormData(); d.f.principal.value = num(Math.floor(d.limit / 1e5) * 1e5); updateLoanPreview(); },
    pay: () => payModal(id, false),
    payoff: () => payModal(id, true),
    'fill-amt': () => { $('[data-form=pay] [name=amount]').value = num(+el.dataset.v); },
    'del-pay': () => { if (!confirm('Xóa thanh toán này? Lãi sẽ được tính lại.')) return; const l = state.loans.find(x => x.id === id); l.payments = l.payments.filter(p => p.id !== el.dataset.pid); render(); },
    'del-loan': () => { if (!confirm('Xóa hợp đồng vay này? Cổ phiếu sẽ được giải tỏa.')) return; state.loans = state.loans.filter(l => l.id !== id); state.view = 'loans'; render(); toast('Đã xóa hợp đồng'); },
    'toggle-rows': () => { state.showAllRows = !state.showAllRows; render(); },
    csv: () => exportCSV(id),
    'add-holding': () => holdingModal(null),
    'edit-holding': () => holdingModal(el.dataset.sym),
    'del-holding': () => { state.holdings = state.holdings.filter(h => h.sym !== el.dataset.sym); closeModal(); render(); },
    tick: () => { state.holdings.forEach(h => { h.prev = h.price; const ch = (Math.random() - 0.5) * 0.1; const tick = h.price < 10000 ? 10 : h.price < 50000 ? 50 : 100; h.price = Math.max(tick, Math.round(h.price * (1 + clamp(ch, -0.07, 0.07)) / tick) * tick); }); render(); toast('Đã cập nhật giá theo phiên mô phỏng (±7%)'); },
    scn: () => { state.scenario = +el.dataset.v; render(); },
    'calc-days': () => { state.calc.days = +el.dataset.v; render(); },
    'add-bank': () => bankModal(null),
    'edit-bank': () => bankModal(id),
    'del-bank': () => { if (confirm('Xóa ngân hàng này?')) { state.banks = state.banks.filter(b => b.id !== id); render(); } },
  };
  A[act]?.();
});

document.addEventListener('input', e => {
  const t = e.target;
  if (t.matches('[data-money]')) {
    const pos = t.value.length - t.selectionStart;
    const v = parseNum(t.value); t.value = v ? num(v) : '';
    try { t.setSelectionRange(t.value.length - pos, t.value.length - pos); } catch { }
  }
  if (t.closest('[data-form=loan]')) {
    if (t.name === 'bankId') t.form.rate.value = bankOf(t.value).rate;
    updateLoanPreview();
  }
  if (t.id === 'scn-range') { state.scenario = +t.value; save(); $('#scn-head').innerHTML = scenarioHead(); $('#scn-body').innerHTML = scenarioBody(); }
  if (['c-amount', 'c-rate', 'c-days'].includes(t.id)) {
    state.calc = { amount: parseNum($('#c-amount').value), rate: parseFloat($('#c-rate').value) || 0, days: clamp(parseInt($('#c-days').value) || 1, 1, 3650) };
    save();
    clearTimeout(window._ct); window._ct = setTimeout(() => { const id = document.activeElement?.id, y = scrollY; render(); scrollTo(0, y); const el = id && document.getElementById(id); if (el) { el.focus(); const n = el.value.length; try { el.setSelectionRange(n, n); } catch { } } }, 350);
  }
});
document.addEventListener('change', e => {
  if (e.target.id === 'asof' && e.target.value) { state.asOf = e.target.value; render(); }
  if (e.target.closest('[data-form=loan]') && e.target.name === 'bankId') { e.target.form.rate.value = bankOf(e.target.value).rate; updateLoanPreview(); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

document.addEventListener('submit', e => {
  const f = e.target; e.preventDefault();
  const type = f.dataset.form;
  if (type === 'loan') {
    const d = loanFormData();
    if (d.principal > d.limit + 0.5 || d.principal <= 0 || !d.pledges.length) return;
    state.loans.push({ id: uid(), code: f.code.value.trim(), bankId: d.bank.id, principal: d.principal, rate: d.rate, startDate: f.startDate.value, termDays: d.termDays, pledges: d.pledges, payments: [] });
    closeModal(); state.view = 'loans'; render(); toast(`Đã giải ngân ${vnd(d.principal)} — cổ phiếu đã được phong tỏa`);
  }
  if (type === 'pay') {
    const loan = state.loans.find(l => l.id === f.dataset.id);
    const amount = parseNum(f.amount.value);
    if (amount <= 0) return toast('Số tiền phải lớn hơn 0');
    if (f.date.value < loan.startDate) return toast('Ngày thanh toán trước ngày giải ngân');
    loan.payments.push({ id: uid(), date: f.date.value, amount, note: f.note.value.trim() });
    const c = computeLoan(loan, state.asOf);
    closeModal(); render();
    toast(c.closed ? '🎉 Đã tất toán — cổ phiếu được giải chấp' : `Đã ghi nhận thanh toán ${vnd(amount)}`);
  }
  if (type === 'holding') {
    const sym = (f.dataset.sym || f.sym.value).trim().toUpperCase();
    if (!f.dataset.sym && holdingOf(sym)) return toast('Mã đã tồn tại trong danh mục');
    const pl = analyze().pledged[sym] || 0;
    const qty = parseInt(f.qty.value) || 0;
    if (qty < pl) return toast(`Số lượng không được nhỏ hơn ${num(pl)} cp đang cầm cố`);
    const price = parseNum(f.price.value);
    const data = { sym, name: f.elements.name.value.trim(), qty, price, ratio: clamp(parseFloat(f.ratio.value) || 0, 0, 100) };
    const h = holdingOf(sym);
    if (h) { if (h.price !== price) h.prev = h.price; Object.assign(h, data); } else state.holdings.push({ ...data, prev: price });
    closeModal(); render(); toast('Đã lưu ' + sym);
  }
  if (type === 'bank') {
    const data = { name: f.elements.name.value.trim(), short: f.short.value.trim() || f.elements.name.value.trim().slice(0, 3).toUpperCase(), color: f.color.value, rate: +f.rate.value, overdue: +f.overdue.value, warn: +f.warn.value, call: +f.call.value };
    if (data.warn >= data.call) return toast('Ngưỡng cảnh báo phải nhỏ hơn ngưỡng xử lý');
    if (f.dataset.id) Object.assign(bankOf(f.dataset.id), data); else state.banks.push({ id: uid(), ...data });
    closeModal(); render(); toast('Đã lưu ngân hàng');
  }
});

render();
