import { ArrowUpRight, BarChart3, Bot, CircleDollarSign, Database, LoaderCircle, PackageSearch, Send, Sparkles, User, Users, Zap } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatRupiah } from '../lib/helpers'

const SUGGESTIONS = [
  'Berapa untung bersih bulan ini?',
  'Rekomendasiin gaji & bonus karyawan',
  'Barang apa yang paling sering masuk?',
  'Analisa pengeluaran terbesar bulan ini',
  'Gimana kondisi keuangan secara keseluruhan?',
]

const WELCOME_MESSAGE = {
  role: 'assistant',
  content:
    'Halo! Gue asisten keuangan Seblak HQ 🍜\n\nGue udah baca data keuangan, stok barang, dan info karyawan bulan ini. Tanya apa aja — analisa untung rugi, rekomendasi gaji, atau kondisi stok.',
}

function rentangBulanIni() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const awal = `${y}-${m}-01`
  const akhir = new Date(y, now.getMonth() + 1, 1).toISOString().slice(0, 10)
  return { awal, akhir }
}

function labelBulan() {
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date())
}

async function fetchKonteksData() {
  const { awal, akhir } = rentangBulanIni()

  const [transaksiRes, karyawanRes, barangRes] = await Promise.all([
    supabase
      .from('transaksi_keuangan')
      .select('jenis, kategori, jumlah, keterangan, tanggal')
      .gte('tanggal', awal)
      .lt('tanggal', akhir)
      .order('tanggal', { ascending: false }),
    supabase.from('karyawan').select('nama, gaji_pokok, status').eq('status', 'aktif').order('nama'),
    supabase
      .from('barang_masuk')
      .select('nama_barang, kategori, jumlah, satuan, harga_total, tanggal')
      .gte('tanggal', awal)
      .lt('tanggal', akhir)
      .order('tanggal', { ascending: false }),
  ])

  const transaksi = transaksiRes.data ?? []
  const karyawan = karyawanRes.data ?? []
  const barang = barangRes.data ?? []

  const pemasukan = transaksi.filter((t) => t.jenis === 'pemasukan').reduce((s, t) => s + Number(t.jumlah), 0)
  const pengeluaran = transaksi.filter((t) => t.jenis === 'pengeluaran').reduce((s, t) => s + Number(t.jumlah), 0)
  const untungBersih = pemasukan - pengeluaran
  const totalGajiPokok = karyawan.reduce((s, k) => s + Number(k.gaji_pokok), 0)
  const kolamBonus = Math.max(0, untungBersih - totalGajiPokok)
  const bonusPerOrang = karyawan.length > 0 ? kolamBonus / karyawan.length : 0

  const pengeluaranPerKategori = {}
  for (const t of transaksi.filter((t) => t.jenis === 'pengeluaran')) {
    pengeluaranPerKategori[t.kategori] = (pengeluaranPerKategori[t.kategori] ?? 0) + Number(t.jumlah)
  }

  const barangPerKategori = {}
  for (const b of barang) {
    if (!barangPerKategori[b.kategori]) barangPerKategori[b.kategori] = []
    barangPerKategori[b.kategori].push(`${b.nama_barang} (${b.jumlah} ${b.satuan})`)
  }

  return `
Kamu adalah asisten manajemen internal Seblak HQ, rumah makan seblak milik keluarga.
Jawab dalam bahasa Indonesia yang santai, informatif, dan to-the-point. Gunakan data di bawah.
Jika pertanyaan tidak relevan dengan bisnis ini, tolak dengan sopan.

=== DATA BULAN ${labelBulan().toUpperCase()} ===

[KEUANGAN]
Pemasukan: ${formatRupiah(pemasukan)} | Pengeluaran: ${formatRupiah(pengeluaran)} | Untung Bersih: ${formatRupiah(untungBersih)}
Pengeluaran per kategori: ${Object.entries(pengeluaranPerKategori).map(([k, v]) => `${k}: ${formatRupiah(v)}`).join(', ') || 'tidak ada'}

Detail transaksi terbaru:
${transaksi.slice(0, 15).map((t) => `- [${t.jenis}] ${t.kategori}: ${formatRupiah(t.jumlah)}${t.keterangan ? ` (${t.keterangan})` : ''}`).join('\n') || 'tidak ada data'}

[KARYAWAN — ${karyawan.length} orang aktif]
${karyawan.map((k) => `- ${k.nama}: gaji pokok ${formatRupiah(k.gaji_pokok)}`).join('\n') || 'belum ada'}
Total Gaji Pokok: ${formatRupiah(totalGajiPokok)}
Kolam Bonus: ${formatRupiah(kolamBonus)} | Estimasi Bonus/Orang: ${formatRupiah(bonusPerOrang)}

[BARANG MASUK — ${barang.length} item]
${Object.entries(barangPerKategori).map(([kat, items]) => `${kat}: ${items.join(', ')}`).join('\n') || 'belum ada data'}
`.trim()
}

