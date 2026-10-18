'use client'
import { useEffect, useState } from 'react'
import { sb } from '@/lib/supabase'
const api = async (action: string, data: any = {}) => {
  const { data: s } = await sb.auth.getSession()
  const r = await fetch('/api/act', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (s.session?.access_token || '') }, body: JSON.stringify({ action, ...data }) })
  return r.json()
}
const DISC = ['Strength', 'Cardio', 'Recovery']
const Btn = (p: any) => <button {...p} className={'w-full rounded-xl bg-red py-3 font-black uppercase text-white hover:bg-red-hover active:bg-red-hover disabled:opacity-40 ' + (p.className || '')} />
const Inp = (p: any) => <input {...p} className="mb-2 w-full rounded-xl border border-line bg-white p-3" />

export default function App() {
  const [session, setSession] = useState<any>(undefined); const [s, setS] = useState<any>(null); const [tab, setTab] = useState('home'); const [play, setPlay] = useState<any>(null); const [err, setErr] = useState('')
  useEffect(() => { sb.auth.getSession().then(({ data }) => setSession(data.session)); const { data } = sb.auth.onAuthStateChange((_e, ses) => setSession(ses)); return () => data.subscription.unsubscribe() }, [])
  const load = async () => { const r = await api('me'); r.error ? setErr(r.error) : (setErr(''), setS(r)) }
  useEffect(() => { if (session) load(); else setS(null) }, [session])
  if (session === undefined) return <p className="p-6 text-mid">Loading…</p>
  if (!session) return <Auth />
  if (err) return <div className="p-6"><p className="text-red">{err}</p><button onClick={() => sb.auth.signOut()} className="mt-3 font-bold">Log out</button></div>
  if (!s) return <p className="p-6 text-mid">Loading…</p>
  if (!s.me) return <Profile reload={load} />
  if (play) return <Workout v={play} done={() => setPlay(null)} />
  const tabs = [['home', 'Workouts'], ['progress', 'Progress'], ['bmr', 'BMR'], ...(s.isCreator ? [['creator', 'Dashboard']] : [])]
  return <div className="mx-auto max-w-md pb-24">
    {tab === 'home' && (s.active ? <Feed onPlay={setPlay} /> : <Apply s={s} reload={load} />)}
    {tab === 'progress' && <Progress />}
    {tab === 'bmr' && <Bmr />}
    {tab === 'creator' && s.isCreator && <Creator />}
    <nav className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md bg-ink text-white">
      {tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={'flex-1 p-3 text-sm font-bold ' + (tab === k ? 'text-red' : '')}>{l}</button>)}
      <button onClick={() => sb.auth.signOut()} className="flex-1 p-3 text-sm text-lite">Log out</button></nav></div>
}

function Auth() {
  const [mode, setMode] = useState('login'); const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true); setMsg('')
    const r = mode === 'login' ? await sb.auth.signInWithPassword({ email, password: pw }) : await sb.auth.signUp({ email, password: pw })
    setBusy(false)
    if (r.error) setMsg(r.error.message)
    else if (mode === 'signup' && !r.data.session) setMsg('Check your email and click the confirmation link, then log in.')
  }
  return <div className="mx-auto max-w-md p-6"><h1 className="mt-10 text-3xl font-black">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
    <p className="mb-5 mt-1 text-mid">Workouts from Bangladesh’s fitness creators.</p>
    <Inp type="email" placeholder="Email" value={email} onChange={(e: any) => setEmail(e.target.value)} />
    <Inp type="password" placeholder="Password (6+ characters)" value={pw} onChange={(e: any) => setPw(e.target.value)} />
    {msg && <p className="mb-2 text-red">{msg}</p>}
    <Btn disabled={busy || !email || pw.length < 6} onClick={go}>{mode === 'login' ? 'Log in' : 'Sign up'}</Btn>
    <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMsg('') }} className="mt-4 w-full font-bold text-mid">{mode === 'login' ? 'New here? Create an account' : 'Have an account? Log in'}</button></div>
}

