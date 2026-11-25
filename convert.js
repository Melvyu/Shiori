// Shiori — turns a PDF into an app-native book:
// reflowed paragraphs (split into sentences), headings, chapters, images, and original page markers.
import * as pdfjs from './vendor/pdf.min.mjs';
pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs', import.meta.url).href;
export { pdfjs };
const BASE = new URL('./vendor/', import.meta.url).href;
export const DOC_OPTS = { cMapUrl: BASE + 'cmaps/', cMapPacked: true, standardFontDataUrl: BASE + 'standard_fonts/', isEvalSupported: false };

const LIG = { 'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬃ': 'ffi', 'ﬄ': 'ffl', 'ﬅ': 'st', 'ﬆ': 'st' };
const CJK = /[　-〿぀-ヿ㐀-鿿＀-￯]/;
const clean = s => s.replace(/[ﬀ-ﬆ]/g, c => LIG[c] || c).replace(/­/g, '').replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').replace(/\s+/g, ' ');
const median = a => { if (!a.length) return 0; const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };

export function splitSentences(text, lang) {
  text = text.trim(); if (!text) return [];
  try {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const seg = new Intl.Segmenter(lang || 'en', { granularity: 'sentence' });
      const out = []; for (const s of seg.segment(text)) { const t = s.segment.trim(); if (t) out.push(t); }
      // merge fragments created by abbreviations ("e.g. the", "Dr. Smith") back into the previous sentence
      const ABBR = /(?:\b(?:[A-Za-z]\.){1,4}|\b(?:e\.g|i\.e|etc|vs|cf|al|approx|fig|figs|no|vol|pp?|ch|dr|mr|mrs|ms|prof|st|jr|sr|inc|ltd|co)\.)$/i;
      const m = []; out.forEach(s => { if (m.length && (s.length < 4 || (/^[a-z]/.test(s) && ABBR.test(m[m.length - 1])))) m[m.length - 1] += ' ' + s; else m.push(s); });
      return m.flatMap(longSplit);
    }
  } catch (e) { }
  return (text.match(/[^.!?。！？]+[.!?。！？]+["'”’)\]]*\s*|[^.!?。！？]+$/g)?.map(s => s.trim()).filter(Boolean) || [text]).flatMap(longSplit);
}

// very long "sentences" (lists, legal text) are split at ; or , so highlights and read-aloud stay usable
function longSplit(s) {
  if (s.length <= 420) return [s];
  const out = []; let rest = s;
  while (rest.length > 420) {
    let cut = -1; for (const re of [/;\s/g, /:\s/g, /,\s/g, /\s/g]) { let m, best = -1; re.lastIndex = 0; while ((m = re.exec(rest)) && m.index < 400) best = m.index; if (best > 120) { cut = best + 1; break; } }
    if (cut < 0) cut = 400; out.push(rest.slice(0, cut).trim()); rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest); return out;
}
const FRONT = /^(front ?cover|cover( page)?|half[- ]?title( page)?|title( page)?|copyright( page)?|dedication|epigraph|(table of )?contents|brief contents|contents (at a glance|in brief|in detail)|detailed contents|list of (figures|tables|illustrations|abbreviations)|acknowledge?ments?|thanks|special thanks|praise( for.*)?|advance praise.*|also by.*|other (books|titles) by.*|about (the )?(authors?|editors?|this (book|e-?book)|the cover)|foreword|preface|prelude|prologue|how to (use|read) this book|credits|colophon|imprint|note(s)? (on|to) (the )?(text|translation|reader)|a note (on|to) .*|welcome|map(s)?|frontispiece)$/i;
const isFront = t => FRONT.test(String(t).replace(/^[\s\divxlc]+[.:)\-–—]\s*/i, '').replace(/[.:]+$/, '').trim());
function prettyName(name) {
  return name.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Untitled';
}

async function canvasBlob(canvas, type = 'image/jpeg', q = 0.86) {
  return await new Promise(r => canvas.toBlob(b => r(b), type, q));
}

async function renderPage(page, width) {
  const vp1 = page.getViewport({ scale: 1 });
  const scale = width / vp1.width;
  const vp = page.getViewport({ scale });
  const c = document.createElement('canvas');
  c.width = Math.round(vp.width); c.height = Math.round(vp.height);
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return { canvas: c, scale };
}
export { renderPage };

// Find where raster images are painted on a page (viewport coords at scale 1)
function imageRects(opList, vp) {
  const O = pdfjs.OPS; let ctm = [1, 0, 0, 1, 0, 0]; const st = []; const rects = [];
  const imgOps = new Set([O.paintImageXObject, O.paintInlineImageXObject, O.paintImageMaskXObject, O.paintImageXObjectRepeat, O.paintInlineImageXObjectGroup].filter(x => x !== undefined));
  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i], a = opList.argsArray[i];
    if (fn === O.save) st.push(ctm.slice());
    else if (fn === O.restore) ctm = st.pop() || [1, 0, 0, 1, 0, 0];
    else if (fn === O.transform) ctm = pdfjs.Util.transform(ctm, a);
    else if (fn === O.paintFormXObjectBegin) { st.push(ctm.slice()); if (a && a[0] && a[0].length === 6) ctm = pdfjs.Util.transform(ctm, a[0]); }
    else if (fn === O.paintFormXObjectEnd) ctm = st.pop() || [1, 0, 0, 1, 0, 0];
    else if (imgOps.has(fn)) {
      const m = pdfjs.Util.transform(vp.transform, ctm);
      const pts = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]);
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      let r = { x0: Math.max(0, Math.min(...xs)), y0: Math.max(0, Math.min(...ys)), x1: Math.min(vp.width, Math.max(...xs)), y1: Math.min(vp.height, Math.max(...ys)) };
      if (r.x1 - r.x0 > 40 && r.y1 - r.y0 > 30) rects.push(r);
    }
  }
  // merge overlapping / touching rects (tiled images)
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < rects.length && !merged; i++) for (let j = i + 1; j < rects.length && !merged; j++) {
      const A = rects[i], B = rects[j];
      if (A.x0 <= B.x1 + 3 && B.x0 <= A.x1 + 3 && A.y0 <= B.y1 + 3 && B.y0 <= A.y1 + 3) {
        rects[i] = { x0: Math.min(A.x0, B.x0), y0: Math.min(A.y0, B.y0), x1: Math.max(A.x1, B.x1), y1: Math.max(A.y1, B.y1) };
        rects.splice(j, 1); merged = true;
      }
    }
  }
  return rects;
}

