import { queryMemory } from "./memory";
import { humanize, buildHumanSystemPrompt } from "./humanize";

export type TodayStoryInput = {
  title: string;
  summary: string;
  sources: string[];
  entities: string[];
};

export async function generateScript(todayStories: TodayStoryInput[]): Promise<{
  script: string;
  callbacks: { storyTitle: string; memoryLine: string; threadSummary: string }[];
  usedMemory: { date: string; oneLine: string; threadSummary: string }[];
}> {
  // 1. pull memory for each today's story
  const allMemory: { date: string; oneLine: string; threadSummary: string }[] = [];
  const callbacks: { storyTitle: string; memoryLine: string; threadSummary: string }[] = [];

  for (const s of todayStories) {
    const q = `${s.title} ${s.summary} ${s.entities.join(" ")}`;
    const { threads, stories } = await queryMemory(q, 4, 30);
    for (const th of threads.slice(0, 1)) {
      const line = th.timeline[th.timeline.length - 1]?.oneLine ?? th.summary.slice(0, 120);
      callbacks.push({ storyTitle: s.title, memoryLine: line, threadSummary: th.summary.slice(0, 400) });
      for (const t of th.timeline.slice(-3)) {
        allMemory.push({ date: t.date, oneLine: t.oneLine, threadSummary: th.summary.slice(0, 300) });
      }
    }
    // also add retrieved stories
    for (const st of stories.slice(0, 1)) {
      allMemory.push({ date: st.date, oneLine: st.title, threadSummary: st.summary.slice(0, 200) });
    }
  }

  // dedupe
  const deduped = Array.from(new Map(allMemory.map((m) => [`${m.date}-${m.oneLine}`, m])).values()).slice(0, 12);

  // 2. build prompt
  const todayBlock = todayStories.map((s, i) => `Story ${i + 1}:\nTitle: ${s.title}\nSummary: ${s.summary}\nSources: ${s.sources.join(", ")}\nEntities: ${s.entities.join(", ")}`).join("\n\n");

  const memoryBlock = deduped.length
    ? deduped.map((m) => `- [${m.date}] ${m.oneLine}`).join("\n")
    : "(no prior history — this is a new thread)";

  const systemPrompt = buildHumanSystemPrompt();
  const userPrompt = `TODAY'S 7 STORIES TO WEAVE (07:00 edition):\n${todayBlock}\n\nMEMORY (last 30 days, use only if relevant — callback to make today make sense):\n${memoryBlock}\n\nTask: Write a 12-minute (~1600 word) podcast script as ONE arc, not 7 summaries.
Structure:
- Cold open (30s): callback to history that makes today's lead make sense
- 7 stories woven, each 70-90s, with source tags
- End with "what to watch" (1 line)

Keep it short, specific, no hedging.`;

  // 3. LLM call or mock
  const key = process.env.OPENAI_API_KEY;
  let rawScript: string;
  if (!key) {
    rawScript = mockScript(todayStories, deduped);
  } else {
    try {
      const { default: OpenAI } = await import("openai");
      const client = new OpenAI({ apiKey: key });
      const res = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.7,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
      rawScript = res.choices[0]?.message?.content ?? mockScript(todayStories, deduped);
    } catch {
      rawScript = mockScript(todayStories, deduped);
    }
  }

  const script = humanize(rawScript);
  return { script, callbacks, usedMemory: deduped };
}

function mockScript(today: TodayStoryInput[], memory: { date: string; oneLine: string }[]): string {
  const memLine = memory[0] ? `If you only saw today's headline, you missed ${memory[0].oneLine} on ${memory[0].date}.` : "";
  return `[COLD OPEN — 0:00]
Good morning. It's 7am. ${memLine} Let's connect it.

${today
  .map(
    (s, i) =>
      `[${String(i * 90).padStart(2, "0")}:00] ${s.title}
${s.summary} [${s.sources[0] ?? "source"}]
Why it matters: This continues ${memory[i % Math.max(1, memory.length)]?.oneLine ?? "the thread"} — and it changes what happens next.`
  )
  .join("\n\n")}

[WHAT TO WATCH — 11:30]
Watch the follow on ${today[0]?.entities[0] ?? "this thread"} tomorrow. That's your 12 minutes. Back tomorrow at 7.`;
}
