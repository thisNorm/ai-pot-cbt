"use client";

import { useEffect, useMemo, useState } from "react";
import { loadQuestions, uniqSessions } from "@/lib/questions";
import { useRouter } from "next/navigation";

export default function PracticeSetup() {
  const router = useRouter();
  const [level, setLevel] = useState<1 | 2>(1);
  const [questions, setQuestions] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [mode, setMode] = useState<"single" | "mock">("single");
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [countAuto, setCountAuto] = useState(true);
  const [count, setCount] = useState<number>(20); // 원하는 만큼

  useEffect(() => {
    loadQuestions()
      .then((qs) => setQuestions(qs))
      .catch((e) => alert(e.message));
  }, []);

  const sessions = useMemo(() => uniqSessions(questions as any, level), [questions, level]);
  const allSessions = useMemo(() => {
    const map = new Map<string, number>();
    (questions as any[]).forEach((q) => {
      if (!q?.sessionId) return;
      map.set(q.sessionId, (map.get(q.sessionId) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([id, total]) => ({ id, total }));
  }, [questions]);
  const levelSessionCounts = useMemo(() => {
    const map = new Map<string, number>();
    (questions as any[]).forEach((q) => {
      if (q?.level !== level || !q?.sessionId) return;
      map.set(q.sessionId, (map.get(q.sessionId) ?? 0) + 1);
    });
    return map;
  }, [questions, level]);

  useEffect(() => {
    if (sessions.length > 0) {
      setSessionId(sessions[0]);
    }
  }, [sessions]);

  useEffect(() => {
    if (!countAuto) return;
    if (mode === "single") {
      const nextCount = levelSessionCounts.get(sessionId) ?? count;
      setCount(nextCount);
      return;
    }
    const total = selectedSessions.reduce((sum, id) => {
      const found = allSessions.find((s) => s.id === id);
      return sum + (found?.total ?? 0);
    }, 0);
    setCount(total);
  }, [mode, sessionId, selectedSessions, levelSessionCounts, allSessions, countAuto, count]);

  const start = () => {
    if (mode === "single") {
      if (!sessionId) return alert("회차를 선택하세요");
      router.push(
        `/practice?level=${level}&sessionId=${encodeURIComponent(sessionId)}&count=${count}&mode=single`
      );
      return;
    }
    if (selectedSessions.length === 0) return alert("모의고사 회차를 선택하세요");
    router.push(
      `/practice?level=${level}&sessions=${encodeURIComponent(selectedSessions.join(","))}&count=${count}&mode=mock`
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-bold">문제풀기 설정</h1>

        <div className="bg-white border rounded-2xl shadow p-5 space-y-4">
          <div className="space-y-2">
            <div className="text-sm text-gray-600">급수</div>
            <div className="flex gap-2">
              <button
                className={`px-4 py-2 rounded-xl border ${
                  mode === "single" && level === 1 ? "bg-black text-white" : "bg-white"
                }`}
                onClick={() => {
                  setLevel(1);
                  setMode("single");
                  setCountAuto(true);
                }}
              >
                1급
              </button>
              <button
                className={`px-4 py-2 rounded-xl border ${
                  mode === "single" && level === 2 ? "bg-black text-white" : "bg-white"
                }`}
                onClick={() => {
                  setLevel(2);
                  setMode("single");
                  setCountAuto(true);
                }}
              >
                2급
              </button>
              <button
                className={`px-4 py-2 rounded-xl border ${mode === "mock" ? "bg-black text-white" : "bg-white"}`}
                onClick={() => {
                  setMode("mock");
                  setCountAuto(true);
                }}
              >
                모의고사
              </button>
            </div>
          </div>

          {mode === "single" ? (
            <div className="space-y-2">
              <div className="text-sm text-gray-600">년도지정</div>
              <select
                value={sessionId}
                onChange={(e) => {
                  setSessionId(e.target.value);
                  setCountAuto(true);
                }}
                className="w-full border rounded-xl px-3 py-2"
              >
                {sessions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {sessions.length === 0 && (
                <div className="text-xs text-gray-500">해당 급수의 문제 데이터가 없어요.</div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-sm text-gray-600">모의고사 범위</div>
              <div className="border rounded-xl max-h-56 overflow-auto">
                {allSessions.map((s) => {
                  const checked = selectedSessions.includes(s.id);
                  return (
                    <label key={s.id} className="flex items-center gap-3 px-3 py-2 border-b last:border-b-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...selectedSessions, s.id]
                            : selectedSessions.filter((x) => x !== s.id);
                          setSelectedSessions(next);
                          setCountAuto(true);
                        }}
                      />
                      <span className="flex-1">{s.id}</span>
                      <span className="text-xs text-gray-500">{s.total}문항</span>
                    </label>
                  );
                })}
                {allSessions.length === 0 && (
                  <div className="text-xs text-gray-500 p-3">등록된 회차가 없어요.</div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="text-sm text-gray-600">출제 문항 수</div>
            <input
              type="number"
              min={1}
              max={200}
              value={count}
              onChange={(e) => {
                setCount(Number(e.target.value));
                setCountAuto(false);
              }}
              className="w-full border rounded-xl px-3 py-2"
            />
            <div className="text-xs text-gray-500">선택된 회차 내에서 랜덤으로 섞어서 출제</div>
          </div>

          <button
            onClick={start}
            className="w-full bg-blue-600 text-white py-3 rounded-2xl"
          >
            문제풀기
          </button>
        </div>
      </div>
    </div>
  );
}
