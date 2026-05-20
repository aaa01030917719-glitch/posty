export type ChannelType = 'instagram' | 'threads' | 'youtube' | 'blog' | 'custom'
export type ContentStatus = 'idea' | 'planning' | 'writing' | 'review' | 'scheduled' | 'published' | 'hold'
export type Priority = 'low' | 'normal' | 'high'

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
  editor_memo: string | null
  reference_url: string | null
  checklist: ChecklistItem[]
  share_sections: ShareSection[]
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
        Row: ContentCard
        Insert: Omit<
          ContentCard,
          | 'id'
          | 'created_at'
          | 'updated_at'
          | 'channel'
          | 'tags'
          | 'project'
          | 'editor_memo'
          | 'share_sections'
          | 'is_deleted'
          | 'deleted_at'
          | 'deleted_reason'
        > & {
          id?: string
          created_at?: string
          updated_at?: string
          editor_memo?: string | null
          share_sections?: ShareSection[]
        }
        Update: Partial<Omit<ContentCard, 'id' | 'channel' | 'tags' | 'project'>>
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
      content_activity_logs: {
        Row: ContentActivityLog
        Insert: Omit<ContentActivityLog, 'id' | 'created_at' | 'card' | 'project'> & {
          id?: string; created_at?: string
        }
        Update: Partial<Omit<ContentActivityLog, 'id' | 'created_at' | 'card' | 'project'>>
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
