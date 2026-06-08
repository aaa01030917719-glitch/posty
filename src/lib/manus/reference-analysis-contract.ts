export type ReferenceAccessStatus = 'accessible' | 'partially_accessible' | 'inaccessible'
export type ReferenceAudioAccessStatus =
  | 'accessible'
  | 'partially_accessible'
  | 'inaccessible'
  | 'unknown'
export type ReferenceTranscriptSource =
  | 'audio'
  | 'visible_captions'
  | 'post_caption'
  | 'mixed'
  | 'unavailable'
export type ReferenceTranscriptConfidence = 'high' | 'medium' | 'low' | null

export type ReferenceAnalysisResult = {
  source_url: string
  access_status: ReferenceAccessStatus
  access_notes: string
  audio_access_status: ReferenceAudioAccessStatus
  audio_access_notes: string
  transcript: string | null
  transcript_source: ReferenceTranscriptSource
  transcript_confidence: ReferenceTranscriptConfidence
  captions: Array<{
    timestamp: string | null
    text: string
  }>
  viral_factors: {
    hook: string | null
    curiosity: string | null
    loss_aversion: string | null
    retention_devices: string[]
    save_value: string | null
    share_value: string | null
    comment_trigger: string | null
  }
  business_use_points: {
    expert_note: string | null
    caption_addition: string | null
    vendor_request_phrase: string | null
    checklist_items: string[]
  }
  content_angles: string[]
  risk_notes: string[]
}

export const REFERENCE_ANALYSIS_SCHEMA_VERSION = 'posty-reference-analysis-v1'

export const referenceAnalysisStructuredOutputSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    source_url: { type: 'string' },
    access_status: {
      type: 'string',
      enum: ['accessible', 'partially_accessible', 'inaccessible'],
    },
    access_notes: { type: 'string' },
    audio_access_status: {
      type: 'string',
      enum: ['accessible', 'partially_accessible', 'inaccessible', 'unknown'],
    },
    audio_access_notes: { type: 'string' },
    transcript: { type: ['string', 'null'] },
    transcript_source: {
      type: 'string',
      enum: ['audio', 'visible_captions', 'post_caption', 'mixed', 'unavailable'],
    },
    transcript_confidence: {
      type: ['string', 'null'],
      enum: ['high', 'medium', 'low', null],
    },
    captions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          timestamp: { type: ['string', 'null'] },
          text: { type: 'string' },
        },
        required: ['timestamp', 'text'],
      },
    },
    viral_factors: {
      type: 'object',
      additionalProperties: false,
      properties: {
        hook: { type: ['string', 'null'] },
        curiosity: { type: ['string', 'null'] },
        loss_aversion: { type: ['string', 'null'] },
        retention_devices: {
          type: 'array',
          items: { type: 'string' },
        },
        save_value: { type: ['string', 'null'] },
        share_value: { type: ['string', 'null'] },
        comment_trigger: { type: ['string', 'null'] },
      },
      required: [
        'hook',
        'curiosity',
        'loss_aversion',
        'retention_devices',
        'save_value',
        'share_value',
        'comment_trigger',
      ],
    },
    business_use_points: {
      type: 'object',
      additionalProperties: false,
      properties: {
        expert_note: { type: ['string', 'null'] },
        caption_addition: { type: ['string', 'null'] },
        vendor_request_phrase: { type: ['string', 'null'] },
        checklist_items: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: [
        'expert_note',
        'caption_addition',
        'vendor_request_phrase',
        'checklist_items',
      ],
    },
    content_angles: {
      type: 'array',
      items: { type: 'string' },
    },
    risk_notes: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: [
    'source_url',
    'access_status',
    'access_notes',
    'audio_access_status',
    'audio_access_notes',
    'transcript',
    'transcript_source',
    'transcript_confidence',
    'captions',
    'viral_factors',
    'business_use_points',
    'content_angles',
    'risk_notes',
  ],
} as const

export function getReferenceAnalysisStatus(result: ReferenceAnalysisResult) {
  if (result.access_status === 'inaccessible') return 'unavailable'
  if (
    result.transcript_source === 'audio' &&
    result.transcript &&
    result.audio_access_status === 'accessible'
  ) {
    return 'completed'
  }

  return 'partial'
}