function Profile({ reload }: any) {
  const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [msg, setMsg] = useState('')
  const go = async () => { const r = await api('saveProfile', { name, phone }); r.error ? setMsg(r.error) : reload() }
  return <div className="mx-auto max-w-md p-6"><h1 className="text-2xl font-black">Almost there</h1><p className="mb-4 mt-1 text-mid">Use the same number you pay with on bKash.</p>
    <Inp placeholder="Your name" value={name} onChange={(e: any) => setName(e.target.value)} />
    <Inp placeholder="bKash number (017XXXXXXXX)" inputMode="tel" value={phone} onChange={(e: any) => setPhone(e.target.value)} />
    {msg && <p className="mb-2 text-red">{msg}</p>}<Btn onClick={go}>Save and continue</Btn></div>
}

function Apply({ s, reload }: any) {
  const [cid, setCid] = useState(''); const [txn, setTxn] = useState(''); const [msg, setMsg] = useState(''); const [sent, setSent] = useState(false)
  useEffect(() => { if (!sent) return; const t = setInterval(reload, 10000); return () => clearInterval(t) }, [sent])
  const go = async () => { const r = await api('apply', { creator_id: cid, txn }); r.error ? setMsg(r.error) : setSent(true) }
  if (sent) return <div className="p-6"><h1 className="text-2xl font-black">Request sent</h1><p className="mt-2 text-mid">We’re checking your payment. This page unlocks by itself when your 30-day trial starts.</p></div>
  return <div className="p-6"><h1 className="text-2xl font-black">{s.me.is_approved ? 'Your trial has ended' : 'Start your 30-day trial'}</h1>
    <p className="my-2 text-mid">Pick your trainer, send {s.price} BDT by bKash, and paste the TxnID.</p>
    <select value={cid} onChange={e => setCid(e.target.value)} className="mb-2 w-full rounded-xl border border-line bg-white p-3"><option value="">Choose your trainer</option>{s.creators.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
    <Inp placeholder="bKash TxnID" value={txn} onChange={(e: any) => setTxn(e.target.value)} />
    {msg && <p className="mb-2 text-red">{msg}</p>}<Btn disabled={!cid || !txn} onClick={go}>Submit payment</Btn></div>
}

function Progress() {
  const [v, setV] = useState('activity')
  return <div className="p-4"><h1 className="text-2xl font-black">My progress</h1>
    <div className="my-3 flex gap-2">{[['activity', 'Activity'], ['body', 'Weight & calories']].map(([k, l]) => <button key={k} onClick={() => setV(k)} className={'rounded-full px-4 py-2 font-bold ' + (v === k ? 'bg-ink text-white' : 'border border-line bg-white')}>{l}</button>)}</div>
    {v === 'activity' ? <Activity /> : <Body />}</div>
}

function Chart({ pts, bars, unit }: any) {
  if (pts.length === 0) return <p className="py-6 text-center text-sm text-lite">Be part of the Adventure. Add your first entry below.</p>
  const W = 300, H = 140, L = 38, R = 10, T = 10, B = 22
  const vals = pts.map((p: any) => p.v); const lo0 = Math.min(...vals), hi0 = Math.max(...vals)
  const pad = bars ? hi0 * 0.1 : Math.max(0.5, (hi0 - lo0) * 0.15)
  const lo = bars ? 0 : lo0 - pad, hi = (hi0 + pad) || 1
  const t0 = new Date(pts[0].date).getTime(), t1 = new Date(pts[pts.length - 1].date).getTime()
  const x = (d: string) => t1 === t0 ? (L + W - R) / 2 : L + (new Date(d).getTime() - t0) / (t1 - t0) * (W - L - R)
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B)
  const short = (d: string) => new Date(d).toLocaleDateString('en', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  const fmt = (n: number) => String(Math.round(n * 10) / 10)
  return <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${unit} chart`}>
    <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="#777A81" strokeWidth="0.5" /><line x1={L} x2={W - R} y1={T} y2={T} stroke="#777A81" strokeWidth="0.5" strokeDasharray="2 3" />
    <text x={L - 4} y={T + 3} textAnchor="end" fontSize="9" fill="#A8ACB1">{fmt(hi)}</text><text x={L - 4} y={H - B + 3} textAnchor="end" fontSize="9" fill="#A8ACB1">{fmt(lo)}</text>
    <text x={L} y={H - 6} fontSize="9" fill="#A8ACB1">{short(pts[0].date)}</text>{pts.length > 1 && <text x={W - R} y={H - 6} textAnchor="end" fontSize="9" fill="#A8ACB1">{short(pts[pts.length - 1].date)}</text>}
    {bars ? pts.map((p: any) => <rect key={p.date} x={x(p.date) - 3} width="6" y={y(p.v)} height={H - B - y(p.v)} rx="2" fill="#FF3347" />)
      : <>{pts.length > 1 && <polyline fill="none" stroke="#FF3347" strokeWidth="2" strokeLinejoin="round" points={pts.map((p: any) => `${x(p.date)},${y(p.v)}`).join(' ')} />}
        {pts.map((p: any) => <circle key={p.date} cx={x(p.date)} cy={y(p.v)} r="3" fill="#FFFFFF" stroke="#FF3347" strokeWidth="1.5" />)}</>}</svg>
}

function Body() {
  const [d, setD] = useState<any>(null); const [f, setF] = useState<any>({ date: '', weight: '', calories: '' }); const [m, setM] = useState('')
  const load = () => api('bodyLogs').then(r => { if (r.error) setM(r.error); else { setD(r); setF((x: any) => ({ ...x, date: x.date || r.today })) } })
  useEffect(() => { load() }, [])
  const save = async () => { const r = await api('saveBody', f); setM(r.error || 'Saved.'); if (!r.error) { setF({ date: d.today, weight: '', calories: '' }); load() } }
  if (!d) return <p className="p-6 text-mid">{m || 'Loading…'}</p>
  const wp = d.logs.filter((l: any) => l.weight !== null).map((l: any) => ({ date: l.date, v: l.weight }))
  const cp = d.logs.filter((l: any) => l.calories !== null).map((l: any) => ({ date: l.date, v: l.calories }))
  const change = wp.length > 1 ? Math.round((wp[wp.length - 1].v - wp[0].v) * 10) / 10 : null
  const avg = cp.length ? Math.round(cp.reduce((s: number, c: any) => s + c.v, 0) / cp.length) : null
  return <div>
    <div className="rounded-xl bg-ink p-4 text-white"><p className="text-sm text-lite">Weight (last 90 days)</p>
      {wp.length > 0 && <p className="text-3xl font-black">{wp[wp.length - 1].v} <span className="text-base font-normal">kg now{change !== null && ` • ${change > 0 ? '+' : ''}${change} kg since ${wp[0].date}`}</span></p>}
      <Chart pts={wp} unit="Weight in kg" /></div>
    <div className="mt-3 rounded-xl bg-ink p-4 text-white"><p className="text-sm text-lite">Calories eaten (last 90 days)</p>
      {avg !== null && <p className="text-3xl font-black">{avg} <span className="text-base font-normal">kcal average per logged day</span></p>}
      <Chart pts={cp} bars unit="Calories" /></div>
    <h2 className="mt-5 font-black">Add an entry</h2><p className="mb-2 text-sm text-mid">Fill one box or both. Saving the same date again updates it.</p>
    <Inp type="date" max={d.today} value={f.date} onChange={(e: any) => setF({ ...f, date: e.target.value })} />
    <Inp type="number" step="0.1" inputMode="decimal" placeholder="Weight (kg)" value={f.weight} onChange={(e: any) => setF({ ...f, weight: e.target.value })} />
    <Inp type="number" inputMode="numeric" placeholder="Calories eaten (kcal)" value={f.calories} onChange={(e: any) => setF({ ...f, calories: e.target.value })} />
    {m && <p className="mb-2 text-mid">{m}</p>}<Btn disabled={!f.weight && !f.calories} onClick={save}>Save entry</Btn></div>
}

function Activity() {
  const [p, setP] = useState<any>(null); const [f, setF] = useState<any>({ title: '', minutes: '' }); const [goal, setGoal] = useState(''); const [m, setM] = useState('')
  const load = () => api('progress').then(r => { if (r.error) setM(r.error); else { setP(r); setGoal(String(r.goal)) } })
  useEffect(() => { load() }, [])
  const log = async () => { const r = await api('logWorkout', f); setM(r.error || 'Workout saved.'); if (!r.error) { setF({ title: '', minutes: '' }); load() } }
  const saveGoal = async () => { const r = await api('setGoal', { minutes: goal }); setM(r.error || 'Goal saved.'); if (!r.error) load() }
  if (!p) return <p className="p-6 text-mid">{m || 'Loading…'}</p>
  const pct = Math.min(100, Math.round(p.todayMinutes / p.goal * 100)); const max = Math.max(p.goal, ...p.week.map((w: any) => w.minutes))
  const dayName = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en', { weekday: 'short', timeZone: 'UTC' })
  return <div>
    <div className="mb-3 rounded-xl bg-ink p-5 text-white"><p className="text-sm text-lite">Today</p><p className="text-4xl font-black">{p.todayMinutes} <span className="text-base font-normal">of {p.goal} min</span></p>
      <div className="my-3 h-2 rounded-full bg-soft"><div className="h-2 rounded-full bg-red" style={{ width: pct + '%' }} /></div>
      <p className="text-sm text-lite">{p.todayMinutes >= p.goal ? 'Daily goal reached.' : `${p.goal - p.todayMinutes} min to go.`}</p></div>
    <div className="grid grid-cols-3 gap-3">
      <div className="rounded-xl border border-line bg-white p-3"><p className="text-sm text-mid">Streak</p><p className="text-2xl font-black">{p.streak}<span className="text-sm font-normal"> {p.streak === 1 ? 'day' : 'days'}</span></p></div>
      <div className="rounded-xl border border-line bg-white p-3"><p className="text-sm text-mid">Best</p><p className="text-2xl font-black">{p.best}<span className="text-sm font-normal"> {p.best === 1 ? 'day' : 'days'}</span></p></div>
      <div className="rounded-xl border border-line bg-white p-3"><p className="text-sm text-mid">Workouts</p><p className="text-2xl font-black">{p.total}</p></div></div>
    {p.streak === 0 && <p className="mt-2 text-sm text-mid">Train at least 1 minute today to start your streak.</p>}
    <h2 className="mt-5 font-black">Last 7 days (minutes)</h2>
    <div className="mt-2 flex h-32 items-end gap-2 rounded-xl border border-line bg-white p-3">{p.week.map((w: any) => <div key={w.day} className="flex flex-1 flex-col items-center justify-end">
      <span className="text-xs text-mid">{w.minutes}</span><div className={'w-full rounded-t ' + (w.minutes >= p.goal ? 'bg-red' : 'bg-lite')} style={{ height: Math.max(2, w.minutes / max * 64) + 'px' }} /><span className="mt-1 text-xs text-mid">{dayName(w.day)}</span></div>)}</div>
    <h2 className="mt-5 font-black">Log a workout</h2><p className="mb-2 text-sm text-mid">Did a walk, football or gym session? Add it yourself.</p>
    <Inp placeholder="What did you do? (e.g. Walking)" value={f.title} onChange={(e: any) => setF({ ...f, title: e.target.value })} />
    <Inp placeholder="Minutes" type="number" value={f.minutes} onChange={(e: any) => setF({ ...f, minutes: e.target.value })} />
    <Btn disabled={!f.title || !f.minutes} onClick={log}>Save workout</Btn>
    <h2 className="mt-5 font-black">Daily goal</h2>
    <div className="flex gap-2"><input type="number" value={goal} onChange={e => setGoal(e.target.value)} className="w-full rounded-xl border border-line bg-white p-3" /><button onClick={saveGoal} className="rounded-xl bg-ink px-5 font-bold text-white">Save</button></div>
    {m && <p className="mt-2 text-mid">{m}</p>}
    <h2 className="mt-5 font-black">History</h2>
    {p.history.length === 0 && <p className="mt-2 text-mid">Be part of the Adventure. Log your first workout above.</p>}
    <div className="mt-2 space-y-2">{p.history.map((h: any) => <div key={h.id} className="overflow-hidden rounded-xl border border-line bg-white"><div className="flex items-center justify-between bg-[#F3F4F6] p-3">
      <div><p className="font-bold leading-tight">{h.title}</p><p className="text-sm text-mid">{h.day}{h.manual ? ' • logged by you' : ''}</p></div>
      <p className="text-right font-black">{h.minutes} min{h.reps > 0 && <span className="block text-sm font-normal text-mid">{h.reps} reps</span>}</p></div></div>)}</div></div>
}

function Bmr() {
  const [f, setF] = useState<any>({ sex: 'm' }); const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value })
  const w = +f.w, h = +f.h, a = +f.a
  const bmr = w && h && a ? Math.round(10 * w + 6.25 * h - 5 * a + (f.sex === 'm' ? 5 : -161)) : null
  return <div className="p-4"><h1 className="text-2xl font-black">BMR calculator</h1><p className="mb-3 text-mid">Calories your body burns at rest in 24 hours (Mifflin-St Jeor).</p>
    <Inp placeholder="Weight (kg)" type="number" onChange={set('w')} /><Inp placeholder="Height (cm)" type="number" onChange={set('h')} /><Inp placeholder="Age" type="number" onChange={set('a')} />
    <select value={f.sex} onChange={set('sex')} className="mb-3 w-full rounded-xl border border-line bg-white p-3"><option value="m">Male</option><option value="f">Female</option></select>
    {bmr && <div className="rounded-xl bg-ink p-5 text-white"><p className="text-sm text-lite">Your BMR</p><p className="text-4xl font-black">{bmr} <span className="text-base font-normal">kcal/day</span></p></div>}</div>
}

function Feed({ onPlay }: any) {
  const [f, setF] = useState<any>(null); const [d, setD] = useState('All'); const [saved, setSaved] = useState<string[]>([])
  useEffect(() => { api('feed').then(setF); try { setSaved(JSON.parse(localStorage.getItem('saved') || '[]')) } catch {} }, [])
  const mark = (id: string) => { const n = saved.includes(id) ? saved.filter(x => x !== id) : [...saved, id]; setSaved(n); try { localStorage.setItem('saved', JSON.stringify(n)) } catch {} }
  if (!f) return <p className="p-6 text-mid">Loading…</p>
  const list = (f.videos || []).filter((v: any) => d === 'All' || v.discipline === d)
  const mine = list.filter((v: any) => v.creator_id === f.myCreator)
  const Row = ({ title, items }: any) => items.length > 0 && <section className="mt-5"><h2 className="px-4 font-black">{title}</h2>
    <div className="flex gap-3 overflow-x-auto px-4 py-2">{items.map((v: any) => <div key={v.id} className="w-64 shrink-0 overflow-hidden rounded-xl border border-line bg-white">
      <div className="relative cursor-pointer" onClick={() => onPlay(v)}><img src={`https://i.ytimg.com/vi/${v.youtube_id}/hqdefault.jpg`} alt="" className="aspect-video w-full object-cover" />
        <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">{v.duration_minutes} min • {v.discipline}</span></div>
      <div className="flex items-center justify-between bg-[#F3F4F6] p-3"><div><p className="font-bold leading-tight">{v.title}</p><p className="text-sm text-mid">{v.creators?.name}</p></div>
        <button onClick={() => mark(v.id)} className="text-xl">{saved.includes(v.id) ? '🔖' : '🏷️'}</button></div></div>)}</div></section>
  return <div><h1 className="p-4 text-2xl font-black">Workouts</h1>
    <div className="flex gap-2 overflow-x-auto px-4">{['All', ...DISC].map(x => <button key={x} onClick={() => setD(x)} className={'rounded-full px-4 py-2 font-bold ' + (d === x ? 'bg-ink text-white' : 'border border-line bg-white')}>{x}</button>)}</div>
    <Row title="My trainer’s routines" items={mine} /><Row title="Newest across all trainers" items={list} />
    {list.length === 0 && <p className="p-6 text-mid">No workouts yet. Your trainers are uploading soon.</p>}
    <div className="m-4 rounded-xl bg-ink p-5 text-white"><p className="font-bold">Your trainer’s private community</p><p className="mb-3 text-sm text-lite">Ask questions and train with others.</p>
      <a href={f.community || '#'} target="_blank" rel="noreferrer"><Btn>Join private Telegram community</Btn></a></div>
    <div className="m-4 rounded-xl bg-ink p-5 text-white"><p className="font-bold">Winter dress: coming in v2</p><p className="mb-3 text-sm text-lite">We’re designing it now.</p><Btn disabled>Buy now via bKash</Btn></div></div>
}

