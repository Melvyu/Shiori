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

const NEVER = `Never ask about:
- The book as an object: copyright, publisher, edition, ISBN, legal notices, dedication, acknowledgements, the table of contents, or how the book is organised. If the text includes such pages, ignore them.
- The author: their life, career, opinions about themselves, or why they wrote the book.
- Trivia: names of people, companies, products or games used as examples, dates, numbers, quotes, or the order things appear in.
- The author's own examples. If the chapter teaches through an example, ask the reader to use the same idea on a NEW situation instead.
- Anything someone could answer from general knowledge or by guessing without reading. No yes/no or one-word questions, no multiple choice.`;
const QSHAPE = `- "q": 15–60 words. A concrete little scenario usually beats abstract wording. Never hint at the answer.
- "goals": 2–3 short criteria (max 12 words each) for what a good answer must SHOW. They describe understanding, not exact wording, so different valid answers can pass.`;
const clean = q => ({ ...q, q: String(q.q || ''), goals: (Array.isArray(q.goals) ? q.goals : []).map(String).filter(Boolean).slice(0, 3) });

export async function makeChapterSet({ book, chapter, text, prior = [] }) {
  const system = `You write the end-of-chapter check for a reader who wants to truly learn this book. Write exactly 3 OPEN questions which, answered well together, prove the reader understood what THIS chapter teaches.
Test the chapter's teachings: its ideas, principles, methods and arguments, and why they work. (For history, biography or narrative: the key events, their causes and consequences, why things happened and what they changed.) Each question covers a DIFFERENT important idea, so together they cover the chapter's core.
${NEVER}
Difficulty:
- Questions 1 and 2: medium. Explain an idea and why it matters, or apply it to a short new scenario. Not trivial, not a trick.
- Question 3: a little harder. Apply the chapter's ideas to a new concrete situation, weigh a trade-off, find what's wrong in a flawed example, or connect two of its ideas.
- Each answerable in 2–5 sentences, about 1–3 minutes.
For each question:
${QSHAPE}
- "passage": 1–2 sentences copied VERBATIM from the chapter that hold the idea it tests.
Also:
- "title": the chapter's core idea, max 6 words.
- "summary": 60–100 words on the chapter's main teachings (used later for a final exam). No examples, no trivia.
- These questions must be unique to this chapter. Don't re-test ideas from earlier chapters' questions (listed below, if any).
- Write in the same language as the chapter text.
Reply with JSON only: {"title":"...","summary":"...","questions":[{"q":"...","goals":["...","..."],"passage":"..."},{...},{...}]}`;
  const user = `Book: ${book}\nChapter: ${chapter}\n\nQUESTIONS ALREADY ASKED IN EARLIER CHAPTERS:\n${prior.length ? prior.map(q => '- ' + q).join('\n') : '(none)'}\n\nCHAPTER TEXT:\n${text}`;
  const c = await call(system, user, 2000);
  const qs = (Array.isArray(c.questions) ? c.questions : []).map(clean).filter(q => q.q && q.goals.length >= 2).slice(0, 3);
  if (qs.length < 3) throw Object.assign(new Error('Couldn’t write the questions — try again'), { code: 'format' });
  qs.forEach((q, i) => q.level = i === 2 ? 'deeper' : 'core');
  return { title: String(c.title || chapter), summary: String(c.summary || ''), questions: qs };
}

export async function makeExam({ book, chapters, asked = [] }) {
  const system = `You write the FINAL EXAM for a whole book. The reader has finished every chapter. Write exactly 5 OPEN questions which, answered well, prove they understood the book thoroughly — its most important teachings and how they fit together.
${NEVER}
- Don't repeat the chapter questions they already answered (listed below). Test the same teachings from a fresh angle.
Difficulty:
- Questions 1–3: medium. Each on a different major teaching, drawn from different parts of the book.
- Questions 4–5: harder. Combine ideas from at least two chapters, or apply the book's whole approach to a new, realistic problem from start to finish.
- Each answerable in 3–6 sentences.
For each question:
${QSHAPE}
- "chapters": the chapter numbers (1-based) whose teachings it tests.
Also "title": max 6 words naming what the book teaches.
Write in the same language as the chapter summaries.
Reply with JSON only: {"title":"...","questions":[{"q":"...","goals":["...","..."],"chapters":[1,3]}, ...5 total]}`;
  const user = `Book: ${book}\n\nCHAPTERS:\n${chapters.map((c, i) => `${i + 1}. ${c.title}\n${c.summary}`).join('\n\n')}\n\nCHAPTER QUESTIONS ALREADY ANSWERED:\n${asked.length ? asked.map(q => '- ' + q).join('\n') : '(none)'}`;
  const c = await call(system, user, 2600);
  const qs = (Array.isArray(c.questions) ? c.questions : []).map(clean).filter(q => q.q && q.goals.length >= 2).slice(0, 5);
  if (qs.length < 3) throw Object.assign(new Error('Couldn’t write the exam — try again'), { code: 'format' });
  qs.forEach((q, i) => { q.level = i >= qs.length - 2 ? 'deeper' : 'core'; q.chapters = (Array.isArray(q.chapters) ? q.chapters : []).map(n => +n).filter(n => n >= 1 && n <= chapters.length).slice(0, 4); });
  return { title: String(c.title || book), questions: qs };
}

