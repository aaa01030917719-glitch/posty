'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  BarChart2,
  ChevronDown,
  ChevronUp,
  Edit3,
  Eye,
  Filter,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react'
import { clsx } from 'clsx'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { createClient } from '@/lib/supabase/client'
import type {
  Database,
  ReelsAnalytics,
  ReelsAnalyticsHookType,
  ReelsAnalyticsScreenType,
  ReelsAnalyticsSnapshot,
  ReelsAnalyticsSnapshotType,
} from '@/lib/types'

type SnapshotBasis = Exclude<ReelsAnalyticsSnapshotType, 'current'>
type ReelsAnalyticsWithSnapshots = ReelsAnalytics & {
  snapshots: ReelsAnalyticsSnapshot[]
}
type ReelInsert = Database['public']['Tables']['reels_analytics']['Insert']
type ReelUpdate = Database['public']['Tables']['reels_analytics']['Update']
type SnapshotInsert = Database['public']['Tables']['reels_analytics_snapshots']['Insert']
type SortKey =
  | 'views_desc'
  | 'save_rate_desc'
  | 'share_rate_desc'
  | 'completion_rate_desc'
  | 'comment_rate_desc'
  | 'follower_growth_desc'
  | 'upload_date_desc'
  | 'upload_date_asc'
type ActiveFilterBadge = {
  key: string
  label: string
  onRemove?: () => void
}
type ViewsPreset =
  | 'all'
  | 'gte80000'
  | '50000-79999'
  | '30000-49999'
  | '10000-29999'
  | '5000-9999'
  | 'lt5000'
  | 'direct'
type DatePreset = 'last30' | 'last90' | 'year' | 'all' | 'direct'

type SnapshotFormState = {
  views: string
  reach: string
  avg_watch_time_seconds: string
  avg_watch_rate: string
  completion_rate: string
  likes: string
  comments: string
  saves: string
  shares: string
  profile_visits: string
  follower_growth: string
  dm_count: string
  inquiry_count: string
  contract_count: string
}

type ReelFormState = {
  upload_date: string
  title: string
  topic: string
  category: string
  thumbnail_title: string
  video_length_seconds: string
  upload_time: string
  upload_weekday: string
  tagsText: string
  script_original: string
  first_sentence_hook: string
  hook_char_count: string
  twist_sentence: string
  cta: string
  comment_keyword: string
  screen_type: ReelsAnalyticsScreenType | ''
  bgm: string
  scene_change_interval_seconds: string
  first_info_time_seconds: string
  hook_types: ReelsAnalyticsHookType[]
  info_density: string
  has_product_name: boolean
  product_name_count: string
  has_brand_name: boolean
  brand_name_count: string
  has_model_name: boolean
  model_name_count: string
  has_cost: boolean
  number_count: string
  has_checklist: boolean
  has_real_case: boolean
  has_before_after: boolean
  has_site_photo: boolean
  success_reason: string
  failure_reason: string
  improvement_idea: string
  next_content_idea: string
  reusable: boolean
  snapshots: Record<SnapshotBasis, SnapshotFormState>
}

type Filters = {
  search: string
  viewsPreset: ViewsPreset
  viewsMin: string
  viewsMax: string
  datePreset: DatePreset
  dateStart: string
  dateEnd: string
  hookType: ReelsAnalyticsHookType | 'all'
  infoDensity: string
  cta: string
  screenType: ReelsAnalyticsScreenType | 'all'
  category: string
  tag: string
  lengthMin: string
  lengthMax: string
  saveRateMin: string
  saveRateMax: string
  shareRateMin: string
  shareRateMax: string
  completionRateMin: string
  completionRateMax: string
}

const SNAPSHOT_TYPES: SnapshotBasis[] = ['24h', '7d', '30d']

const SNAPSHOT_LABELS: Record<SnapshotBasis, string> = {
  '24h': '24시간',
  '7d': '7일',
  '30d': '30일',
}

const SCREEN_TYPE_OPTIONS: Array<{ value: ReelsAnalyticsScreenType; label: string }> = [
  { value: 'talking', label: '토킹' },
  { value: 'site_video', label: '현장 영상' },
  { value: 'photo', label: '사진' },
  { value: 'image', label: '이미지' },
  { value: 'ai_image', label: 'AI 이미지' },
  { value: 'subtitles', label: '자막 중심' },
  { value: 'mixed', label: '혼합' },
]

const HOOK_TYPE_OPTIONS: Array<{ value: ReelsAnalyticsHookType; label: string }> = [
  { value: 'regret', label: '후회형' },
  { value: 'top', label: 'TOP형' },
  { value: 'recommendation', label: '추천형' },
  { value: 'cost', label: '비용형' },
  { value: 'comparison', label: '비교형' },
  { value: 'insider_exposure', label: '내부자 폭로' },
  { value: 'checklist', label: '체크리스트' },
  { value: 'founder_opinion', label: '대표 의견' },
  { value: 'counterintuitive', label: '역발상' },
  { value: 'before_after', label: '비포/애프터' },
  { value: 'mistake_prevention', label: '실수 방지' },
  { value: 'other', label: '기타' },
]

const INFO_DENSITY_OPTIONS = [
  { value: '1', label: '⭐ 매우 낮음' },
  { value: '2', label: '⭐⭐ 낮음' },
  { value: '3', label: '⭐⭐⭐ 보통' },
  { value: '4', label: '⭐⭐⭐⭐ 높음' },
  { value: '5', label: '⭐⭐⭐⭐⭐ 매우 높음' },
] as const

const CTA_OPTIONS = [
  '댓글 유도',
  '저장 유도',
  'DM 유도',
  '팔로우 유도',
  '프로필 방문',
  '문의 유도',
  '없음',
  '기타',
] as const

const CATEGORY_OPTIONS = [
  '자재추천',
  '시공팁',
  '욕실',
  '주방',
  '조명',
  '전기',
  '예산',
  '업체선정',
  '계약',
  '공정',
  '현장',
  '체크리스트',
  '대표소신',
  '하자/AS',
  '기타',
] as const

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'views_desc', label: '조회수 높은 순' },
  { value: 'save_rate_desc', label: '저장률 높은 순' },
  { value: 'share_rate_desc', label: '공유률 높은 순' },
  { value: 'completion_rate_desc', label: '완료율 높은 순' },
  { value: 'comment_rate_desc', label: '댓글률 높은 순' },
  { value: 'follower_growth_desc', label: '팔로워 증가 높은 순' },
  { value: 'upload_date_desc', label: '업로드 최신순' },
  { value: 'upload_date_asc', label: '업로드 오래된순' },
]

const WEEKDAY_OPTIONS = ['월', '화', '수', '목', '금', '토', '일']

const INITIAL_FILTERS: Filters = {
  search: '',
  viewsPreset: 'all',
  viewsMin: '',
  viewsMax: '',
  datePreset: 'all',
  dateStart: '',
  dateEnd: '',
  hookType: 'all',
  infoDensity: 'all',
  cta: 'all',
  screenType: 'all',
  category: 'all',
  tag: '',
  lengthMin: '',
  lengthMax: '',
  saveRateMin: '',
  saveRateMax: '',
  shareRateMin: '',
  shareRateMax: '',
  completionRateMin: '',
  completionRateMax: '',
}

const BOOLEAN_FIELDS: Array<{ key: keyof ReelFormState; label: string }> = [
  { key: 'has_cost', label: '비용 언급' },
  { key: 'has_checklist', label: '체크리스트 구조' },
  { key: 'has_real_case', label: '실제 사례' },
  { key: 'has_before_after', label: '비포/애프터' },
  { key: 'has_site_photo', label: '현장/사이트 사진' },
  { key: 'reusable', label: '재활용 가능' },
]

const SNAPSHOT_METRIC_LABELS: Array<{ key: keyof SnapshotFormState; label: string }> = [
  { key: 'views', label: '조회수' },
  { key: 'reach', label: '도달' },
  { key: 'avg_watch_time_seconds', label: '평균 시청시간(초)' },
  { key: 'avg_watch_rate', label: '평균 시청률(%)' },
  { key: 'completion_rate', label: '완료율(%)' },
  { key: 'likes', label: '좋아요' },
  { key: 'comments', label: '댓글' },
  { key: 'saves', label: '저장' },
  { key: 'shares', label: '공유' },
  { key: 'profile_visits', label: '프로필 방문' },
  { key: 'follower_growth', label: '팔로워 증가' },
  { key: 'dm_count', label: 'DM' },
  { key: 'inquiry_count', label: '문의' },
  { key: 'contract_count', label: '계약' },
]

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

function createSnapshotForm(): SnapshotFormState {
  return {
    views: '',
    reach: '',
    avg_watch_time_seconds: '',
    avg_watch_rate: '',
    completion_rate: '',
    likes: '',
    comments: '',
    saves: '',
    shares: '',
    profile_visits: '',
    follower_growth: '',
    dm_count: '',
    inquiry_count: '',
    contract_count: '',
  }
}

function createSnapshotMap(): Record<SnapshotBasis, SnapshotFormState> {
  return SNAPSHOT_TYPES.reduce(
    (acc, type) => ({
      ...acc,
      [type]: createSnapshotForm(),
    }),
    {} as Record<SnapshotBasis, SnapshotFormState>
  )
}

function createEmptyForm(): ReelFormState {
  return {
    upload_date: todayInputValue(),
    title: '',
    topic: '',
    category: '',
    thumbnail_title: '',
    video_length_seconds: '',
    upload_time: '',
    upload_weekday: '',
    tagsText: '',
    script_original: '',
    first_sentence_hook: '',
    hook_char_count: '',
    twist_sentence: '',
    cta: '',
    comment_keyword: '',
    screen_type: '',
    bgm: '',
    scene_change_interval_seconds: '',
    first_info_time_seconds: '',
    hook_types: [],
    info_density: '',
    has_product_name: false,
    product_name_count: '',
    has_brand_name: false,
    brand_name_count: '',
    has_model_name: false,
    model_name_count: '',
    has_cost: false,
    number_count: '',
    has_checklist: false,
    has_real_case: false,
    has_before_after: false,
    has_site_photo: false,
    success_reason: '',
    failure_reason: '',
    improvement_idea: '',
    next_content_idea: '',
    reusable: false,
    snapshots: createSnapshotMap(),
  }
}

