// Shiori — personal PDF library & reader. All data lives on this device (IndexedDB).
import { db } from './db.js';

const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ph = $('#ph');
// the app frame must never scroll (off-screen pages sit to its right)
ph.addEventListener('scroll', () => { if (ph.scrollLeft || ph.scrollTop) { ph.scrollLeft = 0; ph.scrollTop = 0; } });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ---------- icons ----------
const ICONS = { search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', plus: '<path d="M5 12h14"/><path d="M12 5v14"/>', back: '<path d="m15 18-6-6 6-6"/>', close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>', play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>', pause: '<rect x="6" y="4" width="4" height="16" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" fill="currentColor" stroke="none"/>', head: '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>', list: '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>', pen: '<path d="M12 20h9"/><path d="M16.4 3.6a1 1 0 0 1 3 3L7.4 18.6a2 2 0 0 1-.9.5l-2.9.8.8-2.9a2 2 0 0 1 .5-.8z"/>', bookmark: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>', type: '<path d="m15 16 2.5-7.3a1 1 0 0 1 1.9 0L22 16"/><path d="M15.7 14h5.6"/><path d="m2 16 4-9.7a.5.5 0 0 1 .9 0L11 16"/><path d="M3.3 13h6.4"/>', check: '<path d="M20 6 9 17l-5-5"/>', down: '<path d="m6 9 6 6 6-6"/>', next: '<path d="m9 18 6-6-6-6"/>', rew: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>', fwd: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>', star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>', trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>', image: '<rect width="18" height="18" x="3" y="3" rx="1"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3-3a2 2 0 0 0-2.8 0L6 21"/>', edit: '<path d="M12 20h9"/><path d="M16.4 3.6a1 1 0 0 1 3 3L7.4 18.6a2 2 0 0 1-.9.5l-2.9.8.8-2.9a2 2 0 0 1 .5-.8z"/>', book: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>', layers: '<path d="M12.8 2.2a2 2 0 0 0-1.6 0L2.6 6.1a1 1 0 0 0 0 1.8l8.6 3.9a2 2 0 0 0 1.6 0l8.6-3.9a1 1 0 0 0 0-1.8Z"/><path d="m22 17.6-9.2 4.2a2 2 0 0 1-1.6 0L2 17.6"/><path d="m22 12.6-9.2 4.2a2 2 0 0 1-1.6 0L2 12.6"/>', chart: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>', copy: '<rect width="14" height="14" x="8" y="8" rx="1"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>', ret: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>', upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>', share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="m16 6-4-4-4 4"/><path d="M12 2v13"/>', file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>', underline: '<path d="M6 4v6a6 6 0 0 0 12 0V4"/><path d="M4 20h16"/>' };
const ic = (n, s = 18, c = 'currentColor', fill = 'none') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${fill}" stroke="${c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block">${ICONS[n] || ''}</svg>`;
const hydrate = (root = document) => $$('[data-i]', root).forEach(e => { if (e.dataset.done) return; e.dataset.done = 1; e.insertAdjacentHTML('afterbegin', ic(e.dataset.i, +(e.dataset.s || 18), e.dataset.c || 'currentColor')); });
const pbar = (n, f, extra = '') => `<div class="pb" ${extra}>${Array.from({ length: n }, (_, i) => `<i class="${i < f ? 'f' : ''}"></i>`).join('')}</div>`;
const HL = { key: 'Important', quote: 'Quote', concept: 'Concept', action: 'Action', idea: 'Idea', research: 'Research' };
const STATUS = { reading: 'Reading', want: 'Want to read', done: 'Finished', hold: 'On hold' };

// ---------- settings ----------
const DEF = { theme: 'white', fs: 18, lsp: 'normal', font: 'serif', layout: 'scroll', goal: 12, filter: 'all', voice_en: '', voice_ja: '', rate: 1, scrollAlong: true };
let S = { ...DEF };
const saveS = () => db.put('kv', S, 'settings').catch(() => { });

// ---------- book list ----------
let BOOKS = [];
const coverURL = new Map();
async function loadBooks() { BOOKS = (await db.all('books')) || []; }
async function getCover(id) {
  if (coverURL.has(id)) return coverURL.get(id);
  const b = await db.get('files', 'cover:' + id); const u = b ? URL.createObjectURL(b) : ''; coverURL.set(id, u); return u;
}
const bookById = id => BOOKS.find(b => b.id === id);
const saveBook = b => db.put('books', b);
const bookEl = (b, extra = '') => `<div class="book" data-cover="${b.id}"><span class="ph">${esc(b.title)}</span>${extra}</div>`;
async function fillCovers(root) { for (const el of $$('[data-cover]', root)) { const u = await getCover(el.dataset.cover); if (u && !el.querySelector('img')) { el.insertAdjacentHTML('afterbegin', `<img alt="" src="${u}">`); const ph = el.querySelector('.ph'); if (ph) ph.remove(); } } }

// ---------- navigation ----------
let stack = ['library'];
const ENTER = {}, LEAVE = {};
const cur = () => stack[stack.length - 1];
function go(id, o = {}) {
  const c = $('#' + cur()), nx = $('#' + id); if (!nx || c === nx) return;
  ENTER[id] && ENTER[id](o);
  if (o.fade || RM) { c.classList.remove('on', 'under'); nx.classList.add('fade', 'on'); requestAnimationFrame(() => requestAnimationFrame(() => nx.classList.remove('fade'))); }
  else { nx.style.transition = 'none'; nx.classList.remove('on', 'under'); void nx.offsetWidth; nx.style.transition = ''; nx.classList.add('on'); c.classList.add('under'); setTimeout(() => { if (!stack.includes(c.id) || cur() !== c.id) c.classList.remove('on'); }, 340); }
  stack.push(id); miniPos();
}
function back() {
  if (stack.length < 2) return;
  const c = $('#' + stack.pop()); const pv = $('#' + cur());
  LEAVE[c.id] && LEAVE[c.id]();
  pv.classList.add('on'); pv.classList.remove('under'); c.classList.remove('on');
  ENTER[pv.id] && ENTER[pv.id]({ back: true }); miniPos();
}
function tabTo(id) {
  if (cur() === id && stack.length === 1) { const b = $('#' + id + ' .body'); if (b) b.scrollTo({ top: 0, behavior: RM ? 'auto' : 'smooth' }); return; }
  [...stack].reverse().forEach(s => LEAVE[s] && s !== id && LEAVE[s]());
  const old = $('#' + stack[0]); stack.forEach(s => s !== stack[0] && $('#' + s).classList.remove('on', 'under'));
  stack = [id]; syncTabs();
  const nx = $('#' + id); ENTER[id] && ENTER[id]({});
  nx.style.transition = 'none'; nx.classList.remove('under'); nx.classList.add('on'); nx.style.zIndex = 2; void nx.offsetWidth; nx.style.transition = '';
  const done = () => { if (stack[0] !== old.id) old.classList.remove('on', 'under'); old.getAnimations().forEach(a => a.cancel()); nx.getAnimations().forEach(a => a.cancel()); nx.style.zIndex = ''; };
  if (RM || !nx.animate) { done(); miniPos(); return; }
  // calm crossfade: the old page dims away, the new one rises in a few pixels
  old.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-out', fill: 'forwards' });
  const a = nx.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
  a.onfinish = done; miniPos();
}
function resetTo(id, o = {}) { [...stack].reverse().forEach(s => s !== id && LEAVE[s] && LEAVE[s]()); $$('.screen').forEach(s => s.classList.remove('on', 'under')); stack = [id]; $('#' + id).classList.add('on'); ENTER[id] && ENTER[id](o); syncTabs(true); miniPos(); }
// one shared tab bar; the black pill slides between tabs
const ROOTS = ['library', 'knowledge', 'journal'];
$('#tabbar').insertAdjacentHTML('beforeend', [['library', 'book', 'Library'], ['knowledge', 'layers', 'Knowledge'], ['journal', 'chart', 'Journal']].map(([id, i, l]) => `<button class="tab" data-tabto="${id}">${ic(i, 16)}${l}</button>`).join(''));
function syncTabs(instant) {
  const root = stack[0]; const pill = $('#tabpill'); const btn = $(`#tabbar [data-tabto="${root}"]`); if (!btn) return;
  $$('#tabbar .tab').forEach(t => t.classList.toggle('on', t === btn));
  pill.classList.toggle('instant', !!instant); pill.style.width = btn.offsetWidth + 'px'; pill.style.transform = `translateX(${btn.offsetLeft}px)`;
  if (instant) requestAnimationFrame(() => requestAnimationFrame(() => pill.classList.remove('instant')));
}
addEventListener('resize', () => syncTabs(true));
ph.addEventListener('click', e => {
  const b = e.target.closest('[data-back]'); if (b) { if (b.closest('.sheet,.dialog')) { closeSheet(); closeDialog(); } back(); return; }
  const g = e.target.closest('[data-go]'); if (g) { go(g.dataset.go); return; }
  const t = e.target.closest('[data-tabto]'); if (t) tabTo(t.dataset.tabto);
});

// ---------- toast / sheet / dialog ----------
let tt;
function toast(html, o = {}) { const t = $('#toast'); t.innerHTML = html; t.classList.toggle('low', !!o.low && cur() !== 'reader'); t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), o.ms || 2400); return t; }
let onSheetClose = null;
function sheet(html, mount, close) {
  const prev = onSheetClose; onSheetClose = null; prev && prev();
  $('#sheetBody').innerHTML = html; hydrate($('#sheet')); $('#sheetBody').scrollTop = 0;
  $('#dim').classList.add('on'); $('#sheet').classList.add('on'); $('#sheet').style.transform = ''; onSheetClose = close || null; mount && mount($('#sheetBody'));
}
function closeSheet() { $('#dim').classList.remove('on'); $('#sheet').classList.remove('on'); const f = onSheetClose; onSheetClose = null; f && f(); }
const sheetOpen = () => $('#sheet').classList.contains('on');
$('#dim').addEventListener('click', () => { if ($('#dialog').classList.contains('on')) closeDialog(); else closeSheet(); });
{ let y0 = null, dy = 0; const h = $('#handle'), sh = $('#sheet');
  h.addEventListener('pointerdown', e => { y0 = e.clientY; dy = 0; try { h.setPointerCapture(e.pointerId); } catch (x) { } sh.style.transition = 'none'; });
  h.addEventListener('pointermove', e => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); sh.style.transform = `translateY(${dy}px)`; });
  const up = () => { if (y0 == null) return; sh.style.transition = ''; if (dy > 80) closeSheet(); sh.style.transform = ''; y0 = null; dy = 0; };
  h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up); }
function dialog(html, mount) { const d = $('#dialog'); d.innerHTML = html; hydrate(d); $('#dim').classList.add('on'); d.classList.add('on'); mount && mount(d); }
function closeDialog() { $('#dialog').classList.remove('on'); if (!sheetOpen()) $('#dim').classList.remove('on'); }
const confirmBox = (title, text, ok, okLabel = 'Delete', warn = true) => dialog(`<h3 class="t22" style="margin:0 0 12px">${esc(title)}</h3><p class="muted" style="font-size:14px;line-height:20px;margin:0 0 20px">${esc(text)}</p><button class="btn ${warn ? 'warn' : ''}" id="dOk">${esc(okLabel)}</button><button class="btn sec" id="dNo" style="margin-top:8px">Cancel</button>`, d => { $('#dNo', d).onclick = closeDialog; $('#dOk', d).onclick = () => { closeDialog(); ok(); }; });

