# CS Daily Drill

개인용 CS 학습 웹앱. 사용자는 1명(개발자 본인)이다. 매일 아침 IT/AI 소식을 훑고
CS 면접 질문을 간격 반복으로 복습한다.

## 절대 규칙

1. **Question.id는 영구 불변.** 한 번 발급된 id는 어떤 이유로도 바꾸지 않는다.
   id가 바뀌면 그 카드의 복습 이력이 끊긴다.
2. **날짜는 로컬 자정 기준.** `due`는 항상 `'YYYY-MM-DD'` 문자열로 저장하고 문자열 비교한다.
   `Date` 객체 뺄셈으로 날짜 차이를 구하지 않는다. 날짜 로직은 전부 `src/lib/date.ts`를 거친다.
3. **`src/lib/srs.ts`는 순수 함수다.** React, Dexie, `Date.now()`를 import 하지 않는다.
   오늘 날짜는 인자로 받는다.
4. **문제은행(Question)과 학습 상태(ReviewState)는 분리한다.** Question은 Git이 관리하는
   정적 JSON, ReviewState는 IndexedDB. 서로의 스키마를 섞지 않는다.
5. **뉴스 기사 본문 전문을 저장하지 않는다.** 제목·URL·출처·자체 생성 요약만 저장하고
   원문 링크를 항상 노출한다.
6. **하루 상한을 지킨다.** 복습 60장, 신규 10장. 이 숫자는 `src/lib/config.ts`의 상수로 둔다.

## 범위 밖 (요청받아도 만들지 말 것)

- 로그인, 다중 사용자, 소셜, 랭킹, 공유
- 네이티브 앱 (PWA로 대체)
- 서술형 AI 자동 채점 (Phase 4 이후)
- 관리자 화면, 권한 체계, 결제

## 스택

Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 / Dexie(IndexedDB) / Zod 4 / Vitest
배포 Vercel, 뉴스 수집 GitHub Actions cron

**뉴스 요약 LLM 은 OpenAI 다** (`openai` SDK, Responses API + Structured Outputs).
모델은 `.env` 의 `OPENAI_MODEL` 로 바꾼다. 기본값은 `gpt-5.6-luna`.
키는 `.env` 의 `OPENAI_API_KEY`, CI 에서는 저장소 시크릿 `OPENAI_API_KEY`.

Node 22 가 필요하다(`.nvmrc` 참고). 시스템 기본이 Node 20 이면 `nvm use` 후 작업한다.

## 코딩 규칙

- 모든 파일 TypeScript strict. `any` 금지.
- 외부 데이터(JSON 문제은행, RSS 응답)는 반드시 Zod로 파싱한 뒤 사용한다.
- 컴포넌트는 200줄을 넘기지 않는다. 넘으면 분리한다.
- 로직(`src/lib/*`)에는 Vitest 테스트를 함께 쓴다. UI 컴포넌트 테스트는 쓰지 않는다.
- 커밋 메시지는 한국어로, `feat:` `fix:` `chore:` 접두사를 붙인다.

## 디렉터리

```
content/questions/*.json      문제은행 (주제별 파일)
content/news/YYYY-MM-DD.json  일자별 뉴스            [Phase 2]
scripts/ingest-news.ts        뉴스 수집 스크립트      [Phase 2]
scripts/validate.ts           문제은행 검증 (build 전 자동 실행)
src/app/                      page.tsx, drill/, briefing/, exam/, stats/, manage/
src/lib/                      srs.ts queue.ts db.ts questions.ts date.ts config.ts schema.ts
src/components/
```

## 진행 상황

- **Phase 0 (완료)** — 문제은행 로드·검증, 라우트 5개 껍데기, `/manage` 목록·검색·필터
- **Phase 1 (완료)** — `srs.ts`(SM-2 변형) · `queue.ts` · `db.ts`(Dexie) · `/drill` · 홈 진행 링
- **Phase 2 (완료)** — 뉴스 수집(`scripts/ingest-news.ts`) · `/briefing` · 북마크 · 문제 초안 폼
- **Phase 3 (완료)** — `/exam` · `/stats` · `/manage` 오버레이 편집·내보내기

### Phase 1 에서 정한 것

- 등급은 `1|2|3|4` (Again/Hard/Good/Easy). 문자열이 아니라 숫자다 — 키보드 1~4 와 그대로 맞물린다.
- `schedule()` 은 grade 2~4 에서 **ease 를 먼저 조정하고 reps 를 올린다.** 순서가 바뀌면
  Easy 를 누른 그 회차의 간격이 달라진다. `srs.test.ts` 의 D0~D201 표가 이 순서를 고정한다.
- `Again` 은 due 를 `today + 1일` 로 둔다. 세션 안에서 다시 보여주는 것은 큐가 아니라 UI 가 한다
  (카드당 최대 2회 재출제).
- **하루 상한은 '오늘 이미 한 몫'을 뺀 값이다.** 평가를 마친 카드는 상태가 생겨 신규에서 빠지므로,
  그것만으로는 하루에 몇 번이든 새 카드를 꺼낼 수 있다. `buildTodayQueue` 에
  `newDoneToday`/`reviewDoneToday` 를 넘겨야 절대규칙 6 이 실제로 지켜진다.
- **총량은 60 하나다.** 복습이든 신규든 오늘 끝낸 것은 같은 총량을 쓴다. 신규 몫을 총량에서
  빼지 않으면 '신규 10 + 복습 60 = 70장' 이 되어 상한이 새어 나간다.
- **상한의 단위는 카드 장수다.** Again 으로 같은 카드를 두 번 봐도 오늘 몫은 한 장이다
  (`countDoneToday` 가 qid 로 묶어 센다).
