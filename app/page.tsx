import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center">
      <div className="max-w-3xl w-full mx-auto p-6 space-y-6">
        <div>
          <div className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full bg-white border">
            AI POT (프롬프트엔지니어링) 고정
          </div>
          <h1 className="text-3xl font-bold mt-3">AI POT CBT</h1>
          <p className="text-gray-600 mt-1">문제/해설은 PDF 캡처 이미지로 진행</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Link
            href="/practice/setup"
            className="bg-white rounded-2xl shadow p-6 border hover:shadow-md transition"
          >
            <div className="text-2xl">📝</div>
            <div className="text-xl font-semibold mt-2">문제풀기</div>
            <div className="text-sm text-gray-600 mt-1">
              보기 클릭 즉시 정오답 확인 + 해설 보기
            </div>
          </Link>

          <Link
            href="/viewer/setup"
            className="bg-white rounded-2xl shadow p-6 border hover:shadow-md transition"
          >
            <div className="text-2xl">📚</div>
            <div className="text-xl font-semibold mt-2">문제보기</div>
            <div className="text-sm text-gray-600 mt-1">
              한 문제씩 / 전체보기 (정답 표시 옵션)
            </div>
          </Link>
        </div>

        <Link href="/wrong" className="text-sm underline text-gray-700">
          오답노트 보기 →
        </Link>
      </div>
    </div>
  );
}
