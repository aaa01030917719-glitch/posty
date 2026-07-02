export type ChannelType = 'instagram' | 'threads' | 'youtube' | 'blog' | 'custom'
export type ContentStatus = 'idea' | 'planning' | 'writing' | 'review' | 'scheduled' | 'published' | 'hold'
export type ContentKind = 'content' | 'share_material'
export type ContentMediaType = 'image' | 'video' | 'file'
export type Priority = 'low' | 'normal' | 'high'
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]
export type ReelsAnalyticsScreenType =
  | 'talking'
  | 'site_video'
  | 'photo'
  | 'image'
  | 'ai_image'
  | 'subtitles'
  | 'mixed'
export type ReelsAnalyticsHookType =
  | 'regret'
  | 'top'
  | 'recommendation'
  | 'cost'
  | 'comparison'
  | 'insider_exposure'
  | 'checklist'
  | 'founder_opinion'
  | 'counterintuitive'
  | 'before_after'
  | 'mistake_prevention'
  | 'other'
export type ReelsAnalyticsSnapshotType = '24h' | '7d' | '30d' | 'current'

export interface Profile {
  id: string
  email: string | null
  name: string | null
  avatar_url: string | null
  created_at: string
}

export interface Channel {
  id: string
  user_id: string
  name: string
  type: ChannelType
  color: string
  created_at: string
}

export interface Tag {
  id: string
  user_id: string
  name: string
  color: string
}

export interface ContentProject {
  id: string
  user_id: string
  title: string
  description: string | null
  status: string
  start_date: string | null
  end_date: string | null
  created_at: string
  updated_at: string
}

export type ContentProjectSummary = Pick<ContentProject, 'id' | 'title'>

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

export interface ShareSection {
  id: string
  title: string
  body: string
}

export type ContentScriptSummary = Pick<
  Script,
  'body' | 'caption' | 'hashtags' | 'thumbnail_text'
>

export interface ContentCardMedia {
  id: string
  user_id: string
  card_id: string
  storage_path: string
  file_name: string | null
  mime_type: string | null
  media_type: ContentMediaType
  file_size: number | null
  sort_order: number
  created_at: string
}

export interface ContentCardDraft {
  id: string
  user_id: string
  card_id: string
  title: string
  snapshot: Json
  source_card_updated_at: string | null
  created_at: string
  updated_at: string
}

export interface ContentCard {
  id: string
  user_id: string
  channel_id: string | null
  title: string
  format: string | null
  status: ContentStatus
  priority: Priority
  scheduled_at: string | null
  published_at: string | null
  memo: string | null
  memo_doc?: Json | null
  editor_memo: string | null
  reference_url: string | null
  checklist: ChecklistItem[]
  share_sections: ShareSection[]
  share_body_doc?: Json | null
  content_kind: ContentKind
  idea_id: string | null
  project_id: string | null
  is_deleted: boolean
  deleted_at: string | null
  deleted_reason: string | null
  created_at: string
  updated_at: string
  channel?: Channel
  tags?: Tag[]
  project?: ContentProjectSummary | null
  scripts?: ContentScriptSummary[]
  media?: ContentCardMedia[]
}

export type ContentCardRow = ContentCard & {
  memo_doc: Json | null
  share_body_doc: Json | null
}

export interface Script {
  id: string
  user_id: string
  card_id: string
  title: string | null
  body: string | null
  caption: string | null
  hashtags: string | null
  cta: string | null
  thumbnail_text: string | null
  panel_title: string | null
  is_final: boolean
  created_at: string
  updated_at: string
  card?: ContentCard
}

export interface ContentShareLink {
  id: string
  user_id: string
  card_id: string
  token: string
  is_enabled: boolean
  expires_at: string | null
  created_at: string
  disabled_at: string | null
}

export type InstagramAutoDmLifecycleStatus =
  | 'comment_received'
  | 'keyword_matched'
  | 'waiting_for_user_reply'
  | 'follow_check_pending'
  | 'waiting_for_follow'
  | 'material_sent'
  | 'failed'
  | 'duplicate_skipped'