function normalizeText(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function parseTags(value: string) {
  const seen = new Set<string>()
  return value
    .split(/[,;\n]/)
    .map((tag) => tag.trim().replace(/^#+/, ''))
    .filter((tag) => {
      if (!tag || seen.has(tag.toLocaleLowerCase())) return false
      seen.add(tag.toLocaleLowerCase())
      return true
    })
}

function parseNullableNumber(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function parseNumber(value: string) {
  const parsed = parseNullableNumber(value)
  return parsed === null ? 0 : Math.max(0, parsed)
}

function parseNullableInteger(value: string) {
  const parsed = parseNullableNumber(value)
  return parsed === null ? null : Math.max(0, Math.trunc(parsed))
}

function parseInteger(value: string) {
  return Math.max(0, Math.trunc(parseNumber(value)))
}

function parseInfoDensity(value: string) {
  const parsed = parseNullableInteger(value)
  if (parsed === null) return null
  return Math.min(5, Math.max(1, parsed))
}

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat('ko-KR').format(value ?? 0)
}

function formatDecimal(value: number | null | undefined, digits = 1) {
  return (value ?? 0).toLocaleString('ko-KR', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })
}

function formatCompactDecimal(value: number | null | undefined) {
  const nextValue = value ?? 0
  if (Math.abs(nextValue - Math.round(nextValue)) < 0.05) {
    return formatNumber(Math.round(nextValue))
  }

  return formatDecimal(nextValue, 1)
}

function formatAverageCount(value: number | null | undefined) {
  return `${formatCompactDecimal(value)}개`
}

function formatRate(value: number | null | undefined) {
  const nextValue = value ?? 0
  const digits = Math.abs(nextValue) >= 10 ? 1 : 2
  return `${formatDecimal(nextValue, digits)}%`
}

function normalizeLooseValue(value: string | null | undefined) {
  return (value ?? '').trim().toLocaleLowerCase().replace(/\s+/g, '')
}

function normalizeCtaValue(value: string | null | undefined, commentKeyword?: string | null) {
  if (commentKeyword?.trim()) return '댓글 유도'

  const trimmed = value?.trim()
  if (!trimmed) return null

  if (CTA_OPTIONS.includes(trimmed as (typeof CTA_OPTIONS)[number])) {
    return trimmed
  }

  const normalized = normalizeLooseValue(trimmed)

  if (normalized.includes('댓글')) return '댓글 유도'
  if (normalized.includes('dm') || normalized.includes('메시지') || normalized.includes('메세지')) {
    return 'DM 유도'
  }
  if (normalized.includes('저장') || normalized.includes('자료')) return '저장 유도'
  if (normalized.includes('팔로우')) return '팔로우 유도'
  if (normalized.includes('프로필')) return '프로필 방문'
  if (normalized.includes('문의') || normalized.includes('상담')) return '문의 유도'
  if (normalized.includes('없음') || normalized === 'none' || normalized === 'no') return '없음'

  return '기타'
}

function normalizeCategoryValue(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return null

  if (CATEGORY_OPTIONS.includes(trimmed as (typeof CATEGORY_OPTIONS)[number])) {
    return trimmed
  }

  const normalized = normalizeLooseValue(trimmed)

  if (
    normalized.includes('자재') ||
    normalized.includes('자재리스트') ||
    normalized.includes('자재정보')
  ) {
    return '자재추천'
  }
  if (normalized.includes('시공')) return '시공팁'
  if (normalized.includes('욕실')) return '욕실'
  if (normalized.includes('주방')) return '주방'
  if (normalized.includes('조명')) return '조명'
  if (normalized.includes('전기')) return '전기'
  if (normalized.includes('예산') || normalized.includes('비용')) return '예산'
  if (normalized.includes('업체')) return '업체선정'
  if (normalized.includes('계약')) return '계약'
  if (normalized.includes('공정')) return '공정'
  if (normalized.includes('현장')) return '현장'
  if (normalized.includes('체크')) return '체크리스트'
  if (normalized.includes('대표') || normalized.includes('소신')) return '대표소신'
  if (normalized.includes('as') || normalized.includes('하자') || normalized.includes('보수')) {
    return '하자/AS'
  }

  return '기타'
}

function getFormulaConfidence(count: number) {
  if (count === 0) {
    return {
      badge: '데이터 없음',
      title: '조건에 해당하는 영상이 없습니다.',
      description: '필터를 조정하거나 릴스 기록을 추가하면 공통점 분석을 볼 수 있습니다.',
      showFormula: false,
    }
  }

  if (count < 5) {
    return {
      badge: '데이터 부족',
      title: `현재 분석 영상 ${formatNumber(count)}개`,
      description: '의미 있는 공통점 분석을 위해 최소 5개의 영상이 필요합니다.',
      showFormula: false,
    }
  }

  if (count < 10) {
    return {
      badge: '참고용 분석',
      title: '참고용 바이럴 공식',
      description: '표본이 적어 경향 확인용으로만 참고하세요.',
      showFormula: true,
    }
  }

  if (count < 20) {
    return {
      badge: '분석 가능',
      title: '바이럴 공식',
      description: '현재 필터 결과의 공통점을 단순 집계로 요약합니다.',
      showFormula: true,
    }
  }

  return {
    badge: '신뢰도 높음',
    title: '바이럴 공식',
    description: '충분한 표본을 기준으로 현재 필터 결과의 공통점을 요약합니다.',
    showFormula: true,
  }
}

function getSnapshot(reel: ReelsAnalyticsWithSnapshots, type: SnapshotBasis) {
  return reel.snapshots.find((snapshot) => snapshot.snapshot_type === type) ?? null
}

function rateByViews(numerator: number | null | undefined, snapshot: ReelsAnalyticsSnapshot | null) {
  const views = snapshot?.views ?? 0
  if (views <= 0) return 0
  return ((numerator ?? 0) / views) * 100
}

function average<T>(items: T[], getter: (item: T) => number | null | undefined) {
  if (items.length === 0) return 0
  return items.reduce((sum, item) => sum + (getter(item) ?? 0), 0) / items.length
}

function getHookLabel(value: ReelsAnalyticsHookType) {
  return HOOK_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value
}

function getScreenTypeLabel(value: ReelsAnalyticsScreenType | null) {
  if (!value) return '-'
  return SCREEN_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value
}

function getInfoDensityLabel(value: number | null) {
  if (!value) return '-'
  return INFO_DENSITY_OPTIONS.find((option) => option.value === String(value))?.label ?? `${value}/5`
}

function getSelectOptionsWithCurrent(options: readonly string[], current: string) {
  if (!current || options.includes(current)) return options
  return [...options, current]
}

function getSnapshotViewsRange(filters: Filters): [number | null, number | null] {
  if (filters.viewsPreset === 'gte80000') return [80000, null]
  if (filters.viewsPreset === '50000-79999') return [50000, 79999]
  if (filters.viewsPreset === '30000-49999') return [30000, 49999]
  if (filters.viewsPreset === '10000-29999') return [10000, 29999]
  if (filters.viewsPreset === '5000-9999') return [5000, 9999]
  if (filters.viewsPreset === 'lt5000') return [null, 4999]
  if (filters.viewsPreset === 'direct') {
    return [parseNullableInteger(filters.viewsMin), parseNullableInteger(filters.viewsMax)]
  }
  return [null, null]
}

function isInsideNumberRange(value: number, minText: string, maxText: string) {
  const min = parseNullableNumber(minText)
  const max = parseNullableNumber(maxText)
  if (min !== null && value < min) return false
  if (max !== null && value > max) return false
  return true
}

function getViewsPresetLabel(value: ViewsPreset) {
  const labels: Record<ViewsPreset, string> = {
    all: '조회수 전체',
    gte80000: '조회수 8만 이상',
    '50000-79999': '조회수 5만~7.9만',
    '30000-49999': '조회수 3만~4.9만',
    '10000-29999': '조회수 1만~2.9만',
    '5000-9999': '조회수 5천~9,999',
    lt5000: '조회수 5천 미만',
    direct: '조회수 직접 입력',
  }

  return labels[value]
}

function getDatePresetLabel(value: DatePreset) {
  const labels: Record<DatePreset, string> = {
    last30: '최근 30일',
    last90: '최근 90일',
    year: '올해',
    all: '기간 전체',
    direct: '기간 직접 선택',
  }

  return labels[value]
}

function getRangeLabel(label: string, minText: string, maxText: string, suffix = '') {
  const min = minText.trim()
  const max = maxText.trim()

  if (min && max) return `${label} ${min}${suffix}~${max}${suffix}`
  if (min) return `${label} ${min}${suffix} 이상`
  if (max) return `${label} ${max}${suffix} 이하`
  return null
}

function isInsideDateRange(uploadDate: string, filters: Filters) {
  if (filters.datePreset === 'all') return true

  const target = new Date(`${uploadDate}T00:00:00`)
  if (Number.isNaN(target.getTime())) return true

  const now = new Date()
  const start = new Date(now)

  if (filters.datePreset === 'last30') {
    start.setDate(now.getDate() - 30)
    return target >= start
  }

  if (filters.datePreset === 'last90') {
    start.setDate(now.getDate() - 90)
    return target >= start
  }

  if (filters.datePreset === 'year') {
    return target.getFullYear() === now.getFullYear()
  }

  const directStart = filters.dateStart ? new Date(`${filters.dateStart}T00:00:00`) : null
  const directEnd = filters.dateEnd ? new Date(`${filters.dateEnd}T23:59:59`) : null

  if (directStart && target < directStart) return false
  if (directEnd && target > directEnd) return false
  return true
}

function hasTopStructure(reel: ReelsAnalyticsWithSnapshots) {
  const content = [
    reel.title,
    reel.thumbnail_title,
    reel.first_sentence_hook,
    reel.script_original,
  ]
    .filter(Boolean)
    .join(' ')

  return reel.hook_types.includes('top') || /top\s*(5|10)|TOP\s*(5|10)|탑\s*(5|10)/.test(content)
}

function snapshotToForm(snapshot: ReelsAnalyticsSnapshot | null): SnapshotFormState {
  if (!snapshot) return createSnapshotForm()

  return {
    views: String(snapshot.views ?? ''),
    reach: String(snapshot.reach ?? ''),
    avg_watch_time_seconds: String(snapshot.avg_watch_time_seconds ?? ''),
    avg_watch_rate: String(snapshot.avg_watch_rate ?? ''),
    completion_rate: String(snapshot.completion_rate ?? ''),
    likes: String(snapshot.likes ?? ''),
    comments: String(snapshot.comments ?? ''),
    saves: String(snapshot.saves ?? ''),
    shares: String(snapshot.shares ?? ''),
    profile_visits: String(snapshot.profile_visits ?? ''),
    follower_growth: String(snapshot.follower_growth ?? ''),
    dm_count: String(snapshot.dm_count ?? ''),
    inquiry_count: String(snapshot.inquiry_count ?? ''),
    contract_count: String(snapshot.contract_count ?? ''),
  }
}

function reelToForm(reel: ReelsAnalyticsWithSnapshots): ReelFormState {
  return {
    upload_date: reel.upload_date,
    title: reel.title,
    topic: reel.topic ?? '',
    category: normalizeCategoryValue(reel.category) ?? '',
    thumbnail_title: reel.thumbnail_title ?? '',
    video_length_seconds: reel.video_length_seconds === null ? '' : String(reel.video_length_seconds),
    upload_time: reel.upload_time?.slice(0, 5) ?? '',
    upload_weekday: reel.upload_weekday ?? '',
    tagsText: reel.tags.join(', '),
    script_original: reel.script_original ?? '',
    first_sentence_hook: reel.first_sentence_hook ?? '',
    hook_char_count: reel.hook_char_count === null ? '' : String(reel.hook_char_count),
    twist_sentence: reel.twist_sentence ?? '',
    cta: normalizeCtaValue(reel.cta, reel.comment_keyword) ?? '',
    comment_keyword: reel.comment_keyword ?? '',
    screen_type: reel.screen_type ?? '',
    bgm: reel.bgm ?? '',
    scene_change_interval_seconds:
      reel.scene_change_interval_seconds === null ? '' : String(reel.scene_change_interval_seconds),
    first_info_time_seconds:
      reel.first_info_time_seconds === null ? '' : String(reel.first_info_time_seconds),
    hook_types: reel.hook_types,
    info_density: reel.info_density === null ? '' : String(reel.info_density),
    has_product_name: reel.has_product_name,
    product_name_count: String(reel.product_name_count ?? ''),
    has_brand_name: reel.has_brand_name,
    brand_name_count: String(reel.brand_name_count ?? ''),
    has_model_name: reel.has_model_name,
    model_name_count: String(reel.model_name_count ?? ''),
    has_cost: reel.has_cost,
    number_count: String(reel.number_count ?? ''),
    has_checklist: reel.has_checklist,
    has_real_case: reel.has_real_case,
    has_before_after: reel.has_before_after,
    has_site_photo: reel.has_site_photo,
    success_reason: reel.success_reason ?? '',
    failure_reason: reel.failure_reason ?? '',
    improvement_idea: reel.improvement_idea ?? '',
    next_content_idea: reel.next_content_idea ?? '',
    reusable: reel.reusable,
    snapshots: SNAPSHOT_TYPES.reduce(
      (acc, type) => ({
        ...acc,
        [type]: snapshotToForm(getSnapshot(reel, type)),
      }),
      {} as Record<SnapshotBasis, SnapshotFormState>
    ),
  }
}

function buildReelPayload(form: ReelFormState): Omit<ReelInsert, 'user_id'> {
  const hookCharCount =
    parseNullableInteger(form.hook_char_count) ?? Array.from(form.first_sentence_hook).length

  return {
    upload_date: form.upload_date,
    title: form.title.trim(),
    topic: normalizeText(form.topic),
    category: normalizeCategoryValue(form.category),
    thumbnail_title: normalizeText(form.thumbnail_title),
    video_length_seconds: parseNullableInteger(form.video_length_seconds),
    upload_time: normalizeText(form.upload_time),
    upload_weekday: normalizeText(form.upload_weekday),
    tags: parseTags(form.tagsText),
    script_original: normalizeText(form.script_original),
    first_sentence_hook: normalizeText(form.first_sentence_hook),
    hook_char_count: hookCharCount,
    twist_sentence: normalizeText(form.twist_sentence),
    cta: normalizeCtaValue(form.cta, form.comment_keyword),
    comment_keyword: normalizeText(form.comment_keyword),
    screen_type: form.screen_type || null,
    bgm: normalizeText(form.bgm),
    scene_change_interval_seconds: parseNullableNumber(form.scene_change_interval_seconds),
    first_info_time_seconds: parseNullableNumber(form.first_info_time_seconds),
    hook_types: form.hook_types,
    info_density: parseInfoDensity(form.info_density),
    has_product_name: form.has_product_name,
    product_name_count: form.has_product_name ? parseInteger(form.product_name_count) : 0,
    has_brand_name: form.has_brand_name,
    brand_name_count: form.has_brand_name ? parseInteger(form.brand_name_count) : 0,
    has_model_name: form.has_model_name,
    model_name_count: form.has_model_name ? parseInteger(form.model_name_count) : 0,
    has_cost: form.has_cost,
    number_count: parseInteger(form.number_count),
    has_checklist: form.has_checklist,
    has_real_case: form.has_real_case,
    has_before_after: form.has_before_after,
    has_site_photo: form.has_site_photo,
    success_reason: normalizeText(form.success_reason),
    failure_reason: normalizeText(form.failure_reason),
    improvement_idea: normalizeText(form.improvement_idea),
    next_content_idea: normalizeText(form.next_content_idea),
    reusable: form.reusable,
  }
}

function buildSnapshotPayload(
  form: ReelFormState,
  reelId: string,
  userId: string
): SnapshotInsert[] {
  return SNAPSHOT_TYPES.map((snapshotType) => {
    const snapshot = form.snapshots[snapshotType]

    return {
      user_id: userId,
      reel_id: reelId,
      snapshot_type: snapshotType,
      views: parseInteger(snapshot.views),
      reach: parseInteger(snapshot.reach),
      avg_watch_time_seconds: parseNumber(snapshot.avg_watch_time_seconds),
      avg_watch_rate: parseNumber(snapshot.avg_watch_rate),
      completion_rate: parseNumber(snapshot.completion_rate),
      likes: parseInteger(snapshot.likes),
      comments: parseInteger(snapshot.comments),
      saves: parseInteger(snapshot.saves),
      shares: parseInteger(snapshot.shares),
      profile_visits: parseInteger(snapshot.profile_visits),
      follower_growth: parseInteger(snapshot.follower_growth),
      dm_count: parseInteger(snapshot.dm_count),
      inquiry_count: parseInteger(snapshot.inquiry_count),
      contract_count: parseInteger(snapshot.contract_count),
    }
  })
}

function TextInput({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  min,
  max,
  disabled = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  min?: number
  max?: number
  disabled?: boolean
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-bold text-[var(--color-text-secondary)]">{label}</span>
      <input
        type={type}
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-2.5 text-[13px] font-medium text-[var(--color-text-primary)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] focus-visible:border-[var(--color-accent)] focus-visible:[box-shadow:var(--focus-ring)] disabled:cursor-not-allowed disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-text-muted)]"
      />
    </label>
  )
}

