# Design System Documentation
> Source: `ui_kit.fig` — Simple Design System

---

## 1. Overview

이 디자인 시스템은 웹 UI를 위한 컴포넌트 라이브러리로, Figma Variable 기반의 토큰 시스템과 재사용 가능한 컴포넌트로 구성됩니다.

**Design Scope**
- Pages: `Page 1` (실제 컴포넌트), `Internal Only Canvas` (토큰 정의)
- Total Nodes: 901 (INSTANCE 257, SYMBOL 173, TEXT 160, VARIABLE 125, FRAME 124)
- Max Layout Width: `1200px`
- CSS Variable Prefix: `--sds-`

---

## 2. Color Tokens

### 2.1 Primitive Colors (Raw Scale)

| Token Name | HEX | CSS Variable |
|---|---|---|
| `White/1000` | `#ffffff` | `var(--sds-color-white-1000)` |
| `White/500` | `#ffffff` | `var(--sds-color-white-500)` |
| `White/400` | `#ffffff` | `var(--sds-color-white-400)` |
| `Black/500` | `#0c0c0d` | `var(--sds-color-black-500)` |
| `Black/400` | `#0c0c0d` | `var(--sds-color-black-400)` |

#### Gray Scale

| Token Name | HEX | CSS Variable |
|---|---|---|
| `Gray/100` | `#f5f5f5` | `var(--sds-color-gray-100)` |
| `Gray/200` | `#e6e6e6` | `var(--sds-color-gray-200)` |
| `Gray/300` | `#d9d9d9` | `var(--sds-color-gray-300)` |
| `Gray/400` | `#b3b3b3` | `var(--sds-color-gray-400)` |
| `Gray/500` | `#757575` | `var(--sds-color-gray-500)` |
| `Gray/600` | `#444444` | `var(--sds-color-gray-600)` |
| `Gray/700` | `#383838` | `var(--sds-color-gray-700)` |
| `Gray/800` | `#2c2c2c` | `var(--sds-color-gray-800)` |
| `Gray/900` | `#1e1e1e` | `var(--sds-color-gray-900)` |

#### Slate Scale

| Token Name | HEX | CSS Variable |
|---|---|---|
| `Slate/100` | `#f2f2f2` | `var(--sds-color-slate-100)` |
| `Slate/200` | `#e3e3e3` | `var(--sds-color-slate-200)` |
| `Slate/300` | `#cccccc` | `var(--sds-color-slate-300)` |
| `Slate/400` | `#b1b1b1` | `var(--sds-color-slate-400)` |
| `Slate/500` | `#939393` | `var(--sds-color-slate-500)` |
| `Slate/600` | `#767676` | `var(--sds-color-slate-600)` |
| `Slate/900` | `#303030` | `var(--sds-color-slate-900)` |
| `Slate/1000` | `#242424` | `var(--sds-color-slate-1000)` |

#### Brand Scale

| Token Name | HEX | CSS Variable |
|---|---|---|
| `Brand/100` | `#f5f5f5` | `var(--sds-color-brand-100)` |
| `Brand/300` | `#d9d9d9` | `var(--sds-color-brand-300)` |
| `Brand/600` | `#444444` | `var(--sds-color-brand-600)` |
| `Brand/800` | `#2c2c2c` | `var(--sds-color-brand-800)` |
| `Brand/900` | `#1e1e1e` | `var(--sds-color-brand-900)` |

> **Note:** 이 시스템의 Brand 색상은 Grayscale 계열입니다. Neutral-tone 또는 Dark-mode-first 브랜드 방향성입니다.

#### Semantic / Status Colors

| Token Name | HEX | CSS Variable |
|---|---|---|
| `Red/200` | `#fdd2cf` | `var(--sds-color-red-200)` |
| `Red/500` | `#eb221e` | `var(--sds-color-red-500)` |
| `Red/700` | `#8f0b09` | `var(--sds-color-red-700)` |
| `Blue/500` | `#3f80ea` | `var(--sds-color-pink-500)` |
| `Pink/500` | `#ea3fb8` | `var(--sds-color-pink-500)` |
| `Green/500` | `#14ae5c` | `var(--sds-color-green-500)` |
| `Yellow/600` | `#bf6a02` | `var(--sds-color-yellow-600)` |

---

### 2.2 Semantic Color Tokens (Alias)

아래 토큰들은 Primitive 색상에 대한 alias로, 실제 컴포넌트에서 사용됩니다.

#### Background

