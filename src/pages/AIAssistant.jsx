import { Bot, LoaderCircle, Send, Sparkles, User, Zap } from 'lucide-react'
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
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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
  const showSuggestions = messages.length === 1 && isReady

  return (
    <div className="flex h-[calc(100svh-8.5rem)] flex-col gap-4 md:h-[calc(100svh-9.5rem)]">

      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Animated glow dot */}
          <span className="relative flex h-2 w-2">
            <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${isReady ? 'bg-herb animate-ping' : 'bg-turmeric animate-pulse'}`} />
            <span className={`relative inline-flex h-2 w-2 rounded-full ${isReady ? 'bg-herb' : 'bg-turmeric'}`} />
          </span>
          <p className="text-xs text-ink-muted">
            {loadingKonteks ? 'Memuat data keuangan...' : apiKeyAda ? 'Terhubung · data bulan ini sudah dimuat' : '⚠️ API key belum diset'}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-ink-faint">
          <Zap size={11} className="text-turmeric" />
          <span>Gemini</span>
        </div>
      </div>

      {/* Chat container */}
      <div className="relative flex-1 overflow-hidden rounded-2xl border border-line bg-surface">
        {/* Ambient glow top */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-chili/5 to-transparent" />

        {/* Messages */}
        <div className="relative h-full overflow-y-auto p-5 space-y-5">
          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} isLatest={i === messages.length - 1} />
          ))}
          {sending && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Suggestion chips */}
      {showSuggestions && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => sendMessage(s)}
              className="group flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs text-ink-muted transition-all hover:border-chili/40 hover:bg-chili-bg hover:text-ink"
            >
              <Sparkles size={10} className="text-turmeric opacity-0 transition-opacity group-hover:opacity-100" />
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <form
        onSubmit={(e) => { e.preventDefault(); sendMessage(input) }}
        className="relative flex items-center gap-3"
      >
        {/* Glow ring saat focus */}
        <div className="relative flex-1">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              loadingKonteks ? 'Memuat data...'
              : apiKeyAda ? 'Tanya soal keuangan, gaji, atau stok...'
              : 'Set VITE_GEMINI_API_KEY di .env dulu'
            }
            disabled={!isReady || sending}
            className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-faint transition-all focus:border-chili/50 focus:ring-2 focus:ring-chili/10 disabled:opacity-40"
          />
        </div>

        <button
          type="submit"
          disabled={sending || !input.trim() || !isReady}
          className="group relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-chili shadow-lg shadow-chili/25 transition-all hover:bg-chili-hover hover:shadow-chili/40 disabled:opacity-40 disabled:shadow-none"
          aria-label="Kirim"
        >
          {sending
            ? <LoaderCircle size={16} className="animate-spin text-white" />
            : <Send size={16} className="text-white transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          }
        </button>
      </form>

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