// ---------- splash: the icon opens, pages riffle, the ribbon drops in ----------
const holes = (r, c) => (r === 11 && c === 2) || (r === 12 && c >= 1 && c <= 3);
const ribHTML = (px, col, anim) => { let s = `<div class="rib" style="grid-template-columns:repeat(5,${px}px)">`; for (let r = 0; r < 13; r++) for (let c = 0; c < 5; c++) s += `<i style="width:${px}px;height:${px}px;background:${holes(r, c) ? 'transparent' : col};${anim ? `animation-delay:${r * 38}ms` : 'opacity:1;transform:none'}"></i>`; return s + '</div>'; };
let splashDone;
const splashP = new Promise(r => splashDone = r);
function runSplash() {
  const sp = $('#splash'), sbw = $('#sbw'), sb = $('#sb'), cv = $('#sbCv'), lv = $$('.sb-lf', sb), wm = $('#wm');
  $('#sbIcon').innerHTML = ribHTML(4, '#fff'); $('#sbRib').innerHTML = ribHTML(5, '#111', true);
  wm.innerHTML = 'Shiori'.split('').map(c => `<span>${c}</span>`).join('') + '<i class="cursor" style="opacity:0" id="cur"></i>';
  let done = false; const T = [];
  const end = () => { if (done) return; done = true; T.forEach(clearTimeout); sp.classList.add('out'); setTimeout(() => sp.remove(), 400); splashDone(); };
  sp.addEventListener('click', end);
  let quick = null; try { quick = sessionStorage.getItem('shiori.splash'); sessionStorage.setItem('shiori.splash', '1'); } catch (e) { }
  if (RM || quick || !sb.animate) { sb.style.transform = 'translateX(64px)'; cv.style.transform = 'rotateY(-180deg)'; cv.style.zIndex = 1; lv.forEach((l, i) => { l.style.transform = 'rotateY(-180deg)'; l.style.zIndex = 2 + i; }); $('#sbRib .rib').classList.add('go'); $$('span', wm).forEach(s => s.classList.add('on')); $('#wmSub').style.opacity = 1; T.push(setTimeout(end, quick ? 250 : 700)); return; }
  const A = (el, kf, o) => el.animate(kf, Object.assign({ fill: 'both' }, o)); const IO = 'cubic-bezier(.45,.05,.3,1)';
  cv.style.zIndex = 10; lv.forEach((l, i) => l.style.zIndex = 9 - i);
  A(sbw, [{ transform: 'scale(.86)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
  A(sb, [{ transform: 'translateX(0)' }, { transform: 'translateX(64px)' }], { duration: 700, delay: 450, easing: IO });
  A(cv, [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-180deg)' }], { duration: 700, delay: 450, easing: IO });
  A(cv, [{ zIndex: 10 }, { zIndex: 10, offset: .5 }, { zIndex: 1, offset: .5 }, { zIndex: 1 }], { duration: 700, delay: 450, easing: 'linear' });
  lv.forEach((l, i) => { const d = 930 + i * 120, du = 480; A(l, [{ transform: 'rotateY(0deg)', filter: 'brightness(1)' }, { filter: 'brightness(.86)', offset: .5 }, { transform: 'rotateY(-180deg)', filter: 'brightness(1)' }], { duration: du, delay: d, easing: IO }); A(l, [{ zIndex: 9 - i }, { zIndex: 9 - i, offset: .5 }, { zIndex: 2 + i, offset: .5 }, { zIndex: 2 + i }], { duration: du, delay: d, easing: 'linear' }); });
  T.push(setTimeout(() => $('#sbRib .rib').classList.add('go'), 1620));
  T.push(setTimeout(() => $('#cur').style.opacity = 1, 1900));
  $$('span', wm).forEach((s, i) => T.push(setTimeout(() => s.classList.add('on'), 2050 + i * 80)));
  T.push(setTimeout(() => $('#wmSub').style.opacity = 1, 2600)); T.push(setTimeout(end, 3300));
}

// ---------- library ----------
function shelf() {
  const f = S.filter;
  return BOOKS.filter(b => f === 'all' || b.status === f).sort((a, b) => (b.lastRead || 0) - (a.lastRead || 0) || (b.added || 0) - (a.added || 0));
}
function renderGrid(first, dropId) {
  const list = shelf(); const g = $('#grid');
  $('#showLbl').textContent = S.filter === 'all' ? 'All books' : STATUS[S.filter];
  $('#libTop').style.display = BOOKS.length ? '' : 'none';
  const latest = BOOKS.filter(b => b.lastRead && b.status !== 'done').sort((a, b) => b.lastRead - a.lastRead)[0];
  g.innerHTML = list.map((b, i) => `<button class="tile ${first && !RM ? 'stag' : ''} ${dropId === b.id ? 'drop' : ''}" style="${first ? `animation-delay:${i * 35}ms` : ''}" data-id="${b.id}">${bookEl(b, latest && latest.id === b.id ? `<span class="ctag">${ic('play', 10, '#fff')}Continue</span>` : '')}<span class="ttl">${esc(b.title)}</span>${b.pct ? `<span class="pct">${Math.round(b.pct * 100)}%</span>` : ''}</button>`).join('');
  fillCovers(g);
  const em = $('#libEmpty');
  if (!BOOKS.length) em.innerHTML = `<div class="empty"><div style="width:110px;margin:0 auto">${ribHTML(6, '#111')}</div><div class="t22">Your shelf is empty</div><p>Add a PDF and Shiori turns it into a clean book you can read, mark and listen to.</p><button class="btn" id="emptyAdd">${ic('plus', 16, '#fff')}Add your first PDF</button></div>`;
  else if (!list.length) em.innerHTML = `<div class="empty"><p>No books are “${esc(STATUS[S.filter])}” yet.</p><button class="btn sec" id="showAll">Show all books</button></div>`;
  else em.innerHTML = '';
  const ea = $('#emptyAdd'); if (ea) { ea.onclick = pickFiles; $('.rib', em).style.margin = '0 auto'; $('.rib', em).style.width = 'max-content'; }
  const sa = $('#showAll'); if (sa) sa.onclick = () => { S.filter = 'all'; saveS(); renderGrid(true); };
}
ENTER.library = o => renderGrid(o && o.first, o && o.drop);
{ let tmr = null, lp = false, sx = 0, sy = 0; const g = $('#grid');
  g.addEventListener('pointerdown', e => { const tile = e.target.closest('.tile'); if (!tile) return; lp = false; sx = e.clientX; sy = e.clientY; tmr = setTimeout(() => { lp = true; bookMenu(tile.dataset.id, tile); }, 480); });
  g.addEventListener('pointermove', e => { if (tmr && Math.hypot(e.clientX - sx, e.clientY - sy) > 8) { clearTimeout(tmr); tmr = null; } });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => g.addEventListener(ev, () => { clearTimeout(tmr); tmr = null; }));
  g.addEventListener('click', e => { const t = e.target.closest('.tile'); if (!t) return; if (lp) { lp = false; return; } const id = t.dataset.id; if (e.target.closest('.ctag')) { openBook(id, t.querySelector('.book')); return; } curBook = id; go('book'); });
  g.addEventListener('contextmenu', e => e.preventDefault()); }
$('#showBtn').addEventListener('click', () => {
  const opts = [['all', 'All books'], ...Object.entries(STATUS)];
  const n = k => k === 'all' ? BOOKS.length : BOOKS.filter(b => b.status === k).length;
  sheet(`<h3 class="t24" style="margin:4px 0 20px">Show</h3>${opts.map(([k, l]) => `<button class="row" data-o="${k}" style="height:52px"><span style="display:flex;gap:12px;align-items:center"><span style="width:18px;height:18px;border:1px solid #111;display:grid;place-items:center;${k === S.filter ? 'background:#111' : ''}">${k === S.filter ? ic('check', 12, '#fff') : ''}</span><span style="font-weight:${k === S.filter ? 600 : 400}">${l}</span></span><span class="mono muted" style="font-size:12px">${n(k)}</span></button>`).join('')}`, b => {
    $$('[data-o]', b).forEach(r => r.onclick = () => { S.filter = r.dataset.o; saveS(); closeSheet(); renderGrid(true); });
  });
});
function bookMenu(id, tile) {
  const b = bookById(id); if (!b) return; const bk = tile && tile.querySelector ? tile.querySelector('.book') : null; bk && bk.classList.add('lift'); if (navigator.vibrate) navigator.vibrate(8);
  sheet(`<div style="display:flex;gap:12px;align-items:center;margin:4px 0 16px"><div style="width:44px;flex:none">${bookEl(b)}</div><div style="min-width:0"><div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(b.title)}</div><div class="muted" style="font-size:12px">${STATUS[b.status]}${b.author ? ' · ' + esc(b.author) : ''}</div></div></div>${[['play', 'Open book', 'open'], ['list', 'Change status', 'status'], ['edit', 'Edit title & author', 'edit'], ['image', 'Change cover', 'cover'], ['trash', 'Delete book', 'del']].map(([i, l, a]) => `<button class="row" data-a="${a}" style="justify-content:flex-start;gap:14px;height:52px${a === 'del' ? ';color:#B3261E' : ''}">${ic(i)}${l}</button>`).join('')}`, s => {
    fillCovers(s);
    $$('[data-a]', s).forEach(r => r.addEventListener('click', () => {
      const a = r.dataset.a;
      if (a === 'open') { closeSheet(); openBook(id, bk); }
      else if (a === 'status') statusSheet(b, () => { renderGrid(); if (cur() === 'book') ENTER.book(); });
      else if (a === 'edit') editSheet(b);
      else if (a === 'cover') coverSheet(b);
      else if (a === 'del') { closeSheet(); setTimeout(() => confirmBox('Delete this book?', `“${b.title}” and everything you kept from it will be removed from this phone. This can’t be undone.`, () => deleteBook(id)), 250); }
    }));
  }, () => bk && bk.classList.remove('lift'));
}
function statusSheet(b, after) {
  sheet(`<h3 class="t24" style="margin:4px 0 20px">Status</h3>${Object.entries(STATUS).map(([k, l]) => `<button class="row" data-st="${k}" style="height:52px"><span style="font-weight:${b.status === k ? 600 : 400}">${l}</span>${b.status === k ? ic('check', 16) : ''}</button>`).join('')}`, s => {
    $$('[data-st]', s).forEach(r => r.onclick = async () => { b.status = r.dataset.st; if (b.status === 'done' && !b.finished) b.finished = Date.now(); await saveBook(b); closeSheet(); after && after(); toast(`Moved to ${STATUS[b.status]}`, { low: true }); });
  });
}
function editSheet(b) {
  sheet(`<h3 class="t24" style="margin:4px 0 8px">Edit details</h3><label class="field"><span class="lbl">Title</span><input id="eT" value="${esc(b.title)}"></label><label class="field"><span class="lbl">Author</span><input id="eA" value="${esc(b.author || '')}" placeholder="Unknown"></label><button class="btn" id="eSave" style="margin-top:24px">Save</button>`, s => {
    $('#eSave', s).onclick = async () => { b.title = $('#eT', s).value.trim() || b.title; b.author = $('#eA', s).value.trim(); await saveBook(b); closeSheet(); renderGrid(); if (cur() === 'book') ENTER.book(); toast('Saved', { low: true }); };
  });
}
function coverSheet(b) {
  sheet(`<h3 class="t24" style="margin:4px 0 8px">Change cover</h3><p class="muted small" style="margin:0 0 16px">Use another page of the book, or a picture.</p><label class="field"><span class="lbl">Use page</span><input id="cvN" type="number" inputmode="numeric" min="1" max="${b.pageCount}" value="1"></label><button class="btn" id="cvPage" style="margin-top:16px">Use this page</button><button class="btn sec" id="cvImg" style="margin-top:8px">${ic('image', 16)}Choose a picture</button><input type="file" id="cvFile" accept="image/*" hidden>`, s => {
    $('#cvPage', s).onclick = async () => {
      const n = Math.max(1, Math.min(b.pageCount, parseInt($('#cvN', s).value) || 1));
      try { const { pdfjs, renderPage, DOC_OPTS } = await import('./convert.js'); const blob = await db.get('files', 'pdf:' + b.id); const pdf = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), ...DOC_OPTS }).promise; const pg = await pdf.getPage(n); const { canvas } = await renderPage(pg, 600); const cb = await new Promise(r => canvas.toBlob(r, 'image/jpeg', .88)); await setCover(b, cb); pdf.destroy(); closeSheet(); } catch (e) { toast('Couldn’t read that page', { low: true }); }
    };
    $('#cvImg', s).onclick = () => $('#cvFile', s).click();
    $('#cvFile', s).onchange = async e => { const f = e.target.files[0]; if (!f) return; await setCover(b, f); closeSheet(); };
  });
}
async function setCover(b, blob) { await db.put('files', blob, 'cover:' + b.id); const old = coverURL.get(b.id); if (old) URL.revokeObjectURL(old); coverURL.delete(b.id); renderGrid(); if (cur() === 'book') ENTER.book(); toast('Cover changed', { low: true }); }
async function deleteBook(id) {
  const t = $(`.tile[data-id="${id}"]`); t && t.classList.add('collapse');
  const b = bookById(id); const keys = ['cover:' + id, 'pdf:' + id, ...((b && b.imgKeys) || []).map(k => 'img:' + id + ':' + k)];
  const marks = await db.byBook(id);
  await db.delMany('files', keys); await db.del('content', id); await db.delMany('marks', marks.map(m => m.id)); await db.del('books', id);
  BOOKS = BOOKS.filter(x => x.id !== id); contentCache.delete(id);
  setTimeout(() => { if (cur() !== 'library') resetTo('library'); else renderGrid(); }, 280);
  toast('Book deleted', { low: true });
}