function Workout({ v, done }: any) {
  const [sec, setSec] = useState(0); const [reps, setReps] = useState(0); const [run, setRun] = useState(true); const [b, setB] = useState<any>({ count: 0, top: [] })
  const total = v.duration_minutes * 60
  useEffect(() => { api('board', { video_id: v.id }).then(r => r.top && setB(r)) }, [])
  useEffect(() => { if (!run) return; const t = setInterval(() => setSec(x => x + 1), 1000); return () => clearInterval(t) }, [run])
  const fmt = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
  const finish = async () => { await api('finish', { video_id: v.id, reps, seconds: sec }); done() }
  return <div className="mx-auto flex h-screen max-w-md flex-col bg-bg">
    <div className="h-1 bg-line"><div className="h-1 bg-red" style={{ width: Math.min(100, sec / total * 100) + '%' }} /></div>
    <iframe className="h-[40%] w-full" src={`https://www.youtube-nocookie.com/embed/${v.youtube_id}?rel=0&playsinline=1`} allow="autoplay; fullscreen" allowFullScreen />
    <div className="flex-1 space-y-3 overflow-y-auto p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white p-4"><p className="text-sm text-mid">Time</p><p className="text-3xl font-black">{fmt(sec)}</p></div>
        <button onClick={() => setReps(r => r + 1)} className="rounded-xl bg-red p-4 text-left text-white active:bg-red-hover"><p className="text-sm">Tap to count</p><p className="text-3xl font-black">{reps} reps</p></button></div>
      <div className="rounded-xl bg-ink p-4 text-white"><p className="text-sm text-lite">{b.count > 0 ? `${b.count} ${b.count === 1 ? 'person' : 'people'} completed this today` : 'Be part of the Adventure'}</p>
        {b.top.map((t: any, i: number) => <p key={i} className="font-bold">{i + 1}. {t.you ? 'You' : t.name} ({t.reps})</p>)}</div>
      <div className="flex gap-3"><button onClick={() => setRun(!run)} className="flex-1 rounded-xl border border-line bg-white py-3 font-bold">{run ? 'Pause' : 'Resume'}</button><Btn onClick={finish} className="flex-1">Finish workout</Btn></div>
      <button onClick={done} className="w-full text-sm text-mid">Leave without saving</button></div></div>
}