function ProductCountInput({
  checked,
  count,
  checkboxLabel,
  countLabel,
  onCheckedChange,
  onCountChange,
}: {
  checked: boolean
  count: string
  checkboxLabel: string
  countLabel: string
  onCheckedChange: (checked: boolean) => void
  onCountChange: (value: string) => void
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border-default)] p-3">
      <label className="mb-2 flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onCheckedChange(event.target.checked)}
          className="accent-[var(--color-accent)]"
        />
        {checkboxLabel}
      </label>
      <TextInput
        label={countLabel}
        type="number"
        value={count}
        onChange={onCountChange}
        disabled={!checked}
      />
    </div>
  )
}

function TextArea({
  label,
  value,
  onChange,
  rows = 4,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  rows?: number
  placeholder?: string
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-bold text-[var(--color-text-secondary)]">{label}</span>
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full resize-y rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-2 text-sm font-medium leading-5 text-[var(--color-text-primary)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] focus-visible:border-[var(--color-accent)] focus-visible:[box-shadow:var(--focus-ring)]"
      />
    </label>
  )
}

function SelectInput<T extends string>({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: T
  onChange: (value: T) => void
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-bold text-[var(--color-text-secondary)]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="h-8 w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-2.5 text-[13px] font-medium text-[var(--color-text-primary)] outline-none transition-[border-color,box-shadow] hover:border-[var(--color-border-strong)] focus-visible:border-[var(--color-accent)] focus-visible:[box-shadow:var(--focus-ring)]"
      >
        {children}
      </select>
    </label>
  )
}

function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="space-y-1">
      <h3 className="text-[15px] font-bold text-[var(--color-text-primary)]">{title}</h3>
      {description && <p className="text-xs font-medium leading-5 text-[var(--color-text-subtle)]">{description}</p>}
    </div>
  )
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-4 shadow-[var(--shadow-sm)] transition-[border-color,box-shadow] hover:border-[var(--color-border-strong)]">
      <p className="text-xs font-semibold text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-2 truncate text-2xl font-bold leading-tight tracking-tight text-[var(--color-text-primary)] tabular-nums [font-variant-numeric:tabular-nums]">
        {value}
      </p>
      {hint && <p className="mt-1.5 truncate text-xs font-medium text-[var(--color-text-subtle)]">{hint}</p>}
    </div>
  )
}

