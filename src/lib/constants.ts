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
  idea: '\uC544\uC774\uB514\uC5B4',
  planning: '\uAE30\uD68D\uC911',
  writing: '\uC791\uC131\uC911',
  review: '\uAC80\uC218\uC911',
  scheduled: '\uC608\uC57D',
  published: '\uBC1C\uD589',
  hold: '\uBCF4\uB958',
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: '\uB0AE\uC74C',
  normal: '\uBCF4\uD1B5',
  high: '\uB192\uC74C',
}

export const CHANNEL_TYPE_LABELS: Record<ChannelType, string> = {
  instagram: 'Instagram',
  threads: 'Threads',
  youtube: 'YouTube',
  blog: '\uBE14\uB85C\uADF8',
  custom: '\uCEE4\uC2A4\uD140',
}

export const NAV_ITEMS = [
  { href: '/schedule', label: '\uC77C\uC815', icon: 'Calendar' },
  { href: '/content', label: '\uCF58\uD150\uCE20', icon: 'LayoutGrid' },
  { href: '/scripts', label: '\uC2A4\uD06C\uB9BD\uD2B8', icon: 'FileText' },
  { href: '/ideas', label: '\uC544\uC774\uB514\uC5B4', icon: 'Lightbulb' },
  { href: '/mindmap', label: '\uB9C8\uC778\uB4DC\uB9F5', icon: 'Network' },
  { href: '/dashboard', label: '\uB300\uC2DC\uBCF4\uB4DC', icon: 'BarChart2' },
] as const
