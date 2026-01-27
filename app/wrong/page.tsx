"use client";

import { useEffect, useMemo, useState } from "react";
import { loadQuestions, Question } from "@/lib/questions";
import { clearWrongNotes, getWrongMap, removeWrong } from "@/lib/wrongNotes";
import Link from "next/link";

export default function WrongPage() {
  const [all, setAll] = useState<Question[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    loadQuestions().then(setAll).catch((e) => alert(e.message));
  }, []);

  const wrongActiveIds = useMemo(() => {
    const map = getWrongMap();
    return Object.entries(map)
      .filter(([, v]) => v.isActive)
      .sort((a, b) => (b[1].lastWrongAt - a[1].lastWrongAt))
      .map(([id]) => id);
  }, [tick]);

  const wrongQuestions = useMemo(() => {
    const m = new Map(all.map((q) => [q.id, q]));
    return wrongActiveIds.map((id) => m.get(id)).filter(Boolean) as Question[];
  }, [all, wrongActiveIds]);

  const remove = (id: string) => {
    removeWrong(id);
    setTick((v) => v + 1);
  };

  const clearAll = () => {
    if (!confirm("오답노트를 모두 초기화할까요?")) return;
    clearWrongNotes();
    setTick((v) => v + 1);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">오답노트</h1>
          <div className="flex items-center gap-3">
            <button onClick={clearAll} className="text-sm underline">
              초기화
            </button>
            <Link className="text-sm underline" href="/">홈</Link>
          </div>
        </div>

        {wrongQuestions.length === 0 ? (
          <div className="bg-white border rounded-2xl p-6">
            <div className="font-semibold">오답노트가 비어있어요.</div>
            <div className="text-sm text-gray-600 mt-1">
              문제풀기에서 틀린 문제는 자동으로 여기에 쌓입니다.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {wrongQuestions.map((q) => (
              <div key={q.id} className="bg-white border rounded-2xl p-4 shadow">
                <div className="text-sm text-gray-600 mb-2">
                  {q.sessionId} · {q.level}급 · {q.id}
                </div>
                <img src={q.questionImage} alt="q" className="w-full rounded-xl border" />

                <div className="flex gap-2 mt-3">
                  <Link
                    href={`/practice?level=${q.level}&sessionId=${encodeURIComponent(q.sessionId)}&count=1&focusId=${encodeURIComponent(q.id)}`}
                    className="bg-blue-600 text-white px-4 py-2 rounded-xl"
                  >
                    다시 풀기
                  </Link>
                  <button
                    onClick={() => remove(q.id)}
                    className="border px-4 py-2 rounded-xl"
                  >
                    오답노트에서 제거
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-xs text-gray-500">
          * 오답노트는 브라우저(localStorage)에 저장됩니다.
        </div>
      </div>
    </div>
  );
}
