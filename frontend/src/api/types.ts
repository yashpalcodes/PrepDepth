export interface AuthResponse {
  token: string;
  user: { id: number; email: string };
}

export interface QueueCard {
  id: number;
  title: string;
  url: string | null;
  difficulty: "easy" | "medium" | "hard";
  patterns: string[];
  dueAt: string;
}

export interface QueueResponse {
  date: string;
  totalDue: number;
  limit: number;
  cards: QueueCard[];
}

export type Rating = 1 | 2 | 3 | 4;

export interface CardDetail {
  id: number;
  title: string;
  platform: string;
  url: string | null;
  difficulty: "easy" | "medium" | "hard";
  patterns: string[];
  notes: { approachText: string | null; keyInsight: string | null } | null;
}

export interface ReviewResponse {
  userProblemId: number;
  ease: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  dueAt: string;
}

export interface Pattern {
  id: number;
  name: string;
  description: string | null;
}

export interface AddedProblem {
  id: number;
  problemId: number;
  title: string;
  dueAt: string;
}

export interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

export interface PatternStat {
  patternId: number;
  name: string;
  cards: number;
  dueNow: number;
  mastery: number; // 0..1
  recentReviews: number; // 0 means no data yet
  lastReviewedAt: string | null;
}

export interface Overview {
  totalCards: number;
  dueNow: number;
  later: number;
  reviews7d: number;
  reviews30d: number;
  recallRate30d: number | null;
  days: { day: number; count: number }[];
}
