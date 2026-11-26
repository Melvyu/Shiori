// Shiori ↔ Dropbox sync. Books live in Dropbox › Apps › <your app> as:
//   /books/<id>/book.json · content.json · cover.jpg · book.pdf · img/<key>.jpg · marks.json
//   /deleted.json (deleted books) · /days.json (reading activity)
// Auth: OAuth 2 PKCE with a pasted code (works inside the iPhone home-screen app, no redirect needed).
import { db } from './db.js';

export const DEFAULT_KEY = 'y7i3b6ka2nz5lz9'; // set once the Dropbox app exists (also editable in Settings)
const EP = (globalThis.__SHIORI_DBX || {});
const AUTH = EP.auth || 'https://www.dropbox.com/oauth2/authorize';
const TOKEN = EP.token || 'https://api.dropboxapi.com/oauth2/token';
const API = EP.api || 'https://api.dropboxapi.com/2/';
const CONTENT = EP.content || 'https://content.dropboxapi.com/2/';

let st = null;
async function load() { if (!st) st = (await db.get('kv', 'sync')) || {}; if (!st.key && DEFAULT_KEY) st.key = DEFAULT_KEY; return st; }
async function persist() { await db.put('kv', st, 'sync'); }
export async function status() { await load(); return { key: st.key || '', connected: !!st.refresh, email: st.email || '', last: st.last || 0, error: st.error || '', pending: !st.refresh && !!st.verifier }; }
export async function setKey(k) { await load(); st.key = k.trim(); await persist(); }
export async function disconnect() { await load(); Object.assign(st, { refresh: null, access: null, exp: 0, email: '', last: 0, error: '' }); await persist(); await db.put('kv', {}, 'revs'); await db.put('kv', {}, 'synced'); }

