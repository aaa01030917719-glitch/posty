# ROUTES

이 문서는 확정 설계가 아니라, 현재 코드 기준으로 정리한 초안입니다.
실제 제품 설계/DB 구조와 다를 수 있으며, 변경 전 사용자 확인이 필요합니다.

## 범위

- 이 문서는 `C:\posty\src\app`, `C:\posty\src\components\layout`, `C:\posty\src\proxy.ts` 기준 현황 정리입니다.
- 새로운 라우트 설계 문서가 아니라, 현재 구현 상태를 기록하는 초안입니다.

## 현재 route group 구조

- `(auth)`
  - `/login`
  - `/signup`
- `(dashboard)`
  - `/schedule`
  - `/content`
  - `/scripts`
  - `/ideas`
  - `/mindmap`
  - `/dashboard`

## 현재 존재하는 URL 목록

| URL | 현재 역할 | 인증 필요 여부 | 비고 |
| --- | --- | --- | --- |
| `/` | 루트 진입점 | 간접적으로 필요 | 현재 `redirect('/schedule')` 처리 |
| `/login` | 로그인 페이지 | 아니오 | 로그인 상태면 proxy에서 `/schedule`로 이동 가능 |
| `/signup` | 회원가입 페이지 | 아니오 | 로그인 상태면 proxy에서 `/schedule`로 이동 가능 |
| `/schedule` | 캘린더 일정 화면 | 예 | 월/주/일 뷰 + 카드 모달 상세 |
| `/content` | 콘텐츠 목록 화면 | 예 | grid/list 전환 + 카드 모달 상세 |
| `/scripts` | 대본 목록/편집 화면 | 예 | 좌측 목록 + 우측 편집 패널 |
| `/ideas` | 아이디어 보드 화면 | 예 | 생성/보관/콘텐츠 전환 기능 |
| `/mindmap` | 마인드맵 placeholder 화면 | 예 | 현재 실제 에디터 미구현 |
| `/dashboard` | 상태 요약 화면 | 예 | 통계/요약 카드 중심 |

## 인증 처리 현재 상태

- 현재 인증 체크는 두 군데에서 보입니다.
- `src/proxy.ts`
  - 비로그인 사용자가 auth 페이지 외 경로 접근 시 `/login`으로 redirect
  - 로그인 사용자가 `/login`, `/signup` 접근 시 `/schedule`로 redirect
- `src/app/(dashboard)/layout.tsx`
  - 서버 컴포넌트에서 `supabase.auth.getUser()` 확인 후, user 없으면 `/login` redirect

## 현재 URL 동작 메모

- `/` 는 현재 홈 페이지를 렌더링하지 않고 `/schedule`로 이동합니다.
- 현재 동적 라우트는 없습니다.
- 현재 상세 페이지는 별도 page detail 방식이 아니라 modal detail 중심입니다.
- 현재 `/content/[id]`, `/schedule/[id]`, `/scripts/[id]` 같은 상세 페이지 라우트는 없습니다.
- 향후 상세 라우트 추가 전에는 사용자 확인이 필요합니다.

## 상세 표시 방식 현재 상태

- `/content`
  - 목록 클릭 시 `CardModal` 사용
- `/schedule`
  - 캘린더 카드 클릭 시 `CardModal` 사용
- `/scripts`
  - 별도 detail page 없이 한 화면 안에서 목록/편집 패널 구조

## navigation active 기준 현재 상태

- `Sidebar`와 `MobileNav` 모두 아래 기준으로 active를 계산합니다.
- `pathname === href || pathname.startsWith(href + '/')`
- 이 기준은 현재 코드 기준 현황일 뿐이며, 동적 라우트 추가 이후에도 그대로 유지할지 확정된 것은 아닙니다.
- 현재 `MobileNav`에는 `/dashboard` 항목이 없습니다.

## header title 매핑 현재 상태

- `src/components/layout/Header.tsx`는 exact path 매핑으로 제목을 결정합니다.
- 현재 매핑 대상:
  - `/schedule`
  - `/content`
  - `/scripts`
  - `/ideas`
  - `/mindmap`
  - `/dashboard`
- 동적 라우트나 중첩 경로가 추가되면 이 방식은 쉽게 깨질 수 있습니다.

## proxy 관련 주의사항

- 현재 `src/proxy.ts` matcher는 정적 자산 일부만 제외하고 거의 전체 경로를 대상으로 동작합니다.
- 현재 `/api/*` 라우트는 없습니다.
- 향후 `/api/*` 추가 전에는 `proxy.ts` matcher 범위를 먼저 확인해야 합니다.

## 현재 확인 가능한 비확정 메모

- 현재 라우팅은 flat 구조에 가깝습니다.
- modal 상세와 page 상세를 혼합하는 정책은 아직 코드상 확정되어 있지 않습니다.
- 상세 라우트, nested route, parallel route, intercepting route에 대한 별도 기준 문서는 아직 없습니다.
