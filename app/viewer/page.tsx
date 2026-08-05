"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { loadQuestions, Question } from "@/lib/questions";

const CHOICES = ["①", "②", "③", "④"];
const NOTICE_QUESTION_ID = "1급-B형-샘플_37번";
const NOTICE_TEXT = "한글 또는 영어 중 하나의 답만 입력해 주세요.";
import { useSearchParams, useRouter } from "next/navigation";

function ViewerPageContent() {
  const sp = useSearchParams();
  const router = useRouter();
  const level = Number(sp.get("level") ?? "1") as 1 | 2;
  const sessionId = sp.get("sessionId") ?? "";
  const mode = (sp.get("mode") ?? "single") as "single" | "all";
  const showAnswerMode = (sp.get("showAnswer") ?? "toggle") as "always" | "toggle";

  const [qs, setQs] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(showAnswerMode === "always");

  useEffect(() => {
    loadQuestions()
      .then((all) => {
        setQs(all.filter((q) => q.level === level && q.sessionId === sessionId));
        setIdx(0);
        setShowAnswer(showAnswerMode === "always");
      })
      .catch((e) => alert(e.message));
  }, [level, sessionId, showAnswerMode]);

  const getQuestionNumber = (id?: string) => {
    const match = /_(\d+)번/.exec(id ?? "");
    return match ? Number(match[1]) : null;
  };

  const grouped = useMemo(() => {
    const map = new Map<string, Question[]>();
    qs.forEach((q) => {
      const key = q.questionImage ?? q.id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(q);
    });
    return Array.from(map.entries()).map(([key, items]) => {
      const sorted = [...items].sort(
        (a, b) => (getQuestionNumber(a.id) ?? 0) - (getQuestionNumber(b.id) ?? 0)
      );
      const numbers = sorted
        .map((q) => getQuestionNumber(q.id))
        .filter((n): n is number => n !== null);
      return { key, items: sorted, numbers };
    });
  }, [qs]);

  const curGroup = grouped[idx];

  if (!sessionId) return <div className="p-6">sessionId가 없어요.</div>;
  if (qs.length === 0) return <div className="p-6">해당 조건의 문제가 없어요.</div>;

  const AnswerBadge = ({ q }: { q: Question & { type?: string; answers?: string[] } }) => {
    if (q.type === "subjective") {
      const answers = Array.isArray(q.answers) ? q.answers : [];
      return (
        <div className="text-sm mt-2">
          정답: <span className="font-semibold">{answers.join(" / ")}</span>
        </div>
      );
    }
    if (q.type === "free") {
      return null;
    }
    const answerIndexes =
      Array.isArray(q.answerIndexes) && q.answerIndexes.length > 0
        ? q.answerIndexes
        : [q.answerIndex];
    const labels = answerIndexes.map((i) => CHOICES[i]).join(", ");
    return (
      <div className="text-sm mt-2">
        정답: <span className="font-semibold">{labels}</span>
      </div>
    );
  };

  if (mode === "all") {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">{sessionId} · {level}급 · 전체보기</div>
            <button onClick={() => router.push("/")} className="text-sm underline">
              홈
            </button>
          </div>

          {showAnswerMode === "toggle" && (
            <button className="border rounded-xl px-4 py-2" onClick={() => setShowAnswer((v) => !v)}>
              {showAnswer ? "정답 숨기기" : "정답 보기"}
            </button>
          )}

          <div className="space-y-4">
            {grouped.map((group) => {
              const first = group.items[0];
              const numberLabel =
                group.numbers.length > 1
                  ? `${group.numbers[0]}~${group.numbers[group.numbers.length - 1]}`
                  : group.numbers[0];
              return (
                <div key={group.key} className="bg-white border rounded-2xl shadow p-4">
                  <div className="text-xs text-gray-500 mb-2">{numberLabel}번</div>
                  <img src={first.questionImage} className="w-full rounded-xl border" alt="q" />
                  {group.items.some((q) => q.id === NOTICE_QUESTION_ID) && (
                    <div className="text-xs text-gray-600 mt-2">{NOTICE_TEXT}</div>
                  )}
                  {showAnswer &&
                    group.items.map((q) => (
                      <div key={q.id} className="mt-2">
                        <AnswerBadge q={q} />
                      </div>
                    ))}
                  {first.explainImage && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm underline">해설 보기</summary>
                      <img src={first.explainImage} className="w-full rounded-xl border mt-2" alt="ex" />
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // single
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {sessionId} · {level}급 · {idx + 1}/{grouped.length}
          </div>
          {showAnswerMode === "toggle" && (
            <button className="border rounded-xl px-4 py-2" onClick={() => setShowAnswer((v) => !v)}>
              {showAnswer ? "정답 숨기기" : "정답 보기"}
            </button>
          )}
          <button onClick={() => router.push("/")} className="text-sm underline">
            홈
          </button>
        </div>

        <div className="bg-white border rounded-2xl shadow p-4">
          {curGroup && (
            <>
              <div className="text-xs text-gray-500 mb-2">
                {curGroup.numbers.length > 1
                  ? `${curGroup.numbers[0]}~${curGroup.numbers[curGroup.numbers.length - 1]}`
                  : curGroup.numbers[0]}
                번
              </div>
              <img
                src={curGroup.items[0].questionImage}
                className="w-full rounded-xl border"
                alt="q"
              />
              {curGroup.items.some((q) => q.id === NOTICE_QUESTION_ID) && (
                <div className="text-xs text-gray-600 mt-2">{NOTICE_TEXT}</div>
              )}
              {showAnswer &&
                curGroup.items.map((q) => (
                  <div key={q.id} className="mt-2">
                    <AnswerBadge q={q} />
                  </div>
                ))}
              {curGroup.items[0].explainImage && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm underline">해설 보기</summary>
                  <img
                    src={curGroup.items[0].explainImage}
                    className="w-full rounded-xl border mt-2"
                    alt="ex"
                  />
                </details>
              )}
            </>
          )}
        </div>

        <div className="flex gap-2">
          <button
            className="border rounded-xl px-4 py-2 disabled:opacity-50"
            disabled={idx === 0}
            onClick={() => setIdx((v) => Math.max(0, v - 1))}
          >
            이전
          </button>
          <button
            className="ml-auto border rounded-xl px-4 py-2 disabled:opacity-50"
            disabled={idx + 1 >= grouped.length}
            onClick={() => setIdx((v) => Math.min(grouped.length - 1, v + 1))}
          >
            다음
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ViewerPage() {
  return (
    <Suspense fallback={null}>
      <ViewerPageContent />
    </Suspense>
  );
}