| Token Name | CSS Variable |
|---|---|
| `Background/Default/Default` | `var(--sds-color-background-default-default)` |
| `Background/Default/Secondary` | `var(--sds-color-background-default-secondary)` |
| `Background/Default/Default Hover` | `var(--sds-color-background-default-default-hover)` |
| `Background/Default/Secondary Hover` | `var(--sds-color-background-default-secondary-hover)` |
| `Background/Brand/Default` | `var(--sds-color-background-brand-default)` |
| `Background/Brand/Hover` | `var(--sds-color-background-brand-hover)` |
| `Background/Brand/Tertiary` | `var(--sds-color-background-brand-tertiary)` |
| `Background/Neutral/Tertiary` | `var(--sds-color-background-neutral-tertiary)` |
| `Background/Neutral/Tertiary Hover` | `var(--sds-color-background-neutral-tertiary-hover)` |
| `Background/Disabled/Default` | `var(--sds-color-background-disabled-default)` |

#### Text

| Token Name | CSS Variable |
|---|---|
| `Text/Default/Default` | `var(--sds-color-text-default-default)` |
| `Text/Default/Secondary` | `var(--sds-color-text-default-secondary)` |
| `Text/Default/Tertiary` | `var(--sds-color-text-default-tertiary)` |
| `Text/Brand/On Brand` | `var(--sds-color-text-brand-on-brand)` |
| `Text/Brand/On Brand Secondary` | `var(--sds-color-text-brand-on-brand-secondary)` |
| `Text/Brand/On Brand Tertiary` | `var(--sds-color-text-brand-on-brand-tertiary)` |
| `Text/Neutral/Default` | `var(--sds-color-text-neutral-default)` |
| `Text/Disabled/Default` | `var(--sds-color-text-disabled-default)` |
| `Text/Disabled/On Disabled` | `var(--sds-color-text-disabled-on-disabled)` |
| `Text/Danger/Default` | `var(--sds-color-text-danger-default)` |

#### Border

| Token Name | CSS Variable |
|---|---|
| `Border/Default/Default` | `var(--sds-color-border-default-default)` |
| `Border/Brand/Default` | `var(--sds-color-border-brand-default)` |
| `Border/Neutral/Default` | `var(--sds-color-border-neutral-default)` |
| `Border/Neutral/Secondary` | `var(--sds-color-border-neutral-secondary)` |
| `Border/Disabled/default` | `var(--sds-color-border-disabled-default)` |
| `border/disabled/secondary` | `var(--sds-color-border-disabled-secondary)` |
| `Border/Danger/Default` | `var(--sds-color-border-danger-default)` |

#### Icon

| Token Name | CSS Variable |
|---|---|
| `Icon/Default/Default` | `var(--sds-color-icon-default-default)` |
| `Icon/Default/Tertiary` | `var(--sds-color-icon-default-tertiary)` |
| `Icon/Brand/Default` | `var(--sds-color-icon-brand-default)` |
| `Icon/Brand/On Brand` | `var(--sds-color-icon-brand-on-brand)` |
| `Icon/Brand/On Brand Secondary` | `var(--sds-color-icon-brand-on-brand-secondary)` |
| `Icon/Disabled/On Disabled` | `var(--sds-color-icon-disabled-on-disabled)` |

---

## 3. Typography

### 3.1 Font Families

| Token Name | CSS Variable |
|---|---|
| `Family Sans` | `var(--sds-typography-family-sans)` |
| `Family Mono` | `var(--sds-typography-family-mono)` |

### 3.2 Type Scale (px)

| Scale Token | Value | CSS Variable |
|---|---|---|
| `Scale 02` | `14px` | `var(--sds-typography-scale-02)` |
| `Scale 03` | `16px` | `var(--sds-typography-scale-03)` |
| `Scale 04` | `20px` | `var(--sds-typography-scale-04)` |
| `Scale 05` | `24px` | `var(--sds-typography-scale-05)` |
| `Scale 06` | `32px` | `var(--sds-typography-scale-06)` |
| `Scale 07` | `40px` | `var(--sds-typography-scale-07)` |
| `Scale 08` | `48px` | `var(--sds-typography-scale-08)` |
| `Scale 10` | `72px` | `var(--sds-typography-scale-10)` |

### 3.3 Font Weights

| Token Name | Value | CSS Variable |
|---|---|---|
| `Weight Regular` | `400` | `var(--sds-typography-weight-regular)` |
| `Weight Semibold` | `600` | `var(--sds-typography-weight-semibold)` |
| `Weight Bold` | `700` | `var(--sds-typography-weight-bold)` |

