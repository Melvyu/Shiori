// Shiori — chapter challenges. Talks to Claude straight from this device with the user's own API key.
import { db } from './db.js';

const EP = globalThis.__SHIORI_AI || 'https://api.anthropic.com/v1/messages';
export const MODELS = { smart: 'claude-sonnet-5-5', quick: 'claude-haiku-5-5' };
export async function getAI() { return (await db.get('kv', 'ai')) || {}; }
export async function setAI(o) { const a = await getAI(); await db.put('kv', { ...a, ...o }, 'ai'); }
export async function hasKey() { return !!(await getAI()).key; }

async function call(system, user, maxTokens = 1200) {
  const a = await getAI(); if (!a.key) throw Object.assign(new Error('Add your Claude API key in Settings to use chapter challenges'), { code: 'nokey' });
  let r;
  try {
    r = await fetch(EP, {
      method: 'POST',
      headers: { 'x-api-key': a.key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: MODELS[a.model || 'smart'] || MODELS.smart, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] })
    });
  } catch (e) { throw Object.assign(new Error('You’re offline — challenges need the internet'), { code: 'offline' }); }
  if (r.status === 401 || r.status === 403) throw Object.assign(new Error('Your Claude API key didn’t work — check it in Settings'), { code: 'badkey' });
  if (r.status === 429) throw Object.assign(new Error('Claude is busy right now — try again in a minute'), { code: 'busy' });
  if (r.status === 400) { let m = ''; try { m = (await r.json()).error.message; } catch (e) { } if (/credit|billing|balance/i.test(m)) throw Object.assign(new Error('Your Claude account is out of credit'), { code: 'credit' }); throw Object.assign(new Error('Couldn’t make the challenge'), { code: 'bad' }); }
  if (!r.ok) throw Object.assign(new Error('Couldn’t reach Claude — try again'), { code: 'net' });
  const j = await r.json(); const t = (j.content || []).map(c => c.text || '').join('');
  const m = t.match(/\{[\s\S]*\}/); if (!m) throw Object.assign(new Error('Couldn’t read Claude’s reply — try again'), { code: 'format' });
  try { return JSON.parse(m[0]); } catch (e) { throw Object.assign(new Error('Couldn’t read Claude’s reply — try again'), { code: 'format' }); }
}

export async function testKey() { const r = await call('Reply with JSON only.', 'Return {"ok":true}', 20); return !!r.ok; }

export async function makeChallenge({ book, chapter, text }) {
  const system = `You write ONE short learning challenge for the end of a book chapter, for a reader who wants to really learn the book.
Rules:
- Base it on the chapter's MAIN idea, not a minor detail.
- Pick the type that fits the book: "Fix it" (repair a flawed example — great for design, writing, craft), "Design it" (apply the idea to a new concrete situation), "Explain why" (explain a decision or event using a specific detail from the chapter — great for history, business, biography), "Predict" (what happens next and why — great for science, economics, psychology).
- The prompt is a concrete little scenario, 35–70 words, answerable in your own words in 1–3 minutes. No multiple choice. Don't reveal the answer.
- Exactly 3 goals: short criteria (max 12 words each) for what a good answer must SHOW. They describe reasoning, not exact wording, so different solutions can pass.
- "passage": copy 1–2 sentences VERBATIM from the chapter that hold the key idea.
- Write in the same language as the chapter.
Reply with JSON only: {"type":"Fix it|Design it|Explain why|Predict","title":"max 8 words","prompt":"...","minutes":2,"goals":["...","...","..."],"passage":"..."}`;
  const user = `Book: ${book}\nChapter: ${chapter}\n\nCHAPTER TEXT:\n${text}`;
  const c = await call(system, user, 900);
  if (!c.prompt || !Array.isArray(c.goals) || c.goals.length < 2) throw Object.assign(new Error('Couldn’t make the challenge — try again'), { code: 'format' });
  c.goals = c.goals.slice(0, 3); c.minutes = Math.min(3, Math.max(1, +c.minutes || 2));
  if (!['Fix it', 'Design it', 'Explain why', 'Predict'].includes(c.type)) c.type = 'Design it';
  return c;
}

export async function checkAnswer({ ch, answer }) {
  const system = `You are a warm, fair tutor checking a reader's answer to a chapter challenge.
Judge the REASONING against each goal. Accept any valid solution — different answers can pass. Ignore spelling and style.
- "met": one true/false per goal.
- "verdict": "pass" if every goal is met; "close" if at least one is met; otherwise "miss".
- "followup": if not pass, ONE focused question (max 30 words) that targets only the FIRST unmet goal, built on the specifics of their answer, so they only revise the part they missed. Never give the answer.
- "showed": 3 very short phrases (max 8 words) describing what their answer showed, in plain words.
Reply with JSON only: {"met":[true,false,true],"verdict":"pass|close|miss","followup":"...","showed":["...","...","..."]}`;
  const user = `CHALLENGE (${ch.type}): ${ch.title}\n${ch.prompt}\n\nGOALS:\n${ch.goals.map((g, i) => `${i + 1}. ${g}`).join('\n')}\n\nKEY PASSAGE FROM THE CHAPTER:\n${ch.passage || ''}\n\nREADER'S ANSWER:\n${answer}`;
  const r = await call(system, user, 600);
  r.met = ch.goals.map((_, i) => !!(r.met || [])[i]);
  if (r.met.every(Boolean)) r.verdict = 'pass';
  if (!['pass', 'close', 'miss'].includes(r.verdict)) r.verdict = r.met.some(Boolean) ? 'close' : 'miss';
  r.showed = (r.showed || []).slice(0, 3);
  return r;
}

export async function workedExample({ ch, answer, met }) {
  const system = `A reader is stuck on a chapter challenge. Teach the idea with a worked example from a DIFFERENT situation that uses the same idea, then ask one simpler question.
- "setup": the different situation, max 30 words.
- "steps": exactly 3, one per goal in the same order, each {"title":"max 8 words","detail":"max 18 words"} showing how the example meets that goal.
- "missing": index (0-2) of the first goal the reader has not met.
- "question": ONE simpler question (max 30 words) about the reader's ORIGINAL scenario that leads them to the missing goal. Answerable in one sentence.
Reply with JSON only: {"setup":"...","steps":[{"title":"...","detail":"..."}],"missing":0,"question":"..."}`;
  const user = `CHALLENGE: ${ch.title}\n${ch.prompt}\n\nGOALS:\n${ch.goals.map((g, i) => `${i + 1}. ${g} — ${met[i] ? 'MET' : 'NOT MET'}`).join('\n')}\n\nKEY PASSAGE:\n${ch.passage || ''}\n\nREADER'S ANSWER SO FAR:\n${answer}`;
  const r = await call(system, user, 700);
  r.steps = (r.steps || []).slice(0, 3); r.missing = Math.min(2, Math.max(0, +r.missing || met.findIndex(x => !x) || 0));
  return r;
}

export async function checkSimple({ ch, question, answer }) {
  const system = `Be generous. A stuck reader answered one simple question. Say ok:true if the answer shows any sensible attempt in the right direction. Reply with JSON only: {"ok":true,"note":"one short encouraging sentence"}`;
  return await call(system, `CHALLENGE: ${ch.title}\n${ch.prompt}\n\nQUESTION: ${question}\nANSWER: ${answer}`, 150);
}
