# UI Rebuild Plan

이 문서는 Posty UI 재구축 작업을 시작하기 전에 범위와 순서를 고정하기 위한 작업 기준 문서입니다.
이번 문서의 목적은 기존 기능을 건드리지 않고, 유지할 기반과 재구축할 UI 영역을 분리하는 것입니다.

## 1. KEEP 고정 영역

아래 영역은 현재 단계에서 유지 대상으로 고정합니다.

- Supabase Auth
- `src/lib/supabase/client.ts`
- `src/lib/supabase/server.ts`
- `src/proxy.ts`
- `src/app/(auth)` route group
- `src/app/(dashboard)` route group
- `src/app/(dashboard)/layout.tsx`
- login / signup / logout 흐름
- `package.json`
- `package-lock.json`
- `.env.local` 사용 방식
- `next.config.ts`
- 현재 App Router 기본 구조

## 2. UI 재구축 원칙

- 기존 UI에 맞춰 부분 수정하지 않는다.
- 새 디자인 시스템 기준으로 교체한다.
- 페이지별 임시 CSS를 추가하지 않는다.
- 중복되는 `bg` / `border` / `rounded` 조합을 반복하지 않는다.
- 공통 컴포넌트를 먼저 만들고 페이지에 적용한다.
- 한 화면을 고칠 때도 기존 구조 보존보다 새 UI 기준 정렬을 우선한다.
- 기능 로직은 유지하고 표현 계층만 교체한다.
- 새 UI 도입 전까지 old UI를 급하게 정리하지 않는다.

## 3. 디자인 시스템 1차 범위

1차 범위에서 먼저 기준을 잡아야 하는 항목은 아래와 같습니다.

- color token
- spacing token
- radius token
- shadow token
- typography token
- button
- input
- card
- badge
- modal
- tab / filter chip
- empty state
- loading state
- page header
- toolbar

## 4. 재구축 순서

1. `globals.css` / token 기준 정리
2. `src/components/ui` 공통 컴포넌트 재정의
3. layout components 재구축
4. content 페이지 교체
5. schedule 페이지 교체
6. scripts 페이지 교체
7. ideas 페이지 교체
8. dashboard 페이지 교체
9. old component / 중복 스타일 제거

## 5. 작업 금지 규칙

- Auth 관련 파일 수정 금지
- Supabase 연결 방식 변경 금지
- 라우팅 구조 변경 금지
- 한 번에 여러 페이지 갈아엎기 금지
- 임시 `className` 누적 금지
- 페이지 안에서 독자적인 버튼 / 칩 / 카드 스타일 새로 만들기 금지
- 재구축 도중 기능 로직과 UI 로직을 동시에 바꾸지 않기
- old component 제거를 재구축 초반에 먼저 하지 않기

## 6. 커밋 전략

- 문서 생성만 별도 커밋 후보
- UI token 정리 별도 커밋
- 공통 컴포넌트 별도 커밋
- 페이지별 교체는 페이지 단위 커밋
- 삭제 작업은 마지막에 별도 커밋

## 7. 작업 메모

- 현재 단계에서는 KEEP 영역을 건드리지 않고 UI 계층만 단계적으로 교체한다.
- 공통 UI 기준 없이 페이지부터 고치면 다시 중복이 생기므로, 항상 token -> ui -> layout -> page 순서를 지킨다.
- old component는 새 UI가 실제 화면에 적용된 뒤 제거 후보로 옮긴다.
