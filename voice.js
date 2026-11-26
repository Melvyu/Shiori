// Shiori — natural read-aloud voices (Google Cloud Text-to-Speech, Chirp 3 HD).
// iPhone hides downloaded Premium voices from web apps, so this gives Shiori a natural voice everywhere.
// Uses the reader's own Google Cloud API key, stored only on this device.
import { db } from './db.js';

const EP = globalThis.__SHIORI_TTS || 'https://texttospeech.googleapis.com/v1';
export const FREE = 1000000; // free characters per month for Chirp 3 HD voices
// friendly names → Chirp 3 HD voices (Figma 12.1)
export const NV = [
  { id: 'Sulafat', name: 'Warm', d: 'Calm, close — good for long chapters' },
  { id: 'Despina', name: 'Smooth', d: 'Soft and even — good for fiction' },
  { id: 'Vindemiatrix', name: 'Gentle', d: 'Quiet and slow — good for bedtime reading' },
  { id: 'Iapetus', name: 'Clear', d: 'Crisp — good for dense nonfiction' },
  { id: 'Schedar', name: 'Steady', d: 'Grounded and even — good for history' },
  { id: 'Achird', name: 'Friendly', d: 'Relaxed, like a podcast host' }
];
export const voiceById = id => NV.find(v => v.id === id) || NV[0];

const err = (code, message) => Object.assign(new Error(message), { code });
const month = () => new Date().toISOString().slice(0, 7);
export async function getTTS() { return (await db.get('kv', 'tts')) || {}; }
export async function setTTS(o) { const a = await getTTS(); await db.put('kv', { ...a, ...o }, 'tts'); }
export async function hasKey() { return !!(await getTTS()).key; }
export async function usage() { const a = await getTTS(); return a.month === month() ? (a.chars || 0) : 0; }
export async function paidOk() { const a = await getTTS(); return a.paidMonth === month(); }
export async function allowPaid() { await setTTS({ paidMonth: month() }); }
async function addUsage(n) { const a = await getTTS(); const m = month(); const chars = (a.month === m ? a.chars || 0 : 0) + n; await setTTS({ month: m, chars }); return chars; }

export async function synthesize(text, lang, voiceId) {
  const a = await getTTS();
  if (!a.key) throw err('nokey', 'Add your Google key in Settings → Natural voices');
  const loc = lang === 'ja' ? 'ja-JP' : 'en-US';
  let r;
  try {
    r = await fetch(`${EP}/text:synthesize?key=${encodeURIComponent(a.key)}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ input: { text }, voice: { languageCode: loc, name: `${loc}-Chirp3-HD-${voiceId}` }, audioConfig: { audioEncoding: 'MP3' } })
    });
  } catch (e) { throw err('offline', 'You’re offline — using your phone’s voice'); }
  if (!r.ok) {
    let m = ''; try { m = ((await r.json()).error || {}).message || ''; } catch (e) { }
    if (r.status === 429) throw err('busy', 'Google is busy — using your phone’s voice for now');
    if (/billing/i.test(m)) throw err('billing', 'Turn on billing for your Google Cloud project (the free million still applies)');
    if (/has not been used|is disabled|not enabled/i.test(m)) throw err('disabled', 'Turn on the Cloud Text-to-Speech API in your Google Cloud project');
    if (/referer|referrer/i.test(m)) throw err('referrer', 'Your key is limited to other websites — allow melvyu.github.io in Google Cloud');
    if (r.status === 400 && /api key|API_KEY/i.test(m) || r.status === 401 || r.status === 403) throw err('badkey', 'Your Google key didn’t work — check it in Settings');
    throw err('bad', 'Couldn’t make the voice — using your phone’s voice');
  }
  const j = await r.json(); if (!j.audioContent) throw err('bad', 'Couldn’t make the voice');
  const bin = atob(j.audioContent); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  await addUsage(text.length);
  return new Blob([u8], { type: 'audio/mpeg' });
}
export async function testKey(lang = 'en', voiceId = NV[0].id) { return synthesize(lang === 'ja' ? 'こんにちは。' : 'Hello.', lang, voiceId); }

// a tiny silent WAV, played inside the tap that starts listening so iPhone lets later audio play
export function silentWav() {
  const n = 800, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf); let p = 0;
  const s = t => { for (const c of t) v.setUint8(p++, c.charCodeAt(0)); }, u32 = x => { v.setUint32(p, x, true); p += 4; }, u16 = x => { v.setUint16(p, x, true); p += 2; };
  s('RIFF'); u32(36 + n * 2); s('WAVE'); s('fmt '); u32(16); u16(1); u16(1); u32(16000); u32(32000); u16(2); u16(16); s('data'); u32(n * 2);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
