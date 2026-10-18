import { db, getUser, admin } from '@/lib/server'
const FEE = 100, PRICE = () => Number(process.env.PLAN_PRICE_BDT || 0)
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString() }
const err = (e: string, s = 400) => Response.json({ error: e }, { status: s })
// Bangladesh time is UTC+6 (no daylight saving). We count days in Bangladesh time so streaks are fair.
const day = (t: number | string) => new Date(new Date(t).getTime() + 6 * 3600 * 1000).toISOString().slice(0, 10)
const addDays = (d: string, n: number) => new Date(new Date(d + 'T00:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10)
async function balance(cid: string) {
  const { data: pay } = await db.from('payments').select('amount_bdt').eq('creator_id', cid).eq('status', 'approved')
  const { data: wd } = await db.from('withdrawals').select('amount_bdt,fee_bdt').eq('creator_id', cid).neq('status', 'rejected')
  const gross = (pay || []).reduce((s, p) => s + p.amount_bdt, 0), cut = Math.round(gross * 0.05)
  return { gross, cut, members: pay?.length || 0, net: gross - cut - (wd || []).reduce((s, w) => s + w.amount_bdt + w.fee_bdt, 0) }
}
export async function POST(req: Request) {
  const user = await getUser(req)
  if (!user) return err('Please log in.', 401)
  const { action, ...a } = await req.json()
  const { data: me, error: e1 } = await db.from('profiles').select('*').eq('id', user.id).maybeSingle()
  const { data: cr, error: e2 } = await db.from('creators').select('*').eq('user_id', user.id).maybeSingle()
  if (e1 || e2) return err(`Database error: ${(e1 || e2)!.message}`, 500)
  const ok = !!cr || !!(me?.is_approved && me.trial_ends_at && new Date(me.trial_ends_at) > new Date())

  if (action === 'me') {
    const { data: creators } = await db.from('creators').select('id,name')
    return Response.json({ me, isCreator: !!cr, creators, active: ok, price: PRICE() })
  }
  if (action === 'saveProfile') {
    const name = String(a.name || '').trim().slice(0, 60), phone = String(a.phone || '').replace(/[\s-]/g, '')
    if (!name) return err('Enter your name.')
    if (!/^(\+?88)?01[3-9]\d{8}$/.test(phone)) return err('Enter a valid Bangladesh mobile number, like 017XXXXXXXX.')
    const { error } = await db.from('profiles').upsert({ id: user.id, full_name: name, phone_number: phone })
    return error ? err(error.message, 500) : Response.json({ ok: true })
  }
  if (!me) return err('Finish your profile first.')
  if (action === 'apply') {
    const txn = String(a.txn || '').trim().toUpperCase()
    if (!/^[A-Z0-9]{8,12}$/.test(txn)) return err('TxnID looks wrong. Copy it from your bKash receipt.')
    const { data: c } = await db.from('creators').select('name').eq('id', a.creator_id).maybeSingle()
    if (!c) return err('Choose a trainer.')
    const { data: p, error } = await db.from('payments').insert({ user_id: user.id, creator_id: a.creator_id, amount_bdt: PRICE(), bkash_txn_id: txn }).select().single()
    if (error) return err('This TxnID was already used.')
    await admin(`🚨 NEW PAYMENT REQUEST\n👤 ${me.full_name}\n📱 ${me.phone_number}\n🔑 ${txn}\n💰 ${p.amount_bdt} BDT\n🏋 ${c.name}`,
      { reply_markup: { inline_keyboard: [[{ text: '✅ APPROVE', callback_data: `ok:${p.id}` }, { text: '❌ REJECT', callback_data: `no:${p.id}` }]] } }, process.env.TOPIC_TRIALS)
    return Response.json({ ok: true })
  }
  // ---- FREE actions (no trial needed) ----
  if (action === 'progress') {
    const since = new Date(Date.now() - 400 * 864e5).toISOString()
    const { data, error } = await db.from('sessions').select('id,reps,seconds,title,source,created_at,videos(title)').eq('user_id', user.id).gte('created_at', since).order('created_at', { ascending: false }).limit(2000)
    if (error) return err(error.message, 500)
    const rows = (data || []) as any[]
    const secByDay: Record<string, number> = {}
    rows.forEach(r => { const d = day(r.created_at); secByDay[d] = (secByDay[d] || 0) + (r.seconds || 0) })
    const active = (d: string) => (secByDay[d] || 0) >= 60 // a day counts if you trained at least 1 minute
    const t = day(Date.now())
    let streak = 0, cur = active(t) ? t : addDays(t, -1)
    while (active(cur)) { streak++; cur = addDays(cur, -1) }
    const days = Object.keys(secByDay).filter(active).sort()
    let best = 0, run = 0
    days.forEach((d, i) => { run = i > 0 && addDays(days[i - 1], 1) === d ? run + 1 : 1; best = Math.max(best, run) })
    const week = Array.from({ length: 7 }, (_, i) => { const d = addDays(t, i - 6); return { day: d, minutes: Math.round((secByDay[d] || 0) / 60) } })
    const history = rows.slice(0, 30).map(r => ({ id: r.id, title: r.title || r.videos?.title || 'Workout', minutes: Math.round((r.seconds || 0) / 60), reps: r.reps || 0, manual: r.source === 'manual', day: day(r.created_at) }))
    return Response.json({ goal: me.daily_goal_minutes || 20, todayMinutes: Math.round((secByDay[t] || 0) / 60), streak, best, total: rows.length, week, history })
  }
  if (action === 'logWorkout') {
    const title = String(a.title || '').trim().slice(0, 40), minutes = Math.round(Number(a.minutes))
    if (!title) return err('Type what you did, like Walking or Football.')
    if (!(minutes >= 1 && minutes <= 600)) return err('Minutes must be between 1 and 600.')
    const { error } = await db.from('sessions').insert({ user_id: user.id, title, seconds: minutes * 60, source: 'manual' })
    return error ? err(error.message, 500) : Response.json({ ok: true })
  }
  if (action === 'setGoal') {
    const m = Math.round(Number(a.minutes))
    if (!(m >= 5 && m <= 240)) return err('Pick a goal between 5 and 240 minutes.')
    const { error } = await db.from('profiles').update({ daily_goal_minutes: m }).eq('id', user.id)
    return error ? err(error.message, 500) : Response.json({ ok: true })
  }
  if (action === 'bodyLogs') {
    const since = addDays(day(Date.now()), -89)
    const { data, error } = await db.from('weight_logs').select('log_date,weight_kg,calories').eq('user_id', user.id).gte('log_date', since).order('log_date', { ascending: true })
    if (error) return err(error.message, 500)
    return Response.json({ today: day(Date.now()), logs: (data || []).map((r: any) => ({ date: r.log_date, weight: r.weight_kg === null ? null : Number(r.weight_kg), calories: r.calories })) })
  }
  if (action === 'saveBody') {
    const t = day(Date.now()), d = String(a.date || t).slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d > t || d < addDays(t, -365)) return err('Pick a date from the last year, not in the future.')
    const blank = (x: any) => x === undefined || x === null || String(x).trim() === ''
    const w = blank(a.weight) ? null : Math.round(Number(a.weight) * 10) / 10, c = blank(a.calories) ? null : Math.round(Number(a.calories))
    if (w === null && c === null) return err('Enter your weight, your calories, or both.')
    if (w !== null && !(w >= 20 && w <= 400)) return err('Weight must be between 20 and 400 kg.')
    if (c !== null && !(c >= 0 && c <= 20000)) return err('Calories must be between 0 and 20000.')
    const { data: old } = await db.from('weight_logs').select('weight_kg,calories').eq('user_id', user.id).eq('log_date', d).maybeSingle()
    const { error } = await db.from('weight_logs').upsert({ user_id: user.id, log_date: d, weight_kg: w ?? old?.weight_kg ?? null, calories: c ?? old?.calories ?? null }, { onConflict: 'user_id,log_date' })
    return error ? err(error.message, 500) : Response.json({ ok: true })
  }
  if (['feed', 'board', 'finish'].includes(action) && !ok) return err('locked', 403)
  if (action === 'feed') {
    const { data: videos } = await db.from('videos').select('id,youtube_id,title,discipline,duration_minutes,creator_id,creators(name)').order('created_at', { ascending: false }).limit(60)
    const cid = me.trial_creator_id
    const link = cid ? (await db.from('creators').select('telegram_community_link').eq('id', cid).maybeSingle()).data?.telegram_community_link : null
    return Response.json({ videos, myCreator: cid, community: link })
  }
  if (action === 'board') {
    const { data } = await db.from('sessions').select('user_id,reps,profiles(full_name)').eq('video_id', a.video_id).gte('created_at', today()).order('reps', { ascending: false })
    return Response.json({ count: data?.length || 0, top: (data || []).slice(0, 3).map((s: any) => ({ name: s.profiles?.full_name, reps: s.reps, you: s.user_id === user.id })) })
  }
  if (action === 'finish') {
    await db.from('sessions').insert({ user_id: user.id, video_id: a.video_id, reps: Math.min(Number(a.reps) || 0, 5000), seconds: Math.min(Number(a.seconds) || 0, 14400) })
    return Response.json({ ok: true })
  }
  if (!cr) return err('Creators only.', 403)
  if (action === 'addVideo') {
    const m = String(a.url).match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/)
    if (!m) return err('Paste a valid YouTube link.')
    await db.from('videos').insert({ creator_id: cr.id, youtube_id: m[1], title: String(a.title || 'Workout').slice(0, 80), discipline: a.discipline, duration_minutes: Number(a.minutes) || 10 })
    return Response.json({ ok: true })
  }
  if (action === 'ledger') return Response.json({ ...(await balance(cr.id)), fee: FEE })
  if (action === 'withdraw') {
    const { net } = await balance(cr.id)
    if (net <= FEE) return err(`Balance must be above ${FEE} BDT.`)
    const { data: w } = await db.from('withdrawals').insert({ creator_id: cr.id, amount_bdt: net - FEE, fee_bdt: FEE }).select().single()
    await admin(`💸 CASH-OUT\n🏋 ${cr.name}\nbKash: ${cr.bkash_number}\nSend: ${net - FEE} BDT (after ${FEE} fee)`, { reply_markup: { inline_keyboard: [[{ text: '✅ MARK PAID', callback_data: `wd:${w.id}` }]] } }, process.env.TOPIC_SUPPORT)
    return Response.json({ ok: true })
  }
  return err('Unknown action')
}