export type InstagramAutoDmInitialReplyStatus = 'pending' | 'sent' | 'failed'
export type InstagramAutoDmPublicReplyStatus = 'not_attempted' | 'pending' | 'sent' | 'failed'
export type InstagramAutoDmCommentTriggerMode = 'keyword' | 'all_comments'
export type InstagramAutoDmFollowStatus =
  | 'unknown'
  | 'pending'
  | 'following'
  | 'not_following'
  | 'check_failed'
export type InstagramAutoDmDeliveryStatus = 'not_ready' | 'pending' | 'sent' | 'failed'

export interface InstagramConnection {
  id: string
  user_id: string
  instagram_professional_account_id: string
  instagram_username: string
  token_expires_at: string | null
  connected_at: string
  created_at: string
  updated_at: string
}

export interface InstagramAutoDmRule {
  id: string
  user_id: string
  instagram_connection_id: string
  share_link_id: string | null
  title: string
  media_id: string
  media_type: string
  media_permalink: string | null
  media_preview_url: string | null
  keyword: string | null
  comment_trigger_mode: InstagramAutoDmCommentTriggerMode
  initial_private_reply_message: string
  public_comment_reply_message: string
  follow_required_message: string
  /** Server delivery code replaces the required {link} placeholder with the active public share URL. */
  material_delivery_message: string
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface InstagramAutoDmEvent {
  id: string
  user_id: string
  instagram_connection_id: string | null
  rule_id: string | null
  comment_id: string
  media_id: string
  commenter_instagram_scoped_id: string
  commenter_username: string | null
  comment_text: string
  lifecycle_status: InstagramAutoDmLifecycleStatus
  initial_reply_status: InstagramAutoDmInitialReplyStatus
  public_reply_status: InstagramAutoDmPublicReplyStatus
  follow_status: InstagramAutoDmFollowStatus
  delivery_status: InstagramAutoDmDeliveryStatus
  initial_private_reply_message_id: string | null
  public_comment_reply_id: string | null
  material_delivery_message_id: string | null
  initial_private_reply_sent_at: string | null
  public_comment_reply_sent_at: string | null
  user_replied_at: string | null
  follow_checked_at: string | null
  material_sent_at: string | null
  failure_stage: string | null
  failure_code: string | null
  failure_reason: string | null
  attempt_count: number
  created_at: string
  updated_at: string
}

export type ContentActivityAction =
  | 'draft_saved'
  | 'completed'
  | 'deleted'
  | 'restored'
  | 'status_changed'
  | 'schedule_changed'
  | 'content_created'
  | 'script_updated'
  | 'checklist_updated'

export interface ContentActivityLog {
  id: string
  user_id: string
  card_id: string | null
  project_id: string | null
  action: ContentActivityAction | string
  title: string | null
  description: string | null
  metadata: Record<string, unknown>
  created_at: string
  card?: Pick<ContentCard, 'id' | 'title'> | null
  project?: ContentProjectSummary | null
}

export interface ReelsAnalytics {
  id: string
  user_id: string
  upload_date: string
  title: string
  topic: string | null
  category: string | null
  thumbnail_title: string | null
  video_length_seconds: number | null
  upload_time: string | null
  upload_weekday: string | null
  tags: string[]
  script_original: string | null
  first_sentence_hook: string | null
  hook_char_count: number | null
  twist_sentence: string | null
  cta: string | null
  comment_keyword: string | null
  screen_type: ReelsAnalyticsScreenType | null
  bgm: string | null
  scene_change_interval_seconds: number | null
  first_info_time_seconds: number | null
  hook_types: ReelsAnalyticsHookType[]
  info_density: number | null
  has_product_name: boolean
  product_name_count: number
  has_brand_name: boolean
  brand_name_count: number
  has_model_name: boolean
  model_name_count: number
  has_cost: boolean
  number_count: number
  has_checklist: boolean
  has_real_case: boolean
  has_before_after: boolean
  has_site_photo: boolean
  success_reason: string | null
  failure_reason: string | null
  improvement_idea: string | null
  next_content_idea: string | null
  reusable: boolean
  created_at: string
  updated_at: string
}

export interface ReelsAnalyticsSnapshot {
  id: string
  user_id: string
  reel_id: string
  snapshot_type: ReelsAnalyticsSnapshotType
  views: number
  reach: number
  avg_watch_time_seconds: number
  avg_watch_rate: number
  completion_rate: number
  likes: number
  comments: number
  saves: number
  shares: number
  profile_visits: number
  follower_growth: number
  dm_count: number
  inquiry_count: number
  contract_count: number
  created_at: string
  updated_at: string
}

export interface Scene {
  id: string
  script_id: string
  user_id: string
  order_index: number
  title: string | null
  body: string | null
  created_at: string
  updated_at: string
}

export interface Idea {
  id: string
  user_id: string
  title: string
  body: string | null
  channel_type: ChannelType | null
  priority: Priority
  is_archived: boolean
  converted_card_id: string | null
  created_at: string
  tags?: Tag[]
}

export interface Mindmap {
  id: string
  user_id: string
  title: string
  data: { nodes: MindmapNode[]; edges: MindmapEdge[] }
  created_at: string
  updated_at: string
}

export interface MindmapNode {
  id: string
  data: { label: string }
  position: { x: number; y: number }
  type?: string
}

export interface MindmapEdge {
  id: string
  source: string
  target: string
}

// Supabase Database generic type
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at'> & { created_at?: string }
        Update: Partial<Omit<Profile, 'id'>>
      }
      channels: {
        Row: Channel
        Insert: Omit<Channel, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<Channel, 'id'>>
      }
      tags: {
        Row: Tag
        Insert: Omit<Tag, 'id'> & { id?: string }
        Update: Partial<Omit<Tag, 'id'>>
      }
      content_projects: {
        Row: ContentProject
        Insert: Omit<ContentProject, 'id' | 'created_at' | 'updated_at'> & {
          id?: string; created_at?: string; updated_at?: string
        }
        Update: Partial<Omit<ContentProject, 'id'>>
      }
      content_cards: {
        Row: ContentCardRow
        Insert: Omit<
          ContentCardRow,
          | 'id'
          | 'created_at'
          | 'updated_at'
          | 'channel'
          | 'tags'
          | 'project'
          | 'memo_doc'
          | 'editor_memo'
          | 'share_sections'
          | 'share_body_doc'
          | 'is_deleted'
          | 'deleted_at'
          | 'deleted_reason'
        > & {
          id?: string
          created_at?: string
          updated_at?: string
          memo_doc?: Json | null
          editor_memo?: string | null
          share_sections?: ShareSection[]
          share_body_doc?: Json | null
        }
        Update: Partial<Omit<ContentCardRow, 'id' | 'channel' | 'tags' | 'project'>>
      }
      content_card_media: {
        Row: ContentCardMedia
        Insert: Omit<ContentCardMedia, 'id' | 'created_at' | 'file_size'> & {
          id?: string; created_at?: string; file_size?: number | null
        }
        Update: Partial<Omit<ContentCardMedia, 'id' | 'created_at'>>
      }
      content_card_drafts: {
        Row: ContentCardDraft
        Insert: {
          id?: string
          user_id: string
          card_id: string
          title?: string
          snapshot: Json
          source_card_updated_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<ContentCardDraft>
      }
      scripts: {
        Row: Script
        Insert: Omit<Script, 'id' | 'created_at' | 'updated_at' | 'card'> & {
          id?: string; created_at?: string; updated_at?: string
        }
        Update: Partial<Omit<Script, 'id' | 'card'>>
      }
      content_share_links: {
        Row: ContentShareLink
        Insert: Omit<ContentShareLink, 'id' | 'created_at' | 'disabled_at'> & {
          id?: string; created_at?: string; disabled_at?: string | null
        }
        Update: Partial<Omit<ContentShareLink, 'id' | 'created_at'>>
      }
      instagram_connections: {
        Row: InstagramConnection
        Insert: Omit<InstagramConnection, 'id' | 'connected_at' | 'created_at' | 'updated_at'> & {
          id?: string
          connected_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<InstagramConnection, 'id' | 'user_id' | 'created_at'>>
      }
      instagram_auto_dm_rules: {
        Row: InstagramAutoDmRule
        Insert: Omit<InstagramAutoDmRule, 'id' | 'enabled' | 'created_at' | 'updated_at'> & {
          id?: string
          enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<InstagramAutoDmRule, 'id' | 'user_id' | 'created_at'>>
      }
      instagram_auto_dm_events: {
        Row: InstagramAutoDmEvent
        Insert: Omit<
          InstagramAutoDmEvent,
          | 'id'
          | 'lifecycle_status'
          | 'initial_reply_status'
          | 'public_reply_status'
          | 'follow_status'
          | 'delivery_status'
          | 'initial_private_reply_message_id'
          | 'public_comment_reply_id'
          | 'material_delivery_message_id'
          | 'initial_private_reply_sent_at'
          | 'public_comment_reply_sent_at'
          | 'user_replied_at'
          | 'follow_checked_at'
          | 'material_sent_at'
          | 'failure_stage'
          | 'failure_code'
          | 'failure_reason'
          | 'attempt_count'
          | 'created_at'
          | 'updated_at'
        > & {
          id?: string
          lifecycle_status?: InstagramAutoDmLifecycleStatus
          initial_reply_status?: InstagramAutoDmInitialReplyStatus
          public_reply_status?: InstagramAutoDmPublicReplyStatus
          follow_status?: InstagramAutoDmFollowStatus
          delivery_status?: InstagramAutoDmDeliveryStatus
          initial_private_reply_message_id?: string | null
          public_comment_reply_id?: string | null
          material_delivery_message_id?: string | null
          initial_private_reply_sent_at?: string | null
          public_comment_reply_sent_at?: string | null
          user_replied_at?: string | null
          follow_checked_at?: string | null
          material_sent_at?: string | null
          failure_stage?: string | null
          failure_code?: string | null
          failure_reason?: string | null
          attempt_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<InstagramAutoDmEvent, 'id' | 'user_id' | 'created_at'>>
      }
      content_activity_logs: {
        Row: ContentActivityLog
        Insert: Omit<ContentActivityLog, 'id' | 'created_at' | 'card' | 'project'> & {
          id?: string; created_at?: string
        }
        Update: Partial<Omit<ContentActivityLog, 'id' | 'created_at' | 'card' | 'project'>>
      }
      reels_analytics: {
        Row: ReelsAnalytics
        Insert: Omit<ReelsAnalytics, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<ReelsAnalytics, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
      }
      reels_analytics_snapshots: {
        Row: ReelsAnalyticsSnapshot
        Insert: Omit<ReelsAnalyticsSnapshot, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<
          Omit<
            ReelsAnalyticsSnapshot,
            'id' | 'user_id' | 'reel_id' | 'snapshot_type' | 'created_at' | 'updated_at'
          >
        >
      }
      ideas: {
        Row: Idea
        Insert: Omit<Idea, 'id' | 'created_at' | 'tags'> & { id?: string; created_at?: string }
        Update: Partial<Omit<Idea, 'id' | 'tags'>>
      }
      mindmaps: {
        Row: Mindmap
        Insert: Omit<Mindmap, 'id' | 'created_at' | 'updated_at'> & {
          id?: string; created_at?: string; updated_at?: string
        }
        Update: Partial<Omit<Mindmap, 'id'>>
      }
      card_tags: {
        Row: { card_id: string; tag_id: string }
        Insert: { card_id: string; tag_id: string }
        Update: never
      }
      idea_tags: {
        Row: { idea_id: string; tag_id: string }
        Insert: { idea_id: string; tag_id: string }
        Update: never
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
