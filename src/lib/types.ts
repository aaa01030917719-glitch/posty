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

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
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
  reference_url: string | null
  checklist: ChecklistItem[]
  idea_id: string | null
  created_at: string
  updated_at: string
  channel?: Channel
  tags?: Tag[]
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
      content_cards: {
        Row: ContentCard
        Insert: Omit<ContentCard, 'id' | 'created_at' | 'updated_at' | 'channel' | 'tags'> & {
          id?: string; created_at?: string; updated_at?: string
        }
        Update: Partial<Omit<ContentCard, 'id' | 'channel' | 'tags'>>
      }
      scripts: {
        Row: Script
        Insert: Omit<Script, 'id' | 'created_at' | 'updated_at' | 'card'> & {
          id?: string; created_at?: string; updated_at?: string
        }
        Update: Partial<Omit<Script, 'id' | 'card'>>
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
