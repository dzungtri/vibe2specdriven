// Library study-room booking server — zero dependencies (Node 18+)
// Run: node server.js  →  http://localhost:3000
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

const OPEN_HOUR = 7;   // 07:00
const CLOSE_HOUR = 21; // 21:00
const MAX_HOURS_PER_DAY = 3;
const MAX_DAYS_AHEAD = 7;

const ROOMS = [
  { id: 1, name: 'Phòng Lá Phong', capacity: 2, floor: 'Tầng 2', amenities: ['Ổ cắm', 'Đèn bàn'], color: '#e07a5f' },
  { id: 2, name: 'Phòng Tùng', capacity: 4, floor: 'Tầng 2', amenities: ['Bảng trắng', 'Ổ cắm'], color: '#3d8b6e' },
  { id: 3, name: 'Phòng Sồi', capacity: 4, floor: 'Tầng 2', amenities: ['Màn hình', 'Ổ cắm'], color: '#b08436' },
  { id: 4, name: 'Phòng Liễu', capacity: 6, floor: 'Tầng 3', amenities: ['Bảng trắng', 'Màn hình', 'Điều hoà'], color: '#5b7fb8' },
  { id: 5, name: 'Phòng Bách', capacity: 8, floor: 'Tầng 3', amenities: ['Máy chiếu', 'Bảng trắng', 'Điều hoà'], color: '#8a5fb0' },
  { id: 6, name: 'Phòng Trúc', capacity: 1, floor: 'Tầng 3', amenities: ['Yên tĩnh tuyệt đối', 'Đèn bàn'], color: '#4f9aa8' },
];

// ---------- storage ----------
function load() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return { bookings: [] }; }
}
let db = load();
function save() {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

// ---------- helpers ----------
const pad = (n) => String(n).padStart(2, '0');
function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return localDateStr(new Date(y, m - 1, d + n));
}
function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 1e5) req.destroy(); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('JSON không hợp lệ')); } });
    req.on('error', reject);
  });
}
function newCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (const b of crypto.randomBytes(6)) s += alphabet[b % alphabet.length];
  return s;
}
const publicBooking = (b) => ({ id: b.id, roomId: b.roomId, date: b.date, start: b.start, end: b.end, name: maskName(b.name) });
function maskName(name) {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1]; // only show given name publicly
}

// ---------- API ----------
async function api(req, res, url) {
  const p = url.pathname;

  if (req.method === 'GET' && p === '/api/config') {
    return send(res, 200, { rooms: ROOMS, openHour: OPEN_HOUR, closeHour: CLOSE_HOUR, maxHoursPerDay: MAX_HOURS_PER_DAY, maxDaysAhead: MAX_DAYS_AHEAD, today: localDateStr() });
  }

  if (req.method === 'GET' && p === '/api/bookings') {
    const date = url.searchParams.get('date') || localDateStr();
    return send(res, 200, db.bookings.filter((b) => b.date === date).map(publicBooking));
  }

  if (req.method === 'POST' && p === '/api/bookings') {
    let body;
    try { body = await readBody(req); } catch (e) { return send(res, 400, { error: e.message }); }
    const name = String(body.name || '').trim();
    const studentId = String(body.studentId || '').trim().toUpperCase();
    const contact = String(body.contact || '').trim();
    const purpose = String(body.purpose || '').trim().slice(0, 200);
    const roomId = Number(body.roomId);
    const date = String(body.date || '');
    const start = Number(body.start);
    const end = Number(body.end);

    if (name.length < 2) return send(res, 400, { error: 'Vui lòng nhập họ tên.' });
    if (!/^[A-Z0-9]{4,15}$/.test(studentId)) return send(res, 400, { error: 'Mã thẻ thư viện / MSSV gồm 4–15 chữ hoặc số.' });
    if (!ROOMS.some((r) => r.id === roomId)) return send(res, 400, { error: 'Phòng không tồn tại.' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return send(res, 400, { error: 'Ngày không hợp lệ.' });
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < OPEN_HOUR || end > CLOSE_HOUR || end <= start)
      return send(res, 400, { error: `Giờ đặt phải trong khoảng ${OPEN_HOUR}:00–${CLOSE_HOUR}:00.` });

    const today = localDateStr();
    if (date < today || date > addDays(today, MAX_DAYS_AHEAD - 1))
      return send(res, 400, { error: `Chỉ được đặt trong ${MAX_DAYS_AHEAD} ngày tới.` });
    if (date === today && start <= new Date().getHours())
      return send(res, 400, { error: 'Khung giờ này đã qua.' });

    const sameDay = db.bookings.filter((b) => b.date === date);
    if (sameDay.some((b) => b.roomId === roomId && start < b.end && end > b.start))
      return send(res, 409, { error: 'Khung giờ này vừa có người đặt. Vui lòng chọn giờ khác.' });

    const mine = sameDay.filter((b) => b.studentId === studentId);
    if (mine.some((b) => start < b.end && end > b.start))
      return send(res, 409, { error: 'Bạn đã có lịch đặt phòng khác trùng giờ này.' });
    const used = mine.reduce((s, b) => s + (b.end - b.start), 0);
    if (used + (end - start) > MAX_HOURS_PER_DAY)
      return send(res, 400, { error: `Mỗi người tối đa ${MAX_HOURS_PER_DAY} giờ/ngày (bạn đã đặt ${used} giờ).` });

    const booking = { id: crypto.randomUUID(), code: newCode(), roomId, date, start, end, name, studentId, contact, purpose, createdAt: new Date().toISOString() };
    db.bookings.push(booking);
    save();
    return send(res, 201, booking);
  }

  if (req.method === 'GET' && p === '/api/my-bookings') {
    const studentId = String(url.searchParams.get('studentId') || '').trim().toUpperCase();
    if (!studentId) return send(res, 400, { error: 'Thiếu mã thẻ.' });
    const today = localDateStr();
    const list = db.bookings
      .filter((b) => b.studentId === studentId && b.date >= today)
      .sort((a, b) => (a.date + pad(a.start)).localeCompare(b.date + pad(b.start)))
      .map(({ code, ...rest }) => rest); // never leak cancel code here
    return send(res, 200, list);
  }

  const m = p.match(/^\/api\/bookings\/([\w-]+)$/);
  if (req.method === 'DELETE' && m) {
    let body;
    try { body = await readBody(req); } catch (e) { return send(res, 400, { error: e.message }); }
    const idx = db.bookings.findIndex((b) => b.id === m[1]);
    if (idx === -1) return send(res, 404, { error: 'Không tìm thấy lịch đặt.' });
    if (String(body.code || '').trim().toUpperCase() !== db.bookings[idx].code)
      return send(res, 403, { error: 'Mã huỷ không đúng.' });
    db.bookings.splice(idx, 1);
    save();
    return send(res, 200, { ok: true });
  }

  send(res, 404, { error: 'Not found' });
}

// ---------- static ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
function serveStatic(req, res, url) {
  let file = path.normalize(path.join(PUBLIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname));
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}

http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith('/api/')) {
    api(req, res, url).catch((e) => { console.error(e); send(res, 500, { error: 'Lỗi máy chủ' }); });
  } else serveStatic(req, res, url);
}).listen(PORT, () => {
  console.log(`📚 Thư viện — Đặt phòng tự học đang chạy tại http://localhost:${PORT}`);
});
