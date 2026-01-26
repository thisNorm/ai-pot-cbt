"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { uploadQuestionImage } from "@/lib/uploadImage";

export default function AdminPage() {
  const [level, setLevel] = useState<1 | 2>(1);
  const [sessionId, setSessionId] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [choices, setChoices] = useState<string[]>(["", "", "", ""]);
  const [answerIndex, setAnswerIndex] = useState<number>(0);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChoiceChange = (idx: number, value: string) => {
    const next = [...choices];
    next[idx] = value;
    setChoices(next);
  };

  const validate = () => {
    if (!sessionId.trim()) return "회차(session_id)를 입력하세요 (예: 2025-03-08)";
    if (!questionText.trim()) return "문제 내용을 입력하세요";
    if (choices.some((c) => !c.trim())) return "보기 4개를 모두 입력하세요";
    if (answerIndex < 0 || answerIndex > 3) return "정답 선택이 올바르지 않습니다";
    return null;
  };

  const reset = () => {
    setQuestionText("");
    setChoices(["", "", "", ""]);
    setAnswerIndex(0);
    setImageFile(null);
    setExplanation("");
  };

  const handleSubmit = async () => {
    const errMsg = validate();
    if (errMsg) {
      alert(errMsg);
      return;
    }

    try {
      setLoading(true);

      let imageUrl: string | null = null;
      if (imageFile) {
        imageUrl = await uploadQuestionImage(imageFile);
      }

      const payload = {
        level,
        session_id: sessionId.trim(),
        question_text: questionText.trim(),
        image_url: imageUrl,
        choices,
        answer_index: answerIndex,
        explanation: explanation.trim() || null,
      };

      const { error } = await supabase.from("questions").insert(payload);
      if (error) throw error;

      alert("✅ 문제 저장 완료");
      reset();
    } catch (e: any) {
      console.error(e);
      alert(`❌ 저장 실패: ${e.message ?? "unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-bold">AI POT CBT - 문제 입력(Admin)</h1>
          <span className="text-sm text-gray-500">종목 고정: 프롬프트엔지니어링</span>
        </div>

        <div className="bg-white rounded-2xl shadow p-5 space-y-4">
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2">
              <span className="text-sm text-gray-600">급수</span>
              <select
                value={level}
                onChange={(e) => setLevel(Number(e.target.value) as 1 | 2)}
                className="border rounded-lg px-3 py-2"
              >
                <option value={1}>1급</option>
                <option value={2}>2급</option>
              </select>
            </label>

            <label className="flex items-center gap-2">
              <span className="text-sm text-gray-600">회차</span>
              <input
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                placeholder="예: 2025-03-08"
                className="border rounded-lg px-3 py-2 w-56"
              />
            </label>
          </div>

          <div>
            <div className="text-sm text-gray-600 mb-2">문제</div>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="문제 내용을 입력하세요"
              className="w-full border rounded-xl p-3"
              rows={4}
            />
          </div>

          <div>
            <div className="text-sm text-gray-600 mb-2">문제 이미지(선택)</div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            />
            {imageFile && (
              <div className="text-xs text-gray-500 mt-1">선택됨: {imageFile.name}</div>
            )}
          </div>

          <div>
            <div className="text-sm text-gray-600 mb-2">보기 + 정답 선택</div>
            <div className="space-y-2">
              {choices.map((c, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="radio"
                    name="answer"
                    checked={answerIndex === idx}
                    onChange={() => setAnswerIndex(idx)}
                  />
                  <input
                    value={c}
                    onChange={(e) => handleChoiceChange(idx, e.target.value)}
                    placeholder={`보기 ${idx + 1}`}
                    className="border rounded-lg px-3 py-2 w-full"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm text-gray-600 mb-2">해설(선택)</div>
            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="해설을 입력해도 되고, 오늘은 비워도 됨"
              className="w-full border rounded-xl p-3"
              rows={3}
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl disabled:opacity-60"
            >
              {loading ? "저장 중..." : "문제 저장"}
            </button>
            <button
              onClick={reset}
              type="button"
              className="border px-4 py-2 rounded-xl"
            >
              초기화
            </button>
          </div>
        </div>

        <div className="text-xs text-gray-500">
          * `/admin` 은 오늘 MVP라 인증 없이 열리게 해둠. 배포/공개 전엔 막자.
        </div>
      </div>
    </div>
  );
}
