import type { Json } from '@/lib/types'

export type ReferenceAnalysisStatus =
  | 'pending'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'partial'
  | 'unavailable'
  | 'failed'

export type ReferenceRowData = {
  id: string
  canonical_url: string
  platform: string
  title: string | null
  thumbnail_url: string | null
  analysis_status: ReferenceAnalysisStatus
  first_seen_at: string | null
  last_seen_at: string | null
  created_at: string
  sourceCount: number
  latestSourceFolderName: string | null
  latestJobStatus: string | null
}

export type ReferenceSourceData = {
  id: string
  source_folder_name: string | null
  raw_url: string
  custom_title: string | null
  preview_title: string | null
  memo: string | null
  source_created_at: string | null
  source_deleted_at: string | null
  last_seen_at: string | null
}

export type ReferenceJobData = {
  id: string
  job_type: string
  status: string
  priority: number
  attempt_count: number
  failure_code: string | null
  failure_reason: string | null
  created_at: string
  updated_at: string
}

export type ReferenceAnalysisData = {
  id: string
  transcript: string | null
  captions: Json
  viral_factors: Json
  business_use_points: Json
  content_angles: Json
  risk_notes: Json
  completed_at: string
}