// ---------- add books ----------
const fileIn = $('#fileIn');
function pickFiles() { fileIn.value = ''; fileIn.click(); }
$('#addBtn').onclick = pickFiles;
fileIn.addEventListener('change', () => { const files = [...fileIn.files].filter(f => /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name)); if (!files.length) { if (fileIn.files.length) toast('Only PDF files can be added', { low: true }); return; } importQueue(files); });
let importing = false, cancelImport = false, mkWait = null;
async function importQueue(files) {
  if (importing) { toast('Already adding a book — one moment', { low: true }); return; }
  importing = true; cancelImport = false;
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { }
  let added = [];
  for (let i = 0; i < files.length && !cancelImport; i++) {
    const f = files[i];
    const dup = BOOKS.find(b => b.fileName === f.name && b.fileSize === f.size);
    if (dup) { toast(`“${dup.title}” is already on your shelf`, { low: true }); await sleep(900); continue; }
    const id = await convertOne(f, i, files.length);
    if (id) added.push(id);
  }
  importing = false;
  return added;
}
const STEPS = ['Read the text', 'Cleaned up headers & page numbers', 'Pulled images & figures', 'Found chapters & laid out your pages'];
async function convertOne(file, i, n) {
  if (cur() !== 'making') { if (cur() === 'library' && stack.length === 1) go('making'); else resetTo('library'), go('making'); }
  const mk = $('#making');
  $('#mkTitle').textContent = 'Making your book'; $('#mkSub').textContent = (n > 1 ? `Book ${i + 1} of ${n} · ` : '') + file.name;
  $('#mkBook').innerHTML = `<div class="book"><span class="ph" style="align-items:center;justify-content:center;font-size:12px">${esc(file.name.replace(/\.pdf$/i, ''))}</span></div><div id="mkRib" style="position:absolute;right:10px;top:-6px">${ribHTML(4, '#fff')}</div>`;
  const ribPx = $$('#mkRib i').filter(x => x.style.background !== 'transparent');
  ribPx.forEach(x => x.style.outline = '1px solid #111');
  const info = ['', '', '', ''];
  let stage = 0, frac = 0;
  const draw = () => {
    $('#mkSteps').innerHTML = STEPS.map((s, k) => `<div class="st ${k < stage ? 'done' : k === stage ? 'now' : 'todo'}"><span class="bx">${k < stage ? ic('check', 12, '#fff') : ''}</span><span><span style="font-weight:${k <= stage ? 600 : 400};font-size:15px">${s}</span>${info[k] ? `<br><span class="mono muted" style="font-size:10px">${esc(info[k])}</span>` : ''}</span></div>`).join('');
    const total = Math.min(1, (stage + frac) / 4);
    $('#mkPb').outerHTML = pbar(24, Math.round(total * 24), 'id="mkPb" style="margin-top:24px"');
    const lit = Math.round(total * 13); ribPx.forEach(x => { const r = +x.dataset.r; x.style.background = r < lit ? '#111' : '#fff'; });
  };
  $$('#mkRib i').forEach((x, k) => x.dataset.r = Math.floor(k / 5));
  const goB = $('#mkGo'); goB.disabled = true; goB.innerHTML = ic('play', 16, '#9A9A95') + 'Start reading'; $('#mkNote').textContent = 'Keep Shiori open while it works.';
  draw();
  let res;
  try {
    const { convertPdf } = await import('./convert.js');
    res = await convertPdf(file, (st, fr, x) => { stage = st; frac = fr || 0; if (st === 0 && x && x.pages) info[0] = `${Math.round(frac * x.pages)} of ${x.pages} pages`; draw(); });
  } catch (e) {
    console.error(e);
    const msg = /password/i.test(e && (e.name + e.message)) ? 'This PDF is locked with a password.' : 'This file couldn’t be read as a PDF.';
    $('#mkTitle').textContent = 'Couldn’t make this book'; $('#mkNote').textContent = msg;
    goB.disabled = false; goB.innerHTML = 'Back to library'; goB.onclick = () => resetTo('library');
    await new Promise(r => { mkWait = r; const t = setTimeout(() => { if (mkWait === r) { mkWait = null; r(); } }, n > 1 ? 2600 : 600000); goB.addEventListener('click', () => { clearTimeout(t); mkWait = null; r(); }, { once: true }); });
    return null;
  }
  const id = uid();
  const chapters = res.toc.length, imgs = res.images.length;
  info[0] = `${res.pageCount} pages${res.scanned ? ' · scanned' : ''}`; info[1] = 'done'; info[2] = imgs ? `${imgs} image${imgs > 1 ? 's' : ''}` : 'no images'; info[3] = `${chapters} section${chapters === 1 ? '' : 's'}` + (res.lang === 'ja' || res.scanned ? '' : ` · ${res.words.toLocaleString('en')} words`);
  // save everything
  const book = { id, title: res.title, author: res.author, pageCount: res.pageCount, lang: res.lang, scanned: res.scanned, added: Date.now(), status: 'want', rating: 0, review: '', pos: null, pct: 0, lastRead: 0, readSec: 0, fileName: file.name, fileSize: file.size, imgKeys: res.images.map(x => x.key), words: res.words, chapters, cv: CONV };
  try {
    await db.putMany('files', [[res.coverBlob, 'cover:' + id], [res.pdfBlob, 'pdf:' + id], ...res.images.map(x => [x.blob, 'img:' + id + ':' + x.key])]);
    await db.put('content', { blocks: res.blocks, toc: res.toc, contents: res.contents }, id);
    await saveBook(book); BOOKS.push(book);
  } catch (e) {
    console.error(e); $('#mkTitle').textContent = 'Not enough space'; $('#mkNote').textContent = 'Your phone ran out of room for this book.'; goB.disabled = false; goB.innerHTML = 'Back to library'; goB.onclick = () => resetTo('library'); return null;
  }
  stage = 4; frac = 0; draw();
  $('#mkTitle').textContent = 'Your book is ready';
  $('#mkBook .book').innerHTML = `<img alt="" src="${await getCover(id)}">`;
  $('#mkNote').textContent = res.scanned ? 'This PDF is scanned, so pages show as pictures. Text recognition is coming later.' : '';
  goB.disabled = false; goB.innerHTML = ic('play', 16, '#fff') + 'Start reading';
  if (cancelImport) { if (cur() === 'library') renderGrid(false, id); return id; }
  await new Promise(r => { mkWait = r; goB.onclick = () => { mkWait = null; r(); resetTo('library', { drop: id }); curBook = id; setTimeout(() => openBook(id, $(`.tile[data-id="${id}"] .book`)), 450); }; if (n > 1 && i < n - 1) setTimeout(() => { if (mkWait === r) { mkWait = null; r(); } }, 1400); });
  return id;
}
$('#mkClose').onclick = () => { if (mkWait) { const r = mkWait; mkWait = null; r(); } else if (importing) { cancelImport = true; toast('Finishing this book in the background…', { low: true }); } resetTo('library'); };

