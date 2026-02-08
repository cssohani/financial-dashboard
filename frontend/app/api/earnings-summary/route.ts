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
  // keep it simple: trim and cap size to protect your API bill
  const t = text.trim();
  const MAX = 40_000; // chars
  return t.length > MAX ? t.slice(0, MAX) : t;
}

/**
 * PROVIDER-AGNOSTIC placeholder.
 * Replace this with your provider call (OpenAI/Anthropic/etc).
 */
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

  // Sometimes models wrap JSON in ```json ...```. Strip it defensively.
  return content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
}


function buildPrompt(input: { ticker?: string; text: string }) {
  // Key rules:
  // - structured JSON only
  // - no hallucinated numbers
  // - every claim must include evidence quote from the input text
  return `
You are an analyst assistant. Summarize the provided earnings-related text for investors.
Return ONLY valid JSON matching this schema:

{
  "overview": { "text": string, "evidence": string } | null,
  "positives": [{ "title": string, "text": string, "evidence": string }],
  "concerns": [{ "title": string, "text": string, "evidence": string }],
  "guidance": { "text": string, "evidence": string } | null,
  "notableNumbers": [{ "label": string, "value": string, "evidence": string }],
  "meta": { "generatedAt": string, "model": string, "provider": string, "inputChars": number, "notes": string[] }
}

Rules:
- Use ONLY facts that appear explicitly in the input text.
- Every bullet MUST include an "evidence" field that is a direct quote from the input.
- Do NOT invent numbers. If a number isn't present, omit it.
- Keep overview to 1–2 sentences.
- positives: exactly 3 items if possible (otherwise fewer).
- concerns: exactly 3 items if possible (otherwise fewer).
- guidance: set null if no guidance/outlook is explicitly mentioned.
- notableNumbers: include key metrics only if explicitly stated (Revenue, EPS, margin, FCF, etc).

Context:
Ticker: ${input.ticker ?? 'N/A'}

INPUT TEXT:
"""${input.text}"""
`.trim();
}

export async function POST(req: Request) {
  const body = (await req.json()) as ReqBody;
  const text = cleanInput(body.text ?? '');

  if (text.length < 200) {
    return NextResponse.json(
      { error: 'Paste at least ~200 characters of earnings text.' },
      { status: 400 }
    );
  }

  const provider = process.env.LLM_PROVIDER || 'unconfigured';
  const model =
    provider === 'openai'
      ? process.env.OPENAI_MODEL || 'gpt-4.1-mini'
      : provider === 'anthropic'
        ? process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest'
        : 'unconfigured';

  const key = await sha256(`${provider}:${model}:${body.ticker ?? ''}:${text}`);
  const cacheKey = `earnings:v1:${key}`;

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
    return NextResponse.json(
      { error: e?.message || 'LLM call failed.' },
      { status: 500 }
    );
  }

  // Parse/validate
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: 'Model returned non-JSON output.' },
      { status: 500 }
    );
  }

  const validated = EarningsBriefSchema.safeParse(parsed);
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
      notes: validated.data.meta.notes ?? [],
    },
  };

  // Cache 24h
  setCache(cacheKey, result, 24 * 60 * 60 * 1000);

  return NextResponse.json(result);
}
