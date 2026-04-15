import { UserPatterns } from './firestore';

export type TraceInsights = {
  summary: string;
};

type BuildOptions = {
  patterns?: UserPatterns | null;
};

export function buildTraceInsights({ patterns }: BuildOptions): TraceInsights | null {
  const summary = patterns?.summary?.trim();
  if (summary) {
    return { summary };
  }
  return null;
}

