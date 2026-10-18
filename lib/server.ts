import { createClient } from '@supabase/supabase-js'
export const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
export async function getUser(req: Request) {
  const t = (req.headers.get('authorization') || '').replace('Bearer ', '')
  if (!t) return null
  const { data } = await db.auth.getUser(t)
  return data.user ? { id: data.user.id } : null
}
export const tg = (method: string, body: any) =>
  fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json())
export const admin = (text: string, extra: any = {}, topic?: string) =>
  tg('sendMessage', { chat_id: process.env.ADMIN_CHAT_ID, text, ...(topic ? { message_thread_id: Number(topic) } : {}), ...extra })
