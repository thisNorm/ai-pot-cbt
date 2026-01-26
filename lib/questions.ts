export type Question = {
  id: string;
  level: 1 | 2;
  sessionId: string;
  questionImage: string;
  explainImage: string | null;
  answerIndex: number; // 0~3
  answerIndexes?: number[];
  selectCount?: number;
  type?: "choice" | "subjective";
  answers?: string[];
};

export async function loadQuestions(): Promise<Question[]> {
  const res = await fetch("/data/questions.json", { cache: "no-store" });
  if (!res.ok) throw new Error("questions.json 로드 실패");
  return res.json();
}

export function uniqSessions(questions: Question[], level: 1 | 2) {
  const set = new Set<string>();
  questions.forEach((q) => {
    if (q.level === level) set.add(q.sessionId);
  });
  return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
}

export function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
