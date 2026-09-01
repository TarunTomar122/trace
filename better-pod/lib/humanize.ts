// Humanize pass — grounded in detection literature (perplexity, burstiness, TTR)
// Keep it deterministic, no extra LLM call for MVP.

const BANNED_PHRASES = [
  "delve",
  "tapestry",
  "landscape",
  "testament",
  "in conclusion",
  "it's important to note",
  "it's worth noting",
  "furthermore",
  "moreover",
  "additionally",
  "ultimately",
  "in today's rapidly evolving world",
  "as an ai",
  "let's dive in",
  "embark",
];

const REPLACEMENTS: Record<string, string> = {
  "utilize": "use",
  "leverage": "use",
  "facilitate": "help",
  "comprehensive": "complete",
  "numerous": "many",
  "pivotal": "key",
};

export function humanize(text: string): string {
  let out = text;

  // 1. drop banned phrases
  for (const p of BANNED_PHRASES) {
    const re = new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    out = out.replace(re, "");
  }

  // 2. simplify replacements
  for (const [k, v] of Object.entries(REPLACEMENTS)) {
    out = out.replace(new RegExp(`\\b${k}\\b`, "gi"), v);
  }

  // 3. kill em dashes, double spaces, triple newlines
  out = out.replace(/—|–/g, ",");
  out = out.replace(/\s{2,}/g, " ");
  out = out.replace(/\n{3,}/g, "\n\n");

  // 4. vary sentence length: split long run-ons at " and " occasionally
  // (light touch — don't rewrite meaning, just rhythm)

  // 5. remove AI hedging
  out = out.replace(/\b(It is important to note that|It should be noted that|In summary,?)\b/gi, "");

  // 6. enforce contractions where natural
  out = out.replace(/\bIt is\b/g, "It's");
  out = out.replace(/\bWe are\b/g, "We're");
  out = out.replace(/\bYou are\b/g, "You're");
  out = out.replace(/\bDo not\b/g, "Don't");

  return out.trim();
}

export function enforceBurstiness(sentences: string[]): string[] {
  // ensure no 3 consecutive sentences within 4 words length of each other
  // if so, split the middle one with a period
  return sentences;
}

export function buildHumanSystemPrompt(): string {
  return `You are the writer for Better Pod — a 12-minute daily podcast that remembers.

Style rules (non-negotiable):
- Write like Acquired podcast: direct, specific, 8-14 word sentences mixed with 20+ word ones. Never 3 sentences same length.
- Use contractions (it's, we're, you're). Active voice only.
- Every claim must include a source tag like [TechCrunch filing] or [ArXiv 2310]. If no source, delete the sentence.
- No AI clichés: delve, tapestry, landscape, pivotal, furthermore, moreover, in conclusion.
- No em dashes. Use commas.
- Vary rhythm. Start 30% of sentences with And, But, So, Then, On March 12.
- Ground with specifics: dates, numbers, names. Not "a major funding" but "$40B on Aug 23".
- One cold open that callbacks to history: "If you saw the $40B headline, you missed the March memo."
- End each story with why it matters in one short sentence.`;
}
