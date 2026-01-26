"use client";

import { useEffect, useMemo, useState } from "react";
import { loadQuestions, Question } from "@/lib/questions";

const CHOICES = ["①", "②", "③", "④"];
import { useSearchParams } from "next/navigation";

export default function ViewerPage() {
  const sp = useSearchParams();
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

  const cur = qs[idx];

  if (!sessionId) return <div className="p-6">sessionId가 없어요.</div>;
  if (qs.length === 0) return <div className="p-6">해당 조건의 문제가 없어요.</div>;

  const AnswerBadge = ({ q }: { q: Question }) => {
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
          <div className="text-sm text-gray-600">{sessionId} · {level}급 · 전체보기</div>

          {showAnswerMode === "toggle" && (
            <button className="border rounded-xl px-4 py-2" onClick={() => setShowAnswer((v) => !v)}>
              {showAnswer ? "정답 숨기기" : "정답 보기"}
            </button>
          )}

          <div className="space-y-4">
            {qs.map((q) => (
              <div key={q.id} className="bg-white border rounded-2xl shadow p-4">
                <img src={q.questionImage} className="w-full rounded-xl border" alt="q" />
                {showAnswer && <AnswerBadge q={q} />}
                {q.explainImage && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm underline">해설 보기</summary>
                    <img src={q.explainImage} className="w-full rounded-xl border mt-2" alt="ex" />
                  </details>
                )}
              </div>
            ))}
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
          <div className="text-sm text-gray-600">{sessionId} · {level}급 · {idx+1}/{qs.length}</div>
          {showAnswerMode === "toggle" && (
            <button className="border rounded-xl px-4 py-2" onClick={() => setShowAnswer((v) => !v)}>
              {showAnswer ? "정답 숨기기" : "정답 보기"}
            </button>
          )}
        </div>

        <div className="bg-white border rounded-2xl shadow p-4">
          <img src={cur.questionImage} className="w-full rounded-xl border" alt="q" />
          {showAnswer && <AnswerBadge q={cur} />}
          {cur.explainImage && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm underline">해설 보기</summary>
              <img src={cur.explainImage} className="w-full rounded-xl border mt-2" alt="ex" />
            </details>
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
            disabled={idx + 1 >= qs.length}
            onClick={() => setIdx((v) => Math.min(qs.length - 1, v + 1))}
          >
            다음
          </button>
        </div>
      </div>
    </div>
  );
}