function Creator() {
  const [l, setL] = useState<any>(null); const [f, setF] = useState<any>({ discipline: 'Strength' }); const [m, setM] = useState('')
  const load = () => api('ledger').then(setL); useEffect(() => { load() }, [])
  const add = async () => { const r = await api('addVideo', f); setM(r.error || 'Published. It’s live in the feed.'); if (!r.error) setF({ discipline: 'Strength' }) }
  const wd = async () => { const r = await api('withdraw'); setM(r.error || 'Cash-out requested.'); load() }
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value })
  return <div className="p-4"><h1 className="text-2xl font-black">My dashboard</h1>
    {l && <div className="my-3 rounded-xl border border-line bg-white p-4"><p>Gross revenue: <b>{l.gross} BDT</b> ({l.members} members)</p><p>Platform share (5%): <b>-{l.cut} BDT</b></p><p className="text-xl">Balance: <b>{l.net} BDT</b></p>
      <Btn className="mt-3" onClick={wd}>Cash out ({l.fee} BDT fee)</Btn></div>}
    <h2 className="mt-5 font-black">Add a workout</h2>
    <Inp placeholder="Paste YouTube link" value={f.url || ''} onChange={set('url')} /><Inp placeholder="Title" value={f.title || ''} onChange={set('title')} />
    <Inp placeholder="Minutes" type="number" value={f.minutes || ''} onChange={set('minutes')} />
    <select value={f.discipline} onChange={set('discipline')} className="mb-2 w-full rounded-xl border border-line bg-white p-3">{DISC.map(d => <option key={d}>{d}</option>)}</select>
    {m && <p className="mb-2 text-mid">{m}</p>}<Btn onClick={add}>Publish workout</Btn></div>
}