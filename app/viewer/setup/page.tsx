"use client";

import { useEffect, useMemo, useState } from "react";
import { loadQuestions, uniqSessions } from "@/lib/questions";
import { useRouter } from "next/navigation";

export default function ViewerSetup() {
  const router = useRouter();
  const [level, setLevel] = useState<1 | 2>(1);
  const [questions, setQuestions] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState<string>("");

  const [mode, setMode] = useState<"single" | "all">("single");
  const [showAnswer, setShowAnswer] = useState<"always" | "toggle">("toggle");

  useEffect(() => {
    loadQuestions()
      .then((qs) => setQuestions(qs))
      .catch((e) => alert(e.message));
  }, []);

  const sessions = useMemo(() => uniqSessions(questions as any, level), [questions, level]);

  useEffect(() => {
    if (sessions.length > 0) setSessionId(sessions[0]);
  }, [sessions]);

  const go = () => {
    if (!sessionId) return alert("회차를 선택하세요");
    router.push(
      `/viewer?level=${level}&sessionId=${encodeURIComponent(sessionId)}&mode=${mode}&showAnswer=${showAnswer}`
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-xl mx-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">문제보기 설정</h1>
          <button onClick={() => router.push("/")} className="text-sm underline">
            홈
          </button>
        </div>

        <div className="bg-white border rounded-2xl shadow p-5 space-y-4">
          <div className="space-y-2">
            <div className="text-sm text-gray-600">급수</div>
            <div className="flex gap-2">
              <button className={`px-4 py-2 rounded-xl border ${level === 1 ? "bg-black text-white" : ""}`} onClick={() => setLevel(1)}>1급</button>
              <button className={`px-4 py-2 rounded-xl border ${level === 2 ? "bg-black text-white" : ""}`} onClick={() => setLevel(2)}>2급</button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm text-gray-600">회차</div>
            <select className="w-full border rounded-xl px-3 py-2" value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
              {sessions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <div className="text-sm text-gray-600">보기 방식</div>
            <div className="flex gap-2">
              <button className={`px-4 py-2 rounded-xl border ${mode === "single" ? "bg-black text-white" : ""}`} onClick={() => setMode("single")}>한 문제씩</button>
              <button className={`px-4 py-2 rounded-xl border ${mode === "all" ? "bg-black text-white" : ""}`} onClick={() => setMode("all")}>전체 보기</button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm text-gray-600">정답 표시</div>
            <div className="flex gap-2">
              <button className={`px-4 py-2 rounded-xl border ${showAnswer === "toggle" ? "bg-black text-white" : ""}`} onClick={() => setShowAnswer("toggle")}>토글</button>
              <button className={`px-4 py-2 rounded-xl border ${showAnswer === "always" ? "bg-black text-white" : ""}`} onClick={() => setShowAnswer("always")}>항상 표시</button>
            </div>
          </div>

          <button onClick={go} className="w-full bg-blue-600 text-white py-3 rounded-2xl">
            문제보기
          </button>
        </div>
      </div>
    </div>
  );
}
