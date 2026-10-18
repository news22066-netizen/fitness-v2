import { db, tg } from '@/lib/server'
// Telegram is used ONLY for your admin alerts and Approve / Reject buttons.
export async function POST(req: Request) {
  if (req.headers.get('x-telegram-bot-api-secret-token') !== process.env.WEBHOOK_SECRET) return new Response('no', { status: 401 })
  const c = (await req.json()).callback_query
  if (!c) return Response.json({ ok: true })
  if (String(c.from.id) === process.env.ADMIN_ID) {
    const [act, id] = String(c.data).split(':')
    const edit = (t: string) => tg('editMessageText', { chat_id: c.message.chat.id, message_id: c.message.message_id, text: c.message.text + t })
    if (act === 'ok' || act === 'no') {
      const { data: p } = await db.from('payments').update({ status: act === 'ok' ? 'approved' : 'rejected' }).eq('id', id).eq('status', 'pending').select().single()
      if (p && act === 'ok') await db.from('profiles').update({ is_approved: true, trial_creator_id: p.creator_id, trial_ends_at: new Date(Date.now() + 30 * 864e5).toISOString() }).eq('id', p.user_id)
      await edit(act === 'ok' ? '\n\n✅ APPROVED' : '\n\n❌ REJECTED')
    }
    if (act === 'wd') { await db.from('withdrawals').update({ status: 'paid' }).eq('id', id); await edit('\n\n✅ PAID') }
  }
  await tg('answerCallbackQuery', { callback_query_id: c.id })
  return Response.json({ ok: true })
}
