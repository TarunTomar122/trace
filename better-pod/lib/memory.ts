// Simple 30-90 day memory. No external DB for MVP — JSON file + brute cosine.
// Swap to pgvector/Qdrant later without changing API.
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

export type Story = {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  summary: string;
  sources: string[]; // urls or names
  entities: string[]; // e.g. ["Anthropic", "TSMC"]
  embedding?: number[];
  threadId?: string;
};

export type Thread = {
  id: string;
  summary: string; // living 800 token summary
  timeline: { date: string; storyId: string; oneLine: string }[];
  entities: string[];
  embedding?: number[];
  updatedAt: string;
};

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_FILE = path.join(DATA_DIR, "memory.json");

type Store = {
  stories: Story[];
  threads: Thread[];
};

async function ensureStore(): Promise<Store> {
  try {
    const raw = await fs.readFile(STORE_FILE, "utf8");
    return JSON.parse(raw) as Store;
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const empty: Store = { stories: [], threads: [] };
    await fs.writeFile(STORE_FILE, JSON.stringify(empty, null, 2));
    return empty;
  }
}

async function saveStore(s: Store) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STORE_FILE, JSON.stringify(s, null, 2));
}

// ---- embeddings: OpenAI if key, else deterministic hash fallback ----
function hashEmbedding(text: string, dim = 1536): number[] {
  // deterministic fallback so MVP works offline
  const hash = crypto.createHash("sha256").update(text).digest();
  const arr = new Array(dim).fill(0).map((_, i) => {
    const b = hash[i % hash.length];
    return (b / 255) * 2 - 1;
  });
  // L2 normalize
  const norm = Math.sqrt(arr.reduce((a, v) => a + v * v, 0));
  return arr.map((v) => v / norm);
}

export async function embed(text: string): Promise<number[]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return hashEmbedding(text);
  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: key });
    const res = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: text.slice(0, 8000),
    });
    return res.data[0].embedding;
  } catch {
    return hashEmbedding(text);
  }
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
}

function daysAgo(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00Z").getTime();
  const now = Date.now();
  return (now - d) / (1000 * 60 * 60 * 24);
}

// ---- thread matching ----
export async function findOrCreateThread(story: Story, store: Store): Promise<string> {
  const storyText = `${story.title} ${story.summary} ${story.entities.join(" ")}`;
  const emb = story.embedding ?? (await embed(storyText));
  story.embedding = emb;

  let best: { id: string; score: number } | null = null;
  for (const t of store.threads) {
    if (!t.embedding) continue;
    const sim = cosine(emb, t.embedding);
    const entityOverlap = story.entities.filter((e) => t.entities.includes(e)).length / Math.max(1, story.entities.length);
    const decay = Math.exp(-daysAgo(t.updatedAt) / 45); // 45 day half-ish
    const score = sim * 0.6 + entityOverlap * 0.3 + decay * 0.1;
    if (!best || score > best.score) best = { id: t.id, score };
  }
  // threshold tuned for 30-day window
  if (best && best.score > 0.62) return best.id;

  // new thread
  const newThread: Thread = {
    id: `thr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    summary: story.summary.slice(0, 600),
    timeline: [{ date: story.date, storyId: story.id, oneLine: story.title.slice(0, 80) }],
    entities: [...story.entities],
    embedding: emb,
    updatedAt: story.date,
  };
  store.threads.push(newThread);
  return newThread.id;
}

export async function ingestStories(stories: Omit<Story, "id" | "embedding" | "threadId">[]): Promise<Store> {
  const store = await ensureStore();
  for (const s of stories) {
    const story: Story = {
      id: `st_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      date: s.date,
      title: s.title,
      summary: s.summary,
      sources: s.sources,
      entities: s.entities,
    };
    const threadId = await findOrCreateThread(story, store);
    story.threadId = threadId;
    store.stories.push(story);

    // update thread
    const th = store.threads.find((t) => t.id === threadId)!;
    if (th.timeline.length === 1 && th.timeline[0].storyId === story.id) {
      // already added as new thread, skip
    } else {
      th.timeline.push({ date: story.date, storyId: story.id, oneLine: story.title.slice(0, 80) });
      // keep last 20
      if (th.timeline.length > 20) th.timeline = th.timeline.slice(-20);
      // naive living summary: append
      th.summary = `${th.summary}\n[${story.date}] ${story.title}: ${story.summary.slice(0, 180)}`.slice(-2400);
      th.entities = Array.from(new Set([...th.entities, ...story.entities])).slice(0, 20);
      th.updatedAt = story.date;
      th.embedding = await embed(`${th.summary} ${th.entities.join(" ")}`);
    }
  }
  // keep 90 days max
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  store.stories = store.stories.filter((s) => s.date >= cutoff);
  await saveStore(store);
  return store;
}

export async function queryMemory(query: string, k = 8, daysWindow = 30): Promise<{ stories: Story[]; threads: Thread[] }> {
  const store = await ensureStore();
  const qEmb = await embed(query);
  const cutoff = new Date(Date.now() - daysWindow * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const recentStories = store.stories.filter((s) => s.date >= cutoff);
  const scoredStories = recentStories
    .map((s) => ({
      s,
      score: s.embedding ? cosine(qEmb, s.embedding) * 0.7 + (1 / (1 + daysAgo(s.date))) * 0.3 : 0,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => x.s);

  const scoredThreads = store.threads
    .map((t) => ({
      t,
      score: t.embedding ? cosine(qEmb, t.embedding) : 0,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => x.t);

  return { stories: scoredStories, threads: scoredThreads };
}

export async function getStore(): Promise<Store> {
  return ensureStore();
}

export async function clearStore() {
  await saveStore({ stories: [], threads: [] });
}
