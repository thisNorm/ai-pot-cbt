"use client";

import { useEffect, useState } from "react";
import { loadQuestions, Question, shuffle } from "@/lib/questions";
import { addWrong } from "@/lib/wrongNotes";
import { useSearchParams, useRouter } from "next/navigation";

const CHOICES = ["①", "②", "③", "④"];

// ---- 주관식 자동채점용: 입력/정답 정규화 ----
function normalizeText(s: string) {
  return (
    s
      .trim()
      .toLowerCase()
      // 공백 전부 제거 (주관식에서 띄어쓰기 차이 방지)
      .replace(/\s+/g, "")
      // 흔한 특수문자 제거 (콤마/괄호/따옴표 등)
      .replace(/[.,/#!$%^&*;:{}=\-_`~()'"[\]\\|<>?]/g, "")
  );
}

function gradeSubjective(input: string, answers: string[]) {
  const x = normalizeText(input);
  if (!x) return false;
  return answers.some((a) => normalizeText(a) === x);
}

// Question 타입 확장(로컬 JSON에서 type/answers 들어올 수 있음)
type QuestionExt = Question & {
  type?: "choice" | "subjective";
  answers?: string[]; // 주관식 정답 후보들
};

export default function PracticePage() {
  const sp = useSearchParams();
  const router = useRouter();

  const level = Number(sp.get("level") ?? "1") as 1 | 2;
  const sessionId = sp.get("sessionId") ?? "";
  const count = Math.max(1, Number(sp.get("count") ?? "20"));
  const mode = (sp.get("mode") ?? "single") as "single" | "mock";
  const sessionsParam = sp.get("sessions") ?? "";
  const selectedSessions = sessionsParam
    ? sessionsParam.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const [pool, setPool] = useState<QuestionExt[]>([]);
  const [idx, setIdx] = useState(0);

  // 공통 상태
  const [revealed, setRevealed] = useState(false);
  const [showExplain, setShowExplain] = useState(false);

  // 객관식 상태
  const [selectedChoices, setSelectedChoices] = useState<number[]>([]);

  // 주관식 상태
  const [textAnswer, setTextAnswer] = useState("");
  const [subjectiveCorrect, setSubjectiveCorrect] = useState<boolean | null>(null);

  useEffect(() => {
    loadQuestions()
      .then((qs) => {
        let filtered: QuestionExt[] = [];
        if (mode === "mock") {
          filtered = (qs as QuestionExt[]).filter(
            (q) => selectedSessions.includes(q.sessionId)
          );
        } else {
          filtered = (qs as QuestionExt[]).filter(
            (q) => q.level === level && q.sessionId === sessionId
          );
        }
        const picked = shuffle(filtered).slice(0, Math.min(count, filtered.length));
        setPool(picked);
        setIdx(0);
      })
      .catch((e) => alert(e.message));
  }, [level, sessionId, count, mode, selectedSessions]);

  const q = pool[idx];
  const total = pool.length;

  const resetForNext = () => {
    setSelectedChoices([]);
    setRevealed(false);
    setShowExplain(false);

    setTextAnswer("");
    setSubjectiveCorrect(null);
  };

  const next = () => {
    if (idx + 1 >= total) {
      router.push("/wrong");
      return;
    }
    setIdx((v) => v + 1);
    resetForNext();
  };

  // ---------------- 객관식 ----------------
  const selectChoice = (choiceIdx: number) => {
    if (!q) return;
    if (revealed) return;

    const answerIndexes = Array.isArray(q.answerIndexes) ? q.answerIndexes : null;
    const requiredCount = q.selectCount ?? (answerIndexes ? answerIndexes.length : 1);
    const isMulti = answerIndexes && requiredCount > 1;

    if (!isMulti) {
      setSelectedChoices([choiceIdx]);
      setRevealed(true);

      const isCorrect = choiceIdx === q.answerIndex;
      if (!isCorrect) addWrong(q.id);
      return;
    }

    const alreadySelected = selectedChoices.includes(choiceIdx);
    const next = alreadySelected
      ? selectedChoices.filter((v) => v !== choiceIdx)
      : [...selectedChoices, choiceIdx];

    if (next.length > requiredCount) return;

    setSelectedChoices(next);

    if (next.length === requiredCount) {
      setRevealed(true);
      const sortedNext = [...next].sort();
      const sortedAnswer = [...answerIndexes].sort();
      const isCorrect =
        sortedNext.length === sortedAnswer.length &&
        sortedNext.every((v, i) => v === sortedAnswer[i]);
      if (!isCorrect) addWrong(q.id);
    }
  };

  const choiceClass = (i: number) => {
    const answerIndexes = Array.isArray(q.answerIndexes) ? q.answerIndexes : null;
    const requiredCount = q.selectCount ?? (answerIndexes ? answerIndexes.length : 1);
    const isMulti = answerIndexes && requiredCount > 1;

    if (!revealed) {
      if (selectedChoices.includes(i)) {
        return "border rounded-xl p-3 cursor-pointer bg-blue-50 border-blue-400";
      }
      return "border rounded-xl p-3 cursor-pointer hover:bg-gray-50";
    }
    const base = "border rounded-xl p-3";
    if (isMulti && answerIndexes?.includes(i)) return `${base} border-green-500 bg-green-50`;
    if (!isMulti && i === q.answerIndex) return `${base} border-green-500 bg-green-50`;
    if (selectedChoices.includes(i)) return `${base} border-red-500 bg-red-50`;
    return `${base} opacity-70`;
  };

  // ---------------- 주관식 ----------------
  const submitSubjective = () => {
    if (!q) return;
    if (revealed) return;

    const answers = Array.isArray(q.answers) ? q.answers : [];
    const ok = gradeSubjective(textAnswer, answers);

    setSubjectiveCorrect(ok);
    setRevealed(true);

    if (!ok) addWrong(q.id);
  };

  // type이 없으면 기본은 객관식으로 처리
  const qType: "choice" | "subjective" = q?.type === "subjective" ? "subjective" : "choice";

  if (!sessionId && mode !== "mock") {
    return (
      <div className="p-6">
        sessionId가 없어요.{" "}
        <a className="underline" href="/practice/setup">
          설정으로
        </a>
      </div>
    );
  }

  if (!q) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white border rounded-2xl p-6">
            <div className="font-semibold">문제를 불러오는 중이거나, 데이터가 없어요.</div>
            <div className="text-sm text-gray-600 mt-2">
              급수={level}, 회차={sessionId}
            </div>
            <a className="underline text-sm" href="/practice/setup">
              설정으로 돌아가기
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ==========================
  // ✅ 주관식 화면
  // ==========================
  if (qType === "subjective") {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {(mode === "mock" ? "모의고사" : sessionId)} · {level}급 · {idx + 1}/{total} · 주관식
            </div>
            <button onClick={() => router.push("/")} className="text-sm underline">
              홈
            </button>
          </div>

          <div className="bg-white border rounded-2xl shadow p-4 space-y-4">
            <img src={q.questionImage} alt="question" className="w-full rounded-xl border" />

            <div className="space-y-2">
              <div className="text-sm text-gray-600">답안 입력</div>
              <input
                value={textAnswer}
                onChange={(e) => setTextAnswer(e.target.value)}
                placeholder="답을 입력하세요"
                className="w-full border rounded-xl p-3"
                disabled={revealed}
              />
              <div className="text-xs text-gray-500">
                * 대소문자/공백 차이는 무시하고 채점합니다. (예: Archive, archive 모두 정답 처리)
              </div>
            </div>

            {!revealed ? (
              <button
                onClick={submitSubjective}
                className="bg-blue-600 text-white rounded-xl px-4 py-2"
                disabled={!textAnswer.trim()}
                title={!textAnswer.trim() ? "답을 입력하세요" : ""}
              >
                제출
              </button>
            ) : (
              <div className="text-sm">
                {subjectiveCorrect ? "✅ 정답" : "❌ 오답"}
              </div>
            )}

            <div className="flex gap-2">
              {q.explainImage && revealed && (
                <button
                  onClick={() => setShowExplain((v) => !v)}
                  className="border rounded-xl px-4 py-2"
                >
                  {showExplain ? "해설 닫기" : "해설 보기"}
                </button>
              )}

              <button
                onClick={next}
                className="ml-auto bg-blue-600 text-white rounded-xl px-4 py-2"
                disabled={!revealed}
                title={!revealed ? "먼저 제출하세요" : ""}
              >
                {idx + 1 >= total ? "끝내기" : "다음"}
              </button>
            </div>

            {showExplain && q.explainImage && (
              <div className="pt-2">
                <img src={q.explainImage} alt="explanation" className="w-full rounded-xl border" />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==========================
  // ✅ 객관식 화면 (기존)
  // ==========================
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {(mode === "mock" ? "모의고사" : sessionId)} · {level}급 · {idx + 1}/{total}
          </div>
          <button onClick={() => router.push("/")} className="text-sm underline">
            홈
          </button>
        </div>

        <div className="bg-white border rounded-2xl shadow p-4 space-y-4">
          <img src={q.questionImage} alt="question" className="w-full rounded-xl border" />

          <div className="grid gap-2">
            {(() => {
              const answerIndexes = Array.isArray(q.answerIndexes) ? q.answerIndexes : null;
              const requiredCount = q.selectCount ?? (answerIndexes ? answerIndexes.length : 1);
              if (answerIndexes && requiredCount > 1) {
                return (
                  <div className="text-sm text-gray-600">
                    {requiredCount}개 선택
                  </div>
                );
              }
              return null;
            })()}
            {CHOICES.map((label, i) => (
              <div key={i} className={choiceClass(i)} onClick={() => selectChoice(i)}>
                <span className="font-semibold mr-2">{label}.</span> 선택
              </div>
            ))}
          </div>

          {revealed && (
            <div className="text-sm">
              {(() => {
                const answerIndexes = Array.isArray(q.answerIndexes) ? q.answerIndexes : null;
                const requiredCount = q.selectCount ?? (answerIndexes ? answerIndexes.length : 1);
                const isMulti = answerIndexes && requiredCount > 1;
                if (!isMulti) {
                  return selectedChoices[0] === q.answerIndex ? "✅ 정답" : "❌ 오답";
                }
                const sortedNext = [...selectedChoices].sort();
                const sortedAnswer = [...answerIndexes].sort();
                const isCorrect =
                  sortedNext.length === sortedAnswer.length &&
                  sortedNext.every((v, i) => v === sortedAnswer[i]);
                return isCorrect ? "✅ 정답" : "❌ 오답";
              })()}
            </div>
          )}

          <div className="flex gap-2">
            {q.explainImage && revealed && (
              <button
                onClick={() => setShowExplain((v) => !v)}
                className="border rounded-xl px-4 py-2"
              >
                {showExplain ? "해설 닫기" : "해설 보기"}
              </button>
            )}

            <button
              onClick={next}
              className="ml-auto bg-blue-600 text-white rounded-xl px-4 py-2"
              disabled={!revealed}
              title={!revealed ? "먼저 보기를 선택하세요" : ""}
            >
              {idx + 1 >= total ? "끝내기" : "다음"}
            </button>
          </div>

          {showExplain && q.explainImage && (
            <div className="pt-2">
              <img src={q.explainImage} alt="explanation" className="w-full rounded-xl border" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