export function ReelsAnalyticsWorkspace() {
  const [reels, setReels] = useState<ReelsAnalyticsWithSnapshots[]>([])
  const [loading, setLoading] = useState(true)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [snapshotBasis, setSnapshotBasis] = useState<SnapshotBasis>('7d')
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS)
  const [detailedFiltersOpen, setDetailedFiltersOpen] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('views_desc')
  const [selectedReelId, setSelectedReelId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingReel, setEditingReel] = useState<ReelsAnalyticsWithSnapshots | null>(null)
  const [form, setForm] = useState<ReelFormState>(() => createEmptyForm())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const fetchReels = useCallback(async () => {
    setLoading(true)
    setRequestError(null)

    try {
      const supabase = createClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) throw userError
      if (!user) throw new Error('로그인이 필요합니다.')

      const { data, error } = await supabase
        .from('reels_analytics')
        .select('*, snapshots:reels_analytics_snapshots(*)')
        .eq('user_id', user.id)
        .order('upload_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw error

      const nextReels = ((data as ReelsAnalyticsWithSnapshots[] | null) ?? []).map((reel) => ({
        ...reel,
        snapshots: [...(reel.snapshots ?? [])].sort(
          (left, right) =>
            SNAPSHOT_TYPES.indexOf(left.snapshot_type as SnapshotBasis) -
            SNAPSHOT_TYPES.indexOf(right.snapshot_type as SnapshotBasis)
        ),
      }))

      setReels(nextReels)
      setSelectedReelId((current) =>
        current && nextReels.some((reel) => reel.id === current) ? current : nextReels[0]?.id ?? null
      )
    } catch (error) {
      console.error('Failed to fetch reels analytics', error)
      setRequestError('릴스 분석 데이터를 불러오지 못했습니다. SQL 파일 적용 여부와 권한을 확인해주세요.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchReels()
  }, [fetchReels])

  const categoryOptions = useMemo(
    () => {
      const savedCategories = reels
        .map((reel) => normalizeCategoryValue(reel.category))
        .filter(Boolean) as string[]
      return Array.from(new Set([...CATEGORY_OPTIONS, ...savedCategories]))
    },
    [reels]
  )

  const ctaOptions = useMemo(
    () => {
      const savedCtas = reels
        .map((reel) => normalizeCtaValue(reel.cta, reel.comment_keyword))
        .filter(Boolean) as string[]
      return Array.from(new Set([...CTA_OPTIONS, ...savedCtas]))
    },
    [reels]
  )

  const activeFilterBadges = useMemo<ActiveFilterBadge[]>(() => {
    const badges: ActiveFilterBadge[] = [
      {
        key: 'snapshot-basis',
        label: SNAPSHOT_LABELS[snapshotBasis],
        onRemove: snapshotBasis === '7d' ? undefined : () => setSnapshotBasis('7d'),
      },
    ]

    if (filters.search.trim()) {
      badges.push({
        key: 'search',
        label: `검색: ${filters.search.trim()}`,
        onRemove: () => updateFilter('search', ''),
      })
    }

    if (filters.viewsPreset !== 'all') {
      badges.push({
        key: 'views',
        label:
          filters.viewsPreset === 'direct'
            ? getRangeLabel('조회수', filters.viewsMin, filters.viewsMax) ?? '조회수 직접 입력'
            : getViewsPresetLabel(filters.viewsPreset),
        onRemove: () => {
          setFilters((current) => ({
            ...current,
            viewsPreset: 'all',
            viewsMin: '',
            viewsMax: '',
          }))
        },
      })
    }

    if (filters.datePreset !== 'all') {
      badges.push({
        key: 'date',
        label:
          filters.datePreset === 'direct'
            ? getRangeLabel('기간', filters.dateStart, filters.dateEnd) ?? '기간 직접 선택'
            : getDatePresetLabel(filters.datePreset),
        onRemove: () => {
          setFilters((current) => ({
            ...current,
            datePreset: 'all',
            dateStart: '',
            dateEnd: '',
          }))
        },
      })
    }

    if (filters.hookType !== 'all') {
      badges.push({
        key: 'hook',
        label: getHookLabel(filters.hookType),
        onRemove: () => updateFilter('hookType', 'all'),
      })
    }

    if (filters.infoDensity !== 'all') {
      badges.push({
        key: 'info-density',
        label: `정보 밀도: ${INFO_DENSITY_OPTIONS.find((option) => option.value === filters.infoDensity)?.label ?? filters.infoDensity}`,
        onRemove: () => updateFilter('infoDensity', 'all'),
      })
    }

    if (filters.screenType !== 'all') {
      badges.push({
        key: 'screen',
        label: getScreenTypeLabel(filters.screenType),
        onRemove: () => updateFilter('screenType', 'all'),
      })
    }

    if (filters.category !== 'all') {
      badges.push({
        key: 'category',
        label: filters.category,
        onRemove: () => updateFilter('category', 'all'),
      })
    }

    if (filters.cta !== 'all') {
      badges.push({
        key: 'cta',
        label: `CTA: ${filters.cta}`,
        onRemove: () => updateFilter('cta', 'all'),
      })
    }

    if (filters.tag.trim()) {
      badges.push({
        key: 'tag',
        label: `태그: ${filters.tag.trim()}`,
        onRemove: () => updateFilter('tag', ''),
      })
    }

    const lengthLabel = getRangeLabel('길이', filters.lengthMin, filters.lengthMax, '초')
    if (lengthLabel) {
      badges.push({
        key: 'length',
        label: lengthLabel,
        onRemove: () => {
          setFilters((current) => ({ ...current, lengthMin: '', lengthMax: '' }))
        },
      })
    }

    const saveRateLabel = getRangeLabel('저장률', filters.saveRateMin, filters.saveRateMax, '%')
    if (saveRateLabel) {
      badges.push({
        key: 'save-rate',
        label: saveRateLabel,
        onRemove: () => {
          setFilters((current) => ({ ...current, saveRateMin: '', saveRateMax: '' }))
        },
      })
    }

    const shareRateLabel = getRangeLabel('공유률', filters.shareRateMin, filters.shareRateMax, '%')
    if (shareRateLabel) {
      badges.push({
        key: 'share-rate',
        label: shareRateLabel,
        onRemove: () => {
          setFilters((current) => ({ ...current, shareRateMin: '', shareRateMax: '' }))
        },
      })
    }

    const completionRateLabel = getRangeLabel(
      '완료율',
      filters.completionRateMin,
      filters.completionRateMax,
      '%'
    )
    if (completionRateLabel) {
      badges.push({
        key: 'completion-rate',
        label: completionRateLabel,
        onRemove: () => {
          setFilters((current) => ({
            ...current,
            completionRateMin: '',
            completionRateMax: '',
          }))
        },
      })
    }

    return badges
  }, [filters, snapshotBasis])

  const hasClearableFilters = activeFilterBadges.some((badge) => badge.onRemove)

  const filteredReels = useMemo(() => {
    const [viewsMin, viewsMax] = getSnapshotViewsRange(filters)
    const search = filters.search.trim().toLocaleLowerCase()
    const tagSearch = filters.tag.trim().replace(/^#+/, '').toLocaleLowerCase()
    const infoDensity =
      filters.infoDensity === 'all' ? null : parseNullableInteger(filters.infoDensity)

    return reels.filter((reel) => {
      const snapshot = getSnapshot(reel, snapshotBasis)
      const views = snapshot?.views ?? 0
      const saveRate = rateByViews(snapshot?.saves, snapshot)
      const shareRate = rateByViews(snapshot?.shares, snapshot)
      const completionRate = snapshot?.completion_rate ?? 0
      const videoLength = reel.video_length_seconds ?? 0

      if (viewsMin !== null && views < viewsMin) return false
      if (viewsMax !== null && views > viewsMax) return false
      if (!isInsideDateRange(reel.upload_date, filters)) return false
      if (filters.hookType !== 'all' && !reel.hook_types.includes(filters.hookType)) return false
      if (infoDensity !== null && reel.info_density !== infoDensity) return false
      if (filters.screenType !== 'all' && reel.screen_type !== filters.screenType) return false
      if (filters.category !== 'all' && normalizeCategoryValue(reel.category) !== filters.category) return false
      if (!isInsideNumberRange(videoLength, filters.lengthMin, filters.lengthMax)) return false
      if (!isInsideNumberRange(saveRate, filters.saveRateMin, filters.saveRateMax)) return false
      if (!isInsideNumberRange(shareRate, filters.shareRateMin, filters.shareRateMax)) return false
      if (
        !isInsideNumberRange(
          completionRate,
          filters.completionRateMin,
          filters.completionRateMax
        )
      ) {
        return false
      }

      if (filters.cta !== 'all' && normalizeCtaValue(reel.cta, reel.comment_keyword) !== filters.cta) return false
      if (
        tagSearch &&
        !reel.tags.some((tag) => tag.toLocaleLowerCase().includes(tagSearch))
      ) {
        return false
      }

      if (search) {
        const searchable = [
          reel.title,
          reel.topic,
          reel.category,
          normalizeCategoryValue(reel.category),
          reel.thumbnail_title,
          reel.first_sentence_hook,
          normalizeCtaValue(reel.cta, reel.comment_keyword),
          reel.comment_keyword,
          reel.script_original,
          reel.tags.join(' '),
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase()

        if (!searchable.includes(search)) return false
      }

      return true
    })
  }, [filters, reels, snapshotBasis])

  const sortedReels = useMemo(() => {
    return [...filteredReels].sort((left, right) => {
      const leftSnapshot = getSnapshot(left, snapshotBasis)
      const rightSnapshot = getSnapshot(right, snapshotBasis)

      if (sortKey === 'views_desc') {
        return (rightSnapshot?.views ?? 0) - (leftSnapshot?.views ?? 0)
      }

      if (sortKey === 'save_rate_desc') {
        return rateByViews(rightSnapshot?.saves, rightSnapshot) - rateByViews(leftSnapshot?.saves, leftSnapshot)
      }

      if (sortKey === 'share_rate_desc') {
        return rateByViews(rightSnapshot?.shares, rightSnapshot) - rateByViews(leftSnapshot?.shares, leftSnapshot)
      }

      if (sortKey === 'completion_rate_desc') {
        return (rightSnapshot?.completion_rate ?? 0) - (leftSnapshot?.completion_rate ?? 0)
      }

      if (sortKey === 'comment_rate_desc') {
        return rateByViews(rightSnapshot?.comments, rightSnapshot) - rateByViews(leftSnapshot?.comments, leftSnapshot)
      }

      if (sortKey === 'follower_growth_desc') {
        return (rightSnapshot?.follower_growth ?? 0) - (leftSnapshot?.follower_growth ?? 0)
      }

      const leftTime = new Date(left.upload_date).getTime()
      const rightTime = new Date(right.upload_date).getTime()
      return sortKey === 'upload_date_asc' ? leftTime - rightTime : rightTime - leftTime
    })
  }, [filteredReels, snapshotBasis, sortKey])

  const selectedReel = useMemo(() => {
    return reels.find((reel) => reel.id === selectedReelId) ?? sortedReels[0] ?? null
  }, [reels, selectedReelId, sortedReels])

  const stats = useMemo(() => {
    const count = filteredReels.length
    const hookCounts = new Map<ReelsAnalyticsHookType, number>()
    const ctaCounts = new Map<string, number>()

    filteredReels.forEach((reel) => {
      const uniqueHooks = Array.from(new Set(reel.hook_types))
      uniqueHooks.forEach((hookType) => hookCounts.set(hookType, (hookCounts.get(hookType) ?? 0) + 1))

      const cta = normalizeCtaValue(reel.cta, reel.comment_keyword)
      if (cta) ctaCounts.set(cta, (ctaCounts.get(cta) ?? 0) + 1)
    })

    const topHookEntry = [...hookCounts.entries()].sort((left, right) => right[1] - left[1])[0]
    const topCtaEntry = [...ctaCounts.entries()].sort((left, right) => right[1] - left[1])[0]

    return {
      count,
      avgViews: average(filteredReels, (reel) => getSnapshot(reel, snapshotBasis)?.views ?? 0),
      avgSaveRate: average(filteredReels, (reel) => {
        const snapshot = getSnapshot(reel, snapshotBasis)
        return rateByViews(snapshot?.saves, snapshot)
      }),
      avgShareRate: average(filteredReels, (reel) => {
        const snapshot = getSnapshot(reel, snapshotBasis)
        return rateByViews(snapshot?.shares, snapshot)
      }),
      avgCompletionRate: average(
        filteredReels,
        (reel) => getSnapshot(reel, snapshotBasis)?.completion_rate ?? 0
      ),
      avgWatchTime: average(
        filteredReels,
        (reel) => getSnapshot(reel, snapshotBasis)?.avg_watch_time_seconds ?? 0
      ),
      avgVideoLength: average(filteredReels, (reel) => reel.video_length_seconds ?? 0),
      avgInfoDensity: average(filteredReels, (reel) => reel.info_density ?? 0),
      topHookLabel: topHookEntry ? getHookLabel(topHookEntry[0]) : '-',
      topHookRate: count > 0 && topHookEntry ? (topHookEntry[1] / count) * 100 : 0,
      mostCta: topCtaEntry?.[0] ?? '-',
      mostCtaRate: count > 0 && topCtaEntry ? (topCtaEntry[1] / count) * 100 : 0,
      avgProductNameCount: average(filteredReels, (reel) => reel.product_name_count),
      avgBrandNameCount: average(filteredReels, (reel) => reel.brand_name_count),
      avgNumberCount: average(filteredReels, (reel) => reel.number_count),
      topTypeUsageRate:
        count > 0
          ? (filteredReels.filter((reel) => reel.hook_types.includes('top')).length / count) * 100
          : 0,
      topStructureRate:
        count > 0 ? (filteredReels.filter((reel) => hasTopStructure(reel)).length / count) * 100 : 0,
    }
  }, [filteredReels, snapshotBasis])

  const formulaConfidence = getFormulaConfidence(stats.count)

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  const updateForm = <K extends keyof ReelFormState>(key: K, value: ReelFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const updateSnapshotForm = (
    snapshotType: SnapshotBasis,
    key: keyof SnapshotFormState,
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      snapshots: {
        ...current.snapshots,
        [snapshotType]: {
          ...current.snapshots[snapshotType],
          [key]: value,
        },
      },
    }))
  }

  const openCreateForm = () => {
    setEditingReel(null)
    setForm(createEmptyForm())
    setFormError(null)
    setFormOpen(true)
  }

  const openEditForm = (reel: ReelsAnalyticsWithSnapshots) => {
    setEditingReel(reel)
    setForm(reelToForm(reel))
    setFormError(null)
    setFormOpen(true)
  }

  const toggleHookType = (hookType: ReelsAnalyticsHookType) => {
    setForm((current) => ({
      ...current,
      hook_types: current.hook_types.includes(hookType)
        ? current.hook_types.filter((value) => value !== hookType)
        : [...current.hook_types, hookType],
    }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!form.title.trim()) {
      setFormError('제목은 필수입니다.')
      return
    }

    if (!form.upload_date) {
      setFormError('업로드 날짜는 필수입니다.')
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      const supabase = createClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) throw userError
      if (!user) throw new Error('Authenticated user not found')

      const payload = buildReelPayload(form)
      const saveResult = editingReel
        ? await supabase
            .from('reels_analytics')
            .update(payload as ReelUpdate)
            .eq('id', editingReel.id)
            .eq('user_id', user.id)
            .select('id')
            .single()
        : await supabase
            .from('reels_analytics')
            .insert({ ...payload, user_id: user.id } as ReelInsert)
            .select('id')
            .single()

      if (saveResult.error) throw saveResult.error

      const savedReelId = (saveResult.data as { id: string }).id
      const snapshotPayload = buildSnapshotPayload(form, savedReelId, user.id)
      const { error: snapshotError } = await supabase
        .from('reels_analytics_snapshots')
        .upsert(snapshotPayload, { onConflict: 'reel_id,snapshot_type' })

      if (snapshotError) throw snapshotError

      await fetchReels()
      setSelectedReelId(savedReelId)
      setFormOpen(false)
      setEditingReel(null)
    } catch (error) {
      console.error('Failed to save reels analytics', error)
      setFormError('릴스 분석 데이터를 저장하지 못했습니다. 입력값과 권한을 확인해주세요.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (reel: ReelsAnalyticsWithSnapshots) => {
    const confirmed = window.confirm(`'${reel.title}' 기록을 삭제할까요?`)
    if (!confirmed) return

    try {
      const supabase = createClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) throw userError
      if (!user) throw new Error('Authenticated user not found')

      const { error } = await supabase
        .from('reels_analytics')
        .delete()
        .eq('id', reel.id)
        .eq('user_id', user.id)

      if (error) throw error

      setReels((current) => current.filter((item) => item.id !== reel.id))
      setSelectedReelId((current) => (current === reel.id ? null : current))
    } catch (error) {
      console.error('Failed to delete reels analytics', error)
      setRequestError('릴스 분석 기록을 삭제하지 못했습니다.')
    }
  }

  return (
    <div className="flex min-h-full flex-col gap-6 bg-[var(--color-bg-canvas)] p-4 sm:p-5 md:p-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-border-soft)] bg-[var(--color-bg-subtle)] px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
            <BarChart2 size={14} />
            조회수 기준 저장률/공유률 집계
          </div>
          <div>
            <h1 className="text-[27px] font-bold tracking-normal text-[var(--color-text-primary)]">
              릴스 성과 분석 데이터베이스
            </h1>
            <p className="mt-1.5 max-w-3xl text-sm font-medium leading-6 text-[var(--color-text-subtle)]">
              디자인앙코르 릴스의 정형 데이터를 누적하고, 훅/구성/성과 스냅샷을 조합해 우리 계정의 반복 가능한 패턴을 찾습니다.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => void fetchReels()}>
            <RefreshCw size={14} />
            새로고침
          </Button>
          <Button type="button" size="sm" onClick={openCreateForm}>
            <Plus size={14} />
            릴스 기록
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-xs font-medium text-[var(--color-text-subtle)]">
          현재 성과 지표는 {SNAPSHOT_LABELS[snapshotBasis]} 스냅샷 기준이며 저장률·공유률은 조회수 기준으로 계산합니다.
        </p>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-7">
          <MetricCard label="영상 개수" value={`${formatNumber(stats.count)}개`} />
          <MetricCard label="평균 조회수" value={formatNumber(Math.round(stats.avgViews))} />
          <MetricCard label="평균 저장률" value={formatRate(stats.avgSaveRate)} />
          <MetricCard label="평균 공유률" value={formatRate(stats.avgShareRate)} />
          <MetricCard label="평균 완료율" value={formatRate(stats.avgCompletionRate)} />
          <MetricCard label="평균 시청시간" value={`${formatDecimal(stats.avgWatchTime)}초`} />
          <MetricCard label="평균 길이" value={`${formatDecimal(stats.avgVideoLength)}초`} />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-5 shadow-[var(--shadow-sm)]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <SectionTitle
              title={formulaConfidence.title}
              description={formulaConfidence.description}
            />
            <span className="rounded-[var(--radius-pill)] border border-[var(--color-border-soft)] bg-[var(--color-bg-subtle)] px-3 py-1 text-xs font-semibold text-[var(--color-accent)]">
              {formulaConfidence.badge}
            </span>
          </div>
          {formulaConfidence.showFormula ? (
            <div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
              <FormulaItem label="선택된 영상" value={`${formatNumber(stats.count)}개`} />
              <FormulaItem label="평균 조회수" value={formatNumber(Math.round(stats.avgViews))} highlight />
              <FormulaItem label="가장 많은 훅" value={`${stats.topHookLabel} ${formatRate(stats.topHookRate)}`} highlight />
              <FormulaItem label="가장 많은 CTA" value={`${stats.mostCta} ${formatRate(stats.mostCtaRate)}`} highlight />
              <FormulaItem label="정보 밀도 평균" value={`${formatDecimal(stats.avgInfoDensity)}/5`} />
              <FormulaItem label="TOP형 사용 비율" value={formatRate(stats.topTypeUsageRate)} />
              <FormulaItem label="TOP5/TOP10 구조" value={formatRate(stats.topStructureRate)} />
              <FormulaBreakdown
                label="제품/브랜드/숫자"
                items={[
                  ['제품', formatCompactDecimal(stats.avgProductNameCount)],
                  ['브랜드', formatCompactDecimal(stats.avgBrandNameCount)],
                  ['숫자', formatCompactDecimal(stats.avgNumberCount)],
                ]}
              />
            </div>
          ) : stats.count > 0 ? (
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <FormulaItem label="현재 참고값 평균 조회수" value={formatNumber(Math.round(stats.avgViews))} />
              <FormulaItem label="현재 참고값 평균 길이" value={`${formatDecimal(stats.avgVideoLength)}초`} />
              <FormulaItem label="현재 참고값 정보 밀도" value={`${formatDecimal(stats.avgInfoDensity)}/5`} />
            </div>
          ) : null}
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-5 shadow-[var(--shadow-sm)]">
          <SectionTitle title="추가 평균" description="현재 필터 결과 기준으로 자동 계산됩니다." />
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <FormulaItem label="평균 제품명 개수" value={formatAverageCount(stats.avgProductNameCount)} />
            <FormulaItem label="평균 브랜드명 개수" value={formatAverageCount(stats.avgBrandNameCount)} />
            <FormulaItem label="평균 숫자 개수" value={formatAverageCount(stats.avgNumberCount)} />
            <FormulaItem label="평균 정보 밀도" value={`${formatDecimal(stats.avgInfoDensity)}/5`} />
          </div>
        </div>
      </section>

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-3">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]">
              <Filter size={13} />
            </span>
            <h2 className="text-sm font-extrabold text-[var(--color-text-primary)]">필터</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setDetailedFiltersOpen((current) => !current)}
              className="inline-flex items-center gap-1 rounded-[var(--radius-md)] px-2 py-1 text-xs font-bold text-[var(--color-text-secondary)] transition-[background-color,color,box-shadow] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
            >
              세부 필터
              {detailedFiltersOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="px-2 py-1 text-xs"
              onClick={() => {
                setFilters(INITIAL_FILTERS)
                setSnapshotBasis('7d')
                setSortKey('views_desc')
              }}
            >
              초기화
            </Button>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <SelectInput label="성과 기준" value={snapshotBasis} onChange={setSnapshotBasis}>
            {SNAPSHOT_TYPES.map((type) => (
              <option key={type} value={type}>
                {SNAPSHOT_LABELS[type]}
              </option>
            ))}
          </SelectInput>

          <SelectInput label="정렬" value={sortKey} onChange={setSortKey}>
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectInput>

          <SelectInput
            label="조회수 범위"
            value={filters.viewsPreset}
            onChange={(value) => updateFilter('viewsPreset', value)}
          >
            <option value="all">전체</option>
            <option value="gte80000">8만 이상</option>
            <option value="50000-79999">5만~7.9만</option>
            <option value="30000-49999">3만~4.9만</option>
            <option value="10000-29999">1만~2.9만</option>
            <option value="5000-9999">5천~9,999</option>
            <option value="lt5000">5천 미만</option>
            <option value="direct">직접 입력</option>
          </SelectInput>

          <SelectInput
            label="기간"
            value={filters.datePreset}
            onChange={(value) => updateFilter('datePreset', value)}
          >
            <option value="all">전체</option>
            <option value="last30">최근 30일</option>
            <option value="last90">최근 90일</option>
            <option value="year">올해</option>
            <option value="direct">직접 선택</option>
          </SelectInput>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-[var(--color-text-secondary)]">검색</span>
            <span className="relative">
              <Search
                size={13}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
              />
              <input
                value={filters.search}
                onChange={(event) => updateFilter('search', event.target.value)}
                placeholder="제목, 주제, 태그"
                className="h-8 w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] pl-8 pr-2.5 text-[13px] font-medium text-[var(--color-text-primary)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] focus-visible:border-[var(--color-accent)] focus-visible:[box-shadow:var(--focus-ring)]"
              />
            </span>
          </label>

          {filters.viewsPreset === 'direct' && (
            <>
              <TextInput label="조회수 최소" type="number" value={filters.viewsMin} onChange={(value) => updateFilter('viewsMin', value)} />
              <TextInput label="조회수 최대" type="number" value={filters.viewsMax} onChange={(value) => updateFilter('viewsMax', value)} />
            </>
          )}

          {filters.datePreset === 'direct' && (
            <>
              <TextInput label="시작일" type="date" value={filters.dateStart} onChange={(value) => updateFilter('dateStart', value)} />
              <TextInput label="종료일" type="date" value={filters.dateEnd} onChange={(value) => updateFilter('dateEnd', value)} />
            </>
          )}
        </div>

        {activeFilterBadges.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {activeFilterBadges.map((badge) => (
              <ActiveFilterPill key={badge.key} badge={badge} />
            ))}
            {hasClearableFilters && (
              <button
                type="button"
                onClick={() => {
                  setFilters(INITIAL_FILTERS)
                  setSnapshotBasis('7d')
                }}
                className="rounded-[var(--radius-pill)] px-2 py-1 text-[11px] font-semibold text-[var(--color-text-subtle)] transition-colors hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
              >
                전체 해제
              </button>
            )}
          </div>
        )}

        {detailedFiltersOpen && (
          <div className="mt-2 grid gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-soft)] bg-[var(--color-bg-surface-soft)] p-2 md:grid-cols-2 xl:grid-cols-5">

          <SelectInput
            label="훅 유형"
            value={filters.hookType}
            onChange={(value) => updateFilter('hookType', value)}
          >
            <option value="all">전체</option>
            {HOOK_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectInput>

          <SelectInput
            label="정보 밀도"
            value={filters.infoDensity}
            onChange={(value) => updateFilter('infoDensity', value)}
          >
            <option value="all">전체</option>
            {INFO_DENSITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectInput>

          <SelectInput
            label="화면 구성"
            value={filters.screenType}
            onChange={(value) => updateFilter('screenType', value)}
          >
            <option value="all">전체</option>
            {SCREEN_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectInput>

          <SelectInput
            label="카테고리"
            value={filters.category}
            onChange={(value) => updateFilter('category', value)}
          >
            <option value="all">전체</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </SelectInput>

          <SelectInput label="CTA" value={filters.cta} onChange={(value) => updateFilter('cta', value)}>
            <option value="all">전체</option>
            {ctaOptions.map((cta) => (
              <option key={cta} value={cta}>
                {cta}
              </option>
            ))}
          </SelectInput>
          <TextInput label="태그" value={filters.tag} onChange={(value) => updateFilter('tag', value)} placeholder="태그명" />
          <TextInput label="길이 최소(초)" type="number" value={filters.lengthMin} onChange={(value) => updateFilter('lengthMin', value)} />
          <TextInput label="길이 최대(초)" type="number" value={filters.lengthMax} onChange={(value) => updateFilter('lengthMax', value)} />
          <TextInput label="저장률 최소(%)" type="number" value={filters.saveRateMin} onChange={(value) => updateFilter('saveRateMin', value)} />
          <TextInput label="저장률 최대(%)" type="number" value={filters.saveRateMax} onChange={(value) => updateFilter('saveRateMax', value)} />
          <TextInput label="공유률 최소(%)" type="number" value={filters.shareRateMin} onChange={(value) => updateFilter('shareRateMin', value)} />
          <TextInput label="공유률 최대(%)" type="number" value={filters.shareRateMax} onChange={(value) => updateFilter('shareRateMax', value)} />
          <TextInput label="완료율 최소(%)" type="number" value={filters.completionRateMin} onChange={(value) => updateFilter('completionRateMin', value)} />
          <TextInput label="완료율 최대(%)" type="number" value={filters.completionRateMax} onChange={(value) => updateFilter('completionRateMax', value)} />
          </div>
        )}
      </section>

      {requestError && (
        <div className="rounded-[var(--radius-lg)] border border-[color-mix(in_srgb,var(--color-danger)_30%,var(--color-border-default))] bg-[color-mix(in_srgb,var(--color-danger)_6%,var(--color-bg-surface))] px-4 py-3 text-sm text-[var(--color-danger)]">
          {requestError}
        </div>
      )}

      <section className="grid min-h-[520px] gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] shadow-[var(--shadow-sm)]">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface-soft)] px-4 py-3.5">
            <div>
              <h2 className="text-[15px] font-bold text-[var(--color-text-primary)]">릴스 목록</h2>
              <p className="mt-0.5 text-xs font-medium text-[var(--color-text-subtle)]">
                저장/공유/댓글/좋아요율은 조회수 기준입니다.
              </p>
            </div>
            <span className="rounded-[var(--radius-pill)] bg-[var(--color-bg-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
              {formatNumber(sortedReels.length)}개
            </span>
          </div>

          {loading ? (
            <div className="flex h-72 items-center justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
            </div>
          ) : sortedReels.length === 0 ? (
            <div className="px-6 py-20 text-center">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                조건에 맞는 릴스 기록이 없습니다
              </p>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                필터를 줄이거나 첫 기록을 추가해보세요.
              </p>
              <div className="mt-4">
                <Button type="button" size="sm" onClick={openCreateForm}>
                  <Plus size={14} />
                  릴스 기록
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] border-collapse text-left text-[13px]">
                <thead className="border-b border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] text-xs font-semibold text-[var(--color-text-secondary)]">
                  <tr>
                    <th className="px-4 py-3.5">업로드</th>
                    <th className="px-4 py-3.5">제목/주제</th>
                    <th className="px-4 py-3.5 text-right">조회수</th>
                    <th className="px-4 py-3.5 text-right">저장률</th>
                    <th className="px-4 py-3.5 text-right">공유률</th>
                    <th className="px-4 py-3.5 text-right">완료율</th>
                    <th className="px-4 py-3.5">훅 유형</th>
                    <th className="px-4 py-3.5">CTA</th>
                    <th className="px-4 py-3.5 text-right">길이</th>
                    <th className="px-4 py-3.5 text-right">액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-soft)]">
                  {sortedReels.map((reel) => {
                    const snapshot = getSnapshot(reel, snapshotBasis)
                    const active = selectedReel?.id === reel.id

                    return (
                      <tr
                        key={reel.id}
                        className={clsx(
                          'transition-colors hover:bg-[var(--color-bg-surface-soft)]',
                          active && 'bg-[color-mix(in_srgb,var(--color-accent)_5%,var(--color-bg-surface))]'
                        )}
                      >
                        <td className="whitespace-nowrap px-4 py-3.5 text-xs text-[var(--color-text-secondary)]">
                          {reel.upload_date}
                        </td>
                        <td className="max-w-[240px] px-4 py-3.5">
                          <p className="truncate text-[13px] font-bold text-[var(--color-text-primary)]">{reel.title}</p>
                          <p className="mt-0.5 truncate text-xs font-medium text-[var(--color-text-subtle)]">
                            {reel.topic || reel.category || '-'}
                          </p>
                        </td>
                        <td className="px-4 py-3.5 text-right text-[13px] font-semibold text-[var(--color-text-primary)] tabular-nums [font-variant-numeric:tabular-nums]">
                          {formatNumber(snapshot?.views)}
                        </td>
                        <td className="px-4 py-3.5 text-right text-[13px] font-semibold text-[var(--color-text-primary)] tabular-nums [font-variant-numeric:tabular-nums]">
                          {formatRate(rateByViews(snapshot?.saves, snapshot))}
                        </td>
                        <td className="px-4 py-3.5 text-right text-[13px] font-semibold text-[var(--color-text-primary)] tabular-nums [font-variant-numeric:tabular-nums]">
                          {formatRate(rateByViews(snapshot?.shares, snapshot))}
                        </td>
                        <td className="px-4 py-3.5 text-right text-[13px] font-semibold text-[var(--color-text-primary)] tabular-nums [font-variant-numeric:tabular-nums]">
                          {formatRate(snapshot?.completion_rate)}
                        </td>
                        <td className="max-w-[180px] px-4 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {reel.hook_types.length > 0
                              ? reel.hook_types.slice(0, 2).map((hookType) => (
                                  <span
                                    key={hookType}
                                    className="rounded-[var(--radius-pill)] bg-[var(--color-bg-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-secondary)]"
                                  >
                                    {getHookLabel(hookType)}
                                  </span>
                                ))
                              : '-'}
                            {reel.hook_types.length > 2 && (
                              <span className="text-[11px] text-[var(--color-text-muted)]">
                                +{reel.hook_types.length - 2}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="max-w-[140px] px-4 py-3.5 text-xs text-[var(--color-text-secondary)]">
                          <p className="truncate font-medium">
                            {normalizeCtaValue(reel.cta, reel.comment_keyword) || '-'}
                          </p>
                          {reel.comment_keyword && (
                            <p className="mt-0.5 truncate text-[11px] text-[var(--color-text-muted)]">
                              {reel.comment_keyword}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right text-[13px] font-semibold text-[var(--color-text-primary)] tabular-nums [font-variant-numeric:tabular-nums]">
                          {reel.video_length_seconds ? `${reel.video_length_seconds}초` : '-'}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setSelectedReelId(reel.id)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
                              aria-label="상세"
                              title="상세"
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditForm(reel)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
                              aria-label="수정"
                              title="수정"
                            >
                              <Edit3 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <DetailPanel
          reel={selectedReel}
          snapshotBasis={snapshotBasis}
          onEdit={selectedReel ? () => openEditForm(selectedReel) : undefined}
          onDelete={selectedReel ? () => void handleDelete(selectedReel) : undefined}
        />
      </section>

      <Modal
        isOpen={formOpen}
        onClose={() => {
          if (!saving) setFormOpen(false)
        }}
        title={editingReel ? '릴스 기록 수정' : '릴스 기록 등록'}
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <SectionTitle title="기본 정보" />
            <div className="grid gap-3 md:grid-cols-3">
              <TextInput label="업로드 날짜" type="date" value={form.upload_date} onChange={(value) => updateForm('upload_date', value)} />
              <TextInput label="제목" value={form.title} onChange={(value) => updateForm('title', value)} />
              <TextInput label="주제" value={form.topic} onChange={(value) => updateForm('topic', value)} />
              <SelectInput label="카테고리" value={form.category} onChange={(value) => updateForm('category', value)}>
                <option value="">선택</option>
                {getSelectOptionsWithCurrent(CATEGORY_OPTIONS, form.category).map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </SelectInput>
              <TextInput label="썸네일 문구" value={form.thumbnail_title} onChange={(value) => updateForm('thumbnail_title', value)} />
              <TextInput label="영상 길이(초)" type="number" value={form.video_length_seconds} onChange={(value) => updateForm('video_length_seconds', value)} />
              <TextInput label="업로드 시간" type="time" value={form.upload_time} onChange={(value) => updateForm('upload_time', value)} />
              <SelectInput label="업로드 요일" value={form.upload_weekday} onChange={(value) => updateForm('upload_weekday', value)}>
                <option value="">선택</option>
                {WEEKDAY_OPTIONS.map((weekday) => (
                  <option key={weekday} value={weekday}>
                    {weekday}
                  </option>
                ))}
              </SelectInput>
              <TextInput label="태그" value={form.tagsText} onChange={(value) => updateForm('tagsText', value)} placeholder="쉼표로 구분" />
            </div>
          </div>

          <div className="space-y-3">
            <SectionTitle title="대본 정보" />
            <TextArea label="대본 원문" value={form.script_original} onChange={(value) => updateForm('script_original', value)} rows={7} />
            <div className="grid gap-3 md:grid-cols-3">
              <TextInput
                label="첫 문장 훅"
                value={form.first_sentence_hook}
                onChange={(value) => {
                  updateForm('first_sentence_hook', value)
                  updateForm('hook_char_count', String(Array.from(value).length))
                }}
              />
              <TextInput label="훅 글자 수" type="number" value={form.hook_char_count} onChange={(value) => updateForm('hook_char_count', value)} />
              <SelectInput label="CTA" value={form.cta} onChange={(value) => updateForm('cta', value)}>
                <option value="">선택</option>
                {getSelectOptionsWithCurrent(CTA_OPTIONS, form.cta).map((cta) => (
                  <option key={cta} value={cta}>
                    {cta}
                  </option>
                ))}
              </SelectInput>
              <TextInput label="댓글 키워드" value={form.comment_keyword} onChange={(value) => updateForm('comment_keyword', value)} placeholder="예: 싱크볼" />
              <TextInput label="반전 문장" value={form.twist_sentence} onChange={(value) => updateForm('twist_sentence', value)} />
            </div>
          </div>

          <div className="space-y-3">
            <SectionTitle title="영상 구성" />
            <div className="grid gap-3 md:grid-cols-4">
              <SelectInput label="화면 구성" value={form.screen_type} onChange={(value) => updateForm('screen_type', value)}>
                <option value="">선택</option>
                {SCREEN_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectInput>
              <TextInput label="BGM" value={form.bgm} onChange={(value) => updateForm('bgm', value)} />
              <TextInput label="장면 전환 간격(초)" type="number" value={form.scene_change_interval_seconds} onChange={(value) => updateForm('scene_change_interval_seconds', value)} />
              <TextInput label="첫 정보 등장(초)" type="number" value={form.first_info_time_seconds} onChange={(value) => updateForm('first_info_time_seconds', value)} />
            </div>
          </div>

          <div className="space-y-3">
            <SectionTitle title="대본 분석" />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {HOOK_TYPE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-default)] px-3 py-2 text-sm text-[var(--color-text-secondary)]"
                >
                  <input
                    type="checkbox"
                    checked={form.hook_types.includes(option.value)}
                    onChange={() => toggleHookType(option.value)}
                    className="accent-[var(--color-accent)]"
                  />
                  {option.label}
                </label>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <SelectInput label="정보 밀도" value={form.info_density} onChange={(value) => updateForm('info_density', value)}>
                <option value="">선택</option>
                {INFO_DENSITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectInput>

              <ProductCountInput
                checked={form.has_product_name}
                count={form.product_name_count}
                checkboxLabel="제품명 포함"
                countLabel="제품명 개수"
                onCheckedChange={(checked) => updateForm('has_product_name', checked)}
                onCountChange={(value) => updateForm('product_name_count', value)}
              />

              <ProductCountInput
                checked={form.has_brand_name}
                count={form.brand_name_count}
                checkboxLabel="브랜드명 포함"
                countLabel="브랜드명 개수"
                onCheckedChange={(checked) => updateForm('has_brand_name', checked)}
                onCountChange={(value) => updateForm('brand_name_count', value)}
              />

              <ProductCountInput
                checked={form.has_model_name}
                count={form.model_name_count}
                checkboxLabel="모델명 포함"
                countLabel="모델명 개수"
                onCheckedChange={(checked) => updateForm('has_model_name', checked)}
                onCountChange={(value) => updateForm('model_name_count', value)}
              />

              <TextInput label="숫자 개수" type="number" value={form.number_count} onChange={(value) => updateForm('number_count', value)} />
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {BOOLEAN_FIELDS.map((field) => (
                <label
                  key={field.key}
                  className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-default)] px-3 py-2 text-sm text-[var(--color-text-secondary)]"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(form[field.key])}
                    onChange={(event) =>
                      updateForm(field.key, event.target.checked as ReelFormState[typeof field.key])
                    }
                    className="accent-[var(--color-accent)]"
                  />
                  {field.label}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <SectionTitle title="성과 스냅샷" description="평균 시청률과 완료율은 퍼센트 숫자로 입력합니다." />
            <div className="grid gap-4 xl:grid-cols-3">
              {SNAPSHOT_TYPES.map((snapshotType) => (
                <div
                  key={snapshotType}
                  className="rounded-[var(--radius-lg)] border border-[var(--color-border-default)] p-3"
                >
                  <h4 className="mb-3 text-sm font-bold text-[var(--color-text-primary)]">
                    {SNAPSHOT_LABELS[snapshotType]}
                  </h4>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                    {SNAPSHOT_METRIC_LABELS.map((metric) => (
                      <TextInput
                        key={metric.key}
                        label={metric.label}
                        type="number"
                        value={form.snapshots[snapshotType][metric.key]}
                        onChange={(value) => updateSnapshotForm(snapshotType, metric.key, value)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <SectionTitle title="상세 메모" />
            <div className="grid gap-3 md:grid-cols-2">
              <TextArea label="잘된 이유" value={form.success_reason} onChange={(value) => updateForm('success_reason', value)} rows={3} />
              <TextArea label="안된 이유" value={form.failure_reason} onChange={(value) => updateForm('failure_reason', value)} rows={3} />
              <TextArea label="개선점" value={form.improvement_idea} onChange={(value) => updateForm('improvement_idea', value)} rows={3} />
              <TextArea label="다음 콘텐츠 아이디어" value={form.next_content_idea} onChange={(value) => updateForm('next_content_idea', value)} rows={3} />
            </div>
          </div>

          {formError && (
            <p className="rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--color-danger)_8%,var(--color-bg-surface))] px-3 py-2 text-sm text-[var(--color-danger)]">
              {formError}
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--color-border-soft)] pt-4">
            <Button type="button" variant="ghost" disabled={saving} onClick={() => setFormOpen(false)}>
              취소
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? '저장 중...' : '저장'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function FormulaItem({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      className={clsx(
        'rounded-[var(--radius-md)] border px-3.5 py-3 transition-[border-color,background-color]',
        highlight
          ? 'border-[var(--color-border-default)] bg-[var(--color-bg-surface)] shadow-[var(--shadow-sm)]'
          : 'border-[var(--color-border-soft)] bg-[var(--color-bg-subtle)]'
      )}
    >
      <p className="text-[11px] font-semibold text-[var(--color-text-subtle)]">{label}</p>
      <p className="mt-1.5 truncate text-sm font-bold tracking-tight text-[var(--color-text-primary)] tabular-nums [font-variant-numeric:tabular-nums]">
        {value}
      </p>
    </div>
  )
}

function FormulaBreakdown({
  label,
  items,
}: {
  label: string
  items: Array<[string, string]>
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3.5 py-3 shadow-[var(--shadow-sm)]">
      <p className="text-[11px] font-semibold text-[var(--color-text-subtle)]">{label}</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {items.map(([itemLabel, value]) => (
          <div key={itemLabel} className="min-w-0 rounded-[var(--radius-sm)] bg-[var(--color-bg-subtle)] px-2 py-1.5">
            <p className="truncate text-[10px] font-medium text-[var(--color-text-subtle)]">{itemLabel}</p>
            <p className="mt-0.5 truncate text-sm font-bold text-[var(--color-text-primary)] tabular-nums [font-variant-numeric:tabular-nums]">
              {value}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function ActiveFilterPill({ badge }: { badge: ActiveFilterBadge }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-border-soft)] bg-[var(--color-bg-subtle)] px-2 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)]">
      {badge.label}
      {badge.onRemove && (
        <button
          type="button"
          onClick={badge.onRemove}
          className="rounded-full px-0.5 text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
          aria-label={`${badge.label} 필터 제거`}
        >
          ×
        </button>
      )}
    </span>
  )
}

function DetailPanel({
  reel,
  snapshotBasis,
  onEdit,
  onDelete,
}: {
  reel: ReelsAnalyticsWithSnapshots | null
  snapshotBasis: SnapshotBasis
  onEdit?: () => void
  onDelete?: () => void
}) {
  if (!reel) {
    return (
      <aside className="rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-5 py-12 text-center shadow-[var(--shadow-sm)]">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">상세를 볼 릴스가 없습니다</p>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">기록을 추가하면 분석 패널이 채워집니다.</p>
      </aside>
    )
  }

  const basisSnapshot = getSnapshot(reel, snapshotBasis)
  const normalizedCta = normalizeCtaValue(reel.cta, reel.comment_keyword)
  const normalizedCategory = normalizeCategoryValue(reel.category)
  const hookTypeText =
    reel.hook_types.length > 0 ? reel.hook_types.map((hookType) => getHookLabel(hookType)).join(', ') : '-'

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] shadow-[var(--shadow-sm)]">
      <div className="border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface-soft)] px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[var(--color-text-subtle)]">
              {SNAPSHOT_LABELS[snapshotBasis]} 상세
            </p>
            <h2 className="mt-1 line-clamp-2 text-[17px] font-bold leading-6 text-[var(--color-text-primary)]">
              {reel.title}
            </h2>
          </div>
          <div className="flex shrink-0 gap-1">
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
                aria-label="수정"
                title="수정"
              >
                <Edit3 size={15} />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-muted)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-danger)_8%,var(--color-bg-surface))] hover:text-[var(--color-danger)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
                aria-label="삭제"
                title="삭제"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <DetailSection title="성과">
          <DetailGrid
            items={[
              ['조회수', formatNumber(basisSnapshot?.views)],
              ['도달', formatNumber(basisSnapshot?.reach)],
              ['저장률', formatRate(rateByViews(basisSnapshot?.saves, basisSnapshot))],
              ['공유률', formatRate(rateByViews(basisSnapshot?.shares, basisSnapshot))],
              ['완료율', formatRate(basisSnapshot?.completion_rate)],
              ['평균 시청시간', `${formatDecimal(basisSnapshot?.avg_watch_time_seconds)}초`],
              ['프로필 방문', formatNumber(basisSnapshot?.profile_visits)],
              ['팔로워 증가', formatNumber(basisSnapshot?.follower_growth)],
            ]}
          />
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[320px] text-left text-xs">
              <thead className="border-b border-[var(--color-border-default)] text-[var(--color-text-subtle)]">
                <tr>
                  <th className="py-2">기준</th>
                  <th className="py-2 text-right">조회수</th>
                  <th className="py-2 text-right">저장</th>
                  <th className="py-2 text-right">공유</th>
                  <th className="py-2 text-right">완료율</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-soft)]">
                {SNAPSHOT_TYPES.map((type) => {
                  const snapshot = getSnapshot(reel, type)
                  return (
                    <tr key={type}>
                      <td className="py-2 font-semibold text-[var(--color-text-primary)]">{SNAPSHOT_LABELS[type]}</td>
                      <td className="py-2 text-right font-semibold text-[var(--color-text-primary)] tabular-nums [font-variant-numeric:tabular-nums]">{formatNumber(snapshot?.views)}</td>
                      <td className="py-2 text-right font-semibold text-[var(--color-text-primary)] tabular-nums [font-variant-numeric:tabular-nums]">{formatNumber(snapshot?.saves)}</td>
                      <td className="py-2 text-right font-semibold text-[var(--color-text-primary)] tabular-nums [font-variant-numeric:tabular-nums]">{formatNumber(snapshot?.shares)}</td>
                      <td className="py-2 text-right font-semibold text-[var(--color-text-primary)] tabular-nums [font-variant-numeric:tabular-nums]">{formatRate(snapshot?.completion_rate)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </DetailSection>

        <DetailSection title="대본 분석">
          <div className="space-y-3 text-sm leading-6">
            <DetailText label="첫 문장" value={reel.first_sentence_hook} />
            <DetailText label="훅 유형" value={hookTypeText} />
            <DetailText label="반전 문장" value={reel.twist_sentence} />
            <DetailText label="CTA" value={normalizedCta} />
            <DetailText label="댓글 키워드" value={reel.comment_keyword} />
            <DetailGrid
              items={[
                ['정보 밀도', getInfoDensityLabel(reel.info_density)],
                ['제품명 개수', reel.has_product_name ? formatAverageCount(reel.product_name_count) : '-'],
                ['브랜드명 개수', reel.has_brand_name ? formatAverageCount(reel.brand_name_count) : '-'],
                ['모델명 개수', reel.has_model_name ? formatAverageCount(reel.model_name_count) : '-'],
              ]}
            />
            <div>
              <p className="mb-1 text-xs font-semibold text-[var(--color-text-subtle)]">대본 원문</p>
              <p className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-[var(--radius-md)] border border-[var(--color-border-soft)] bg-[var(--color-bg-subtle)] p-3 text-xs font-medium leading-5 text-[var(--color-text-primary)]">
                {reel.script_original || '-'}
              </p>
            </div>
          </div>
        </DetailSection>

        <DetailSection title="기본 정보">
          <DetailGrid
            items={[
              ['업로드 날짜', reel.upload_date],
              ['주제', reel.topic || '-'],
              ['카테고리', normalizedCategory || '-'],
              ['화면 구성', getScreenTypeLabel(reel.screen_type)],
              ['영상 길이', reel.video_length_seconds ? `${reel.video_length_seconds}초` : '-'],
              ['태그', reel.tags.length > 0 ? reel.tags.map((tag) => `#${tag}`).join(' ') : '-'],
              ['재활용 여부', reel.reusable ? '가능' : '미정'],
            ]}
          />
        </DetailSection>

        <DetailSection title="메모">
          <div className="space-y-3">
            <DetailText label="잘된 이유" value={reel.success_reason} />
            <DetailText label="안된 이유" value={reel.failure_reason} />
            <DetailText label="개선점" value={reel.improvement_idea} />
            <DetailText label="다음 콘텐츠 아이디어" value={reel.next_content_idea} />
          </div>
        </DetailSection>
      </div>
    </aside>
  )
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-md)] border border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] p-3">
      <h3 className="mb-3 text-sm font-bold text-[var(--color-text-primary)]">{title}</h3>
      {children}
    </section>
  )
}

function DetailGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="grid grid-cols-2 gap-2 text-xs">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-[var(--radius-md)] border border-[var(--color-border-soft)] bg-[var(--color-bg-subtle)] px-3 py-2">
          <dt className="font-semibold text-[var(--color-text-subtle)]">{label}</dt>
          <dd className="mt-1 break-words font-bold text-[var(--color-text-primary)]">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function DetailText({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="mb-1 text-xs font-bold text-[var(--color-text-subtle)]">{label}</p>
      <p className="whitespace-pre-wrap text-sm font-medium leading-6 text-[var(--color-text-primary)]">
        {value || '-'}
      </p>
    </div>
  )
}