- `updatedAt` 은 `today` 의 자정 ms 다. `srs.ts` 가 순수해야 해서 `Date.now()` 를 못 쓴다.
  실제 시각이 필요하면 `reviewLogs.reviewedAt` 을 본다.

### Phase 2 에서 정한 것

- **수집기는 어떤 실패에도 성공으로 끝난다.** 소스 어댑터마다 try/catch 를 두고, 요약 실패는
  그 기사만 `summary: []` 로 비운다. 피드 하나가 죽었다고 그날 브리핑을 통째로 잃지 않는다.
- **기사 본문은 저장하지 않는다**(절대규칙 5). `excerpt` 는 요약 모델 입력으로만 쓰고 버린다.
  저장되는 건 제목·URL·출처·발행시각·자체 요약·태그뿐이다.
- **발췌가 없으면 요약하지 않는다.** 제목만으로 3줄을 만들면 세 줄이 같은 말을 되풀이한다.
  피드가 발췌를 안 주면(Hacker News 링크 글) 원문에서 한 번 가져오고, 그것도 실패하면
  빈 요약으로 두고 화면이 원문 링크를 안내한다.
- **요약 줄 길이(40~70자)는 재시도로 지킨다.** strict 모드가 `minLength` 를 안 받아서
  스키마로 막을 수 없다. 어긴 줄을 되돌려주며 한 번만 다시 시킨다.
- **id 는 정규화한 URL 의 sha1.** 추적 파라미터(`utm_*`·`ref`·`fbclid`…)를 떼고 소문자로 눕힌 뒤
  해싱하므로, 같은 글이 다른 경로로 들어와도 한 건으로 묶인다. 최근 14일치와 대조해 중복을 버린다.
- **하루 8건, 소스별 4/3/2.** 합이 9라 총 상한에 걸리는데, 라운드로빈으로 뽑아 한 소스가
  통째로 밀려나지 않게 한다.
- **오늘 파일이 있으면 갈아엎지 않고 남은 자리만 채운다.** 하루에 두 번 돌려도 두 번째가 헛돌지 않는다.
- **브리핑 첫 페이지도 `/api/news` 로 가져온다.** 서버가 내려준 배열을 `useState` 초기값으로 쓰면,
  서버 컴포넌트가 다시 렌더될 때 컴포넌트가 재마운트되면서 스크롤로 쌓은 지난 날짜가 날아간다.
- **요약이 빈 기사는 다음 실행이 채운다.** 키 없이 수집한 날의 기사는 중복 걸러내기에 막혀
  다시 수집되지 않으므로, `refillSummaries` 가 최근 3일치의 빈 요약을 메운다.
- **요약 스키마에 개수 제약을 넣지 않는다.** Structured Outputs 의 strict 모드가 받는
  JSON Schema 는 부분집합이라 `minItems`/`maxItems` 가 거절될 수 있다. 개수는 프롬프트로
  요구하고, 받아온 뒤 자르기 + 저장 직전 `newsItemSchema` 검증으로 강제한다.
- **로그에 키를 찍지 않는다.** OpenAI 인증 실패 메시지에 부분 마스킹된 키가 담겨 오므로
  `redact()` 로 한 번 더 가린 뒤 출력한다. Actions 로그에 남기지 않기 위해서다.
- **배열 필드에 같은 값이 두 번 오면 스키마가 거부한다**(`keywords`·`choices`·`followUps`·
  `summary`·`tags`). 중복은 데이터 오류이고 화면에서 React key 충돌을 낳는다.

### Phase 3 에서 정한 것

- **복습 큐는 '밀린 카드 → 오늘 카드' 두 그룹으로 나눠 각 그룹 안에서만 섞는다.**
  통째로 섞으면 며칠 밀린 카드가 큐 끝으로 밀리고, 시험에서 틀려 앞당긴 카드도 앞에
  온다는 보장이 사라진다. Phase 1 의 '복습은 셔플' 은 그룹 안에서 유지된다.
- **시험 오답은 `due` 를 오늘로 당기고 `ease` 만 0.15 깎는다.** `interval`·`reps` 는 그대로 둔다 —
  시험은 채점이 아니라 '지금 모른다' 는 신호이고, 간격 계산의 이력은 드릴이 갖고 있다.
- **자가 채점의 '애매' 는 오답 처리 대상이 아니다.** 점수는 0.5점으로 세고 결과의 오답 목록에는
  남기지만 복습 일정은 건드리지 않는다. 애매까지 끌어오면 시험 한 번에 큐가 통째로 밀려온다.
- **문항 수정은 로컬 오버레이(IndexedDB)에만 쌓인다.** 브라우저는 `content/questions/*.json` 에
  쓸 수 없다. 화면은 'Git 문제은행 + 오버레이' 를 병합해 보여주고(같은 id 는 오버레이 우선),
  레포에 남기려면 내보내기 → 붙여넣기 → `npm run validate` → 커밋을 사람이 해야 한다.
- **문항을 쓰는 화면은 전부 `useMergedQuestions` 를 거친다.** 서버는 오버레이를 모르므로
  병합은 브라우저에서만 가능하다. 드릴은 병합이 끝난 뒤에 세션을 열어야 큐가 도중에 다시 짜이지 않는다.
- **되돌릴 수 있는 일은 확인 대화상자로 막지 않는다.** 복습 리셋과 정지는 일단 실행하고
  5초짜리 되돌리기 토스트를 띄운다.
- **통계는 차트 라이브러리 없이 그린다.** `stats.ts` 가 주 단위 격자까지 만들어 주고
  화면은 CSS grid 로 칠하기만 한다.
