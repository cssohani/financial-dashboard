export type EarningsBrief = {
  overview: { text: string; evidence: string } | null;

  positives: Array<{ title: string; text: string; evidence: string }>;
  concerns: Array<{ title: string; text: string; evidence: string }>;

  guidance: { text: string; evidence: string } | null;

  notableNumbers: Array<{
    label: string; // e.g. "Revenue"
    value: string; // keep as string to avoid hallucinated parsing
    evidence: string;
  }>;

  meta: {
    generatedAt: string;
    model: string;
    provider: string;
    inputChars: number;
    notes: string[];
  };
};
