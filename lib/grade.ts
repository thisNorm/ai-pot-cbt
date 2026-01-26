export function normalizeText(s: string) {
  return s
    .trim()
    .toLowerCase()
    // 공백 제거
    .replace(/\s+/g, "")
    // 구두점/기호 제거
    .replace(/[.,/#!$%^&*;:{}=\-_`~()'"[\]\\|<>?]/g, "");
}

export function gradeSubjective(input: string, answers: string[]) {
  const x = normalizeText(input);
  return answers.some((a) => normalizeText(a) === x);
}