### 3.4 Text Roles

| Role | Font Family | Font Weight Token | Size Token | CSS Variables |
|---|---|---|---|---|
| **Title Hero** | Sans | Bold | Scale 10 (72px) | `--sds-typography-title-hero-*` |
| **Title Page** | Sans | Bold | Scale 08 (48px) | `--sds-typography-title-page-*` |
| **Subtitle** | Sans | Semibold | Scale 07 (40px) | `--sds-typography-subtitle-*` |
| **Heading** | Sans | Semibold | Scale 05 (24px) | `--sds-typography-heading-*` |
| **Subheading** | Sans | Semibold | Scale 04 (20px) | `--sds-typography-subheading-*` |
| **Body Base** | Sans | Regular | Scale 03 (16px) | `--sds-typography-body-size-medium` |
| **Body Small** | Sans | Regular | Scale 02 (14px) | `--sds-typography-body-size-small` |
| **Body Strong** | Sans | Semibold | Scale 03 (16px) | `--sds-typography-body-font-weight-strong` |
| **Body Code** | Mono | Regular | Scale 03 (16px) | `--sds-typography-code-*` |

---

## 4. Spacing

| Token Name | Value | CSS Variable |
|---|---|---|
| `Space/100` | `4px` | `var(--sds-size-space-100)` |
| `Space/150` | `6px` | `var(--sds-size-space-150)` |
| `Space/200` | `8px` | `var(--sds-size-space-200)` |
| `Space/300` | `12px` | `var(--sds-size-space-300)` |
| `Space/400` | `16px` | `var(--sds-size-space-400)` |
| `Space/600` | `24px` | `var(--sds-size-space-600)` |
| `Space/800` | `32px` | `var(--sds-size-space-800)` |
| `Space/1200` | `48px` | `var(--sds-size-space-1200)` |
| `Space/1600` | `64px` | `var(--sds-size-space-1600)` |
| `Space/4000` | `160px` | `var(--sds-size-space-4000)` |

---

## 5. Border Radius

| Token Name | Value | CSS Variable |
|---|---|---|
| `Radius/100` | `4px` | `var(--sds-size-radius-100)` |
| `Radius/200` | `8px` | `var(--sds-size-radius-200)` |
| `Radius/400` | `16px` | `var(--sds-size-radius-400)` |
| `Radius/Full` | `9999px` | `var(--sds-size-radius-full)` |

---

## 6. Stroke & Border

| Token Name | Value | CSS Variable |
|---|---|---|
| `Stroke/Border` | `1px` | `var(--sds-size-stroke-border)` |
| `border-width` | `1px` | `var(--sds-responsive-border-width)` |

---

## 7. Icon Sizes

| Token Name | Value | CSS Variable |
|---|---|---|
| `Icon/Small` | `24px` | `var(--sds-size-icon-small)` |
| `Icon/Medium` | `32px` | `var(--sds-size-icon-medium)` |
| `Icon/Large` | `40px` | `var(--sds-size-icon-large)` |

---

## 8. Responsive

| Token Name | Value | CSS Variable |
|---|---|---|
| `Device Width` | `1200px` | `var(--sds-responsive-device-width)` |
| `Responsive/show-hamburger` | `false` (desktop default) | — |

---

## 9. Components

### 9.1 Button

**Variants:**
- `Variant`: `Primary` / `Neutral` / `Subtle`
- `State`: `Default` / `Hover` / `Disabled`
- `Size`: `Medium` / `Small`

**총 18개 variant** (3 variants × 3 states × 2 sizes)

```
Button
├── Variant=Primary, State=Default, Size=Medium
├── Variant=Primary, State=Default, Size=Small
├── Variant=Primary, State=Hover, Size=Medium
├── Variant=Primary, State=Hover, Size=Small
├── Variant=Primary, State=Disabled, Size=Medium
├── Variant=Primary, State=Disabled, Size=Small
├── Variant=Neutral, State=Default, Size=Medium
├── Variant=Neutral, State=Default, Size=Small
│   ... (동일 패턴)
└── Variant=Subtle, State=Disabled, Size=Small
```

**Icon Button:** 별도 컴포넌트, 동일 variant 구조

**Button Group:** Button 복수 조합 컨테이너

---

### 9.2 Input / Form

**Input Field**
- `State`: `Default` / `Hover` / `Disabled` / `Error`
- `Value Type`: `Default` / `Filled` / `Placeholder`
- Height: `40px`

