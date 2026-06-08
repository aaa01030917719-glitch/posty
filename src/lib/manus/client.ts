import 'server-only'

import {
  REFERENCE_ANALYSIS_SCHEMA_VERSION,
  referenceAnalysisStructuredOutputSchema,
} from './reference-analysis-contract'
import { buildReferenceAnalysisPrompt } from './reference-analysis-prompt'
import type {
  CreateReferenceAnalysisTaskInput,
  ManusListMessagesResponse,
  ManusTaskCreateResponse,
  ManusTaskDetailResponse,
  ManusWebhookCreateResponse,
  ManusWebhookListResponse,
  ManusWebhookPublicKeyResponse,
} from './types'

const MANUS_API_BASE_URL = 'https://api.manus.ai/v2'
const DEFAULT_TIMEOUT_MS = 20_000

export class ManusApiError extends Error {
  code: string
  status: number
  requestId: string | null

  constructor({
    code,
    message,
    status,
    requestId,
  }: {
    code: string
    message: string
    status: number
    requestId?: string | null
  }) {
    super(message)
    this.name = 'ManusApiError'
    this.code = code
    this.status = status
    this.requestId = requestId ?? null
  }
}

function getApiKey() {
  const apiKey = process.env.MANUS_API_KEY
  if (!apiKey) {
    throw new ManusApiError({
      code: 'manus_api_key_missing',
      message: 'Manus API key is not configured.',
      status: 503,
    })
  }

  return apiKey
}

export function getManusAgentProfile() {
  return process.env.MANUS_AGENT_PROFILE || 'manus-1.6-lite'
}

export function getReferencesQueueBatchSize() {
  const parsed = Number(process.env.REFERENCES_QUEUE_BATCH_SIZE)
  if (!Number.isFinite(parsed) || parsed < 1) return 1

  return Math.min(Math.floor(parsed), 5)
}

async function manusFetch<T>(
  endpoint: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${MANUS_API_BASE_URL}${endpoint}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-manus-api-key': getApiKey(),
        ...init.headers,
      },
    })
    const payload = await response.json().catch(() => ({}))
    const requestId =
      payload && typeof payload === 'object' && 'request_id' in payload
        ? String(payload.request_id)
        : null

    if (!response.ok || payload?.ok === false) {
      const message =
        payload?.error?.message ||
        payload?.error ||
        `Manus API request failed with status ${response.status}.`

      throw new ManusApiError({
        code: payload?.error?.code || `manus_http_${response.status}`,
        message: typeof message === 'string' ? message : 'Manus API request failed.',
        status: response.status,
        requestId,
      })
    }

    return payload as T
  } catch (error) {
    if (error instanceof ManusApiError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ManusApiError({
        code: 'manus_request_timeout',
        message: 'Manus API request timed out.',
        status: 504,
      })
    }

    throw new ManusApiError({
      code: 'manus_request_failed',
      message: 'Manus API request failed.',
      status: 502,
    })
  } finally {
    clearTimeout(timeout)
  }
}

export async function createReferenceAnalysisTask(input: CreateReferenceAnalysisTaskInput) {
  const body: Record<string, unknown> = {
    title: input.title || `Posty reference analysis: ${input.sourceUrl}`,
    message: {
      content: buildReferenceAnalysisPrompt(input.sourceUrl),
    },
    locale: 'ko',
    agent_profile: getManusAgentProfile(),
    interactive_mode: false,
    hide_in_task_list: true,
    share_visibility: 'private',
    structured_output_schema: referenceAnalysisStructuredOutputSchema,
  }

  if (process.env.MANUS_PROJECT_ID) {
    body.project_id = process.env.MANUS_PROJECT_ID
  }

  const result = await manusFetch<ManusTaskCreateResponse>('/task.create', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  return {
    taskId: result.task_id ?? null,
    taskUrl: result.task_url ?? result.share_url ?? null,
    requestId: result.request_id ?? null,
    schemaVersion: REFERENCE_ANALYSIS_SCHEMA_VERSION,
  }
}

export async function getTaskDetail(taskId: string) {
  const params = new URLSearchParams({ task_id: taskId })

  return manusFetch<ManusTaskDetailResponse>(`/task.detail?${params.toString()}`, {
    method: 'GET',
  })
}

export async function listTaskMessages(taskId: string) {
  const params = new URLSearchParams({
    task_id: taskId,
    order: 'desc',
    limit: '20',
  })

  return manusFetch<ManusListMessagesResponse>(
    `/task.listMessages?${params.toString()}`,
    { method: 'GET' }
  )
}

export async function getWebhookPublicKey() {
  return manusFetch<ManusWebhookPublicKeyResponse>('/webhook.publicKey', {
    method: 'GET',
  })
}

export async function listWebhooks() {
  return manusFetch<ManusWebhookListResponse>('/webhook.list', { method: 'GET' })
}

export async function createWebhook(url: string) {
  return manusFetch<ManusWebhookCreateResponse>('/webhook.create', {
    method: 'POST',
    body: JSON.stringify({ url }),
  })
}