function linesFromText(tc, vp) {
  const lines = []; let cur = null;
  for (const it of tc.items) {
    if (!('str' in it)) continue;
    const tx = pdfjs.Util.transform(vp.transform, it.transform);
    const size = Math.hypot(tx[2], tx[3]) || Math.abs(it.height) || 10;
    const x = tx[4], y = tx[5], w = it.width || 0;
    const vertical = Math.abs(tx[1]) > Math.abs(tx[0]) * 2; // rotated text: skip
    if (vertical) continue;
    const str = it.str;
    if (!str && !it.hasEOL) continue;
    if (cur && Math.abs(y - cur.y) < Math.max(cur.size, size) * 0.55 && x > cur.xEnd - size * 2.5) {
      if (str) {
        const gap = x - cur.xEnd;
        const needSpace = gap > size * 0.18 && !/\s$/.test(cur.text) && !/^\s/.test(str) && !(CJK.test(cur.text.slice(-1)) && CJK.test(str[0]));
        cur.text += (needSpace ? ' ' : '') + str; cur.xEnd = Math.max(cur.xEnd, x + w); cur.size = Math.max(cur.size, size);
        cur.chars += str.length; cur.sizes.push([size, str.length]);
      }
    } else {
      if (cur && cur.text.trim()) lines.push(cur);
      cur = str ? { x, y, xEnd: x + w, size, text: str, chars: str.length, sizes: [[size, str.length]] } : null;
    }
  }
  if (cur && cur.text.trim()) lines.push(cur);
  lines.forEach(l => { l.text = clean(l.text).trim(); const big = l.sizes.sort((a, b) => b[1] - a[1])[0]; l.size = big ? big[0] : l.size; delete l.sizes; });
  return lines.filter(l => l.text);
}