**Textarea Field**
- `Value Type`: `Default` / `Placeholder`
- `State`: `Default` / `Disabled` / `Invalid`

**Input Field (Label + Description + Value + Error/Hint)** 래퍼 컴포넌트 포함

---

### 9.3 Avatar

**Props:**
- `Type`: `Image` / `Initial`
- `Size`: `Small` / `Medium` / `Large`
- `Shape`: `Circle` / `Square`

**총 12개 variant** (2 types × 3 sizes × 2 shapes)

---

### 9.4 Navigation

**Navigation Pill** — 개별 탭 아이템
- `State`: `Default` / `Active`
- Corner Radius: `8px`

**Navigation Pill List** — Pill의 컨테이너

---

### 9.5 Header

**Header** — 전체 헤더 레이아웃 (Max Width 1200px)
**Header Auth** — 인증 상태 헤더
- `State`: `Logged Out` / `Logged In` / `Logged In - Hover`
- `Platform`: `Desktop` / `Mobile`
- `Density`: `Default` / `Tight`

---

### 9.6 Card

**Card** — 기본 카드 컴포넌트
**Card Grid Content List** — 텍스트 리스트 카드 그리드
**Card Grid Image** — 이미지 포함 카드 그리드

---

### 9.7 Hero Section

**Hero Basic** — 텍스트 + CTA 기본 히어로
**Hero Form** — 인라인 폼 포함 히어로

---

### 9.8 Text Content

**Text Content Title** — `Title Hero` + `Subtitle` 조합
**Text Content Heading** — `Heading` + `Subheading` 조합

---

### 9.9 Footer

Full-width 푸터 레이아웃 (1695px 기준 프레임)

---

### 9.10 Search

**Search** — 검색 인풋 컴포넌트 (Search 아이콘 포함)

---

### 9.11 AI Chatbot

**AI Chat Box** — 채팅 입력 영역  
**AI Chatbot** — 전체 채팅 인터페이스  
**AI Sidebar** — 사이드바 채팅 패널

**메시지 타입:**
- `AI Chat -> User message`
- `AI Chat -> Chat Response`
- `AI Chat -> Code Block`
- `AI -> Conversation`

---

### 9.12 Text Link List

**Text Link List** — 링크 목록
**Text Link List Item** — 개별 링크 아이템 (Text Strong 포함)

---

### 9.13 Panel / Layout

**Panel Image Double** — 이미지 2열 패널 레이아웃  
**Slot 2** — 2-slot 레이아웃 컨테이너

---

### 9.14 Form Contact (Full Form)

`Form Contact` — 이름, 이메일, 메시지 필드를 포함한 전체 컨택트 폼 심볼

---

## 10. Icons

**Provided Icon Set:**

| Icon | Usage |
|---|---|
| `Menu` | 햄버거 메뉴 (16px, 24px 두 종류) |
| `Menu/16` | 소형 메뉴 아이콘 |
| `X` | 닫기 (16px, 24px) |
| `X/16` | 소형 닫기 |
| `Chevron down` | 드롭다운 화살표 |
| `Arrow up` | 위쪽 화살표 |
| `Search` | 검색 |
| `Star` | 즐겨찾기/평점 |
| `Info` | 정보 |
| `Message circle` | 메시지 |
| `Plus circle` | 추가 |
| `Mic` | 마이크 |
| `Code` | 코드 |
| `Image` | 이미지 |
| `Figma` | Figma 로고 |

**Icon Variants:**
- `Asset Type`: `Icon` / `Image`
- `Variant`: `Default` / `Stroke`
- `Direction`: `Horizontal` / `Vertical`

---

## 11. Example Templates

파일 내에 세 가지 완성 예시 페이지가 포함되어 있습니다.

| Template | 포함 요소 |
|---|---|
| `Examples/About` | Hero Basic, Card Grid, Text Content |
| `Examples/Contact Us` | Hero Form, Form Contact |
| `Examples/AI Chat` | AI Chatbot, AI Chat Box |

---

## 12. CSS Variables Quick Reference

