import { NextResponse } from 'next/server';
import { EarningsBriefSchema } from '@/src/lib/earnings/schema';
import { getCache, setCache } from '@/src/lib/cache/simpleCache';
import { sha256 } from '@/src/lib/earnings/hash';
import OpenAI from 'openai';

type ReqBody = {
  ticker?: string;
  text: string;
};

function cleanInput(text: string) {
  const t = text.trim();
  const MAX = 40_000; // chars
  return t.length > MAX ? t.slice(0, MAX) : t;
}

async function callLLM(args: { prompt: string; model: string; provider: string }): Promise<string> {
  if (args.provider !== 'openai') {
    throw new Error(`LLM_PROVIDER is ${args.provider}, but this route is wired for OpenAI.`);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY in env');

  const client = new OpenAI({ apiKey });

  const resp = await client.chat.completions.create({
    model: args.model,
    messages: [
      { role: 'system', content: 'Return ONLY valid JSON. No markdown. No extra text.' },
      { role: 'user', content: args.prompt },
    ],
    temperature: 0.2,
  });

  const content = resp.choices[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned empty response');

  return content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
}

function buildPrompt(input: { ticker?: string; text: string }) {
  // We ask for a wrapper object that contains a relevance decision and (if relevant) a brief
  // matching your existing EarningsBriefSchema shape.
  return `
You are a STRICT relevance filter + earnings brief generator.

Company context:
- Ticker: ${input.ticker ?? 'N/A'}

Your job:
1) Determine if the INPUT TEXT is primarily about the company identified by the ticker above.
   - Relevant if it discusses that company's earnings/results, guidance, operations, products, risks, outlook, management commentary, or financial metrics.
   - NOT relevant if it is about another company, a general macro/market topic, unrelated content, or nonsense.
   - If unsure, be conservative and mark NOT relevant.

2) If NOT relevant:
   - Return isRelevant=false
   - Provide a short reason
   - Set brief=null

3) If relevant:
   - Return isRelevant=true
   - Provide a short reason
   - Provide brief as valid JSON matching this schema exactly:

{
  "overview": { "text": string, "evidence": string } | null,
  "positives": [{ "title": string, "text": string, "evidence": string }],
  "concerns": [{ "title": string, "text": string, "evidence": string }],
  "guidance": { "text": string, "evidence": string } | null,
  "notableNumbers": [{ "label": string, "value": string, "evidence": string }],
  "meta": { "generatedAt": string, "model": string, "provider": string, "inputChars": number, "notes": string[] }
}

Rules for brief (when relevant):
- Use ONLY facts explicitly present in the input text.
- EVERY item MUST include an "evidence" field that is a direct quote from the input.
- Do NOT invent numbers. If a number isn't present, omit it.
- Keep overview to 1–2 sentences.
- positives: exactly 3 items if possible (otherwise fewer).
- concerns: exactly 3 items if possible (otherwise fewer).
- guidance: null if no guidance/outlook is explicitly mentioned.
- notableNumbers: include key metrics only if explicitly stated (Revenue, EPS, margin, FCF, etc).

Output format:
Return ONLY valid JSON with exactly these keys:
{
  "isRelevant": boolean,
  "confidence": number,
  "reason": string,
  "brief": object | null
}

INPUT TEXT:
"""${input.text}"""
`.trim();
}

export async function POST(req: Request) {
  const body = (await req.json()) as ReqBody;
  const text = cleanInput(body.text ?? '');

  if (text.length < 200) {
    return NextResponse.json({ error: 'Paste at least ~200 characters of earnings text.' }, { status: 400 });
  }

  const provider = process.env.LLM_PROVIDER || 'unconfigured';
  const model =
    provider === 'openai'
      ? process.env.OPENAI_MODEL || 'gpt-4.1-mini'
      : provider === 'anthropic'
        ? process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest'
        : 'unconfigured';

  // Cache by provider/model/ticker/text so we don't re-bill on repeats
  const key = await sha256(`${provider}:${model}:${body.ticker ?? ''}:${text}`);
  const cacheKey = `earnings:v2:${key}`;

  const cached = getCache<any>(cacheKey);
  if (cached.hit) {
    return NextResponse.json({
      ...cached.value,
      meta: { ...cached.value.meta, notes: [...(cached.value.meta?.notes ?? []), 'cached'] },
    });
  }

  const prompt = buildPrompt({ ticker: body.ticker, text });

  let raw: string;
  try {
    raw = await callLLM({ prompt, provider, model });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'LLM call failed.' }, { status: 500 });
  }

  // Parse wrapper JSON
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Model returned non-JSON output.' }, { status: 500 });
  }

  const isRelevant = Boolean(parsed?.isRelevant);
  const confidence =
    typeof parsed?.confidence === 'number' && Number.isFinite(parsed.confidence) ? parsed.confidence : null;
  const reason = typeof parsed?.reason === 'string' ? parsed.reason : 'Input does not appear to match the selected ticker.';

  if (!isRelevant || !parsed?.brief) {
    // Return a clean UX error so your UI shows a nice red banner
    return NextResponse.json(
      {
        error: `That text doesn’t look like it’s about ${body.ticker ?? 'the selected company'}. ${reason}${
          confidence !== null ? ` (confidence: ${confidence.toFixed(2)})` : ''
        }`,
      },
      { status: 400 }
    );
  }

  // Validate the brief against your existing schema
  const validated = EarningsBriefSchema.safeParse(parsed.brief);
  if (!validated.success) {
    return NextResponse.json(
      { error: 'Model returned invalid JSON shape.', details: validated.error.flatten() },
      { status: 500 }
    );
  }

  // Stamp meta fields defensively
  const result = {
    ...validated.data,
    meta: {
      ...validated.data.meta,
      generatedAt: new Date().toISOString(),
      model,
      provider,
      inputChars: text.length,
      notes: [...(validated.data.meta.notes ?? []), 'relevance_gate_passed'],
    },
  };

  // Cache 24h
  setCache(cacheKey, result, 24 * 60 * 60 * 1000);

  return NextResponse.json(result);
}