const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export async function startAuth() {
  await load(); if (!st.key) throw new Error('no key');
  // reuse a pending sign-in, so a code from any earlier tap of Connect still works
  const v = st.verifier || b64u(crypto.getRandomValues(new Uint8Array(32)));
  const ch = b64u(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)));
  st.verifier = v; st.error = ''; await persist();
  return `${AUTH}?client_id=${encodeURIComponent(st.key)}&response_type=code&code_challenge=${ch}&code_challenge_method=S256&token_access_type=offline`;
}
export async function finishAuth(code) {
  await load();
  const clean = String(code).replace(/\s+/g, '');
  let r; try { r = await fetch(TOKEN, { method: 'POST', body: new URLSearchParams({ grant_type: 'authorization_code', code: clean, code_verifier: st.verifier || '', client_id: st.key }) }); } catch (e) { throw new Error('Couldn’t reach Dropbox — check your connection and try again'); }
  if (!r.ok) {
    let d = ''; try { const j = await r.json(); d = `${j.error || ''} ${j.error_description || ''}`; } catch (e) { }
    if (/verifier/i.test(d)) { delete st.verifier; await persist(); throw new Error('That code came from an older try — tap Start over and use the new code'); }
    if (/expired|doesn.t exist|invalid_grant/i.test(d)) throw new Error('That code was already used or has expired — tap Connect Dropbox again for a new one');
    if (/client|app/i.test(d)) throw new Error('Dropbox didn’t recognise the app — check the app key');
    throw new Error('Dropbox didn’t accept that code — tap Connect Dropbox again');
  }
  const j = await r.json();
  st.refresh = j.refresh_token; st.access = j.access_token; st.exp = Date.now() + ((j.expires_in || 14400) - 120) * 1000; delete st.verifier; st.error = '';
  try { const a = await api('users/get_current_account', null); st.email = a.email || ''; } catch (e) { }
  await persist();
}
async function token() {
  await load(); if (!st.refresh) throw new Error('not connected');
  if (st.access && Date.now() < st.exp) return st.access;
  const r = await fetch(TOKEN, { method: 'POST', body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: st.refresh, client_id: st.key }) });
  if (!r.ok) { if (r.status === 400 || r.status === 401) { st.refresh = null; st.error = 'Dropbox signed out — connect again'; await persist(); } throw new Error('auth'); }
  const j = await r.json(); st.access = j.access_token; st.exp = Date.now() + ((j.expires_in || 14400) - 120) * 1000; await persist(); return st.access;
}
async function api(path, body) {
  const t = await token();
  const r = await fetch(API + path, { method: 'POST', headers: body === null ? { Authorization: 'Bearer ' + t } : { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: body === null ? undefined : JSON.stringify(body) });
  if (r.status === 401) { st.access = null; throw new Error('auth'); }
  if (r.status === 409) { const e = await r.json().catch(() => ({})); const err = new Error('conflict'); err.summary = e.error_summary || ''; throw err; }
  if (!r.ok) throw new Error(path + ' ' + r.status);
  return r.json();
}
const arg = o => JSON.stringify(o).replace(/[\u007f-￿]/g, c => '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4));
async function up(path, data) {
  const t = await token();
  const r = await fetch(CONTENT + 'files/upload', { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Dropbox-API-Arg': arg({ path, mode: 'overwrite', mute: true }), 'Content-Type': 'application/octet-stream' }, body: data });
  if (!r.ok) throw new Error('upload ' + r.status);
  return r.json();
}
async function down(path) {
  const t = await token();
  const r = await fetch(CONTENT + 'files/download', { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Dropbox-API-Arg': arg({ path }) } });
  if (r.status === 409) return null;
  if (!r.ok) throw new Error('download ' + r.status);
  return r.blob();
}
const downJSON = async p => { const b = await down(p); if (!b) return null; try { return JSON.parse(await b.text()); } catch (e) { return null; } };
const upJSON = (p, o) => up(p, new Blob([JSON.stringify(o)], { type: 'application/json' }));
async function listAll() {
  let r; try { r = await api('files/list_folder', { path: '', recursive: true, limit: 2000 }); } catch (e) { if (e.summary && e.summary.startsWith('path/not_found')) return []; throw e; }
  const out = [...r.entries]; while (r.has_more) { r = await api('files/list_folder/continue', { cursor: r.cursor }); out.push(...r.entries); }
  return out;
}

// Original PDF: kept locally if the book was added on this device, otherwise downloaded when first needed
export async function getPdf(id) {
  let b = await db.get('files', 'pdf:' + id); if (b) return b;
  await load(); if (!st.refresh) return null;
  b = await down(`/books/${id}/book.pdf`); if (b) await db.put('files', b, 'pdf:' + id); return b;
}

// ---- tombstones for things deleted on this device ----
export async function markDeleted(id) { const t = (await db.get('kv', 'tombs')) || {}; t[id] = Date.now(); await db.put('kv', t, 'tombs'); }
export async function bookDeleted(id) { const t = (await db.get('kv', 'delBooks')) || {}; t[id] = Date.now(); await db.put('kv', t, 'delBooks'); }

let running = null, again = false;
export function isConnected() { return !!(st && st.refresh); }
export async function sync(ctx) {
  await load(); if (!st.refresh) return null;
  if (running) { again = true; return running; }
  running = (async () => {
    const out = { added: 0, updated: 0, removed: 0, uploaded: 0 };
    try {
      const entries = await listAll();
      const files = new Map(entries.filter(e => e['.tag'] === 'file').map(e => [e.path_lower, e]));
      const revs = (await db.get('kv', 'revs')) || {}; const synced = (await db.get('kv', 'synced')) || {};
      const rev = p => (files.get(p.toLowerCase()) || {}).rev;
      const seen = p => { const r = rev(p); if (r) revs[p.toLowerCase()] = r; };
      const changedRemote = p => { const r = rev(p); return r && revs[p.toLowerCase()] !== r; };
      const putRev = (p, res) => { if (res && res.rev) revs[p.toLowerCase()] = res.rev; };

      // deleted books, both directions
      const localDel = (await db.get('kv', 'delBooks')) || {};
      const remoteDel = files.has('/deleted.json') ? (await downJSON('/deleted.json')) || {} : {};
      const allDel = { ...remoteDel }; for (const k in localDel) allDel[k] = Math.max(allDel[k] || 0, localDel[k]);
      for (const id in allDel) { const b = ctx.book(id); if (b && (b.updated || b.added || 0) < allDel[id]) { await ctx.removeLocal(id); out.removed++; } }
      for (const id in localDel) if ([...files.keys()].some(p => p.startsWith(`/books/${id.toLowerCase()}/`))) { try { await api('files/delete_v2', { path: `/books/${id}` }); } catch (e) { } }
      if (Object.keys(allDel).length && JSON.stringify(allDel) !== JSON.stringify(remoteDel)) putRev('/deleted.json', await upJSON('/deleted.json', allDel));
      await db.put('kv', allDel, 'delBooks');

      // books on this device
      const remoteIds = new Set([...files.keys()].map(p => (p.match(/^\/books\/([^/]+)\/book\.json$/) || [])[1]).filter(Boolean));
      const local = ctx.books().filter(b => !allDel[b.id]);
      const localIds = new Set(local.map(b => b.id.toLowerCase()));
      for (const b of local) {
        const base = `/books/${b.id}`;
        if (!remoteIds.has(b.id.toLowerCase())) {
          // new here → upload everything
          ctx.progress && ctx.progress(`Uploading “${b.title}”`);
          const cover = await db.get('files', 'cover:' + b.id); if (cover) putRev(base + '/cover.jpg', await up(base + '/cover.jpg', cover));
          const content = await db.get('content', b.id); if (content) putRev(base + '/content.json', await upJSON(base + '/content.json', content));
          for (const k of b.imgKeys || []) { const im = await db.get('files', `img:${b.id}:${k}`); if (im) putRev(`${base}/img/${k}.jpg`, await up(`${base}/img/${k}.jpg`, im)); }
          const pdf = await db.get('files', 'pdf:' + b.id); if (pdf) putRev(base + '/book.pdf', await up(base + '/book.pdf', pdf));
          putRev(base + '/book.json', await upJSON(base + '/book.json', b)); synced[b.id] = b.updated || 0;
          const cs = (await db.get('kv', 'contentSynced')) || {}; cs[b.id] = b.contentVer || 0; await db.put('kv', cs, 'contentSynced');
          out.uploaded++;
        } else {
          // both have it → newest details win
          const p = base + '/book.json';
          if (changedRemote(p)) {
            const rb = await downJSON(p); seen(p);
            if (rb && (rb.updated || 0) > (b.updated || 0)) {
              if ((rb.contentVer || 0) > (b.contentVer || 0)) {
                // the other device rebuilt this book: take its new text and images
                const content = await downJSON(base + '/content.json');
                if (content) { const ims = []; for (const k of rb.imgKeys || []) { const im = await down(`${base}/img/${k}.jpg`); if (im) ims.push([im, `img:${b.id}:${k}`]); } if (ims.length) await db.putMany('files', ims); await db.put('content', content, b.id); const cs = (await db.get('kv', 'contentSynced')) || {}; cs[b.id] = rb.contentVer; await db.put('kv', cs, 'contentSynced'); }
                else rb.contentVer = b.contentVer;
              }
              await ctx.applyMeta(rb); out.updated++; synced[b.id] = rb.updated || 0;
            }
            else if ((b.updated || 0) > (rb && rb.updated || 0)) { putRev(p, await upJSON(p, b)); synced[b.id] = b.updated || 0; }
          } else if ((b.updated || 0) > (synced[b.id] || 0)) { putRev(p, await upJSON(p, b)); synced[b.id] = b.updated || 0; }
          // a book rebuilt with a newer converter on this device: send the new text and images
          const cs = (await db.get('kv', 'contentSynced')) || {};
          if ((b.contentVer || 0) > (cs[b.id] || 0)) {
            const content = await db.get('content', b.id); if (content) putRev(base + '/content.json', await upJSON(base + '/content.json', content));
            for (const k of b.imgKeys || []) { const im = await db.get('files', `img:${b.id}:${k}`); if (im) putRev(`${base}/img/${k}.jpg`, await up(`${base}/img/${k}.jpg`, im)); }
            cs[b.id] = b.contentVer; await db.put('kv', cs, 'contentSynced');
          }
        }
        await syncMarks(b.id, files, revs, rev, ctx, out);
      }
      // books only in Dropbox → download (the PDF itself is fetched later, only if needed)
      for (const id of remoteIds) {
        if (localIds.has(id) || allDel[id] || Object.keys(allDel).some(k => k.toLowerCase() === id)) continue;
        const prefix = `/books/${id}/`; const realPath = (entries.find(e => e.path_lower === prefix + 'book.json') || {}).path_display || prefix + 'book.json';
        const realBase = realPath.replace(/\/book\.json$/i, '');
        const meta = await downJSON(realBase + '/book.json'); if (!meta) continue;
        ctx.progress && ctx.progress(`Downloading “${meta.title}”`);
        const content = await downJSON(realBase + '/content.json'); if (!content) continue;
        const cover = await down(realBase + '/cover.jpg');
        const imgs = [];
        for (const k of meta.imgKeys || []) { const im = await down(`${realBase}/img/${k}.jpg`); if (im) imgs.push([im, `img:${meta.id}:${k}`]); }
        if (cover) imgs.push([cover, 'cover:' + meta.id]);
        if (imgs.length) await db.putMany('files', imgs);
        await db.put('content', content, meta.id);
        await ctx.addLocal(meta);
        seen(realBase + '/book.json'); synced[meta.id] = meta.updated || 0;
        await syncMarks(meta.id, files, revs, rev, ctx, out);
        out.added++;
      }
      // reading activity
      const days = (await db.get('kv', 'days')) || {};
      const rd = files.has('/days.json') && changedRemote('/days.json') ? (await downJSON('/days.json')) || {} : null;
      if (rd) { seen('/days.json'); for (const k in rd) days[k] = Math.max(days[k] || 0, rd[k]); await db.put('kv', days, 'days'); }
      const dsig = JSON.stringify(days);
      if (dsig !== st.daysSig) { putRev('/days.json', await upJSON('/days.json', days)); st.daysSig = dsig; }

      await db.put('kv', revs, 'revs'); await db.put('kv', synced, 'synced');
      st.last = Date.now(); st.error = ''; await persist();
    } catch (e) {
      console.warn('sync failed', e); st.error = e.message === 'auth' ? (st.error || 'Dropbox needs you to connect again') : (navigator.onLine === false ? 'Offline — will sync when you’re back online' : 'Couldn’t reach Dropbox'); await persist(); out.error = st.error;
    }
    return out;
  })();
  const res = await running; running = null;
  if (again) { again = false; setTimeout(() => sync(ctx), 50); }
  return res;
}

async function syncMarks(id, files, revs, rev, ctx, out) {
  const p = `/books/${id}/marks.json`;
  const local = await db.byBook(id);
  const tombs = (await db.get('kv', 'tombs')) || {};
  const localMod = Math.max(0, ...local.map(m => m.mod || m.at || 0), ...Object.entries(tombs).filter(([k]) => k.startsWith(id + ':')).map(([, v]) => v));
  const synced = (await db.get('kv', 'marksSynced')) || {};
  const remoteChanged = rev(p) && revs[p.toLowerCase()] !== rev(p);
  if (!remoteChanged && localMod <= (synced[id] || 0) && rev(p)) return;
  const remote = rev(p) ? (await downJSON(p)) || [] : [];
  const map = new Map();
  for (const m of remote) map.set(m.id, m);
  for (const m of local) { const r = map.get(m.id); if (!r || (m.mod || m.at || 0) >= (r.mod || r.at || 0)) map.set(m.id, m); }
  for (const [k, v] of Object.entries(tombs)) { if (!k.startsWith(id + ':')) continue; const r = map.get(k); if (!r || v >= (r.mod || r.at || 0)) map.set(k, { id: k, book: id, del: true, mod: v }); }
  const merged = [...map.values()];
  // apply to this device
  const localIds = new Map(local.map(m => [m.id, m]));
  const toPut = merged.filter(m => !m.del && JSON.stringify(localIds.get(m.id)) !== JSON.stringify(m));
  const toDel = merged.filter(m => m.del && localIds.has(m.id)).map(m => m.id);
  if (toPut.length) await db.putMany('marks', toPut.map(m => [m]));
  if (toDel.length) await db.delMany('marks', toDel);
  if (toPut.length || toDel.length) { out.updated++; ctx.marksChanged && ctx.marksChanged(id); }
  if (JSON.stringify(merged) !== JSON.stringify(remote)) { const res = await upJSON(p, merged); if (res && res.rev) revs[p.toLowerCase()] = res.rev; }
  else if (rev(p)) revs[p.toLowerCase()] = rev(p);
  synced[id] = Math.max(localMod, ...merged.map(m => m.mod || m.at || 0)); await db.put('kv', synced, 'marksSynced');
}