```css
/* ===== COLORS ===== */
/* Grayscale Primitives */
--sds-color-white-1000: #ffffff;
--sds-color-gray-100: #f5f5f5;
--sds-color-gray-200: #e6e6e6;
--sds-color-gray-300: #d9d9d9;
--sds-color-gray-400: #b3b3b3;
--sds-color-gray-500: #757575;
--sds-color-gray-600: #444444;
--sds-color-gray-700: #383838;
--sds-color-gray-800: #2c2c2c;
--sds-color-gray-900: #1e1e1e;
--sds-color-black-500: #0c0c0d;

/* Slate */
--sds-color-slate-100: #f2f2f2;
--sds-color-slate-200: #e3e3e3;
--sds-color-slate-300: #cccccc;
--sds-color-slate-400: #b1b1b1;
--sds-color-slate-500: #939393;
--sds-color-slate-600: #767676;
--sds-color-slate-900: #303030;
--sds-color-slate-1000: #242424;

/* Semantic Status */
--sds-color-red-200: #fdd2cf;
--sds-color-red-500: #eb221e;
--sds-color-red-700: #8f0b09;
--sds-color-green-500: #14ae5c;
--sds-color-yellow-600: #bf6a02;
--sds-color-blue-500: #3f80ea;
--sds-color-pink-500: #ea3fb8;

/* ===== SPACING ===== */
--sds-size-space-100: 4px;
--sds-size-space-150: 6px;
--sds-size-space-200: 8px;
--sds-size-space-300: 12px;
--sds-size-space-400: 16px;
--sds-size-space-600: 24px;
--sds-size-space-800: 32px;
--sds-size-space-1200: 48px;
--sds-size-space-1600: 64px;
--sds-size-space-4000: 160px;

/* ===== BORDER RADIUS ===== */
--sds-size-radius-100: 4px;
--sds-size-radius-200: 8px;
--sds-size-radius-400: 16px;
--sds-size-radius-full: 9999px;

/* ===== BORDER ===== */
--sds-size-stroke-border: 1px;

/* ===== ICONS ===== */
--sds-size-icon-small: 24px;
--sds-size-icon-medium: 32px;
--sds-size-icon-large: 40px;

/* ===== TYPOGRAPHY SCALE ===== */
--sds-typography-scale-02: 14px;
--sds-typography-scale-03: 16px;
--sds-typography-scale-04: 20px;
--sds-typography-scale-05: 24px;
--sds-typography-scale-06: 32px;
--sds-typography-scale-07: 40px;
--sds-typography-scale-08: 48px;
--sds-typography-scale-10: 72px;

/* Font Weights */
--sds-typography-weight-regular: 400;
--sds-typography-weight-semibold: 600;
--sds-typography-weight-bold: 700;

/* ===== RESPONSIVE ===== */
--sds-responsive-device-width: 1200px;
```

---

## 13. Posty 프로젝트 적용 가이드

이 디자인 시스템을 Posty (Next.js 14 + Tailwind CSS)에 적용할 때 참고사항:

**Tailwind CSS 매핑 예시**

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        gray: {
          100: '#f5f5f5',
          200: '#e6e6e6',
          300: '#d9d9d9',
          400: '#b3b3b3',
          500: '#757575',
          600: '#444444',
          700: '#383838',
          800: '#2c2c2c',
          900: '#1e1e1e',
        },
        slate: {
          100: '#f2f2f2',
          200: '#e3e3e3',
          300: '#cccccc',
          400: '#b1b1b1',
          500: '#939393',
          600: '#767676',
          900: '#303030',
          1000: '#242424',
        },
        brand: {
          // Posty's Airbnb-aligned primary
          primary: '#ff385c',
        },
        danger: {
          light: '#fdd2cf',
          DEFAULT: '#eb221e',
          dark: '#8f0b09',
        },
        success: '#14ae5c',
        warning: '#bf6a02',
      },
      spacing: {
        '100': '4px',
        '150': '6px',
        '200': '8px',
        '300': '12px',
        '400': '16px',
        '600': '24px',
        '800': '32px',
        '1200': '48px',
        '1600': '64px',
      },
      borderRadius: {
        '100': '4px',
        '200': '8px',
        '400': '16px',
        'full': '9999px',
      },
      fontSize: {
        'scale-02': '14px',
        'scale-03': '16px',
        'scale-04': '20px',
        'scale-05': '24px',
        'scale-06': '32px',
        'scale-07': '40px',
        'scale-08': '48px',
        'scale-10': '72px',
      },
      maxWidth: {
        'layout': '1200px',
      },
    },
  },
}
```

> **Posty Runtime Color Note:** Figma 추출 문서의 grayscale brand 설명과 별개로, 현재 Posty 런타임 token은 Airbnb 기준 색상을 사용합니다. Primary/CTA는 `#ff385c`, active는 `#e00b41`, accent soft/disabled는 `#ffd1da`를 기준으로 맞춥니다.
