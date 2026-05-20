import type { ChannelType, ContentActivityAction, ContentStatus, Priority } from './types'

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

export const STATUS_BADGE_CLASSES: Record<ContentStatus, string> = {
  idea: 'bg-[#f3f4f6] text-[#6b7280]',
  planning: 'bg-[#f0eeff] text-[#5b3fb5]',
  writing: 'bg-[var(--color-bg-surface-strong)] text-[var(--color-text-body)]',
  review: 'bg-[#e8f4ff] text-[#1a5fa8]',
  scheduled: 'bg-[var(--color-bg-accent-soft)] text-[var(--color-accent)]',
  published: 'bg-[#eaf4e2] text-[#3a6e1a]',
  hold: 'bg-[#f3f4f6] text-[#6b7280]',
}

export const STATUS_LABELS: Record<ContentStatus, string> = {
  idea: '\uC544\uC774\uB514\uC5B4',
  planning: '\uAE30\uD68D\uC911',
  writing: '\uC784\uC2DC\uC800\uC7A5',
  review: '\uAC80\uC218\uC911',
  scheduled: '\uC608\uC57D',
  published: '\uC644\uB8CC',
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

export const ACTIVITY_ACTION_LABELS: Record<ContentActivityAction, string> = {
  content_created: '\uCF58\uD150\uCE20 \uC0DD\uC131',
  draft_saved: '\uC784\uC2DC\uC800\uC7A5',
  completed: '\uC644\uB8CC',
  status_changed: '\uC0C1\uD0DC \uBCC0\uACBD',
  checklist_updated: '\uCCB4\uD06C\uB9AC\uC2A4\uD2B8',
  schedule_changed: '\uC77C\uC815 \uBCC0\uACBD',
  script_updated: '\uB300\uBCF8 \uC218\uC815',
  deleted: '\uC0AD\uC81C\uB428',
  restored: '\uBCF5\uAD6C\uB428',
}

export const ACTIVITY_ACTION_COMPACT_LABELS: Record<ContentActivityAction, string> = {
  content_created: '\uC0DD',
  draft_saved: '\uC784',
  completed: '\uC644',
  status_changed: '\uC0C1',
  checklist_updated: '\uCCB4',
  schedule_changed: '\uC77C',
  script_updated: '\uB300',
  deleted: '\uC0AD',
  restored: '\uBCF5',
}

export const ACTIVITY_ACTION_COMPACT_BADGE_CLASSES: Record<ContentActivityAction, string> = {
  content_created: 'bg-[#eef6ff] text-[#2563a8]',
  draft_saved: 'bg-[#f5f3ff] text-[#6d5fb8]',
  completed: 'bg-[#edf8f0] text-[#2f7a4f]',
  status_changed: 'bg-[#fff4e8] text-[#a65f17]',
  checklist_updated: 'bg-[#eef7f6] text-[#24756f]',
  schedule_changed: 'bg-[#fff8db] text-[#806b16]',
  script_updated: 'bg-[#f3f4f6] text-[#56606d]',
  deleted: 'bg-[#fff0f3] text-[#b33f5d]',
  restored: 'bg-[#eaf7fb] text-[#247388]',
}

export const ACTIVITY_ACTION_FILTERS = [
  { label: '\uC804\uCCB4', value: 'all' },
  { label: '\uC0DD\uC131', value: 'content_created' },
  { label: '\uC784\uC2DC\uC800\uC7A5', value: 'draft_saved' },
  { label: '\uC644\uB8CC', value: 'completed' },
  { label: '\uC0C1\uD0DC \uBCC0\uACBD', value: 'status_changed' },
  { label: '\uCCB4\uD06C\uB9AC\uC2A4\uD2B8', value: 'checklist_updated' },
  { label: '\uC77C\uC815 \uBCC0\uACBD', value: 'schedule_changed' },
  { label: '\uC0AD\uC81C\uB428', value: 'deleted' },
  { label: '\uBCF5\uAD6C\uB428', value: 'restored' },
] as const

export const NAV_ITEMS = [
  { href: '/schedule', label: '\uC77C\uC815', icon: 'Calendar' },
  { href: '/content', label: '\uCF58\uD150\uCE20', icon: 'LayoutGrid' },
  { href: '/scripts', label: '\uC2A4\uD06C\uB9BD\uD2B8', icon: 'FileText' },
  { href: '/ideas', label: '\uC544\uC774\uB514\uC5B4', icon: 'Lightbulb' },
  { href: '/mindmap', label: '\uB9C8\uC778\uB4DC\uB9F5', icon: 'Network' },
  { href: '/dashboard', label: '\uB300\uC2DC\uBCF4\uB4DC', icon: 'BarChart2' },
] as const
