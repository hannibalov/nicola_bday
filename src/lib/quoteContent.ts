import quoteJson from "./content/quoteQuestions.json";

export type QuoteQuestion = {
  id: string;
  quote: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
};

function isOptionTuple(v: unknown): v is [string, string, string, string] {
  return (
    Array.isArray(v) &&
    v.length === 4 &&
    v.every((x) => typeof x === "string")
  );
}

/** Validates the bundled quote pack (≥1 item, 4 options each, correctIndex in range). */
export function parseQuoteQuestions(raw: unknown): QuoteQuestion[] {
  if (!Array.isArray(raw)) {
    throw new Error("quote questions: expected array");
  }
  if (raw.length < 1) {
    throw new Error("quote questions: expected at least one item");
  }
  const out: QuoteQuestion[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (item === null || typeof item !== "object") {
      throw new Error(`quote questions[${i}]: expected object`);
    }
    const rec = item as Record<string, unknown>;
    const id = rec.id;
    const quote = rec.quote;
    const options = rec.options;
    const correctIndex = rec.correctIndex;
    if (typeof id !== "string" || id.length === 0) {
      throw new Error(`quote questions[${i}]: invalid id`);
    }
    if (typeof quote !== "string" || quote.length === 0) {
      throw new Error(`quote questions[${i}]: invalid quote`);
    }
    if (!isOptionTuple(options)) {
      throw new Error(`quote questions[${i}]: options must be 4 strings`);
    }
    if (
      correctIndex !== 0 &&
      correctIndex !== 1 &&
      correctIndex !== 2 &&
      correctIndex !== 3
    ) {
      throw new Error(`quote questions[${i}]: correctIndex must be 0–3`);
    }
    out.push({ id, quote, options, correctIndex });
  }
  return out;
}

let cached: QuoteQuestion[] | null = null;

export function getQuoteQuestions(): QuoteQuestion[] {
  if (!cached) {
    cached = parseQuoteQuestions(quoteJson);
  }
  return cached;
}