async function tanyaGemini(systemPrompt, history, userMessage) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) return 'API key Gemini belum diset di file .env'

  const contents = [
    ...history.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: userMessage }] },
  ]

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `HTTP ${res.status}`)
  }
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Tidak ada respons.'
}

// Komponen typing indicator dengan animasi dots
function TypingIndicator() {
  return (
    <div className="flex items-end gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-chili to-chili-hover shadow-lg shadow-chili/20">
        <Bot size={15} className="text-white" />
      </div>
      <div className="rounded-2xl rounded-bl-sm bg-surface-2 border border-line px-4 py-3">
        <div className="flex gap-1.5 items-center h-4">
          <span className="h-1.5 w-1.5 rounded-full bg-ink-faint animate-bounce [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-ink-faint animate-bounce [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-ink-faint animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  )
}

// Bubble pesan
function MessageBubble({ message, isLatest }) {
  const isUser = message.role === 'user'
  return (
    <div
      className={`flex items-end gap-3 ${isUser ? 'flex-row-reverse' : ''} ${isLatest ? 'animate-[fadeSlideUp_0.3s_ease_forwards]' : ''}`}
    >
      {/* Avatar */}
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-lg ${
          isUser
            ? 'bg-surface-3 border border-line'
            : 'bg-gradient-to-br from-chili to-chili-hover shadow-chili/20'
        }`}
      >
        {isUser ? (
          <User size={14} className="text-ink-muted" />
        ) : (
          <Bot size={15} className="text-white" />
        )}
      </div>

      {/* Bubble */}
      <div
        className={`relative max-w-[72%] ${
          isUser
            ? 'rounded-2xl rounded-br-sm bg-surface-3 border border-line-strong px-4 py-3'
            : 'rounded-2xl rounded-bl-sm bg-surface-2 border border-line px-4 py-3'
        }`}
      >
        {/* Glow subtle untuk AI */}
        {!isUser && (
          <div className="absolute -inset-px rounded-2xl rounded-bl-sm bg-gradient-to-r from-chili/5 to-transparent pointer-events-none" />
        )}
        <p className="relative text-sm leading-relaxed text-ink whitespace-pre-wrap">
          {message.content}
        </p>
      </div>
    </div>
  )
}

export default function AIAssistant() {
  const [messages, setMessages] = useState([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [konteks, setKonteks] = useState(null)
  const [loadingKonteks, setLoadingKonteks] = useState(true)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    fetchKonteksData()
      .then(setKonteks)
      .catch(() => setKonteks('(gagal memuat data)'))
      .finally(() => setLoadingKonteks(false))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  const apiKeyAda = !!import.meta.env.VITE_GEMINI_API_KEY

  async function sendMessage(text) {
    if (!text.trim() || sending || loadingKonteks) return
    const userMessage = { role: 'user', content: text.trim() }
    const history = messages.slice(1)
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setSending(true)
    inputRef.current?.focus()

    try {
      const reply = await tanyaGemini(konteks, history, text.trim())
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Ada error: ${err.message}. Coba lagi ya.` },
      ])
    }
    setSending(false)
  }

  const isReady = !loadingKonteks && apiKeyAda
  return (
    <div className="space-y-5 animate-slide-up">

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-turmeric">Pusat insight</p>
          <h2 className="font-display text-3xl">Asisten AI</h2>
          <p className="mt-1 max-w-xl text-sm text-ink-muted">Teman analisis untuk membantu membaca angka, stok, dan payroll Seblak HQ.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3 py-2 text-xs text-ink-muted"><span className={`relative flex h-2 w-2`}><span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${isReady ? 'bg-herb animate-ping' : 'bg-turmeric animate-pulse'}`} /><span className={`relative inline-flex h-2 w-2 rounded-full ${isReady ? 'bg-herb' : 'bg-turmeric'}`} /></span>{loadingKonteks ? 'Membaca data...' : apiKeyAda ? 'AI siap membantu' : 'API key belum diset'}</div>
      </div>

      <div className="grid min-h-[calc(100svh-15rem)] grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <section className="flex min-h-[620px] flex-col overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-surface via-surface/95 to-surface-2/20 shadow-xl shadow-black/10">
          <div className="flex items-center justify-between border-b border-line px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-chili-bg text-chili"><Bot size={18} /></span><div><h3 className="font-display text-base">Ruang percakapan</h3><p className="text-[10px] text-ink-faint">Konteks diperbarui dari data bulan berjalan</p></div></div><div className="flex items-center gap-1.5 text-[10px] text-ink-faint"><Zap size={11} className="text-turmeric" /> Gemini</div></div>

          <div className="relative flex-1 overflow-hidden">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-chili/10 to-transparent" />
            <div className="relative h-full min-h-[430px] overflow-y-auto p-5 space-y-5">
              {messages.map((msg, i) => <MessageBubble key={i} message={msg} isLatest={i === messages.length - 1} />)}
              {sending && <TypingIndicator />}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* Composer */}
          <div className="border-t border-line bg-base/20 p-4">
            <form onSubmit={(e) => { e.preventDefault(); sendMessage(input) }} className="flex items-center gap-3">
              <div className="relative flex-1"><input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder={loadingKonteks ? 'Memuat data...' : apiKeyAda ? 'Tulis pertanyaan tentang bisnis kamu...' : 'Set VITE_GEMINI_API_KEY di .env dulu'} disabled={!isReady || sending} className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-faint transition-all focus:border-chili/50 focus:ring-2 focus:ring-chili/10 disabled:opacity-40" /><span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 text-[10px] text-ink-faint sm:block">Enter untuk kirim</span></div>
              <button type="submit" disabled={sending || !input.trim() || !isReady} className="group relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-chili shadow-lg shadow-chili/25 transition-all hover:bg-chili-hover hover:shadow-chili/40 disabled:opacity-40 disabled:shadow-none" aria-label="Kirim">{sending ? <LoaderCircle size={16} className="animate-spin text-white" /> : <Send size={16} className="text-white transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />}</button>
            </form>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-line bg-surface/60 p-5 backdrop-blur-sm"><div className="mb-4 flex items-center justify-between"><div><p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-ink-faint">Sumber analisis</p><h3 className="font-display text-lg">Data bisnis</h3></div><Database size={18} className="text-turmeric" /></div><div className="space-y-2.5"><div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/40 p-3"><span className="rounded-lg bg-herb-bg p-2 text-herb"><CircleDollarSign size={15} /></span><span><strong className="block text-xs text-ink">Keuangan</strong><small className="text-[10px] text-ink-faint">Omzet, biaya, dan saldo bersih</small></span></div><div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/40 p-3"><span className="rounded-lg bg-chili-bg p-2 text-chili"><PackageSearch size={15} /></span><span><strong className="block text-xs text-ink">Persediaan</strong><small className="text-[10px] text-ink-faint">Stok bahan dan barang masuk</small></span></div><div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/40 p-3"><span className="rounded-lg bg-turmeric-bg p-2 text-turmeric"><Users size={15} /></span><span><strong className="block text-xs text-ink">Karyawan</strong><small className="text-[10px] text-ink-faint">Data payroll dan gaji pokok</small></span></div></div></div>

          <div className="rounded-2xl border border-line bg-surface/60 p-5 backdrop-blur-sm"><div className="mb-4 flex items-center justify-between"><div><p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-ink-faint">Mulai dari sini</p><h3 className="font-display text-lg">Insight cepat</h3></div><BarChart3 size={18} className="text-chili" /></div><div className="space-y-2">{SUGGESTIONS.slice(0, 4).map((suggestion) => <button key={suggestion} type="button" onClick={() => sendMessage(suggestion)} disabled={!isReady || sending} className="group flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-surface-2/30 px-3 py-2.5 text-left text-xs text-ink-muted transition-colors hover:border-chili/30 hover:bg-chili-bg hover:text-ink disabled:opacity-40"><span>{suggestion}</span><ArrowUpRight size={13} className="shrink-0 text-ink-faint transition-colors group-hover:text-chili" /></button>)}</div></div>
        </aside>
      </div>

      {/* Keyframe styles */}
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
