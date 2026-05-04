import type { ChannelType, ContentStatus, Priority } from './types'

export const CHANNEL_COLORS: Record<ChannelType, string> = {
  instagram: '#E1306C',
  threads: '#000000',
  youtube: '#FF0000',
  blog: '#4CAF50',
  custom: '#9CA3AF',
}

export const STATUS_COLORS: Record<ContentStatus, string> = {
  idea: '#9CA3AF',
  planning: '#7C6FF7',
  writing: '#3B9EFF',
  review: '#F97316',
  scheduled: '#E8917E',
  published: '#47C9A2',
  hold: '#D1D5DB',
}

export const STATUS_LABELS: Record<ContentStatus, string> = {
  idea: '아이디어',
  planning: '기획중',
  writing: '작성중',
  review: '검토중',
  scheduled: '예약됨',
  published: '발행됨',
  hold: '보류',
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: '낮음',
  normal: '보통',
  high: '높음',
}

export const CHANNEL_TYPE_LABELS: Record<ChannelType, string> = {
  instagram: 'Instagram',
  threads: 'Threads',
  youtube: 'YouTube',
  blog: '블로그',
  custom: '커스텀',
}

export const NAV_ITEMS = [
  { href: '/schedule', label: '스케줄', icon: 'Calendar' },
  { href: '/content', label: '콘텐츠', icon: 'LayoutGrid' },
  { href: '/scripts', label: '원고', icon: 'FileText' },
  { href: '/ideas', label: '아이디어', icon: 'Lightbulb' },
  { href: '/mindmap', label: '마인드맵', icon: 'Network' },
  { href: '/dashboard', label: '대시보드', icon: 'BarChart2' },
] as const
