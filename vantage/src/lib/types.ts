export type Role = 'engineer' | 'designer' | 'founder' | 'pm' | 'investor' | 'student';

export type Goal = 'ship-my-own-thing' | 'get-better' | 'catch-opportunities' | 'stay-current';

export interface Profile {
  name?: string;
  role?: Role;
  goal?: Goal;
  interests: string[];
  delivery: { app: boolean; podcast: boolean; email: boolean; whatsapp: boolean };
  pace: 'relaxed' | 'natural' | 'brisk';
}

export interface Episode {
  id: string;
  date: string; // ISO
  title: string;
  blurb: string;
  durationSec: number;
  audioUrl: string;
  topics: string[];
  listened?: boolean;
}

export const ROLES: { id: Role; label: string; icon: string }[] = [
  { id: 'engineer', label: 'Engineer', icon: 'terminal' },
  { id: 'designer', label: 'Designer', icon: 'pen' },
  { id: 'founder', label: 'Founder', icon: 'rocket' },
  { id: 'pm', label: 'Product', icon: 'compass' },
  { id: 'investor', label: 'Investor', icon: 'trend' },
  { id: 'student', label: 'Learning', icon: 'book' },
];

export const GOALS: { id: Goal; label: string; sub: string }[] = [
  { id: 'ship-my-own-thing', label: 'Ship my own thing', sub: 'Spot openings before they’re obvious' },
  { id: 'catch-opportunities', label: 'Catch opportunities', sub: 'Jobs, launches, moves worth making' },
  { id: 'get-better', label: 'Get better at my craft', sub: 'The shifts worth learning now' },
  { id: 'stay-current', label: 'Just stay current', sub: 'No FOMO, no ten open tabs' },
];

export const INTERESTS = [
  'AI models', 'Agents & tools', 'Dev tooling', 'Design & UX', 'Startups', 'Funding',
  'Hardware & robotics', 'Security', 'Open source', 'Big tech', 'Markets', 'Policy',
];
