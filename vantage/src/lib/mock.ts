import { BRAND } from './brand';
import type { Episode, Profile } from './types';

// Mock episodes for the prototype. In production these come from the daily
// generation pipeline (see README: feed -> gpt-5 script -> Runway seed_audio -> Storage).
// All point at the one real sample mp3 so the players actually play.
export const MOCK_EPISODES: Episode[] = [
  {
    id: '2026-09-01',
    date: '2026-09-01',
    title: 'The agent plumbing is leaking',
    blurb:
      'Why 40% of MCP servers being exploitable is a founder-shaped opening, not just a headline — plus Apple’s trade-secret fight with OpenAI and a $399 robot that quietly went platform.',
    durationSec: 154,
    audioUrl: BRAND.sampleAudio,
    topics: ['Security', 'Agents & tools', 'Hardware & robotics'],
    listened: false,
  },
  {
    id: '2026-08-31',
    date: '2026-08-31',
    title: 'Cheap robots, expensive lawsuits',
    blurb:
      'The week hardware stopped being the hard part, what Apple v. OpenAI means for anyone hiring from a big lab, and where the boring compliance money is hiding.',
    durationSec: 168,
    audioUrl: BRAND.sampleAudio,
    topics: ['Hardware & robotics', 'Big tech', 'Policy'],
    listened: true,
  },
  {
    id: '2026-08-30',
    date: '2026-08-30',
    title: 'Everyone’s wiring agents to everything',
    blurb:
      'The tool layer became the attack surface overnight. Here’s the skill worth getting ahead of, and the one product gap nobody’s filled yet.',
    durationSec: 141,
    audioUrl: BRAND.sampleAudio,
    topics: ['Agents & tools', 'Dev tooling', 'Security'],
    listened: true,
  },
  {
    id: '2026-08-29',
    date: '2026-08-29',
    title: 'Money’s betting on prediction markets',
    blurb:
      '$300M into a market where the rulebook’s still being written — what that signals for anyone building in a gray zone, and the safer angle underneath it.',
    durationSec: 149,
    audioUrl: BRAND.sampleAudio,
    topics: ['Funding', 'Markets', 'Policy'],
    listened: true,
  },
  {
    id: '2026-08-28',
    date: '2026-08-28',
    title: 'Open weights come for the coding stack',
    blurb:
      'A GPT-4-class model on a single GPU changes who can compete. Where that leaves your side project, and what to build on top instead of under.',
    durationSec: 157,
    audioUrl: BRAND.sampleAudio,
    topics: ['AI models', 'Open source', 'Dev tooling'],
    listened: true,
  },
];

export const DEFAULT_PROFILE: Profile = {
  name: '',
  role: undefined,
  goal: undefined,
  interests: [],
  delivery: { app: true, podcast: true, email: true, whatsapp: false },
  pace: 'natural',
};

export function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function fmtDate(iso: string): string {
  return new Date(iso + 'T08:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}
