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
