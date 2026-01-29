"use client";

import { useEffect, useMemo, useState } from "react";
import { loadQuestions, Question, shuffle } from "@/lib/questions";
import { addWrong, getWrongMap } from "@/lib/wrongNotes";
import { useSearchParams, useRouter } from "next/navigation";

const CHOICES = ["①", "②", "③", "④"];
const NOTICE_QUESTION_ID = "1급-B형-샘플_37번";
const NOTICE_TEXT = "한글 또는 영어 중 하나의 답만 입력해 주세요.";

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
  type?: "choice" | "subjective" | "free";
  answers?: string[]; // ???????? ?????  inputs?: string[];
  explainText?: string;
};

const getQuestionNumber = (id?: string) => {
  const match = /_(\d+)번/.exec(id ?? "");
  return match ? Number(match[1]) : null;
};

export default function PracticePage() {
  const sp = useSearchParams();
  const router = useRouter();

  const level = Number(sp.get("level") ?? "1") as 1 | 2;
  const sessionId = sp.get("sessionId") ?? "";
  const count = Math.max(1, Number(sp.get("count") ?? "20"));
  const mode = (sp.get("mode") ?? "single") as "single" | "mock" | "overnight";
  const sessionsParam = sp.get("sessions") ?? "";
  const selectedSessions = useMemo(() => {
    return sessionsParam
      ? sessionsParam.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
  }, [sessionsParam]);
  const isSampleSession = mode === "single" && sessionId.includes("샘플");
  const seenKey = useMemo(
    () => (mode === "single" && sessionId ? `seen:${sessionId}` : ""),
    [mode, sessionId]
  );

  const [pool, setPool] = useState<QuestionExt[]>([]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [maxScore, setMaxScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [wrongMap, setWrongMap] = useState<Record<string, { isActive: boolean }>>({});

  // 공통 상태
  const [revealed, setRevealed] = useState(false);
  const [showExplain, setShowExplain] = useState(false);

  // 객관식 상태
  const [selectedChoices, setSelectedChoices] = useState<number[]>([]);

  // 주관식 상태
  const [textAnswer, setTextAnswer] = useState("");
  const [subjectiveCorrect, setSubjectiveCorrect] = useState<boolean | null>(null);
  const [freeSubmitted, setFreeSubmitted] = useState(false);
  const [groupInputs, setGroupInputs] = useState<Record<number, string>>({});
  const [groupResults, setGroupResults] = useState<Record<number, boolean> | null>(null);

  useEffect(() => {
    loadQuestions()
      .then((qs) => {
        let filtered: QuestionExt[] = [];
        if (mode === "mock") {
          filtered = (qs as QuestionExt[]).filter(
            (q) => q.level === level && selectedSessions.includes(q.sessionId)
          );
          if (level === 1) {
            const choices = filtered.filter((q) => q.type !== "subjective");
            const subjectives = filtered.filter((q) => q.type === "subjective");
            const picked = [
              ...shuffle(choices).slice(0, Math.min(35, choices.length)),
              ...shuffle(subjectives).slice(0, Math.min(5, subjectives.length)),
            ];
            setPool(shuffle(picked));
            setIdx(0);
            setScore(0);
            setMaxScore(0);
            setCorrectCount(0);
            setFinished(false);
            return;
          }
        } else if (mode === "overnight") {
          filtered = (qs as QuestionExt[]).filter(
            (q) => selectedSessions.includes(q.sessionId)
          );
        } else {
          filtered = (qs as QuestionExt[]).filter(
            (q) => q.level === level && q.sessionId === sessionId
          );
        }
        let picked = shuffle(filtered).slice(0, Math.min(count, filtered.length));
        if (mode === "single") {
          let seenSet = new Set<string>();
          if (seenKey) {
            try {
              const raw = localStorage.getItem(seenKey);
              const arr = raw ? JSON.parse(raw) : [];
              if (Array.isArray(arr)) arr.forEach((id) => seenSet.add(String(id)));
            } catch {}
          }
          const groups = new Map<string, QuestionExt[]>();
          filtered.forEach((item) => {
            const key = item.questionImage ?? item.id;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(item);
          });
          let groupKeys = Array.from(groups.keys()).filter((key) => {
            const items = groups.get(key) ?? [];
            return !items.every((item) => seenSet.has(item.id));
          });
          if (groupKeys.length === 0) {
            seenSet = new Set<string>();
            groupKeys = Array.from(groups.keys());
          }
          const shuffledKeys = shuffle(groupKeys);
          picked = shuffledKeys.flatMap((key) => {
            const items = groups.get(key) ?? [];
            return items.sort((a, b) => (getQuestionNumber(a.id) ?? 0) - (getQuestionNumber(b.id) ?? 0));
          });
          if (seenKey) {
            try {
              picked.forEach((item) => seenSet.add(item.id));
              localStorage.setItem(seenKey, JSON.stringify(Array.from(seenSet)));
            } catch {}
          }
        }
        const max = picked.reduce((sum, q) => {
          if (mode === "overnight" || mode === "mock") return sum;
          if (level === 1) return sum + (q.type === "subjective" ? 4 : 1);
          const weight = getYearPoint(q, level);
          return sum + weight;
        }, 0);
        setPool(picked);
        setIdx(0);
        setScore(0);
        setMaxScore(max);
        setCorrectCount(0);
        setFinished(false);
      })
      .catch((e) => alert(e.message));
  }, [level, sessionId, count, mode, selectedSessions]);

  useEffect(() => {
    setWrongMap(getWrongMap());
  }, [idx, sessionId, mode]);

  const q = pool[idx];
  const total = pool.length;
  const isWrongNote = q ? !!wrongMap[q.id]?.isActive : false;
  const noticeText = q?.id === NOTICE_QUESTION_ID ? NOTICE_TEXT : null;
  const groupInfo = useMemo(() => {
    if (!q?.questionImage) return { isGroup: false, items: [] as QuestionExt[], indices: [] as number[] };
    const match = /_(\d+)~(\d+)번/.exec(q.questionImage);
    if (!match) return { isGroup: false, items: [] as QuestionExt[], indices: [] as number[] };
    const start = Number(match[1]);
    const end = Number(match[2]);
    const items = pool
      .filter(
        (item) =>
          item.sessionId === q.sessionId &&
          item.questionImage === q.questionImage &&
          (() => {
            const num = getQuestionNumber(item.id);
            return num !== null && num >= start && num <= end;
          })()
      )
      .sort((a, b) => (getQuestionNumber(a.id) ?? 0) - (getQuestionNumber(b.id) ?? 0));
    const indices = items
      .map((item) => pool.indexOf(item))
      .filter((i) => i >= 0)
      .sort((a, b) => a - b);
    return { isGroup: items.length > 1, items, indices, start, end };
  }, [q, pool]);


  const handleHome = () => {
    const ok = window.confirm("문제를 풀다가 홈 버튼을 눌렀을 때 나가면 초기화되는데 괜찮으십니까?");
    if (!ok) return;
    try {
      if (seenKey) localStorage.removeItem(seenKey);
    } catch {}
    router.push("/");
  };

  const resetForNext = () => {
    setSelectedChoices([]);
    setRevealed(false);
    setShowExplain(false);

    setTextAnswer("");
    setSubjectiveCorrect(null);
    setFreeSubmitted(false);
    setGroupInputs({});
    setGroupResults(null);
  };

  const next = () => {
    if (idx + 1 >= total) {
      if (mode === "mock" || mode === "overnight") {
        setFinished(true);
        return;
      }
      if (isSampleSession) {
        setFinished(true);
        return;
      }
      router.push("/wrong");
      return;
    }
    if (groupInfo.isGroup && groupInfo.indices.length > 0) {
      const maxIndex = groupInfo.indices[groupInfo.indices.length - 1];
      const nextIndex = Math.min(maxIndex + 1, total - 1);
      setIdx(nextIndex);
      resetForNext();
      return;
    }
    setIdx((v) => v + 1);
    resetForNext();
  };

  const getYearPoint = (question: QuestionExt, lvl: 1 | 2) => {
    if (lvl === 1) return question.type === "subjective" ? 4 : 1;
    const level2OnePoints: Record<string, Set<number>> = {
      "제2401회_2급": new Set([1, 3, 4, 5, 6, 11, 13, 14, 22, 25, 26, 33, 34, 35, 41, 44, 50, 56]),
      "제2402회_2급": new Set([1, 3, 6, 7, 9, 12, 14, 15, 17, 18, 20, 26, 28, 36, 43, 45, 46, 51, 52]),
      "제2501회_2급": new Set([1, 2, 8, 10, 13, 15, 17, 19, 22, 26, 32, 38, 43, 44, 46, 48, 49, 53]),
      "제2502회_2급": new Set([1, 2, 6, 9, 12, 16, 20, 22, 27, 31, 35, 39, 42, 48, 49, 52, 53, 55, 56, 58]),
    };
    const match = /_(\d+)번/.exec(question.id ?? "");
    const number = match ? Number(match[1]) : null;
    const onePointSet = level2OnePoints[question.sessionId];
    if (!onePointSet || !number) return 1;
    return onePointSet.has(number) ? 1 : 2;
  };

  const addScoreIfNeeded = (question: QuestionExt, isCorrect: boolean) => {
    if (mode === "mock" || mode === "overnight") {
      if (isCorrect) setCorrectCount((s) => s + 1);
      return;
    }
    if (isSampleSession) {
      if (isCorrect) setCorrectCount((s) => s + 1);
      return;
    }
    if (!isCorrect) return;
    const point = getYearPoint(question, level);
    setScore((s) => s + point);
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
      addScoreIfNeeded(q, isCorrect);
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
      addScoreIfNeeded(q, isCorrect);
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
    addScoreIfNeeded(q, ok);
  };

  const submitGroupSubjective = () => {
    if (!groupInfo.isGroup || revealed) return;
    const results: Record<number, boolean> = {};
    groupInfo.items.forEach((item) => {
      const num = getQuestionNumber(item.id);
      if (num === null) return;
      const answers = Array.isArray(item.answers) ? item.answers : [];
      const ok = gradeSubjective(groupInputs[num] ?? "", answers);
      results[num] = ok;
      if (!ok) addWrong(item.id);
      addScoreIfNeeded(item, ok);
    });
    setGroupResults(results);
    setRevealed(true);
  };
  // type이 없으면 기본은 객관식으로 처리
  const qType: "choice" | "subjective" | "free" =
    q?.type === "subjective" ? "subjective" : q?.type === "free" ? "free" : "choice";

  if (!sessionId && mode === "single") {
    return (
      <div className="p-6">
        sessionId가 없어요.{" "}
        <a className="underline" href="/practice/setup">
          설정으로
        </a>
      </div>
    );
  }

  if (finished && isSampleSession) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white border rounded-2xl p-6 space-y-3">
            <div className="text-sm text-gray-600">{sessionId} · 샘플문제 · {total}문항</div>
            <div className="text-2xl font-bold">
              맞은 개수 {correctCount} / {total}
            </div>
            <div className="text-xs text-gray-500">샘플문제라 점수 부여가 되어 있지 않습니다.</div>
            <button onClick={handleHome} className="mt-2 underline text-sm">
              홈으로
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (finished && (mode === "mock" || mode === "overnight")) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white border rounded-2xl p-6 space-y-3">
            <div className="text-sm text-gray-600">
              {mode === "mock" ? `${level}급 모의고사` : "밤샘문풀"} · {total}문항
            </div>
            <div className="text-2xl font-bold">
              맞은 개수 {correctCount} / {total}
            </div>
            <button onClick={handleHome} className="mt-2 underline text-sm">
              홈으로
            </button>
          </div>
        </div>
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

  if (qType === "free") {
    const inputLabels = Array.isArray(q.inputs) && q.inputs.length > 0 ? q.inputs : ["답안"];
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {(mode === "mock" ? "모의고사" : mode === "overnight" ? "밤샘문풀" : sessionId)} · {level}급 ·{" "}
              {idx + 1}/{total}
            </div>
            {isWrongNote && (
              <div className="text-xs text-red-700 font-semibold bg-red-100 px-2 py-0.5 rounded-full">
                ★ 틀렸던 문제
              </div>
            )}
            <button onClick={handleHome} className="text-sm underline">
              홈
            </button>
          </div>

          <div className="bg-white border rounded-2xl shadow p-4 space-y-4">
            <img src={q.questionImage} alt="question" className="w-full rounded-xl border" />
            {noticeText && <div className="text-xs text-gray-600">{noticeText}</div>}

            <div className="space-y-2">
              {inputLabels.map((label, i) => (
                <div key={i} className="space-y-1">
                  <div className="text-sm text-gray-600">{label}</div>
                  <input className="w-full border rounded-xl p-3" />
                </div>
              ))}
            </div>

            <div className="flex gap-2 items-center">
              {!freeSubmitted ? (
                <button
                  onClick={() => setFreeSubmitted(true)}
                  className="bg-blue-600 text-white rounded-xl px-4 py-2"
                >
                  채점
                </button>
              ) : (
                q.explainImage && (
                  <button
                    onClick={() => setShowExplain((v) => !v)}
                    className="border rounded-xl px-4 py-2"
                  >
                    {showExplain ? "해설 닫기" : "해설 보기"}
                  </button>
                )
              )}
              <button
                onClick={next}
                className="ml-auto bg-blue-600 text-white rounded-xl px-4 py-2"
              >
                {idx + 1 >= total ? "끝내기" : "다음"}
              </button>
            </div>
            <div className="text-xs text-gray-500">서술형은 채점이 되지 않습니다.</div>

            {showExplain && q.explainImage && (
              <div className="pt-2">
                <img src={q.explainImage} alt="explanation" className="w-full rounded-xl border" />
              </div>
            )}
            <div className="text-xs text-gray-500">진행: {idx + 1}/{total}</div>
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
            {isWrongNote && (
              <div className="text-xs text-red-700 font-semibold bg-red-100 px-2 py-0.5 rounded-full">
                ★ 틀렸던 문제
              </div>
            )}
            <button onClick={handleHome} className="text-sm underline">
              홈
            </button>
          </div>

          <div className="bg-white border rounded-2xl shadow p-4 space-y-4">
            <img src={q.questionImage} alt="question" className="w-full rounded-xl border" />
            {noticeText && <div className="text-xs text-gray-600">{noticeText}</div>}

            {groupInfo.isGroup ? (
              <div className="space-y-3">
                {groupInfo.items.map((item) => {
                  const num = getQuestionNumber(item.id);
                  if (num === null) return null;
                  const isCorrect = groupResults ? groupResults[num] : null;
                  return (
                    <div key={item.id} className="space-y-1">
                      <div className="text-sm text-gray-600">{num}. 입력</div>
                      <input
                        value={groupInputs[num] ?? ""}
                        onChange={(e) =>
                          setGroupInputs((prev) => ({ ...prev, [num]: e.target.value }))
                        }
                        placeholder="답을 입력하세요"
                        className="w-full border rounded-xl p-3"
                        disabled={revealed}
                      />
                      {isCorrect !== null && (
                        <div className="text-xs space-y-1">
                          <div>{isCorrect ? "✅ 정답" : "❌ 오답"}</div>
                          {Array.isArray(item.answers) && item.answers.length > 0 && (
                            <div className="text-gray-600">
                              정답: {item.answers.join(" / ")}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div className="text-xs text-gray-500">
                  * 대소문자/공백 차이는 무시하고 채점합니다.
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-sm text-gray-600">
                  {(() => {
                    const match = /_(\d+)번/.exec(q.id ?? "");
                    return match ? `${match[1]}. 입력` : "답안 입력";
                  })()}
                </div>
                <input
                  value={textAnswer}
                  onChange={(e) => setTextAnswer(e.target.value)}
                  placeholder="답을 입력하세요"
                  className="w-full border rounded-xl p-3"
                  disabled={revealed}
                />
                <div className="text-xs text-gray-500">
                  * 대소문자/공백 차이는 무시하고 채점합니다.
                </div>
              </div>
            )}

            {!revealed ? (
              <button
                onClick={groupInfo.isGroup ? submitGroupSubjective : submitSubjective}
                className="bg-blue-600 text-white rounded-xl px-4 py-2"
                disabled={
                  groupInfo.isGroup
                    ? groupInfo.items.some(
                        (item) => {
                          const num = getQuestionNumber(item.id);
                          return num !== null && !(groupInputs[num] ?? "").trim();
                        }
                      )
                    : !textAnswer.trim()
                }
                title={
                  groupInfo.isGroup ? "답을 입력하세요" : !textAnswer.trim() ? "답을 입력하세요" : ""
                }
              >
                제출
              </button>
            ) : (
              !groupInfo.isGroup && (
                <div className="text-sm space-y-1">
                  <div>{subjectiveCorrect ? "✅ 정답" : "❌ 오답"}</div>
                  {Array.isArray(q.answers) && q.answers.length > 0 && (
                    <div className="text-xs text-gray-600">
                      정답: {q.answers.join(" / ")}
                    </div>
                  )}
                </div>
              )
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
              {!q.explainImage && q.explainText && revealed && (
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
            {showExplain && !q.explainImage && q.explainText && (
              <div className="pt-2 text-base text-black leading-relaxed whitespace-pre-line space-y-1">
                <div className="font-semibold">
                  [?뺣떟] {
                    Array.isArray(q.answers) && q.answers.length > 0
                      ? q.answers.join(" / ")
                      : "?뺣떟 ?뺣낫 ?놁뼱??"
                  }
                </div>
                <div>[?댁꽕] {q.explainText}</div>
              </div>
            )}
            <div className="text-xs text-gray-500">진행: {idx + 1}/{total}</div>
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
          {isWrongNote && (
              <div className="text-xs text-red-700 font-semibold bg-red-100 px-2 py-0.5 rounded-full">
                ★ 틀렸던 문제
              </div>
          )}
          <button onClick={handleHome} className="text-sm underline">
            홈
          </button>
        </div>

        <div className="bg-white border rounded-2xl shadow p-4 space-y-4">
          <img src={q.questionImage} alt="question" className="w-full rounded-xl border" />
          {noticeText && <div className="text-xs text-gray-600">{noticeText}</div>}

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
            {revealed && (q.explainImage || q.explainText || (groupInfo.isGroup && groupInfo.items.some((item) => item.explainText))) && (
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
          {showExplain && !q.explainImage && q.explainText && (
            <div className="pt-2 text-base text-black leading-relaxed whitespace-pre-line space-y-1">
              <div className="font-semibold">
                [정답] {(() => {
                  const answerIndexes =
                    Array.isArray(q.answerIndexes) && q.answerIndexes.length > 0
                      ? q.answerIndexes
                      : [q.answerIndex];
                  const labels = answerIndexes.map((i) => CHOICES[i]).join(", ");
                  return labels;
                })()}번
              </div>
              <div>[해설] {q.explainText}</div>
            </div>
          )}
          {showExplain && !q.explainImage && !q.explainText && !groupInfo.isGroup && (
            <div className="pt-2 text-base text-black">[해설] 준비 중입니다.</div>
          )}
          {showExplain && groupInfo.isGroup && !q.explainImage && (
            <div className="pt-2 text-base text-black leading-relaxed whitespace-pre-line space-y-2">
              {groupInfo.items.map((item) => {
                if (!item.explainText) return null;
                const num = getQuestionNumber(item.id);
                return (
                  <div key={item.id}>
                    <div className="font-semibold">
                      [정답] {(() => {
                        const answerIndexes =
                          Array.isArray(item.answerIndexes) && item.answerIndexes.length > 0
                            ? item.answerIndexes
                            : [item.answerIndex];
                        const labels = answerIndexes.map((i) => CHOICES[i]).join(", ");
                        return labels;
                      })()}번
                      {num ? ` (${num}번)` : ""}
                    </div>
                    <div>[해설] {item.explainText}</div>
                  </div>
                );
              })}
            </div>
          )}
                    <div className="text-xs text-gray-500">진행: {idx + 1}/{total}</div>
        </div>
      </div>
    </div>
  );
}