function orderLines(lines, W) {
  const narrowLeft = lines.filter(l => l.xEnd < W * 0.55 && (l.xEnd - l.x) > W * 0.18).length;
  const narrowRight = lines.filter(l => l.x > W * 0.45 && (l.xEnd - l.x) < W * 0.55).length;
  const twoCol = lines.length > 12 && narrowLeft > lines.length * 0.25 && narrowRight > lines.length * 0.25;
  if (twoCol) {
    const col = l => (l.x > W * 0.45 && (l.xEnd - l.x) < W * 0.55) ? 1 : 0;
    lines.forEach(l => l.col = col(l));
    return lines.sort((a, b) => a.col - b.col || a.y - b.y);
  }
  // single column: keep content-stream order unless it is clearly scrambled
  let back = 0; for (let i = 1; i < lines.length; i++) if (lines[i].y < lines[i - 1].y - lines[i].size) back++;
  lines.forEach(l => l.col = 0);
  return back > lines.length * 0.15 ? lines.sort((a, b) => a.y - b.y || a.x - b.x) : lines;
}

const normKey = t => t.toLowerCase().replace(/\d+/g, '#').replace(/[^a-z#぀-鿿]+/g, '').slice(0, 60);
const isPageNum = t => /^(page\s*)?[\divxlc]{1,6}$/i.test(t.trim()) || /^[-–—\s]*\d{1,4}[-–—\s]*$/.test(t);

export async function convertPdf(file, onStep = () => { }) {
  const buf = await file.arrayBuffer();
  const pdfBlob = new Blob([buf], { type: 'application/pdf' });
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf.slice(0)), ...DOC_OPTS }).promise;
  const N = pdf.numPages;
  let meta = {}; try { meta = (await pdf.getMetadata()).info || {}; } catch (e) { }
  let labels = null; try { labels = await pdf.getPageLabels(); } catch (e) { }
  const label = p => (labels && labels[p - 1] && labels[p - 1].trim()) || String(p);

  // cover from the first page
  onStep(0, 0, { pages: N });
  const p1 = await pdf.getPage(1);
  const cov = await renderPage(p1, 600);
  const coverBlob = await canvasBlob(cov.canvas, 'image/jpeg', 0.88);
  const coverRatio = cov.canvas.height / cov.canvas.width;

  // pass 1: text lines + image positions per page
  const pages = [];
  let allChars = 0, cjkChars = 0;
  for (let p = 1; p <= N; p++) {
    const page = p === 1 ? p1 : await pdf.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    let lines = [];
    try { lines = linesFromText(await page.getTextContent(), vp); } catch (e) { }
    let rects = [];
    try { rects = imageRects(await page.getOperatorList(), vp); } catch (e) { }
    const chars = lines.reduce((n, l) => n + l.text.length, 0);
    allChars += chars; for (const l of lines) for (const ch of l.text) if (CJK.test(ch)) cjkChars++;
    pages.push({ p, W: vp.width, H: vp.height, lines: orderLines(lines, vp.width), rects, chars });
    page.cleanup && page.cleanup();
    if (p % 3 === 0 || p === N) onStep(0, p / N, { pages: N });
    if (p % 10 === 0) await new Promise(r => setTimeout(r));
  }
  const lang = cjkChars > allChars * 0.3 ? 'ja' : 'en';
  const scanned = allChars < N * 30;

  // pass 2: remove running headers / footers / page numbers
  onStep(1, 0);
  const counts = new Map();
  for (const pg of pages) {
    const zone = pg.lines.filter(l => l.y < pg.H * 0.1 || l.y > pg.H * 0.9);
    new Set(zone.map(l => normKey(l.text))).forEach(k => { if (k) counts.set(k, (counts.get(k) || 0) + 1); });
  }
  const repeatMin = Math.max(3, Math.ceil(N * 0.25));
  for (const pg of pages) {
    pg.lines = pg.lines.filter(l => {
      const edge = l.y < pg.H * 0.1 || l.y > pg.H * 0.9;
      if (!edge) return true;
      if (isPageNum(l.text)) return false;
      if (N >= 4 && (counts.get(normKey(l.text)) || 0) >= repeatMin) return false;
      return true;
    });
  }

  // body text size and normal line spacing
  const sizeW = new Map();
  pages.forEach(pg => pg.lines.forEach(l => { const k = Math.round(l.size * 2) / 2; sizeW.set(k, (sizeW.get(k) || 0) + l.text.length); }));
  let body = 10, best = 0; sizeW.forEach((w, k) => { if (w > best) { best = w; body = k; } });
  const gaps = [];
  pages.forEach(pg => { for (let i = 1; i < pg.lines.length; i++) { const a = pg.lines[i - 1], b = pg.lines[i]; if (Math.abs(a.size - body) < 0.6 && Math.abs(b.size - body) < 0.6 && a.col === b.col) { const g = b.y - a.y; if (g > 0 && g < body * 3) gaps.push(g); } } });
  const lineGap = median(gaps) || body * 1.3;

  // the PDF's own outline (bookmarks), two levels deep
  const pageOf = async dest => {
    try {
      if (typeof dest === 'string') dest = await pdf.getDestination(dest);
      if (!dest) return null; const ref = dest[0];
      return typeof ref === 'number' ? ref + 1 : (await pdf.getPageIndex(ref)) + 1;
    } catch (e) { return null; }
  };
  let outline = [];
  try {
    const ol = await pdf.getOutline();
    const walk = async (items, lv) => { for (const o of items || []) { const n = o.dest ? await pageOf(o.dest) : null; const title = clean(o.title || '').trim(); if (n && title) outline.push({ title, n, lv }); if (lv < 3 && o.items && o.items.length) await walk(o.items, lv + 1); } };
    if (ol && ol.length) await walk(ol, 1);
    // a single top item (usually the book title) wrapping everything: shift levels up
    while (outline.filter(o => o.lv === 1).length < 3 && outline.some(o => o.lv === 2)) outline = outline.filter(o => o.lv > 1).map(o => ({ ...o, lv: o.lv - 1 }));
    outline = outline.filter(o => o.lv <= 2).sort((a, b) => a.n - b.n || a.lv - b.lv);
  } catch (e) { outline = []; }

  // skip the front matter: cover, title pages, copyright, dedication, thanks, contents, foreword…
  const pageText = pg => pg.lines.map(l => l.text).join(' ');
  const isCopyright = t => /all rights reserved|\bisbn\b|library of congress|cataloging[- ]in[- ]publication|copyright\s*(©|\(c\)|\d{4})|©\s*\d{4}|first (published|edition)|printed in (the )?[a-z]/i.test(t);
  const tocLike = pg => { const ends = pg.lines.filter(l => /(\.{2,}|\s)\s*[\divxlc]{1,4}$/i.test(l.text) && l.text.length > 4).length; return ends >= 5 && ends >= pg.lines.length * 0.4; };
  const headOf = pg => pg.lines.find(l => l.size >= body * 1.18 && l.text.length < 120);
  const coverLike = pg => pg.chars < 400 || pg.rects.some(r => (r.x1 - r.x0) * (r.y1 - r.y0) > pg.W * pg.H * 0.45);
  let startPage = 1;
  const chapters1 = outline.filter(o => o.lv === 1);
  if (!scanned) {
    if (chapters1.length >= 2) { const first = chapters1.find(o => !isFront(o.title)); if (first) startPage = first.n; }
    else {
      let skipping = false;
      for (const pg of pages) {
        if (pg.p > Math.max(14, N * 0.4)) break;
        const t = pageText(pg); const head = headOf(pg);
        if (pg.chars < 250 || isCopyright(t) || tocLike(pg)) { if (pg.chars >= 250) skipping = false; continue; }
        if (head && (isFront(head.text) || /^contents$/i.test(head.text.trim()))) { skipping = true; continue; }
        if (!head && skipping) continue;
        startPage = pg.p; break;
      }
    }
    if (startPage > Math.max(14, N * 0.45)) startPage = (pages.find(pg => pg.chars >= 250 && !isCopyright(pageText(pg))) || { p: 1 }).p;
    if (startPage === 1 && N > 2 && coverLike(pages[0])) startPage = 2;
  }

  // pass 3: images (crop from a rendered page) — scanned pages become whole-page images
  onStep(2, 0);
  const images = []; let imgN = 0;
  const imgPages = pages.filter(pg => pg.p >= startPage && (scanned ? true : pg.rects.some(r => (r.x1 - r.x0) * (r.y1 - r.y0) > 2500 && !((r.x1 - r.x0) > pg.W * 0.95 && (r.y1 - r.y0) > pg.H * 0.95 && pg.chars > 200))));
  for (let k = 0; k < imgPages.length; k++) {
    const pg = imgPages[k];
    try {
      const page = await pdf.getPage(pg.p);
      if (scanned || (pg.chars < 30 && pg.rects.some(r => (r.x1 - r.x0) * (r.y1 - r.y0) > pg.W * pg.H * 0.5))) {
        const { canvas } = await renderPage(page, 1100);
        const blob = await canvasBlob(canvas, 'image/jpeg', 0.82);
        const key = 'i' + (imgN++); images.push({ key, blob });
        pg.items = [{ t: 'scan', k: key, w: canvas.width, h: canvas.height, y: 0 }];
        pg.lines = [];
      } else {
        const { canvas, scale } = await renderPage(page, Math.min(1400, pg.W * 2));
        pg.items = [];
        for (const r of pg.rects) {
          if ((r.x1 - r.x0) > pg.W * 0.95 && (r.y1 - r.y0) > pg.H * 0.95) continue; // page background
          const sx = Math.round(r.x0 * scale), sy = Math.round(r.y0 * scale), sw = Math.round((r.x1 - r.x0) * scale), sh = Math.round((r.y1 - r.y0) * scale);
          if (sw < 60 || sh < 40) continue;
          const c = document.createElement('canvas'); c.width = sw; c.height = sh;
          c.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
          const blob = await canvasBlob(c, 'image/jpeg', 0.86);
          const key = 'i' + (imgN++); images.push({ key, blob });
          pg.items.push({ t: 'img', k: key, w: sw, h: sh, y: r.y0, y1: r.y1 });
          // drop text lines that sit inside the image (labels baked into figures)
          pg.lines = pg.lines.filter(l => !(l.y > r.y0 + 2 && l.y < r.y1 - 2 && l.x > r.x0 - 2 && l.xEnd < r.x1 + 2));
        }
      }
      page.cleanup && page.cleanup();
    } catch (e) { console.warn('image page failed', pg.p, e); }
    onStep(2, (k + 1) / imgPages.length);
    await new Promise(r => setTimeout(r));
  }
  if (!imgPages.length) onStep(2, 1);

  // pass 4: build blocks
  onStep(3, 0);
  const blocks = [];
  const ends = /[.!?:;。！？」』"”’)\]]$/;
  let para = null; // open paragraph
  const flush = () => { if (para) { para.x = para.x.trim(); if (para.x) blocks.push(para); para = null; } };
  const joinText = (a, b) => {
    if (/[A-Za-z]-$/.test(a) && /^[a-z]/.test(b)) return a.slice(0, -1) + b;
    if (CJK.test(a.slice(-1)) && CJK.test(b[0])) return a + b;
    return a + ' ' + b;
  };
  for (const pg of pages) {
    if (pg.p < startPage) continue;
    const lab = label(pg.p);
    const items = [...pg.lines.map(l => ({ ...l, t: 'line' })), ...(pg.items || [])];
    if (pg.items && pg.items.length && pg.lines.length) items.sort((a, b) => (a.col || 0) - (b.col || 0) || a.y - b.y);
    // marker for the new page goes before the first block that starts on it
    let markerPending = true;
    const marker = () => { if (markerPending) { blocks.push({ t: 'pg', p: lab, n: pg.p }); markerPending = false; } };
    const lefts = pg.lines.filter(l => Math.abs(l.size - body) < 0.6).map(l => l.x);
    const left0 = lefts.length ? Math.min(...lefts) : 0;
    const rights = pg.lines.filter(l => Math.abs(l.size - body) < 0.6).map(l => l.xEnd);
    const right0 = rights.length ? median(rights) : pg.W;
    let prev = null;
    for (const it of items) {
      if (it.t !== 'line') { flush(); marker(); blocks.push({ t: it.t, k: it.k, w: it.w, h: it.h, p: lab }); prev = null; continue; }
      const heading = it.size >= body * 1.18 && it.text.length < 140;
      const small = it.size < body * 0.86;
      const kind = heading ? 'h' : small ? 's' : 'p';
      let newBlock = !para || para.kind !== kind;
      if (!newBlock && prev) {
        const gap = it.y - prev.y;
        if (prev.col !== it.col) newBlock = false;
        else if (kind === 'h' ? (gap > it.size * 1.8 || gap < 0) : (gap > lineGap * 1.45 || gap < -lineGap * 0.5)) newBlock = true;
        else if (kind !== 'h' && it.x - left0 > body * 0.9 && it.x - prev.x > body * 0.7) newBlock = true; // indented first line
        else if (kind !== 'h' && ends.test(prev.text) && prev.xEnd < right0 - body * 3) newBlock = true; // short last line
        if (kind === 'h' && Math.abs(it.size - para.size) > 0.6) newBlock = true;
      }
      if (!prev && para && !markerPending) newBlock = true;
      if (!prev && para && kind === 'p' && para.kind === 'p') {
        // first line on a new page: continue the paragraph if the previous one did not end
        const cont = !ends.test(para.x.trim()) && !(it.x - left0 > body * 0.9);
        newBlock = !cont;
        if (cont) { para.x = joinText(para.x, it.text); prev = it; markerPending && (para.cont = lab); continue; }
      }
      if (newBlock) { flush(); marker(); para = { t: kind === 'h' ? 'h' : 'p', kind, x: it.text, p: lab, size: it.size, sm: small ? 1 : undefined }; }
      else para.x = joinText(para.x, it.text);
      prev = it;
    }
    if (markerPending && pg.p > 1 && !pg.lines.length && !(pg.items || []).length) { /* empty page: skip marker */ }
    else if (markerPending) { flush(); marker(); }
    if (pg.p % 20 === 0) { onStep(3, pg.p / N); await new Promise(r => setTimeout(r)); }
  }
  flush();

  // heading levels; drop absurd headings (very long) back to paragraphs
  const hs = blocks.filter(b => b.t === 'h').map(b => b.size);
  const big = hs.length ? Math.max(...hs) : 0;
  blocks.forEach(b => {
    if (b.t === 'h') {
      if (b.x.length > 140) { b.t = 'p'; }
      else b.lv = (b.size >= body * 1.55 || (big && b.size >= big - 0.5 && b.size >= body * 1.3)) ? 1 : 2;
    }
    delete b.kind;
  });

  // sentences
  blocks.forEach(b => { if (b.t === 'p') b.s = splitSentences(b.x, lang); delete b.size; });

  // chapters + contents: from the PDF's outline if it has one, otherwise from headings
  let toc = [], contents = [];
  const entries = outline.filter(o => o.n >= startPage && !isFront(o.title));
  if (entries.filter(o => o.lv === 1).length >= 1 && entries.length >= 2) {
    entries.forEach((t, ti) => {
      let i = blocks.findIndex(b => b.t === 'pg' && b.n >= t.n); if (i < 0) i = blocks.length - 1;
      const want = normKey(t.title); let found = -1;
      for (let j = i; j < Math.min(blocks.length, i + 8); j++) { const bj = blocks[j]; if (want && bj.t !== 'pg' && bj.x && !bj.toc && (normKey(bj.x).startsWith(want.slice(0, 20)) || want.startsWith(normKey(bj.x).slice(0, 20)) && normKey(bj.x).length > 3)) { found = j; break; } }
      if (found >= 0) { const b = blocks[found]; if (b.t !== 'h') { b.t = 'h'; delete b.s; } b.lv = t.lv; b.toc = ti + 1; }
      else t.ins = i + 1;
      t.id = ti + 1;
    });
    [...entries].filter(t => t.ins !== undefined).sort((a, b) => b.ins - a.ins || b.id - a.id).forEach(t => { blocks.splice(t.ins, 0, { t: 'h', lv: t.lv, x: t.title, p: label(t.n), toc: t.id }); });
    entries.forEach(t => { t.b = blocks.findIndex(b => b.toc === t.id); });
    contents = entries.filter(t => t.b >= 0).map(t => ({ title: t.title, b: t.b, lv: t.lv }));
    toc = contents.filter(t => t.lv === 1);
  }
  if (!toc.length) {
    let lv1 = blocks.map((b, i) => [b, i]).filter(([b]) => b.t === 'h' && b.lv === 1);
    if (lv1.length < 2) lv1 = blocks.map((b, i) => [b, i]).filter(([b]) => b.t === 'h');
    if (lv1.length >= 2 && lv1.length < 200) {
      toc = lv1.map(([b, i]) => ({ title: b.x, b: i, lv: 1 }));
      const lv2 = blocks.map((b, i) => [b, i]).filter(([b]) => b.t === 'h' && b.lv === 2);
      contents = (lv1.length && lv2.length && lv2.length < 300 && lv1[0][0].lv === 1) ? [...toc, ...lv2.map(([b, i]) => ({ title: b.x, b: i, lv: 2 }))].sort((a, b) => a.b - b.b) : toc.slice();
    }
  }
  if (!toc.length) {
    // no structure at all: sections every ~20 pages
    const marks = blocks.map((b, i) => [b, i]).filter(([b]) => b.t === 'pg');
    for (let k = 0; k < marks.length; k += 20) { const [b, i] = marks[k]; const last = marks[Math.min(marks.length - 1, k + 19)][0]; toc.push({ title: `Pages ${b.p}–${last.p}`, b: i, lv: 1 }); }
    contents = toc.slice();
  }
  const pAt = i => (blocks.slice(0, i + 1).reverse().find(x => x.t === 'pg') || { p: '1' }).p;
  toc.forEach(t => { t.p = pAt(t.b); }); contents.forEach(t => { t.p = pAt(t.b); });
  blocks.forEach(b => { if (b.t !== 'pg') delete b.n; delete b.toc; });

  // title / author
  let title = (meta.Title || '').trim();
  if (!title || /^(untitled|microsoft word|document|\d+)$/i.test(title) || /\.(docx?|indd|pdf|qxd)$/i.test(title) || title.length > 120) title = prettyName(file.name);
  let author = (meta.Author || '').trim(); if (author.length > 80 || /^(anonymous|unknown|user|admin|owner|author)$/i.test(author)) author = '';
  onStep(3, 1);
  try { await pdf.destroy(); } catch (e) { }
  return { title, author, pageCount: N, lang, scanned, coverBlob, coverRatio, pdfBlob, blocks, toc, contents, startPage, images, words: blocks.reduce((n, b) => n + (b.x ? b.x.split(/\s+/).length : 0), 0) };
}
