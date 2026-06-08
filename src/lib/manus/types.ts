import type { ReferenceAnalysisResult } from './reference-analysis-contract'

export type ManusApiErrorPayload = {
  code?: string
  message?: string
}

export type ManusTaskCreateResponse = {
  ok: boolean
  request_id?: string
  task_id?: string
  task_title?: string
  task_url?: string
  share_url?: string
  error?: ManusApiErrorPayload
}

export type ManusTaskDetailResponse = {
  ok: boolean
  request_id?: string
  task?: {
    id?: string
    status?: 'running' | 'stopped' | 'waiting' | 'error' | string
    credit_usage?: number
    task_url?: string
  }
  error?: ManusApiErrorPayload
}

export type ManusMessage = {
  id?: string
  timestamp?: number
  type?: string
  status_update?: {
    status?: 'running' | 'stopped' | 'waiting' | 'error' | string
    agent_status?: 'running' | 'stopped' | 'waiting' | 'error' | string
    stop_reason?: string | null
  }
  structured_output_result?: {
    success: boolean
    value?: ReferenceAnalysisResult
    error?: string | null
  }
  error_message?: {
    message?: string
    code?: string
  }
}

export type ManusListMessagesResponse = {
  ok: boolean
  request_id?: string
  task_id?: string
  messages?: ManusMessage[]
  has_more?: boolean
  next_cursor?: string
  error?: ManusApiErrorPayload
}

export type ManusWebhookPublicKeyResponse = {
  ok: boolean
  request_id?: string
  public_key?: string
  algorithm?: 'RSA-SHA256' | string
  error?: ManusApiErrorPayload
}

export type ManusWebhookListResponse = {
  ok: boolean
  request_id?: string
  data?: Array<{
    id: string
    url: string
    status?: 'active' | 'inactive' | string
    created_at?: number
  }>
  error?: ManusApiErrorPayload
}

export type ManusWebhookCreateResponse = {
  ok: boolean
  request_id?: string
  webhook?: {
    id: string
    url: string
    status?: 'active' | 'inactive' | string
    created_at?: number
  }
  error?: ManusApiErrorPayload
}

export type CreateReferenceAnalysisTaskInput = {
  sourceUrl: string
  title?: string | null
}
