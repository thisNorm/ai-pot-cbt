const KEY = "ai_pot_wrong_notes_v1";

export type WrongMap = Record<
  string,
  { wrongCount: number; isActive: boolean; lastWrongAt: number }
>;

export function getWrongMap(): WrongMap {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveWrongMap(map: WrongMap) {
  localStorage.setItem(KEY, JSON.stringify(map));
}

export function addWrong(questionId: string) {
  const map = getWrongMap();
  const cur = map[questionId];
  map[questionId] = {
    wrongCount: (cur?.wrongCount ?? 0) + 1,
    isActive: true,
    lastWrongAt: Date.now(),
  };
  saveWrongMap(map);
}

export function removeWrong(questionId: string) {
  const map = getWrongMap();
  if (!map[questionId]) return;
  map[questionId].isActive = false;
  saveWrongMap(map);
}