export async function checkAnswer({ book, where, q, answer }) {
  const system = `You are a warm but honest tutor checking a reader's answer to an open question about a book they are studying.
Judge the UNDERSTANDING against each goal. Accept any valid answer — different reasoning can pass. Ignore spelling, grammar and style.
Be fair, not lenient: an answer that only names the idea, repeats the question, or stays vague does NOT meet a goal. It must show the reasoning.
- "met": one true/false per goal.
- "verdict": "pass" if every goal is met; "close" if at least one is met; otherwise "miss".
- "followup": if not pass, ONE focused question (max 30 words) about only the FIRST unmet goal, built on the specifics of their answer, so they only add the part they missed. Never give the answer.
- "showed": up to 3 very short phrases (max 8 words) naming what their answer showed, in plain words.
- "review": if not pass and the question lists chapters, the chapter numbers (only from those listed) whose teaching would fill the gaps in their answer, most useful first. Otherwise [].
Reply with JSON only: {"met":[true,false],"verdict":"pass|close|miss","followup":"...","showed":["..."],"review":[2]}`;
  const user = `BOOK: ${book}\n${where}\n\nQUESTION:\n${q.q}\n\nGOALS:\n${q.goals.map((g, i) => `${i + 1}. ${g}`).join('\n')}\n\n${q.passage ? `KEY PASSAGE:\n${q.passage}\n\n` : q.context ? `WHAT THOSE CHAPTERS TEACH:\n${q.context}\n\n` : ''}READER'S ANSWER:\n${answer}`;
  const r = await call(system, user, 600);
  r.met = q.goals.map((_, i) => !!(r.met || [])[i]);
  if (r.met.every(Boolean)) r.verdict = 'pass'; else if (r.verdict === 'pass') r.verdict = 'close';
  if (!['pass', 'close', 'miss'].includes(r.verdict)) r.verdict = r.met.some(Boolean) ? 'close' : 'miss';
  r.showed = (r.showed || []).filter(Boolean).slice(0, 3);
  const ok = (q.chapters || []);
  r.review = r.verdict === 'pass' ? [] : (Array.isArray(r.review) ? r.review.map(n => +n).filter(n => ok.includes(n)) : []);
  if (r.verdict !== 'pass' && !r.review.length) r.review = ok.slice();
  return r;
}

export async function workedExample({ q, answer, met }) {
  const n = q.goals.length;
  const system = `A reader is stuck on an open question about a book. Teach the idea with a worked example from a DIFFERENT situation that uses the same idea, then ask one simpler question.
- "setup": the different situation, max 30 words.
- "steps": exactly ${n}, one per goal in the same order, each {"title":"max 8 words","detail":"max 18 words"} showing how the example meets that goal.
- "missing": index (0-${n - 1}) of the first goal the reader has not met.
- "question": ONE simpler question (max 30 words) about the ORIGINAL question that leads them to the missing goal. Answerable in one sentence.
Reply with JSON only: {"setup":"...","steps":[{"title":"...","detail":"..."}],"missing":0,"question":"..."}`;
  const user = `QUESTION:\n${q.q}\n\nGOALS:\n${q.goals.map((g, i) => `${i + 1}. ${g} — ${met[i] ? 'MET' : 'NOT MET'}`).join('\n')}\n\n${q.passage ? `KEY PASSAGE:\n${q.passage}\n\n` : q.context ? `WHAT THOSE CHAPTERS TEACH:\n${q.context}\n\n` : ''}READER'S ANSWER SO FAR:\n${answer}`;
  const r = await call(system, user, 700);
  r.steps = (r.steps || []).slice(0, n);
  const first = met.findIndex(x => !x);
  r.missing = Math.min(r.steps.length - 1, Math.max(0, Number.isInteger(+r.missing) ? +r.missing : (first < 0 ? 0 : first)));
  return r;
}

export async function checkSimple({ q, question, answer }) {
  const system = `Be generous. A stuck reader answered one simple question. Say ok:true if the answer shows any sensible attempt in the right direction. Reply with JSON only: {"ok":true,"note":"one short encouraging sentence"}`;
  return await call(system, `ORIGINAL QUESTION:\n${q.q}\n\nSIMPLE QUESTION: ${question}\nANSWER: ${answer}`, 150);
}