// ---------- book page ----------
let curBook = null;
ENTER.book = async () => {
  const b = bookById(curBook); if (!b) return;
  const page = b.pos ? b.pos.page || '1' : '1'; const pct = b.pct || 0;
  const marks = (await db.byBook(b.id)).filter(m => m.kind === 'hl').sort((x, y) => y.at - x.at);
  $('#bookBody').innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;text-align:center"><div style="width:120px" class="stag">${bookEl(b)}</div><h2 class="t24" style="margin-top:20px;line-height:1.15">${esc(b.title)}</h2><div class="muted" style="font-size:12px;margin-top:4px">${[b.author, b.pageCount + ' pages'].filter(Boolean).map(esc).join(' · ')}</div>
  <div style="display:flex;gap:16px;align-items:center;margin-top:16px"><button class="dd" id="bStatus"><i style="width:8px;height:8px;background:#111;display:block"></i>${STATUS[b.status]}${ic('down', 14)}</button><span style="display:flex;gap:4px" id="stars">${[0, 1, 2, 3, 4].map(i => `<button data-r="${i + 1}" aria-label="${i + 1} stars" style="padding:4px">${ic('star', 18, '#111', i < b.rating ? '#111' : 'none')}</button>`).join('')}</span></div></div>
  <div class="card" style="margin-top:24px;display:flex;flex-direction:column;gap:12px"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div class="muted" style="font-size:12px">${b.pos ? 'You’re on page' : 'Not started yet'}</div><div style="display:flex;gap:6px;align-items:baseline;margin-top:4px"><span class="dot" style="font-size:40px;line-height:1">${esc(page)}</span><span class="mono muted" style="font-size:12px">/ ${b.pageCount}</span></div></div><div style="text-align:right"><div class="mono muted" style="font-size:10px">Saved automatically</div><div class="mono" style="font-size:12px;margin-top:6px">${Math.round(pct * 100)}%</div></div></div>${pbar(30, Math.round(pct * 30))}</div>
  <button class="btn" id="contBtn" style="margin-top:16px">${ic('play', 16, '#fff')}${b.pos ? 'Continue reading' : 'Start reading'}</button>${b.scanned ? '' : `<div style="text-align:center;margin-top:12px"><button class="link" style="font-family:'Hanken Grotesk';font-size:13px" id="bListen">or listen instead</button></div>`}
  <div class="seg" style="margin-top:32px" id="bTabs"><button class="on" data-t="nb">NOTEBOOK ${marks.length}</button><button data-t="ch">CHAPTERS</button><button data-t="rv">REVIEW</button></div><div id="bTab" style="margin-top:8px"></div>`;
  fillCovers($('#bookBody'));
  const bt2 = $('#bTab');
  const tabs = {
    nb: () => marks.length ? marks.slice(0, 30).map(m => hlItem(m, b)).join('') + (marks.length > 30 ? `<button class="link" style="margin-top:16px" id="moreNb">See all ${marks.length} →</button>` : '') : '<p class="muted" style="font-size:14px;line-height:20px">Nothing kept yet. While reading, tap &amp; hold a sentence, then pick a colour.</p>',
    ch: () => '<div id="chList"><p class="muted small">Loading…</p></div>',
    rv: () => `<div class="lbl" style="margin-top:8px">Your review</div><textarea id="rvT" style="background:var(--so);padding:14px;margin-top:12px;min-height:140px;width:100%;font-size:15px;line-height:22px;border:0;outline:none;resize:none" placeholder="What did you think? What will you use?">${esc(b.review || '')}</textarea><div class="mono muted" style="font-size:10px;margin-top:8px">Saved automatically</div>`
  };
  const show = async k => {
    bt2.innerHTML = tabs[k]();
    if (k === 'nb') { wireHlItems(bt2); const mn = $('#moreNb'); if (mn) mn.onclick = () => openNotebook(b.id); }
    if (k === 'ch') { const c = await getContent(b.id); const pos = b.pos ? b.pos.b : -1; $('#chList').innerHTML = c.toc.length ? c.toc.map((t, i) => { const nx = c.toc[i + 1]; const done = nx && pos >= nx.b; const here = pos >= t.b && (!nx || pos < nx.b); return `<button class="row" data-cb="${t.b}" style="min-height:48px;padding:8px 0;color:${done ? 'var(--g)' : '#111'}"><span style="display:flex;gap:12px;align-items:baseline;text-align:left"><span class="dot" style="width:22px;flex:none">${i + 1}</span><span style="font-weight:${here ? 600 : 400}">${esc(t.title)}</span></span><span class="mono" style="font-size:12px;flex:none">${done ? '✓ ' : ''}${esc(t.p)}</span></button>`; }).join('') : '<p class="muted small">No chapters found in this PDF.</p>'; $$('[data-cb]', bt2).forEach(r => r.onclick = () => openBook(b.id, $('#bookBody .book'), { jump: +r.dataset.cb })); }
    if (k === 'rv') { const t = $('#rvT'); let tm; t.oninput = () => { clearTimeout(tm); tm = setTimeout(() => { b.review = t.value; saveBook(b); }, 400); }; }
  };
  show('nb');
  $$('#bTabs button').forEach(x => x.onclick = () => { $$('#bTabs button').forEach(y => y.classList.toggle('on', y === x)); show(x.dataset.t); });
  $$('#stars button').forEach(s => s.onclick = () => { const r = +s.dataset.r; b.rating = b.rating === r ? 0 : r; saveBook(b); $$('#stars button').forEach((x, i) => { x.innerHTML = ic('star', 18, '#111', i < b.rating ? '#111' : 'none'); }); s.classList.remove('flashpop'); void s.offsetWidth; s.classList.add('flashpop'); });
  $('#bStatus').onclick = () => statusSheet(b, () => ENTER.book());
  $('#contBtn').onclick = () => openBook(b.id, $('#bookBody .book'));
  const bl = $('#bListen'); if (bl) bl.onclick = () => openBook(b.id, $('#bookBody .book'), { listen: true });
};
$('#bookMore').onclick = () => bookMenu(curBook, null);

// ---------- highlight items (notebook, knowledge, book page) ----------
const hlItem = (m, b) => `<button class="hlitem" data-m="${esc(m.id)}"><i class="bar" style="background:var(--${m.color}S)"></i><span style="flex:1;min-width:0"><q>${esc(m.text)}</q>${m.note ? `<span class="notebox">${ic('pen', 14)}<span>${esc(m.note)}</span></span>` : ''}<span class="hlmeta"><i style="background:var(--${m.color}S)"></i>${HL[m.color]}${b ? ` · ${esc(b.title)}` : ''} · p. ${esc(m.page || '?')} →</span></span></button>`;
function wireHlItems(root) { $$('[data-m]', root).forEach(el => el.onclick = async () => { const all = await db.all('marks'); const m = all.find(x => x.id === el.dataset.m); if (!m) return; openBook(m.book, null, { jump: m.b, flash: m.key }); }); }

// ---------- content ----------
const contentCache = new Map();
async function getContent(id) { if (contentCache.has(id)) return contentCache.get(id); const c = await db.get('content', id); contentCache.clear(); contentCache.set(id, c); return c; }

// ---------- reader ----------
const rs = $('#rscroll'), bt = $('#bt');
let RB = null, RC = null, MARKS = new Map(), BMS = [], pageMode = false, SENTS = [], sentIdx = new Map(), pageOf = [], nOf = [];
const imgURLs = [];
let imgObs = null;
function blockHTML(b, i, ja) {
  if (b.t === 'pg') return `<button class="pdiv" data-b="${i}" data-pg="${b.n || ''}" aria-label="Original page ${esc(b.p)}">p. ${esc(b.p)}</button>`;
  if (b.t === 'h') return b.lv === 1 ? `<h2 data-b="${i}">${esc(b.x)}</h2>` : `<h3 data-b="${i}">${esc(b.x)}</h3>`;
  if (b.t === 'img' || b.t === 'scan') return `<figure class="fig" data-b="${i}"><img data-k="${esc(b.k)}" width="${b.w}" height="${b.h}" alt="" style="aspect-ratio:${b.w}/${b.h}"></figure>`;
  if (b.t === 'p') { const ss = b.s && b.s.length ? b.s : [b.x]; return `<p data-b="${i}"${b.sm ? ' class="sm"' : ''}>` + ss.map((s, k) => { const key = i + '.' + k; const m = MARKS.get(key); return `<span class="s${m ? ' hl hl-' + m.color : ''}" data-s="${key}">${esc(s)}</span>${m && m.note ? '<i class="pm"></i>' : ''}`; }).join(ja ? '' : ' ') + '</p>'; }
  return '';
}
function contentsHTML() {
  const list = (RC.contents && RC.contents.length ? RC.contents : RC.toc) || [];
  if (list.length < 2) return '';
  return `<nav class="bc" aria-label="Contents"><div class="bc-h">Contents</div><div class="bc-sub">TAP A CHAPTER TO JUMP TO IT</div>${list.map(e => `<button class="bc-i ${e.lv === 2 ? 'lv2' : ''}" data-jb="${e.b}"><span>${esc(e.title)}</span><span>${esc(e.p || '')}</span></button>`).join('')}</nav>`;
}
function rangeHTML(from, to) { let h = from === 0 && !RB.scanned ? contentsHTML() : ''; const bl = RC.blocks, ja = RB.lang === 'ja'; for (let i = from; i < to && i < bl.length; i++) h += blockHTML(bl[i], i, ja); return h; }
function lazyImages(root) {
  if (!imgObs) imgObs = new IntersectionObserver(es => es.forEach(async e => { if (!e.isIntersecting) return; const img = e.target; imgObs.unobserve(img); const blob = await db.get('files', 'img:' + RB.id + ':' + img.dataset.k); if (blob) { const u = URL.createObjectURL(blob); imgURLs.push(u); img.src = u; img.style.background = 'none'; } }), { root: null, rootMargin: '800px 0px' });
  $$('img[data-k]', root).forEach(i => { if (!i.src) imgObs.observe(i); });
}
function applyLook() {
  const th = { white: ['#fff', '#fff', '#1E1E1E'], grey: ['#F2F2EF', '#F7F7F5', '#1E1E1E'], sepia: ['#EFE2C8', '#F6EEDD', '#3B2F22'], dark: ['#1C1C1C', '#111', '#E6E6E2'] }[S.theme] || ['#fff', '#fff', '#1E1E1E'];
  const R = $('#reader'); R.style.setProperty('--paper', th[0]); R.style.setProperty('--rbg', th[1]); R.style.setProperty('--ink', th[2]);
  R.style.setProperty('--fs', S.fs + 'px'); R.style.setProperty('--lh', Math.round(S.fs * { tight: 1.45, normal: 1.7, airy: 1.95 }[S.lsp]) + 'px');
  R.style.setProperty('--bf', S.font === 'serif' ? "'Newsreader',Georgia,serif" : "'Hanken Grotesk',system-ui,sans-serif");
  R.classList.toggle('dark', S.theme === 'dark');
  document.querySelector('meta[name=theme-color]').content = cur() === 'reader' ? th[1] : '#ffffff';
}
const CONV = 2; // conversion version — older books are rebuilt once with the newer converter
let rebuilding = false;
async function rebuildBook(b) {
  if ((b.cv || 1) >= CONV || rebuilding) return;
  rebuilding = true; const t = toast('Tidying this book — skipping the front pages…', { ms: 60000 });
  try {
    const blob = await db.get('files', 'pdf:' + b.id); if (!blob) return;
    const { convertPdf } = await import('./convert.js');
    const res = await convertPdf(new File([blob], b.fileName || 'book.pdf', { type: 'application/pdf' }));
    await db.delMany('files', (b.imgKeys || []).map(k => 'img:' + b.id + ':' + k));
    if (res.images.length) await db.putMany('files', res.images.map(x => [x.blob, 'img:' + b.id + ':' + x.key]));
    await db.put('content', { blocks: res.blocks, toc: res.toc, contents: res.contents }, b.id);
    // carry highlights and bookmarks over by their text / page
    const sents = []; let pg = '1'; const firstOfPage = {};
    res.blocks.forEach((bl, i) => { if (bl.t === 'pg') { pg = bl.p; if (!(pg in firstOfPage)) firstOfPage[pg] = i; } if (bl.t === 'p') (bl.s && bl.s.length ? bl.s : [bl.x]).forEach((s, k) => sents.push({ key: i + '.' + k, b: i, x: s })); });
    const old = await db.byBook(b.id); const put = [], del = [];
    for (const m of old) {
      del.push(m.id);
      if (m.kind === 'hl') { const s = sents.find(x => x.x === m.text) || sents.find(x => x.x.includes(m.text.slice(0, 60))); if (s) put.push({ ...m, key: s.key, b: s.b, id: b.id + ':' + s.key }); }
      else if (m.kind === 'bm') { const i = firstOfPage[m.page]; if (i !== undefined) put.push({ ...m, b: i }); }
    }
    if (del.length) await db.delMany('marks', del); if (put.length) await db.putMany('marks', put.map(m => [m]));
    if (b.pos) { const i = firstOfPage[b.pos.page]; b.pos = i === undefined ? null : { b: i, page: b.pos.page }; }
    Object.assign(b, { cv: CONV, imgKeys: res.images.map(x => x.key), chapters: res.toc.length, words: res.words });
    await saveBook(b); contentCache.delete(b.id);
  } catch (e) { console.warn('rebuild failed', e); b.cv = CONV; await saveBook(b); }
  finally { rebuilding = false; t.classList.remove('on'); }
}
async function openBook(id, bk, o = {}) {
  curBook = id; const b = bookById(id); if (!b) return;
  if ((b.cv || 1) < CONV) await rebuildBook(b);
  RC = await getContent(id); RB = b;
  if (!RC) { toast('This book’s pages are missing', { low: true }); return; }
  MARKS = new Map(); BMS = [];
  (await db.byBook(id)).forEach(m => { if (m.kind === 'hl') MARKS.set(m.key, m); else if (m.kind === 'bm') BMS.push(m); });
  // indexes
  SENTS = []; sentIdx = new Map(); pageOf = []; nOf = []; let p = '1', n = 1;
  RC.blocks.forEach((bl, i) => { if (bl.t === 'pg') { p = bl.p; n = bl.n || n; } pageOf[i] = p; nOf[i] = n; if (bl.t === 'p') (bl.s && bl.s.length ? bl.s : [bl.x]).forEach((s, k) => { sentIdx.set(i + '.' + k, SENTS.length); SENTS.push({ key: i + '.' + k, b: i, x: s }); }); });
  if (b.status === 'want' || b.status === 'hold') { b.status = 'reading'; }
  const target = o.jump ?? (b.pos ? b.pos.b : 0);
  const start = () => { go('reader', { fade: true, jump: target, flash: o.flash }); if (o.listen) setTimeout(openListen, 500); };
  if (!bk || RM || !bk.animate) { start(); return; }
  bookOpenAnim(bk, target, start);
}
function bookOpenAnim(bk, target, start) {
  applyLook(); const Rd = $('#reader'); const r = bk.getBoundingClientRect(), pr = ph.getBoundingClientRect(), PW = pr.width, PH = pr.height;
  const sx = r.left - pr.left, sy = r.top - pr.top, sw = r.width, sh = r.height; const w = Math.min(160, PW * .4), hh = w * 1.5, cx = (PW - w) / 2, cy = PH * .42 - hh / 2, ox = cx + w / 2;
  const tx = 20, ty = parseFloat(getComputedStyle(rs).paddingTop) || 114, tw = PW - 40, th = PH - ty;
  const ov = document.createElement('div'); ov.className = 'opening';
  ['--paper', '--rbg', '--ink', '--fs', '--lh', '--bf'].forEach(v => ov.style.setProperty(v, Rd.style.getPropertyValue(v)));
  const from = Math.max(0, target);
  ov.innerHTML = `<div class="op-bg"></div><div class="op-pg"><div class="op-in" style="width:${tw}px"><div class="bt ${RB.lang === 'ja' ? 'ja' : ''}">${rangeHTML(from, from + 30)}</div></div><i class="op-shade"></i><svg class="op-rib" viewBox="0 0 14 64" preserveAspectRatio="none"><path d="M0 0h14v62l-7-6-7 6z" fill="#111"/></svg></div><div class="op-cv"><div class="f"></div><div class="b"></div></div>`;
  ph.appendChild(ov);
  const img = bk.querySelector('img'); if (img) $('.op-cv .f', ov).innerHTML = `<img alt="" src="${img.src}">`;
  const bg = $('.op-bg', ov), pg = $('.op-pg', ov), inn = $('.op-in', ov), cv = $('.op-cv', ov), sd = $('.op-shade', ov), rb = $('.op-rib', ov);
  const box = (x, y, W, H) => ({ left: x + 'px', top: y + 'px', width: W + 'px', height: H + 'px' }); const sc = W => `scale(${W / tw})`;
  bk.style.visibility = 'hidden'; if (navigator.vibrate) navigator.vibrate(6);
  const E = 'cubic-bezier(.2,.8,.2,1)', IO = 'cubic-bezier(.45,.05,.3,1)', T1 = 440, T2 = 680, T3 = 500, d2 = T1 + 80, d3 = d2 + T2 - 20, Z = 'cubic-bezier(.6,0,.2,1)';
  const a = (el, kf, o) => el.animate(kf, Object.assign({ fill: 'forwards' }, o));
  [pg, cv].forEach(el => a(el, [box(sx, sy, sw, sh), box(cx, cy, w, hh)], { duration: T1, easing: E, fill: 'both' }));
  a(inn, [{ transform: sc(sw) }, { transform: sc(w) }], { duration: T1, easing: E, fill: 'both' });
  a(cv, [{ transform: 'perspective(1400px) rotateY(0deg)' }, { transform: 'perspective(1400px) rotateY(-8deg)' }], { duration: T1, easing: E, fill: 'both' });
  a(bg, [{ opacity: 0 }, { opacity: .94 }], { duration: T1 + T2, easing: 'ease-out', fill: 'both' });
  a(rb, [{ transform: 'translateY(-110%)' }, { transform: 'translateY(-110%)' }], { duration: 1, fill: 'both' });
  [pg, cv].forEach(el => a(el, [box(cx, cy, w, hh), box(ox, cy, w, hh)], { duration: T2, delay: d2, easing: IO }));
  a(cv, [{ transform: 'perspective(1400px) rotateY(-8deg)' }, { transform: 'perspective(1400px) rotateY(-178deg)' }], { duration: T2, delay: d2, easing: IO });
  const vis = (el, on) => a(el, [{ visibility: on ? 'visible' : 'hidden' }, { visibility: on ? 'visible' : 'hidden', offset: .49 }, { visibility: on ? 'hidden' : 'visible', offset: .49 }, { visibility: on ? 'hidden' : 'visible' }], { duration: T2, delay: d2, easing: 'linear', fill: 'both' });
  vis($('.f', cv), true); vis($('.b', cv), false);
  a(sd, [{ opacity: .5 }, { opacity: 0 }], { duration: T2, delay: d2, easing: IO, fill: 'both' });
  a(rb, [{ transform: 'translateY(-110%)' }, { transform: 'translateY(0)' }], { duration: 380, delay: d2 + T2 - 260, easing: 'cubic-bezier(.34,1.56,.64,1)' });
  a(pg, [box(ox, cy, w, hh), box(tx, ty, tw, th)], { duration: T3, delay: d3, easing: Z });
  a(inn, [{ transform: sc(w) }, { transform: sc(tw) }], { duration: T3, delay: d3, easing: Z });
  a(cv, [box(ox, cy, w, hh), box(tx, cy, w, hh)], { duration: T3, delay: d3, easing: Z });
  [$('.f', cv), $('.b', cv)].forEach(el => a(el, [{ opacity: 1 }, { opacity: 0 }], { duration: T3 * .5, delay: d3, easing: 'ease-in' }));
  a(rb, [{ opacity: 1 }, { opacity: 0 }], { duration: T3 * .6, delay: d3 });
  a(bg, [{ opacity: .94 }, { opacity: 1 }], { duration: 200, delay: d3 });
  let went = false, fin = false; const goR = () => { if (went) return; went = true; start(); };
  const finish = () => { if (fin) return; fin = true; goR(); ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, fill: 'forwards' }); setTimeout(() => { ov.remove(); bk.style.visibility = ''; }, 250); };
  setTimeout(goR, d3 + 60); setTimeout(finish, d3 + T3 + 40);
  ov.addEventListener('click', () => { ov.getAnimations({ subtree: true }).forEach(x => { try { x.finish(); } catch (e) { } }); finish(); });
}
function renderReader() {
  imgURLs.splice(0).forEach(u => URL.revokeObjectURL(u));
  bt.classList.toggle('ja', RB.lang === 'ja');
  bt.innerHTML = rangeHTML(0, RC.blocks.length) || '<p class="muted">This PDF has no readable text.</p>';
  lazyImages(bt);
}
let progScroll = 0;
function jumpTo(i) {
  hideQ(); if (pageMode) buildPages(i); else scrollToBlock(i);
  const el = (pageMode ? $('#cols') : bt).querySelector(`[data-b="${i}"]`);
  if (el && /^H/.test(el.tagName)) { el.classList.remove('jumped'); void el.offsetWidth; el.classList.add('jumped'); }
  setTimeout(() => updateProgress(true), 150);
}
function scrollToBlock(i, smooth) {
  progScroll = Date.now();
  if (i <= 0) { rs.scrollTop = 0; return; }
  const el = bt.querySelector(`[data-b="${i}"]`); if (!el) { rs.scrollTop = 0; return; }
  const y = Math.max(0, el.offsetTop - 8);
  if (smooth && !RM) rs.scrollTo({ top: y, behavior: 'smooth' }); else rs.scrollTop = y;
}
function topBlock() {
  if (pageMode) return pageTopBlock();
  const pr = rs.getBoundingClientRect(); const top = pr.top + (parseFloat(getComputedStyle(rs).paddingTop) || 100);
  const x = pr.left + pr.width / 2;
  for (let dy = 4; dy < 260; dy += 14) { const el = document.elementFromPoint(x, top + dy); const b = el && el.closest && el.closest('[data-b]'); if (b && bt.contains(b)) return +b.dataset.b; }
  // fallback: binary search by offsetTop
  const els = $$('[data-b]', bt); const st = rs.scrollTop; let best = 0; for (const e of els) { if (e.offsetTop <= st + 20) best = +e.dataset.b; else break; } return best;
}
function chapterAt(i) { if (RC.blocks[i] && RC.blocks[i].t === 'pg' && RC.blocks[i + 1] && RC.blocks[i + 1].t === 'h') i++; const t = RC.toc; let c = null, k = -1; t.forEach((x, j) => { if (x.b <= i) { c = x; k = j; } }); return { c, k, next: t[k + 1] }; }
function updateProgress(save = true) {
  if (!RB) return;
  const i = topBlock(); const p = pageOf[i] || '1';
  const pct = pageMode ? i / Math.max(1, RC.blocks.length - 1) : Math.min(1, rs.scrollTop / Math.max(1, rs.scrollHeight - rs.clientHeight));
  $('#rPage').textContent = /^\d+$/.test(p) ? `Page ${p} of ${RB.pageCount}` : `Page ${p}`;
  const { c, next } = chapterAt(i);
  const left = next ? nOf[next.b] - nOf[i] : RB.pageCount - nOf[i];
  $('#rLeft').textContent = left > 0 ? `${left} page${left > 1 ? 's' : ''} left in ${next ? 'chapter' : 'book'}` : (next ? 'Next chapter soon' : 'Last page');
  $('#rLab').textContent = c ? c.title : RB.title;
  $('#rpb').outerHTML = pbar(32, Math.round(pct * 32), 'id="rpb"');
  const on = BMS.some(m => m.page === p);
  $('#ribbon').classList.toggle('on', on && !pageMode); $('#bmBtn').classList.toggle('on', on);
  if (save) { RB.pos = { b: i, page: p }; RB.pct = pct; RB.lastRead = Date.now(); saveBook(RB); if (pct > .985 && RB.status !== 'done' && !RB.askedDone) { RB.askedDone = true; const t = toast(`Finished “${esc(RB.title)}”? <u>Mark as finished</u>`, { ms: 5000 }); $('u', t).onclick = () => { RB.status = 'done'; RB.finished = Date.now(); saveBook(RB); t.classList.remove('on'); toast('Nice — added to your finished books', { low: true }); }; } }
}
ENTER.reader = o => {
  if (o && o.back) { applyLook(); return; }
  applyLook(); chromeOn(true); renderReader(); pageMode = S.layout === 'page';
  $('#rscroll').style.display = pageMode ? 'none' : ''; $('#pmode').classList.toggle('on', pageMode);
  const target = o && o.jump != null ? o.jump : 0;
  requestAnimationFrame(() => {
    if (pageMode) buildPages(target); else scrollToBlock(target);
    updateProgress(false);
    if (o && o.flash) flashKey(o.flash);
    else if (RB.pos && target === RB.pos.b && target > 0) setTimeout(() => toast(`${ic('ret', 14, '#fff')}Back where you left off · p. ${esc(RB.pos.page)}`), 700);
    else if (RB.scanned) setTimeout(() => toast('Scanned book · pages show as pictures', { ms: 2600 }), 700);
  });
  saveBook(RB); startClock();
};
LEAVE.reader = () => { hideQ(); if (RB) { updateProgress(true); } stopClock(); $('meta[name=theme-color]').content = '#ffffff'; if (playing) showMini(true); };
function flashKey(key) { const el = (pageMode ? $('#cols') : bt)?.querySelector(`[data-s="${key}"]`); if (!el) return; if (!pageMode) { progScroll = Date.now(); rs.scrollTop = Math.max(0, el.offsetTop - 160); } el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
let st2, lastY = 0;
rs.addEventListener('scroll', () => { hideQ(); const y = rs.scrollTop; if (Math.abs(y - lastY) > 6) { if (Date.now() - progScroll > 700) chromeOn(y < lastY || y < 40); lastY = y; } clearTimeout(st2); st2 = setTimeout(() => updateProgress(true), 300); bump(); }, { passive: true });
function chromeOn(v) { $('#reader').classList.toggle('chrome-off', !v && !pageMode); }
document.addEventListener('visibilitychange', () => { if (document.hidden && cur() === 'reader' && RB) updateProgress(true); });

// reading time
let clock = null, lastAct = Date.now();
const bump = () => lastAct = Date.now();
function startClock() { stopClock(); clock = setInterval(async () => { if (document.hidden || Date.now() - lastAct > 90000 && !playing) return; const d = new Date(); const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); const days = (await db.get('kv', 'days')) || {}; days[k] = (days[k] || 0) + 15; await db.put('kv', days, 'days'); if (RB) { RB.readSec = (RB.readSec || 0) + 15; } }, 15000); }
function stopClock() { clearInterval(clock); clock = null; }
['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, bump, { passive: true }));

// long press → select sentence
let lpT = null, lpX = 0, lpY = 0, lpFired = false, selKey = null;
function readerDown(e) { const s = e.target.closest('.s'); lpFired = false; lpX = e.clientX; lpY = e.clientY; if (!s) return; lpT = setTimeout(() => { lpFired = true; if (navigator.vibrate) navigator.vibrate(8); selectS(s.dataset.s, s); }, 430); }
function readerMove(e) { if (lpT && Math.hypot(e.clientX - lpX, e.clientY - lpY) > 8) { clearTimeout(lpT); lpT = null; } }
function readerUp() { clearTimeout(lpT); lpT = null; }
function readerClick(e) {
  if (lpFired) { lpFired = false; return; }
  if ($('#qbar').classList.contains('on')) { hideQ(); return; }
  const pd = e.target.closest('.pdiv'); if (pd) { originalPage(+pd.dataset.pg, pd.textContent); return; }
  const jb = e.target.closest('.bc [data-jb]'); if (jb) { jumpTo(+jb.dataset.jb); return; }
  const s = e.target.closest('.s'); if (s && MARKS.has(s.dataset.s)) { selectS(s.dataset.s, s, true); return; }
  if (pageMode) { const pr = $('#pmode').getBoundingClientRect(); const rx = (e.clientX - pr.left) / pr.width; if (rx > .62) turn(1); else if (rx < .3) turn(-1); return; }
  const pr = ph.getBoundingClientRect(); const relY = (e.clientY - pr.top) / pr.height;
  if (relY > .2 && relY < .75) chromeOn($('#reader').classList.contains('chrome-off'));
}
['#rscroll', '#pmode'].forEach(id => { const el = $(id); el.addEventListener('pointerdown', readerDown); el.addEventListener('pointermove', readerMove); el.addEventListener('pointerup', readerUp); el.addEventListener('pointercancel', readerUp); el.addEventListener('click', readerClick); el.addEventListener('contextmenu', e => e.preventDefault()); });
const allS = key => $$(`.s[data-s="${key}"]`, $('#reader'));
function selectS(key, el, existing) { $$('.s.sel').forEach(x => x.classList.remove('sel')); selKey = key; if (!existing) el.classList.add('sel'); showQ(el, existing); }
function showQ(el, existing, full) {
  const q = $('#qbar'); const m = MARKS.get(selKey);
  const sw = Object.keys(HL).map(k => `<button data-k="${k}" aria-label="${HL[k]}"><i style="background:var(--${k}S);${m && m.color === k ? 'outline:2px solid #111;outline-offset:2px' : ''}"></i>${HL[k]}</button>`).join('');
  q.innerHTML = `<div class="qrow">${sw}<button data-m="more"><i style="border:1px solid #111;display:grid;place-items:center">${ic('more', 18)}</i>More</button></div>${full ? `<div class="qrow6">${[['pen', m && m.note ? 'Edit note' : 'Note'], ['copy', 'Copy'], ['head', 'Read from here'], ...(m ? [['trash', 'Remove']] : [])].map(([i, l]) => `<button data-x="${l}">${ic(i, 18)}${l}</button>`).join('')}</div>` : ''}<span class="caret" id="qc"></span>`;
  const pr = ph.getBoundingClientRect(), rects = el.getClientRects(), r0 = rects[0], rl = rects[rects.length - 1];
  q.style.visibility = 'hidden'; q.classList.add('on'); const h = q.offsetHeight;
  let top = r0.top - pr.top - 12 - h, below = false; if (top < (parseFloat(getComputedStyle(rs).paddingTop) || 100) - 20) { top = rl.bottom - pr.top + 12; below = true; }
  top = Math.min(top, pr.height - h - 10); q.style.top = top + 'px'; q.style.visibility = '';
  const c = $('#qc', q); const cx = Math.min(Math.max(r0.left - pr.left + 10, 36), pr.width - 40) - 16 - 9; c.style.left = cx + 'px';
  c.style.borderColor = 'transparent'; if (below) { c.style.top = '-19px'; c.style.bottom = ''; c.style.borderBottomColor = '#111'; } else { c.style.bottom = '-19px'; c.style.top = ''; c.style.borderTopColor = '#111'; }
  $$('[data-k]', q).forEach(b => b.onclick = () => keep(b.dataset.k));
  $$('[data-m]', q).forEach(b => b.onclick = () => showQ(el, existing, true));
  $$('[data-x]', q).forEach(b => b.onclick = () => {
    const x = b.dataset.x; const key = selKey; hideQ(true);
    if (x === 'Note' || x === 'Edit note') noteSheet(key);
    else if (x === 'Copy') { const t = SENTS[sentIdx.get(key)].x; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('Copied', { low: true })).catch(() => toast('Couldn’t copy', { low: true })); hideQ(); }
    else if (x === 'Read from here') { hideQ(); pi = sentIdx.get(key); playing ? speakNext() : startPlay(true); showMini(true); }
    else if (x === 'Remove') removeHl(key);
  });
}
function hideQ(keepSel) { $('#qbar').classList.remove('on'); if (!keepSel) $$('.s.sel').forEach(x => x.classList.remove('sel')); }
function paintAll(key) { allS(key).forEach(el => { el.classList.remove('sel', 'hl', ...Object.keys(HL).map(k => 'hl-' + k)); const m = MARKS.get(key); const pm = el.nextElementSibling && el.nextElementSibling.classList.contains('pm') ? el.nextElementSibling : null; if (pm && !(m && m.note)) pm.remove(); if (m && m.note && !pm) el.insertAdjacentHTML('afterend', '<i class="pm"></i>'); if (!m) return; el.style.transition = 'none'; el.style.backgroundSize = '0% 100%'; el.classList.add('hl', 'hl-' + m.color); void el.offsetWidth; el.style.transition = ''; el.style.backgroundSize = ''; }); }
async function keep(color) {
  const key = selKey; const prev = MARKS.get(key) ? { ...MARKS.get(key) } : null; const si = sentIdx.get(key); const b = SENTS[si].b;
  const m = prev ? { ...prev, color } : { id: RB.id + ':' + key, book: RB.id, kind: 'hl', key, b, color, text: SENTS[si].x, note: '', page: pageOf[b], ch: (chapterAt(b).c || {}).title || '', at: Date.now() };
  MARKS.set(key, m); await db.put('marks', m); hideQ(); paintAll(key);
  const t = toast(`<span style="display:flex;gap:6px;align-items:center"><i style="width:10px;height:10px;background:var(--${color}S);display:block;flex:none"></i>Kept as ${HL[color]}</span><u>Undo</u>`, { ms: 4000 });
  $('u', t).onclick = async () => { if (prev) { MARKS.set(key, prev); await db.put('marks', prev); } else { MARKS.delete(key); await db.del('marks', m.id); } paintAll(key); t.classList.remove('on'); };
}
async function removeHl(key) {
  const prev = MARKS.get(key); if (!prev) return; MARKS.delete(key); await db.del('marks', prev.id); hideQ(); paintAll(key);
  const t = toast(`Highlight removed<u>Undo</u>`, { ms: 4000 }); $('u', t).onclick = async () => { MARKS.set(key, prev); await db.put('marks', prev); paintAll(key); t.classList.remove('on'); };
}
function noteSheet(key) {
  const si = sentIdx.get(key); const m0 = MARKS.get(key);
  sheet(`<h3 class="t24" style="margin:4px 0 16px">Note</h3><div style="border-left:3px solid var(--${m0 ? m0.color : 'idea'}S);padding-left:12px;font:italic 14px/20px Newsreader,serif;color:var(--g)">“${esc(SENTS[si].x)}”</div><textarea id="nt" style="margin-top:16px;width:100%;height:120px;border:1.5px solid #111;padding:14px;resize:none;outline:none;line-height:22px" placeholder="Write a thought…">${esc(m0 && m0.note || '')}</textarea><div class="mono muted" style="font-size:10px;margin-top:8px">Saves as you type · shows as a pen mark next to the sentence</div><button class="btn" style="margin-top:24px" id="ntDone">Done</button>`, b => {
    const t = $('#nt', b); setTimeout(() => t.focus(), 320); let tm;
    const saveNote = async () => { let m = MARKS.get(key); const v = t.value.trim(); if (!m) { if (!v) return; const bi = SENTS[si].b; m = { id: RB.id + ':' + key, book: RB.id, kind: 'hl', key, b: bi, color: 'idea', text: SENTS[si].x, note: '', page: pageOf[bi], ch: (chapterAt(bi).c || {}).title || '', at: Date.now() }; } m.note = v; MARKS.set(key, m); await db.put('marks', m); };
    t.oninput = () => { clearTimeout(tm); tm = setTimeout(saveNote, 300); };
    $('#ntDone', b).onclick = async () => { clearTimeout(tm); await saveNote(); closeSheet(); };
  }, async () => { await sleep(350); paintAll(key); $$('.s.sel').forEach(x => x.classList.remove('sel')); });
}
// bookmarks
$('#bmBtn').onclick = async () => {
  const i = topBlock(); const p = pageOf[i] || '1'; const ex = BMS.find(m => m.page === p);
  if (ex) { BMS = BMS.filter(m => m !== ex); await db.del('marks', ex.id); toast('Bookmark removed', { low: true, ms: 1500 }); }
  else { const m = { id: RB.id + ':bm:' + p, book: RB.id, kind: 'bm', b: i, page: p, ch: (chapterAt(i).c || {}).title || '', at: Date.now() }; BMS.push(m); await db.put('marks', m); toast(`Bookmarked p. ${esc(p)}`, { low: true, ms: 1500 }); }
  updateProgress(false);
};
// original page view
async function originalPage(n, lab) {
  if (!n) return;
  sheet(`<div style="display:flex;justify-content:space-between;align-items:center;margin:4px 0 12px"><h3 class="t24" style="margin:0">Original page</h3><span class="mono muted" style="font-size:11px">${esc(lab)}</span></div><div class="orig" id="origBox"><p class="muted small" style="padding:20px">Loading…</p></div><div class="muted small" style="margin-top:12px">Exactly as it looks in the PDF — useful for tables and charts.</div>`, async b => {
    try { const { pdfjs, renderPage, DOC_OPTS } = await import('./convert.js'); const blob = await db.get('files', 'pdf:' + RB.id); const pdf = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), ...DOC_OPTS }).promise; const pg = await pdf.getPage(n); const { canvas } = await renderPage(pg, Math.min(1600, ph.clientWidth * (devicePixelRatio || 2))); const box = $('#origBox', b); if (box) { box.innerHTML = ''; box.appendChild(canvas); } pdf.destroy(); } catch (e) { const box = $('#origBox', b); if (box) box.innerHTML = '<p class="muted small" style="padding:20px">Couldn’t show this page.</p>'; }
  });
}

// ---------- reading settings ----------
$('#aaBtn').onclick = () => {
  const T = [['white', 'White', '#fff'], ['grey', 'Soft grey', '#F2F2EF'], ['sepia', 'Sepia', '#EFE2C8'], ['dark', 'Dark', '#1C1C1C']];
  sheet(`<h3 class="t24" style="margin:4px 0 24px">Reading</h3><div class="lbl" style="margin-bottom:12px">Theme</div><div style="display:flex;justify-content:space-between">${T.map(([k, l, c]) => `<button data-th="${k}" style="display:flex;flex-direction:column;align-items:center;gap:8px;font:10px 'Geist Mono',monospace"><span style="width:56px;height:56px;background:${c};border:${S.theme === k ? '2.5px' : '1px'} solid #111;display:grid;place-items:center;font:20px Newsreader,serif;color:${k === 'dark' ? '#eee' : '#111'}">Aa</span>${l}</button>`).join('')}</div>
  <div class="row" style="height:56px;margin-top:16px"><span style="font-weight:500">Text size</span><span style="display:flex;gap:8px;align-items:center"><button class="sq" style="height:36px" id="fsm" aria-label="Smaller"><span style="font:13px Newsreader,serif">A</span></button><span class="mono" style="width:28px;text-align:center" id="fsv">${S.fs}</span><button class="sq" style="height:36px" id="fsp" aria-label="Bigger"><span style="font:20px Newsreader,serif">A</span></button></span></div>
  <div class="row" style="height:56px"><span style="font-weight:500">Line spacing</span><div class="seg" style="width:186px;height:32px" id="lsp">${['tight', 'normal', 'airy'].map(x => `<button class="${S.lsp === x ? 'on' : ''}" data-v="${x}">${x.toUpperCase()}</button>`).join('')}</div></div>
  <div class="row" style="height:56px"><span style="font-weight:500">Font</span><div class="seg" style="width:124px;height:32px" id="fnt">${['serif', 'sans'].map(x => `<button class="${S.font === x ? 'on' : ''}" data-v="${x}">${x.toUpperCase()}</button>`).join('')}</div></div>
  <div class="row" style="height:56px;border:0"><span style="font-weight:500">Layout</span><div class="seg" style="width:170px;height:32px" id="lay">${[['scroll', 'SCROLL'], ['page', 'PAGE TURN']].map(([x, l]) => `<button class="${S.layout === x ? 'on' : ''}" data-v="${x}">${l}</button>`).join('')}</div></div>`, b => {
    const keepPos = fn => { const i = topBlock(); fn(); requestAnimationFrame(() => { if (pageMode) buildPages(i); else scrollToBlock(i); updateProgress(false); }); };
    $$('[data-th]', b).forEach(x => x.onclick = () => { S.theme = x.dataset.th; saveS(); applyLook(); $$('[data-th] span', b).forEach(sp => sp.style.borderWidth = '1px'); x.querySelector('span').style.borderWidth = '2.5px'; });
    const fs = d => { S.fs = Math.min(26, Math.max(14, S.fs + d)); $('#fsv', b).textContent = S.fs; saveS(); keepPos(applyLook); };
    $('#fsm', b).onclick = () => fs(-1); $('#fsp', b).onclick = () => fs(1);
    const segb = (id, key, cb) => $$(id + ' button', b).forEach(x => x.onclick = () => { $$(id + ' button', b).forEach(y => y.classList.toggle('on', y === x)); S[key] = x.dataset.v; saveS(); cb ? cb() : keepPos(applyLook); });
    segb('#lsp', 'lsp'); segb('#fnt', 'font');
    segb('#lay', 'layout', () => setLayout(S.layout));
  });
};
function setLayout(l) {
  const i = topBlock(); pageMode = l === 'page'; chromeOn(true);
  $('#rscroll').style.display = pageMode ? 'none' : ''; $('#pmode').classList.toggle('on', pageMode);
  if (pageMode) buildPages(i); else { requestAnimationFrame(() => { scrollToBlock(i); updateProgress(false); }); }
  toast(pageMode ? 'Page turn · tap the right side to turn' : 'Scroll', { low: true, ms: 1500 });
}

// ---------- page-turn mode (one section at a time, laid out in columns) ----------
let sec = null, pIdx = 0, pCount = 1, STEP = 345, colsEl = null;
function sectionOf(i) { const t = RC.toc; if (t.length) { const { k } = chapterAt(i); const a = k >= 0 ? t[k].b : 0; const z = t[k + 1] ? t[k + 1].b : RC.blocks.length; if (z - a < 400) return [a, z]; } const a = Math.floor(i / 120) * 120; return [a, Math.min(RC.blocks.length, a + 120)]; }
function buildPages(target) {
  const pm = $('#pmode'); sec = sectionOf(target);
  pm.innerHTML = `<div class="pbox" id="pbox"><div class="cols bt ${RB.lang === 'ja' ? 'ja' : ''}" id="cols">${rangeHTML(sec[0], sec[1])}</div><div class="pfoot" id="pfoot"></div></div>`;
  colsEl = $('#cols'); const box = $('#pbox'); const W = box.clientWidth; const cw = W - 48; STEP = W;
  colsEl.style.width = cw + 'px'; colsEl.style.columnWidth = cw + 'px'; colsEl.style.columnGap = '48px';
  lazyImages(colsEl);
  requestAnimationFrame(() => {
    pCount = Math.max(1, Math.ceil((colsEl.scrollWidth + 48) / STEP));
    const el = colsEl.querySelector(`[data-b="${target}"]`); pIdx = el ? Math.min(pCount - 1, Math.floor(el.offsetLeft / STEP)) : 0;
    place(); updateProgress(false);
  });
  let sx = null; pm.ontouchstart = e => { sx = e.touches[0].clientX; }; pm.ontouchend = e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 50 && !$('#qbar').classList.contains('on')) turn(dx < 0 ? 1 : -1); };
}
function pageTopBlock() { if (!colsEl) return 0; const els = $$('[data-b]', colsEl); for (const e of els) if (e.offsetLeft >= pIdx * STEP - 10 && e.offsetLeft < (pIdx + 1) * STEP - 10) return +e.dataset.b; for (let k = els.length - 1; k >= 0; k--) if (els[k].offsetLeft < pIdx * STEP) return +els[k].dataset.b; return sec ? sec[0] : 0; }
function place() { colsEl.style.transform = `translateX(${-pIdx * STEP}px)`; const i = pageTopBlock(); $('#pfoot').textContent = `p. ${pageOf[i] || ''} · ${pIdx + 1} / ${pCount}`; }
function turn(d) {
  hideQ(); bump();
  const ni = pIdx + d;
  if (ni < 0 || ni >= pCount) {
    if (d > 0 && sec[1] < RC.blocks.length) { buildPages(sec[1]); updateProgress(true); return; }
    if (d < 0 && sec[0] > 0) { const prevStart = sectionOf(sec[0] - 1); buildPages(prevStart[0]); requestAnimationFrame(() => requestAnimationFrame(() => { pIdx = pCount - 1; place(); updateProgress(true); })); return; }
    toast(d > 0 ? 'The end' : 'The beginning', { low: true, ms: 1200 }); return;
  }
  const box = $('#pbox'); if (RM) { pIdx = ni; place(); updateProgress(true); return; }
  if (d > 0) { const leaf = box.cloneNode(true); leaf.removeAttribute('id'); $$('[id]', leaf).forEach(x => x.removeAttribute('id')); leaf.classList.add('leaf'); $('#pmode').appendChild(leaf); pIdx = ni; place(); leaf.style.transition = 'transform .55s cubic-bezier(.45,.05,.3,1)'; requestAnimationFrame(() => requestAnimationFrame(() => { leaf.classList.add('turn'); leaf.style.transform = 'rotateY(-105deg)'; })); setTimeout(() => leaf.remove(), 580); }
  else { pIdx = ni; const leaf = box.cloneNode(true); leaf.removeAttribute('id'); $$('[id]', leaf).forEach(x => x.removeAttribute('id')); leaf.classList.add('leaf', 'turn'); const lc = leaf.querySelector('.cols'); lc.style.transform = `translateX(${-pIdx * STEP}px)`; leaf.style.transform = 'rotateY(-105deg)'; $('#pmode').appendChild(leaf); leaf.style.transition = 'transform .5s cubic-bezier(.45,.05,.3,1)'; requestAnimationFrame(() => requestAnimationFrame(() => { leaf.classList.remove('turn'); leaf.style.transform = 'rotateY(0)'; })); setTimeout(() => { place(); leaf.remove(); }, 520); }
  setTimeout(() => updateProgress(true), 600);
}

// ---------- contents ----------
$('#tContents').onclick = () => {
  const i = topBlock();
  sheet(`<h3 class="t24" style="margin:4px 0 16px">Contents</h3><div class="seg" style="margin-bottom:12px" id="cT"><button class="on">CHAPTERS ${RC.toc.length}</button><button>BOOKMARKS ${BMS.length}</button></div><div id="cL"></div>`, b => {
    const ch = () => RC.toc.length ? RC.toc.map((t, k) => { const nx = RC.toc[k + 1]; const here = i >= t.b && (!nx || i < nx.b); const done = nx && i >= nx.b; return `<button class="row" data-jb="${t.b}" style="min-height:${here ? 64 : 52}px;padding:8px 12px;${here ? 'background:#111;color:#fff;border:0' : ''};${done ? 'color:var(--g)' : ''}"><span style="display:flex;gap:12px;align-items:baseline;text-align:left;min-width:0"><span class="dot" style="font-size:16px;width:22px;flex:none">${k + 1}</span><span>${esc(t.title)}${here ? `<br><span class="mono" style="font-size:10px;color:#CFCFCA">You’re here · p. ${esc(pageOf[i])}</span>` : ''}</span></span><span class="mono" style="font-size:12px;flex:none">${done ? '✓ ' : ''}${esc(t.p)}</span></button>`; }).join('') : '<p class="muted small">This PDF has no chapters we could find.</p>';
    const bm = () => BMS.length ? [...BMS].sort((x, y) => x.b - y.b).map(m => `<div class="row" style="height:52px"><button data-jb="${m.b}" style="display:flex;gap:12px;align-items:center;flex:1;height:100%;text-align:left"><svg width="12" height="20" viewBox="0 0 12 20"><path d="M0 0h12v19l-6-5-6 5z" fill="#111"/></svg><span>Page ${esc(m.page)}<span class="muted small"> · ${esc(m.ch)}</span></span></button><button data-delbm="${esc(m.id)}" aria-label="Remove bookmark" style="padding:8px">${ic('close', 16)}</button></div>`).join('') : '<p class="muted small" style="line-height:20px">No bookmarks yet. Tap the bookmark button at the top while reading.</p>';
    const L = $('#cL', b);
    const wire = () => { $$('[data-jb]', L).forEach(r => r.onclick = () => { const t = +r.dataset.jb; closeSheet(); jumpTo(t); }); $$('[data-delbm]', L).forEach(x => x.onclick = async () => { const id = x.dataset.delbm; BMS = BMS.filter(m => m.id !== id); await db.del('marks', id); L.innerHTML = bm(); wire(); updateProgress(false); }); };
    L.innerHTML = ch(); wire();
    $$('#cT button', b).forEach((x, k) => x.onclick = () => { $$('#cT button', b).forEach(y => y.classList.toggle('on', y === x)); L.innerHTML = k ? bm() : ch(); wire(); });
  });
};
// find in book
$('#tSearch').onclick = () => {
  sheet(`<h3 class="t24" style="margin:4px 0 16px">Find in this book</h3><div class="sbox">${ic('search', 16)}<input id="fIn" type="search" enterkeyhint="search" placeholder="Word or phrase" autocomplete="off"></div><div id="fRes" style="margin-top:8px"></div>`, b => {
    const inp = $('#fIn', b); setTimeout(() => inp.focus(), 320); let tm;
    inp.oninput = () => { clearTimeout(tm); tm = setTimeout(() => {
      const q = inp.value.trim().toLowerCase(); const R = $('#fRes', b); if (q.length < 2) { R.innerHTML = ''; return; }
      const hits = []; for (const s of SENTS) { if (s.x.toLowerCase().includes(q)) { hits.push(s); if (hits.length > 60) break; } }
      R.innerHTML = hits.length ? `<div class="lbl" style="margin:12px 0 4px">${hits.length > 60 ? '60+' : hits.length} found</div>` + hits.map(s => `<button class="res" data-fk="${s.key}"><span class="mono muted" style="font-size:10px">p. ${esc(pageOf[s.b])}</span><br><span style="font-size:14px;line-height:20px">${mark(s.x, q)}</span></button>`).join('') : '<p class="muted small">Nothing found.</p>';
      $$('[data-fk]', R).forEach(r => r.onclick = () => { const k = r.dataset.fk; closeSheet(); const bi = +k.split('.')[0]; if (pageMode) buildPages(bi); else scrollToBlock(bi); setTimeout(() => { flashKey(k); updateProgress(true); }, 300); });
    }, 200); };
  });
};
const mark = (t, q) => { const k = t.toLowerCase().indexOf(q); if (k < 0) return esc(t); let a = Math.max(0, k - 60); if (a > 0) { const sp = t.indexOf(' ', a); a = sp > -1 && sp < k ? sp + 1 : a; } return (a ? '…' : '') + esc(t.slice(a, k)) + `<mark>${esc(t.slice(k, k + q.length))}</mark>` + esc(t.slice(k + q.length, k + q.length + 120)) + (k + q.length + 120 < t.length ? '…' : ''); };

// ---------- listen (device voices) ----------
let playing = false, pi = 0, lt = null, gen = 0, voices = [];
const synth = window.speechSynthesis;
const loadV = () => { try { voices = synth ? synth.getVoices() : []; } catch (e) { } };
loadV(); try { synth && synth.addEventListener('voiceschanged', loadV); } catch (e) { }
const BADV = /compact|eloquence|albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|ralph|grandma|grandpa|rocko|shelley|sandy|\bflo\b|reed|eddy|novelty/i;
function scoreV(v) { const n = v.name; let s = 0; if (/premium/i.test(n)) s += 7; if (/enhanced/i.test(n)) s += 6; if (/natural|neural|online/i.test(n)) s += 6; if (/google/i.test(n)) s += 3; if (/samantha|ava|allison|serena|daniel|karen|moira|evan|zoe|kyoko|o-ren|hattori/i.test(n)) s += 2; if (v.default) s += 1; return s; }
const vlist = lang => voices.filter(v => v.lang && v.lang.replace('_', '-').toLowerCase().startsWith(lang) && !BADV.test(v.name)).sort((a, b) => scoreV(b) - scoreV(a));
const LANG = () => RB && RB.lang === 'ja' ? 'ja' : 'en';
function pickVoice(lang) { const vs = vlist(lang); if (!vs.length) return null; return vs.find(v => v.voiceURI === S['voice_' + lang]) || vs[0]; }
function markNow(i) {
  $$('.s.now').forEach(x => x.classList.remove('now')); const s = SENTS[i]; if (!s) return;
  const root = pageMode ? colsEl : bt; const el = root && root.querySelector(`[data-s="${s.key}"]`);
  if (!el) { if (pageMode && cur() === 'reader') { buildPages(s.b); } return; }
  el.classList.add('now');
  if (cur() !== 'reader' || !S.scrollAlong) return;
  if (pageMode) { const pg = Math.floor(el.offsetLeft / STEP); if (pg !== pIdx) { pIdx = pg; place(); } }
  else { const r = el.offsetTop - rs.scrollTop; if (r < 140 || r > rs.clientHeight - 280) rs.scrollTo({ top: el.offsetTop - 200, behavior: RM ? 'auto' : 'smooth' }); }
}
function speakNext() {
  if (!playing) return; clearTimeout(lt); const my = ++gen;
  if (pi >= SENTS.length) { stopPlay(); toast('End of the book', { low: true }); return; }
  const ja = LANG() === 'ja'; const b = SENTS[pi].b; const ids = []; for (let k = pi; k < SENTS.length && SENTS[k].b === b; k++) ids.push(k);
  let text = ''; const offs = []; ids.forEach(k => { offs.push(text.length); text += SENTS[k].x + (ja ? '' : ' '); });
  markNow(ids[0]); updMini();
  const done = () => { if (my !== gen || !playing) return; pi = ids[ids.length - 1] + 1; speakNext(); };
  const est = () => { let k = 0; const step = () => { if (my !== gen || !playing) return; if (k >= ids.length) { done(); return; } pi = ids[k]; markNow(pi); const t = ja ? SENTS[ids[k]].x.length * 170 : SENTS[ids[k]].x.length * 62; lt = setTimeout(() => { k++; step(); }, Math.max(1400, t / S.rate)); }; step(); };
  if (!(synth && window.SpeechSynthesisUtterance)) { est(); return; }
  try {
    synth.cancel(); const u = new SpeechSynthesisUtterance(text); const v = pickVoice(ja ? 'ja' : 'en'); if (v) u.voice = v; u.lang = ja ? 'ja-JP' : (v ? v.lang : 'en-US'); u.rate = S.rate * (ja ? 1 : .95);
    u.onboundary = e => { if (my !== gen) return; let k = 0; offs.forEach((o, j) => { if (e.charIndex >= o) k = j; }); if (ids[k] !== pi) { pi = ids[k]; markNow(pi); } };
    u.onend = done; u.onerror = e => { if (my !== gen || e.error === 'interrupted' || e.error === 'canceled') return; est(); };
    synth.speak(u);
    lt = setTimeout(() => { if (my === gen && playing && !synth.speaking && !synth.pending) est(); }, 2500);
  } catch (e) { est(); }
}
function firstVisibleSent() { const i = topBlock(); for (let k = 0; k < SENTS.length; k++) if (SENTS[k].b >= i) return k; return 0; }
function startPlay(keepPi) { if (!SENTS.length) { toast('Nothing to read aloud in this book', { low: true }); return; } playing = true; if (!keepPi) pi = firstVisibleSent(); speakNext(); syncPlayBtns(); }
function stopPlay() { playing = false; gen++; clearTimeout(lt); try { synth && synth.cancel(); } catch (e) { } $$('.s.now').forEach(x => x.classList.remove('now')); syncPlayBtns(); }
function syncPlayBtns() { const b = $('#lPlay'); if (b) b.innerHTML = ic(playing ? 'pause' : 'play', 26, '#fff'); $('#miniPlay').innerHTML = ic(playing ? 'pause' : 'play', 18, '#fff'); }
function updMini() { if (!RB) return; const s = SENTS[pi]; $('#miniTitle').textContent = s ? ((chapterAt(s.b).c || {}).title || RB.title) : RB.title; $('#miniPb').outerHTML = pbar(20, Math.round(pi / Math.max(1, SENTS.length) * 20), 'id="miniPb" style="margin-top:6px"'); const lp = $('#lPb'); if (lp) lp.outerHTML = pbar(32, Math.round(pi / Math.max(1, SENTS.length) * 32), 'id="lPb"'); }
const mini = $('#mini'); ph.appendChild(mini);
function showMini(v) { mini.classList.toggle('on', v); miniPos(); }
function miniPos() { const tabsVisible = ['library', 'knowledge', 'journal'].includes(cur()); mini.style.bottom = cur() === 'reader' ? '' : `calc(var(--bot) + ${tabsVisible ? 76 : 16}px)`; }
$('#miniX').innerHTML = ic('close', 18, '#fff');
mini.addEventListener('click', e => { if (e.target.closest('#miniPlay')) { playing ? stopPlay() : startPlay(true); return; } if (e.target.closest('#miniX')) { stopPlay(); showMini(false); return; } if (cur() === 'reader') openListen(); else if (RB) openBook(RB.id, null, { jump: SENTS[pi] ? SENTS[pi].b : undefined }); });
function openListen() {
  if (RB.scanned || !SENTS.length) { toast('This book has no text to read aloud', { low: true }); return; }
  showMini(false); const ja = LANG() === 'ja'; const v = pickVoice(ja ? 'ja' : 'en');
  sheet(`<div class="t20" style="text-align:center;margin-top:8px">${esc((chapterAt(SENTS[pi] ? SENTS[pi].b : topBlock()).c || {}).title || RB.title)}</div><div class="muted" style="font-size:12px;text-align:center;margin-top:4px">The grey line is what you hear</div><div style="margin-top:20px">${pbar(32, Math.round(pi / Math.max(1, SENTS.length) * 32), 'id="lPb"')}</div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-top:20px"><button class="sq" style="width:56px" id="lSpd"><span class="mono" style="font-size:12px">${S.rate}×</span></button><button id="lRew" aria-label="Back one sentence" style="padding:8px">${ic('rew', 26)}</button><button id="lPlay" class="btn" style="width:64px;height:64px" aria-label="Play or pause">${ic(playing ? 'pause' : 'play', 26, '#fff')}</button><button id="lFwd" aria-label="Forward one sentence" style="padding:8px">${ic('fwd', 26)}</button><button class="sq" style="width:56px" id="lVoice"><span class="mono" style="font-size:11px">Voice</span></button></div>
  <div class="row" style="margin-top:20px"><span style="font-weight:500">Scroll along with the voice</span><button class="tog ${S.scrollAlong ? 'on' : ''}" id="lTog" aria-label="Scroll along"></button></div>
  <div class="muted small" style="margin-top:12px;line-height:18px">Voice: ${v ? esc(v.name) : 'your phone’s default'}. Your phone’s own voices are free and work offline.</div>`, b => {
    $('#lPlay', b).onclick = () => { playing ? stopPlay() : startPlay(true); };
    $('#lRew', b).onclick = () => { pi = Math.max(0, pi - 1); if (playing) speakNext(); else markNow(pi); };
    $('#lFwd', b).onclick = () => { pi = Math.min(SENTS.length - 1, pi + 1); if (playing) speakNext(); else markNow(pi); };
    $('#lSpd', b).onclick = e => { const o = [0.75, 1, 1.25, 1.5, 2]; S.rate = o[(o.indexOf(S.rate) + 1) % o.length]; saveS(); e.currentTarget.innerHTML = `<span class="mono" style="font-size:12px">${S.rate}×</span>`; if (playing) speakNext(); };
    $('#lTog', b).onclick = e => { S.scrollAlong = !S.scrollAlong; saveS(); e.currentTarget.classList.toggle('on', S.scrollAlong); };
    $('#lVoice', b).onclick = () => voiceSheet();
  }, () => { if (playing) showMini(true); });
  if (!playing) pi = firstVisibleSent();
}
function voiceSheet() {
  loadV(); const ja = LANG() === 'ja', lang = ja ? 'ja' : 'en'; const vs = vlist(lang).slice(0, 10); const curV = pickVoice(lang);
  sheet(`<div style="display:flex;align-items:center;gap:12px;margin:4px 0 8px"><button class="sq" id="vBack" aria-label="Back">${ic('back')}</button><h3 class="t24" style="margin:0">Voice</h3></div><p class="muted" style="font-size:13px;line-height:19px;margin:8px 0 16px">Tap a voice to hear it. For the smoothest reading on iPhone, download an <b style="color:#111">Enhanced</b> or <b style="color:#111">Premium</b> voice in Settings › Accessibility › Spoken Content › Voices, then come back here.</p>${vs.length ? vs.map((v, k) => `<button class="row" data-v="${esc(v.voiceURI)}" style="height:56px"><span style="display:flex;gap:12px;align-items:center"><span class="rad" style="width:18px;height:18px;border:1px solid #111;border-radius:50%;display:grid;place-items:center;flex:none">${curV && curV.voiceURI === v.voiceURI ? '<i style="width:10px;height:10px;border-radius:50%;background:#111;display:block"></i>' : ''}</span><span style="text-align:left">${esc(v.name.replace(/\s*\(.*\)/, ''))}<br><span class="mono muted" style="font-size:10px">${esc(v.lang)}${/premium|enhanced|natural|neural|online/i.test(v.name) ? ' · SMOOTH' : ''}</span></span></span>${k === 0 ? '<span class="mono" style="font-size:10px;border:1px solid #111;padding:2px 6px">BEST</span>' : ''}</button>`).join('') : '<p class="muted">No voices found on this device.</p>'}`, b => {
    $('#vBack', b).onclick = () => openListen();
    $$('[data-v]', b).forEach(r => r.onclick = () => { S['voice_' + lang] = r.dataset.v; saveS(); $$('[data-v] .rad', b).forEach(x => x.innerHTML = x.closest('[data-v]') === r ? '<i style="width:10px;height:10px;border-radius:50%;background:#111;display:block"></i>' : ''); const was = playing; stopPlay(); try { const u = new SpeechSynthesisUtterance(ja ? 'この声で本を読みます。' : 'This is how I’ll read your book.'); const v = voices.find(x => x.voiceURI === r.dataset.v); if (v) { u.voice = v; u.lang = v.lang; } u.rate = .95; u.onend = () => { if (was) startPlay(true); }; synth.speak(u); } catch (e) { } });
  }, () => { if (playing) showMini(true); });
}
$('#tListen').onclick = openListen;

// ---------- notebook ----------
$('#tNotes').onclick = () => openNotebook(RB.id);
let nbBook = null, nbFilter = 'all';
async function openNotebook(id) { nbBook = id; nbFilter = 'all'; go('notebook'); }
ENTER.notebook = async o => {
  const b = bookById(nbBook); if (!b) return;
  const ms = (await db.byBook(nbBook)).filter(m => m.kind === 'hl').sort((x, y) => x.b - y.b || x.key.localeCompare(y.key, undefined, { numeric: true }));
  $('#nbSub').textContent = `${b.title} · ${ms.length} kept`;
  const counts = {}; ms.forEach(m => counts[m.color] = (counts[m.color] || 0) + 1);
  const list = nbFilter === 'all' ? ms : ms.filter(m => m.color === nbFilter);
  let lastCh = null;
  $('#nbBody').innerHTML = ms.length ? `<div class="chips" style="margin-bottom:16px" id="nbChips"><button class="chip ${nbFilter === 'all' ? 'on' : ''}" data-f="all">All <small>${ms.length}</small></button>${Object.keys(HL).filter(k => counts[k]).map(k => `<button class="chip ${nbFilter === k ? 'on' : ''}" data-f="${k}"><i style="background:var(--${k}S)"></i>${HL[k]} <small>${counts[k]}</small></button>`).join('')}</div>` + list.map(m => { const h = m.ch !== lastCh && m.ch ? `<div class="lbl" style="padding:16px 0 8px;border-bottom:1px solid var(--ln)">${esc(m.ch)}</div>` : ''; lastCh = m.ch; return h + hlItem(m); }).join('') : '<div class="empty"><div class="t22">Nothing kept yet</div><p>While reading, tap &amp; hold a sentence, then pick a colour. It shows up here.</p></div>';
  $$('#nbChips .chip').forEach(c => c.onclick = () => { nbFilter = c.dataset.f; ENTER.notebook(); });
  $$('[data-m]', $('#nbBody')).forEach(el => el.onclick = () => { const m = ms.find(x => x.id === el.dataset.m); if (!m) return; if (stack.includes('reader') && RB && RB.id === m.book) { back(); setTimeout(() => { if (pageMode) buildPages(m.b); else scrollToBlock(m.b); flashKey(m.key); updateProgress(true); }, 340); } else openBook(m.book, null, { jump: m.b, flash: m.key }); });
};
$('#nbShare').onclick = async () => { const b = bookById(nbBook); const ms = (await db.byBook(nbBook)).filter(m => m.kind === 'hl').sort((x, y) => x.b - y.b); shareText(`${b.title}${b.author ? ' — ' + b.author : ''}`, notesMarkdown(b, ms)); };
function notesMarkdown(b, ms) { let out = `# ${b.title}\n${b.author ? '_' + b.author + '_\n' : ''}\n`; let ch = null; ms.forEach(m => { if (m.ch && m.ch !== ch) { ch = m.ch; out += `\n## ${ch}\n\n`; } out += `> ${m.text}\n\n— ${HL[m.color]} · p. ${m.page}\n\n`; if (m.note) out += `${m.note}\n\n`; }); return out; }
async function shareText(title, text) {
  try { if (navigator.share) { await navigator.share({ title, text }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); toast('Copied — paste it anywhere', { low: true }); } catch (e) { toast('Couldn’t share', { low: true }); }
}

// ---------- knowledge ----------
let kFilter = 'all';
ENTER.knowledge = async () => {
  const ms = (await db.all('marks')).filter(m => m.kind === 'hl').sort((a, b) => b.at - a.at);
  const counts = {}; ms.forEach(m => counts[m.color] = (counts[m.color] || 0) + 1);
  const books = new Set(ms.map(m => m.book));
  const list = kFilter === 'all' ? ms : ms.filter(m => m.color === kFilter);
  $('#kBody').innerHTML = ms.length ? `<p class="muted" style="font-size:14px;margin:0 0 16px">${ms.length} thing${ms.length > 1 ? 's' : ''} you kept, from ${books.size} book${books.size > 1 ? 's' : ''}.</p><div class="chips" id="kChips"><button class="chip ${kFilter === 'all' ? 'on' : ''}" data-f="all">All <small>${ms.length}</small></button>${Object.keys(HL).filter(k => counts[k]).map(k => `<button class="chip ${kFilter === k ? 'on' : ''}" data-f="${k}"><i style="background:var(--${k}S)"></i>${HL[k]} <small>${counts[k]}</small></button>`).join('')}</div><div style="margin-top:8px">${list.map(m => hlItem(m, bookById(m.book))).join('')}</div>`
    : '<div class="empty"><div class="t22">Your knowledge lives here</div><p>Everything you mark in any book collects here, sorted by colour — Important, Quote, Concept, Action, Idea and Research.</p></div>';
  $$('#kChips .chip').forEach(c => c.onclick = () => { kFilter = c.dataset.f; ENTER.knowledge(); });
  wireHlItems($('#kBody'));
};
$('#kShare').onclick = async () => { const ms = (await db.all('marks')).filter(m => m.kind === 'hl'); if (!ms.length) { toast('Nothing kept yet', { low: true }); return; } let out = ''; BOOKS.forEach(b => { const bm = ms.filter(m => m.book === b.id).sort((x, y) => x.b - y.b); if (bm.length) out += notesMarkdown(b, bm) + '\n'; }); shareText('Shiori — my highlights', out); };

// ---------- search ----------
ENTER.search = o => { if (o && o.back) return; $('#sIn').value = ''; $('#sBody').innerHTML = '<p class="muted" style="font-size:14px;line-height:20px">Search titles, authors, everything inside your books, and your notes.</p>'; setTimeout(() => $('#sIn').focus(), 350); };
let sTm;
$('#sIn').addEventListener('input', e => { clearTimeout(sTm); sTm = setTimeout(() => runSearch(e.target.value), 250); });
async function runSearch(qq) {
  const q = qq.trim().toLowerCase(); const B = $('#sBody'); if (q.length < 2) { B.innerHTML = ''; return; }
  const bs = BOOKS.filter(b => (b.title + ' ' + (b.author || '')).toLowerCase().includes(q));
  const ms = (await db.all('marks')).filter(m => m.kind === 'hl' && ((m.text || '') + ' ' + (m.note || '')).toLowerCase().includes(q)).slice(0, 20);
  let inside = [];
  for (const b of BOOKS) { if (inside.length >= 30) break; const c = await db.get('content', b.id); if (!c) continue; for (let i = 0; i < c.blocks.length && inside.length < 30; i++) { const bl = c.blocks[i]; if (bl.t !== 'p') continue; const ss = bl.s && bl.s.length ? bl.s : [bl.x]; for (let k = 0; k < ss.length; k++) if (ss[k].toLowerCase().includes(q)) { inside.push({ b, i, k, x: ss[k], page: (c.blocks.slice(0, i).reverse().find(x => x.t === 'pg') || { p: '1' }).p }); break; } } }
  if ($('#sIn').value.trim().toLowerCase() !== q) return;
  B.innerHTML = (bs.length ? `<div class="lbl" style="margin-bottom:8px">Books · ${bs.length}</div>` + bs.map(b => `<button class="row" data-sb="${b.id}" style="justify-content:flex-start;gap:12px;padding:8px 0"><span style="width:36px;flex:none">${bookEl(b)}</span><span style="text-align:left"><span style="font-weight:600;font-size:15px">${mark(b.title, q)}</span><br><span class="muted" style="font-size:12px">${esc(b.author || '')}</span></span></button>`).join('') : '')
    + (ms.length ? `<div class="lbl" style="margin:24px 0 4px">Your notes · ${ms.length}</div>` + ms.map(m => hlItem(m, bookById(m.book))).join('') : '')
    + (inside.length ? `<div class="lbl" style="margin:24px 0 4px">Inside your books · ${inside.length}${inside.length >= 30 ? '+' : ''}</div>` + inside.map(r => `<button class="res" data-si="${r.b.id}|${r.i}|${r.k}"><span style="display:flex;justify-content:space-between;gap:12px"><b style="font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.b.title)}</b><span class="link" style="flex:none">p. ${esc(r.page)} →</span></span><span style="display:block;font-size:14px;line-height:20px;margin-top:4px">${mark(r.x, q)}</span></button>`).join('') : '')
    + (!bs.length && !ms.length && !inside.length ? `<div class="empty"><div class="t22">Nothing found</div><p>No book, page or note mentions “${esc(qq.trim())}”.</p></div>` : '');
  fillCovers(B);
  $$('[data-sb]', B).forEach(r => r.onclick = () => { curBook = r.dataset.sb; go('book'); });
  $$('[data-si]', B).forEach(r => r.onclick = () => { const [id, i, k] = r.dataset.si.split('|'); openBook(id, null, { jump: +i, flash: i + '.' + k }); });
  wireHlItems(B);
}

// ---------- journal ----------
ENTER.journal = async () => {
  const days = (await db.get('kv', 'days')) || {}; const ms = (await db.all('marks')).filter(m => m.kind === 'hl');
  const yr = new Date().getFullYear();
  const finished = BOOKS.filter(b => b.status === 'done');
  const finishedYr = finished.filter(b => new Date(b.finished || b.lastRead || b.added).getFullYear() === yr).length;
  const secs = Object.values(days).reduce((a, b) => a + b, 0);
  const pages = BOOKS.reduce((n, b) => n + Math.round((b.status === 'done' ? 1 : (b.pct || 0)) * b.pageCount), 0);
  const st = [[finished.length, 'Books finished'], [Math.round(secs / 360) / 10, 'Hours read'], [pages, 'Pages read'], [ms.length, 'Things kept']];
  // heatmap: last 26 weeks, columns = weeks
  const tints = ['#EFEFEC', '#C9C9C4', '#8A8A84', '#4A4A47', '#111']; const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(today); start.setDate(start.getDate() - (25 * 7 + today.getDay()));
  let heat = ''; for (let d = 0; d < 26 * 7; d++) { const dt = new Date(start); dt.setDate(start.getDate() + d); const k = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0'); const v = days[k] || 0; const lv = dt > today ? -1 : v === 0 ? 0 : v < 600 ? 1 : v < 1800 ? 2 : v < 3600 ? 3 : 4; heat += `<i title="${k}" style="background:${lv < 0 ? 'transparent' : tints[lv]};transition-delay:${RM ? 0 : Math.floor(d / 7) * 18}ms"></i>`; }
  const fmt = d => d.toLocaleDateString('en', { month: 'short' });
  const reading = BOOKS.filter(b => b.status === 'reading');
  const speed = (() => { const totalSec = BOOKS.reduce((n, b) => n + (b.readSec || 0), 0); const pg = BOOKS.reduce((n, b) => n + Math.round((b.pct || 0) * b.pageCount), 0); return totalSec > 600 ? Math.round(pg / (totalSec / 3600)) : 0; })();
  $('#jBody').innerHTML = `<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">${st.map(([n, l]) => `<div class="stat"><span class="dot" data-n="${n}">0</span><span class="mono muted" style="font-size:9px;text-transform:uppercase">${l}</span></div>`).join('')}</div>
  <div class="lbl" style="margin:32px 0 12px">Reading activity · ${fmt(start)} – ${fmt(today)}</div><div class="heat" id="heat">${heat}</div><div style="display:flex;gap:6px;align-items:center;justify-content:flex-end;margin-top:8px" class="mono muted"><span style="font-size:9px">LESS</span>${tints.map(t => `<i style="width:9px;height:9px;background:${t};display:block"></i>`).join('')}<span style="font-size:9px">MORE</span></div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin:32px 0 12px"><span class="lbl">Yearly goal</span><button class="link" id="goalEdit">Change</button></div><div class="dot" style="font-size:18px">${finishedYr} / ${S.goal} books</div><div style="margin-top:8px" id="goal">${pbar(Math.min(30, S.goal * 2), 0)}</div><div class="muted" style="font-size:12px;margin-top:8px">${finishedYr >= S.goal ? 'Goal reached. Lovely.' : `About ${Math.max(1, Math.ceil((S.goal - finishedYr) / Math.max(1, 12 - today.getMonth())))} book${(S.goal - finishedYr) > 12 - today.getMonth() ? 's' : ''} a month keeps you on track.`}</div>
  <div style="margin-top:32px">${[['Currently reading', reading.length ? reading.length + ' book' + (reading.length > 1 ? 's' : '') : '—'], ['Reading speed', speed ? speed + ' pages / hour' : 'after 10 min of reading'], ['Most highlighted', (() => { const c = {}; ms.forEach(m => c[m.book] = (c[m.book] || 0) + 1); const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0]; return top && bookById(top[0]) ? esc(bookById(top[0]).title) + ' · ' + top[1] : '—'; })()]].map(([a, b]) => `<div class="row"><span>${a}</span><span class="mono" style="font-size:12px;font-weight:500;text-align:right">${b}</span></div>`).join('')}</div>`;
  $$('[data-n]', $('#jBody')).forEach(e => { const N = +e.dataset.n; const t0 = performance.now(); const dur = RM ? 1 : 700; const f = t => { const p = Math.min(1, (t - t0) / dur); const v = N * (1 - Math.pow(1 - p, 3)); e.textContent = N % 1 ? v.toFixed(1) : Math.round(v).toLocaleString('en'); if (p < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); });
  requestAnimationFrame(() => $('#heat') && $('#heat').classList.add('on'));
  const seg = Math.min(30, S.goal * 2), fill = Math.round(Math.min(1, finishedYr / S.goal) * seg); let g = 0; const gi = setInterval(() => { const el = $('#goal'); if (!el || g >= fill) { clearInterval(gi); return; } g++; el.innerHTML = pbar(seg, g); }, RM ? 1 : 30);
  $('#goalEdit').onclick = () => sheet(`<h3 class="t24" style="margin:4px 0 8px">Yearly goal</h3><label class="field"><span class="lbl">Books this year</span><input id="gN" type="number" inputmode="numeric" min="1" max="200" value="${S.goal}"></label><button class="btn" id="gSave" style="margin-top:24px">Save</button>`, s => { $('#gSave', s).onclick = () => { S.goal = Math.max(1, Math.min(200, parseInt($('#gN', s).value) || 12)); saveS(); closeSheet(); ENTER.journal(); }; });
};

// ---------- settings ----------
ENTER.settings = async () => {
  let est = ''; try { const e = await navigator.storage.estimate(); est = `${(e.usage / 1048576).toFixed(1)} MB used`; } catch (e) { }
  let persisted = false; try { persisted = await navigator.storage.persisted(); } catch (e) { }
  $('#setBody').innerHTML = `<div class="lbl" style="margin:8px 0 8px">Your library</div>
  <div class="row" style="min-height:56px"><span>Books on this phone<br><span class="muted small">${BOOKS.length} book${BOOKS.length === 1 ? '' : 's'}${est ? ' · ' + est : ''}</span></span></div>
  <div class="row" style="min-height:56px"><span>Keep my books safe<br><span class="muted small">${persisted ? 'On — your phone won’t clear Shiori’s storage' : 'Asks your phone not to clear Shiori’s storage'}</span></span>${persisted ? ic('check', 18) : '<button class="btn sm sec" id="persist" style="width:auto;height:36px;padding:0 12px;font-size:11px">Turn on</button>'}</div>
  <div class="lbl" style="margin:32px 0 8px">Backup</div>
  <p class="muted small" style="line-height:18px;margin:0 0 12px">Saves your highlights, notes, bookmarks, reviews and progress as one file. Your PDFs aren’t included — keep those in Files.</p>
  <button class="btn sec" id="bkOut">${ic('share', 16)}Export backup</button><button class="btn sec" id="bkIn" style="margin-top:8px">${ic('upload', 16)}Restore from backup</button>
  <div class="lbl" style="margin:32px 0 8px">About</div><p class="muted small" style="line-height:18px;margin:0">Shiori keeps everything on this phone — nothing is uploaded. Version 1.0.</p>
  <button class="btn warn" id="wipe" style="margin-top:32px">Delete everything</button>`;
  hydrate($('#setBody'));
  const pb = $('#persist'); if (pb) pb.onclick = async () => { let ok = false; try { ok = await navigator.storage.persist(); } catch (e) { } toast(ok ? 'Turned on' : 'Your phone said no — adding Shiori to your Home Screen helps', { low: true, ms: 3200 }); ENTER.settings(); };
  $('#bkOut').onclick = exportBackup; $('#bkIn').onclick = () => { $('#backupIn').value = ''; $('#backupIn').click(); };
  $('#wipe').onclick = () => confirmBox('Delete everything?', 'Every book, highlight and note in Shiori will be removed from this phone. This can’t be undone.', async () => { for (const s of ['books', 'content', 'files', 'marks', 'kv']) { const ks = await db.keys(s); await db.delMany(s, ks); } BOOKS = []; contentCache.clear(); coverURL.clear(); S = { ...DEF }; resetTo('library'); toast('Everything deleted', { low: true }); });
};
async function exportBackup() {
  const data = { app: 'shiori', version: 1, exported: new Date().toISOString(), settings: S, days: (await db.get('kv', 'days')) || {}, books: BOOKS.map(b => ({ ...b })), marks: await db.all('marks') };
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }); const name = `shiori-backup-${new Date().toISOString().slice(0, 10)}.json`;
  try { const f = new File([blob], name, { type: 'application/json' }); if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: 'Shiori backup' }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); toast('Backup saved', { low: true });
}
$('#backupIn').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const data = JSON.parse(await f.text()); if (data.app !== 'shiori') throw new Error('not a backup');
    let matched = 0, marks = 0;
    for (const ob of data.books || []) { const b = BOOKS.find(x => x.id === ob.id) || BOOKS.find(x => x.fileName === ob.fileName && x.fileSize === ob.fileSize); if (!b) continue; matched++; Object.assign(b, { status: ob.status, rating: ob.rating, review: ob.review, pos: ob.pos, pct: ob.pct, lastRead: ob.lastRead, readSec: ob.readSec, finished: ob.finished, title: ob.title, author: ob.author }); await saveBook(b); const ms = (data.marks || []).filter(m => m.book === ob.id).map(m => ({ ...m, book: b.id, id: m.id.replace(ob.id, b.id) })); marks += ms.length; if (ms.length) await db.putMany('marks', ms.map(m => [m])); }
    if (data.days) { const d = (await db.get('kv', 'days')) || {}; for (const k in data.days) d[k] = Math.max(d[k] || 0, data.days[k]); await db.put('kv', d, 'days'); }
    toast(matched ? `Restored ${marks} highlights for ${matched} book${matched > 1 ? 's' : ''}` : 'Add the same PDFs first, then restore', { low: true, ms: 3200 });
  } catch (err) { toast('That file isn’t a Shiori backup', { low: true }); }
});

// ---------- start ----------
(async function init() {
  hydrate();
  try { const s = await db.get('kv', 'settings'); if (s) S = { ...DEF, ...s }; } catch (e) { }
  try { await loadBooks(); } catch (e) { console.error(e); toast('Storage is unavailable in this browser mode', { ms: 4000 }); }
  runSplash();
  await splashP;
  ENTER.library({ first: true }); syncTabs(true);
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) navigator.serviceWorker.register('sw.js').catch(() => { });
  window.__shiori = { db, BOOKS: () => BOOKS, S: () => S };
})();
