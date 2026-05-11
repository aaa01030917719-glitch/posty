import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/types'

type ContentActivityLogInsert = Database['public']['Tables']['content_activity_logs']['Insert']

export async function recordContentActivityLog(activity: ContentActivityLogInsert) {
  const supabase = createClient()
  const { error } = await supabase.from('content_activity_logs').insert(activity)

  if (error) {
    throw error
  }
}
