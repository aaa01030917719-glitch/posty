# DB_SCHEMA

이 문서는 확정 설계가 아니라, 현재 코드 기준으로 정리한 초안입니다.
실제 제품 설계/DB 구조와 다를 수 있으며, 변경 전 사용자 확인이 필요합니다.

## 범위

- 이 문서는 실제 Supabase 콘솔을 기준으로 한 스키마 문서가 아닙니다.
- `C:\posty\src\lib\types.ts`, `C:\posty\src\lib\constants.ts`, 각 page/component의 Supabase 호출 코드를 기준으로 추정한 초안입니다.

## 현재 확인 가능한 기술 상태

- ORM 없음
- Prisma 없음
- Drizzle 없음
- migration 폴더 없음
- `schema.sql` 없음
- 현재 타입 기준은 `src/lib/types.ts`
- 실제 Supabase 콘솔 확인 전까지 확정 스키마로 보면 안 됩니다

## 현재 코드 기준 추정 테이블 목록

- `profiles`
- `channels`
- `tags`
- `content_cards`
- `scripts`
- `ideas`
- `mindmaps`
- `card_tags`
- `idea_tags`

## 테이블별 현재 코드 기준 메모

### profiles

- 추정 목적: 사용자 프로필 정보
- 타입상 필드:
  - `id`
  - `email`
  - `name`
  - `avatar_url`
  - `created_at`

### channels

- 추정 목적: 사용자 채널 정보
- 타입상 필드:
  - `id`
  - `user_id`
  - `name`
  - `type`
  - `color`
  - `created_at`

### tags

- 추정 목적: 사용자 태그 정보
- 타입상 필드:
  - `id`
  - `user_id`
  - `name`
  - `color`

### content_cards

- 추정 목적: 콘텐츠 카드 메인 엔티티
- 타입상 필드:
  - `id`
  - `user_id`
  - `channel_id`
  - `title`
  - `format`
  - `status`
  - `priority`
  - `scheduled_at`
  - `published_at`
  - `memo`
  - `reference_url`
  - `checklist`
  - `idea_id`
  - `created_at`
  - `updated_at`
- 코드상 `channel:channels(*)` 관계 조회가 보입니다.

### scripts

- 추정 목적: 콘텐츠 카드에 연결된 대본 데이터
- 타입상 필드:
  - `id`
  - `user_id`
  - `card_id`
  - `title`
  - `body`
  - `caption`
  - `hashtags`
  - `cta`
  - `thumbnail_text`
  - `panel_title`
  - `is_final`
  - `created_at`
  - `updated_at`
- 코드상 `card:content_cards(title, status)` 관계 조회가 보입니다.

### ideas

- 추정 목적: 아이디어 보드 데이터
- 타입상 필드:
  - `id`
  - `user_id`
  - `title`
  - `body`
  - `channel_type`
  - `priority`
  - `is_archived`
  - `converted_card_id`
  - `created_at`

### mindmaps

- 추정 목적: 마인드맵 저장용 데이터
- 타입상 필드:
  - `id`
  - `user_id`
  - `title`
  - `data`
  - `created_at`
  - `updated_at`
- 현재 UI는 placeholder라 실제 사용 여부는 코드만으로 확정할 수 없습니다.

### card_tags

- 추정 목적: 콘텐츠 카드와 태그 다대다 연결
- 타입상 필드:
  - `card_id`
  - `tag_id`

### idea_tags

- 추정 목적: 아이디어와 태그 다대다 연결
- 타입상 필드:
  - `idea_id`
  - `tag_id`

## 타입/테이블 불일치 가능성

- `Scene` interface는 `src/lib/types.ts` 안에 존재합니다.
- 하지만 `Database.public.Tables`에는 `scenes` 테이블 정의가 없습니다.
- 따라서 `Scene` 타입과 실제 DB 구조 사이에 불일치 가능성이 있습니다.

## 현재 코드 기준 권한/RLS 관련 주의

- `user_id` 필터와 RLS 정책 확인이 필요합니다.
- 현재 코드에는 `user_id` 없는 `select`가 여러 곳 보입니다.
- 이 구조는 RLS에 강하게 의존하는 형태일 수 있습니다.
- 실제로 안전한지 여부는 Supabase 콘솔에서 정책 확인 전까지 확정할 수 없습니다.
- 새 테이블/컬럼 추가 전에는 실제 Supabase 구조 확인이 필수입니다.

## 현재 코드 기준 구현 메모

- Supabase client에 `Database` generic 연결이 필요합니다.
- 현재 `createBrowserClient`, `createServerClient` 호출에 `Database` generic이 연결되어 있지 않습니다.
- 현재 `insert`/`update` 구문에서 `as never` 우회가 사용되고 있습니다.
- 향후 타입 안전성 정리 시 `as never` 제거가 필요합니다.

## 상태값/상수 관리 관련 메모

- 상태값이 `src/lib/types.ts`와 `src/lib/constants.ts`에 분산되어 있습니다.
- 예:
  - `ContentStatus`
  - `Priority`
  - `ChannelType`
  - 상태 라벨/색상
- 현재는 작동 가능해 보이지만, 상태값 추가/변경 시 두 파일을 함께 관리해야 하는 구조입니다.

## 현재 코드 기준 비확정 메모

- 실제 DB의 nullable 여부, default 값, foreign key, index, trigger, RLS policy는 코드만으로 확정할 수 없습니다.
- 이 문서는 migration 문서가 아닙니다.
- 실제 DB 구조처럼 확정해서 사용하면 안 됩니다.
