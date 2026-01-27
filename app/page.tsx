import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      <div className="max-w-3xl w-full mx-auto p-6 pt-30 space-y-6 flex flex-col min-h-screen">
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

        <div className="bg-white border rounded-2xl p-5 space-y-3">
          <div className="font-semibold">사용 방법</div>
          <ol className="text-sm text-gray-700 list-decimal pl-5 space-y-1">
            <li>홈에서 문제풀기 또는 문제보기를 선택합니다.</li>
            <li>급수/회차/모드를 설정한 뒤 시작합니다.</li>
            <li>오답노트에서 틀린 문제를 확인하고 다시 풀 수 있습니다.</li>
          </ol>
        </div>

        <div className="bg-white border rounded-2xl p-5 space-y-3">
          <div className="font-semibold">현재 이용 가능한 기출 범위</div>
          <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
            <li>1급 샘플: 1급-A형-샘플(40), 1급-B형-샘플(39)</li>
            <li>2급 샘플: 2급-A형-샘플(60), 2급-B형-샘플(60)</li>
            <li>1급 회차: 제2401회_1급(85), 제2501회_1급(85)</li>
            <li>2급 회차: 제2401회_2급(60), 제2402회_2급(60), 제2501회_2급(60), 제2502회_2급(60)</li>
          </ul>
        </div>

        <div className="bg-white border rounded-2xl p-5 space-y-2">
          <div className="font-semibold">주의사항</div>
          <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
            <li>파일명/세션명이 변경되면 questions.json도 갱신해야 합니다.</li>
            <li>이미지가 많으므로 저장소 용량을 확인하세요.</li>
          </ul>
        </div>

        <div className="text-xs text-gray-500 pt-4 border-t mt-auto">
          기출문제 저작권 © 한국생산성본부(KPC) | CBT 시스템 설계·구현 © 황규범
        </div>
      </div>
    </div>
  );
}
