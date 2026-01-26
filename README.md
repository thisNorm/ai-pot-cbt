# AI POT CBT

로컬 CBT(Computer Based Test) 프로젝트입니다. 문제/해설 이미지를 기반으로
문항을 구성하고, 랜덤 출제/뷰어/오답노트 기능을 제공합니다.

## 기능
- 문제풀기(랜덤 출제, 단일 회차/모의고사)
- 문제 보기(한 문제씩/전체 보기)
- 주관식 자동 채점(공백/대소문자/일부 특수문자 무시)
- 오답노트
- 문제/해설 이미지 자동 정리 스크립트

## 실행
```bash
npm install
npm run dev
```

## 문제 데이터
- 데이터 파일: `public/data/questions.json`
- 이미지 경로:
  - 문제: `public/questions/<세트명>/...`
  - 해설: `public/explanations/<세트명>/...`

## 자동화 스크립트
문제/해설 이미지 파일명을 정리하고 `questions.json`을 생성/갱신합니다.

```bash
node scripts/rename-and-generate.js
```

옵션:
- `--subjective="24-26,30"`
- `--forceType=true`
- `--forceBFormMap=true`

## 문제풀기 설정
- **선택년도**: 단일 회차에서 랜덤 출제 (기본 문항 수 = 해당 회차 전체 문항 수)
- **모의고사**: 체크한 회차들을 합쳐 랜덤 출제 (기본 문항 수 = 체크된 회차의 총 문항 수)

## 주의사항
- `.env.local` 등 민감 정보는 커밋하지 않습니다.
- 이미지가 많으므로 저장소 용량을 확인하세요.
