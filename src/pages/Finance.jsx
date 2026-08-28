import CurrencyInput from '../components/CurrencyInput'
import { ArrowDownRight, ArrowUpRight, CircleDollarSign, Download, Plus, TrendingDown, TrendingUp, Wallet, X, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip as ChartTooltip } from 'recharts'
import EmptyState from '../components/EmptyState'
import { supabase } from '../lib/supabase'
import { formatRupiah, formatTanggal } from '../lib/helpers'

const KATEGORI_PEMASUKAN = ['penjualan', 'lainnya']
const KATEGORI_PENGELUARAN = ['belanja_barang', 'listrik_air', 'gaji', 'sewa', 'lainnya']

const KATEGORI_LABEL = {
  penjualan: 'Penjualan',
  belanja_barang: 'Belanja Barang',
  listrik_air: 'Listrik & Air',
  gaji: 'Gaji',
  sewa: 'Sewa',
  lainnya: 'Lainnya',
}

const METODE_PEMBAYARAN = [
  { value: 'cash', label: 'Cash / Tunai' },
  { value: 'qris', label: 'QRIS' },
  { value: 'transfer', label: 'Transfer Bank' },
  { value: 'debit', label: 'Kartu Debit' },
  { value: 'kredit', label: 'Kartu Kredit' },
  { value: 'ewallet', label: 'E-Wallet' },
  { value: 'lainnya', label: 'Lainnya' },
]

const EMPTY_FORM = {
  tanggal: new Date().toISOString().slice(0, 10),
  jenis: 'pemasukan',
  kategori: 'penjualan',
  metode_pembayaran: 'cash',
  jumlah: '',
  keterangan: '',
}

function toCsv(rows) {
  const header = ['Tanggal', 'Jenis', 'Kategori', 'Metode Pembayaran', 'Jumlah', 'Keterangan']
  const lines = rows.map((r) =>
    [
      r.tanggal,
      r.jenis,
      KATEGORI_LABEL[r.kategori] ?? r.kategori,
      METODE_PEMBAYARAN.find((method) => method.value === r.metode_pembayaran)?.label ?? r.metode_pembayaran ?? 'Belum diisi',
      r.jumlah,
      (r.keterangan ?? '').replace(/,/g, ' '),
    ].join(',')
  )
  return [header.join(','), ...lines].join('\n')
}

export default function Finance() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const [totalGajiKaryawan, setTotalGajiKaryawan] = useState(0)

  async function fetchItems() {
    setLoading(true)
    const { data, error: fetchError } = await supabase
      .from('transaksi_keuangan')
      .select('*')
      .order('tanggal', { ascending: false })
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setItems(data)
      setError(null)
    }
    setLoading(false)
  }

  async function fetchKaryawanGaji() {
    const { data, error: err } = await supabase
      .from('karyawan')
      .select('gaji_pokok')
      .eq('status', 'aktif')
    if (!err && data) {
      const total = data.reduce((sum, k) => sum + Number(k.gaji_pokok), 0)
      setTotalGajiKaryawan(total)
    }
  }

  useEffect(() => {
    fetchItems()
    fetchKaryawanGaji()
  }, [])

  const summary = useMemo(() => {
    const pemasukan = items
      .filter((i) => i.jenis === 'pemasukan')
      .reduce((sum, i) => sum + Number(i.jumlah), 0)
    const pengeluaran = items
      .filter((i) => i.jenis === 'pengeluaran')
      .reduce((sum, i) => sum + Number(i.jumlah), 0)
    return { pemasukan, pengeluaran, bersih: pemasukan - pengeluaran }
  }, [items])

  const analisisBEP = useMemo(() => {
    const now = new Date()
    const hariIni = now.getDate()
    const y = now.getFullYear()
    const m = now.getMonth()
    const totalHari = new Date(y, m + 1, 0).getDate()
    const sisa = totalHari - hariIni

    const totalBeban = summary.pengeluaran + totalGajiKaryawan
    const targetHarian = totalBeban / totalHari
    const targetMingguan = targetHarian * 7

    const avgHarian = summary.pemasukan / hariIni
    const avgMingguan = avgHarian * 7

    const diffHarian = avgHarian - targetHarian
    const diffMingguan = avgMingguan - targetMingguan

    // Sisa omzet untuk mencapai BEP
    const sisaTargetBulan = Math.max(0, totalBeban - summary.pemasukan)
    const targetHarianSisa = sisa > 0 ? sisaTargetBulan / sisa : sisaTargetBulan

    return {
      hariIni,
      totalHari,
      sisa,
      targetHarian,
      targetMingguan,
      avgHarian,
      avgMingguan,
      diffHarian,
      diffMingguan,
      sisaTargetBulan,
      targetHarianSisa
    }
  }, [summary.pemasukan, summary.pengeluaran, totalGajiKaryawan])

  const periodStats = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfWeek = new Date(startOfToday)
    const day = startOfWeek.getDay()
    startOfWeek.setDate(startOfWeek.getDate() - (day === 0 ? 6 : day - 1))
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    function calculate(startDate) {
      const transactions = items.filter((item) => new Date(`${item.tanggal}T00:00:00`) >= startDate)
      const pemasukan = transactions.filter((item) => item.jenis === 'pemasukan').reduce((sum, item) => sum + Number(item.jumlah), 0)
      const pengeluaran = transactions.filter((item) => item.jenis === 'pengeluaran').reduce((sum, item) => sum + Number(item.jumlah), 0)
      return { omzet: pemasukan, pengeluaran, bersih: pemasukan - pengeluaran }
    }

    return { hari: calculate(startOfToday), minggu: calculate(startOfWeek), bulan: calculate(startOfMonth) }
  }, [items])

  const sparklineData = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today)
      date.setDate(today.getDate() - (6 - index))
      const key = date.toISOString().slice(0, 10)
      return {
        day: key,
        pemasukan: items.filter((item) => item.tanggal === key && item.jenis === 'pemasukan').reduce((sum, item) => sum + Number(item.jumlah), 0),
        pengeluaran: items.filter((item) => item.tanggal === key && item.jenis === 'pengeluaran').reduce((sum, item) => sum + Number(item.jumlah), 0),
      }
    })
  }, [items])

  function trendLabel(values) {
    const previous = values.slice(0, 3).reduce((sum, value) => sum + value, 0)
    const recent = values.slice(-3).reduce((sum, value) => sum + value, 0)
    if (previous === 0 && recent === 0) return 'Belum ada aktivitas'
    if (previous === 0) return 'Mulai tercatat minggu ini'
    const percent = Math.round(((recent - previous) / previous) * 100)
    return `${percent >= 0 ? '+' : ''}${percent}% vs awal minggu`
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const payload = {
      tanggal: form.tanggal,
      jenis: form.jenis,
      kategori: form.kategori,
      metode_pembayaran: form.metode_pembayaran,
      jumlah: Number(form.jumlah),
      keterangan: form.keterangan.trim() || null,
    }

    const { error: submitError } = editingId
      ? await supabase.from('transaksi_keuangan').update(payload).eq('id', editingId)
      : await supabase.from('transaksi_keuangan').insert(payload)

    if (submitError) {
      setError(submitError.message)
    } else {
      setForm(EMPTY_FORM)
      setEditingId(null)
      setShowForm(false)
      await fetchItems()
    }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!confirm('Apakah kamu yakin ingin menghapus transaksi ini?')) return
    const { error: deleteError } = await supabase
      .from('transaksi_keuangan')
      .delete()
      .eq('id', id)

    if (deleteError) {
      setError(deleteError.message)
    } else {
      setItems((prev) => prev.filter((item) => item.id !== id))
    }
  }

  function handleExport() {
    const csv = toCsv(items)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `keuangan-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const kategoriOptions = form.jenis === 'pemasukan' ? KATEGORI_PEMASUKAN : KATEGORI_PENGELUARAN

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-turmeric">Pusat keuangan</p>
          <h2 className="font-display text-3xl">Keuangan</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Pemasukan dan pengeluaran rumah makan.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={items.length === 0}
            className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/60 px-4 py-2.5 text-sm text-ink-muted hover:bg-surface-3 hover:text-ink transition-all disabled:opacity-50"
          >
            <Download size={16} />
            Ekspor
          </button>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="bg-gradient-to-r from-chili to-chili-hover text-white rounded-xl px-5 py-2.5 text-sm font-medium shadow-lg shadow-chili/25 hover:shadow-chili/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
          >
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? 'Batal' : 'Catat Transaksi'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1.9fr] stagger">
        <div className="relative overflow-hidden rounded-2xl border border-herb/25 bg-gradient-to-br from-herb/20 via-surface to-surface-2/40 p-6 shadow-xl shadow-black/20">
          <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-herb/15 blur-3xl" />
          <div className="relative flex items-start justify-between"><div><p className="text-xs text-ink-muted">Saldo bersih berjalan</p><p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-ink-faint">Pemasukan dikurangi pengeluaran</p></div><span className="rounded-xl bg-herb-bg p-2.5 text-herb"><CircleDollarSign size={19} /></span></div>
          <p className={`ledger-num relative mt-8 text-3xl font-bold ${summary.bersih >= 0 ? 'text-herb' : 'text-chili'}`}>{formatRupiah(summary.bersih)}</p>
          <p className="relative mt-2 text-xs text-ink-faint">{summary.bersih >= 0 ? 'Posisi keuangan masih positif.' : 'Pengeluaran lebih besar dari pemasukan.'}</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            { label: 'Total pemasukan', value: summary.pemasukan, color: '#10b981', tone: 'text-herb', Icon: TrendingUp, dataKey: 'pemasukan' },
            { label: 'Total pengeluaran', value: summary.pengeluaran, color: '#ef4444', tone: 'text-chili', Icon: TrendingDown, dataKey: 'pengeluaran' },
          ].map(({ label, value, color, tone, Icon, dataKey }) => (
            <div key={label} className="relative overflow-hidden rounded-2xl border border-line bg-surface/60 p-4 backdrop-blur-sm">
              <div className="flex items-start justify-between"><div><p className="text-[10px] uppercase tracking-wider text-ink-faint">{label}</p><p className={`ledger-num mt-2 text-xl font-bold ${tone}`}>{formatRupiah(value)}</p></div><span className={`rounded-lg bg-surface-2 p-2 ${tone}`}><Icon size={16} /></span></div>
              <div className="mt-2 flex items-center justify-between gap-2"><p className={`truncate text-[10px] ${tone}`}>{trendLabel(sparklineData.map((point) => point[dataKey]))}</p><div className="h-12 w-24 shrink-0"><ResponsiveContainer width="100%" height="100%"><LineChart data={sparklineData}><ChartTooltip content={() => null} /><Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} activeDot={false} /></LineChart></ResponsiveContainer></div></div>
              <p className="mt-1 text-[10px] text-ink-faint">7 hari terakhir</p>
            </div>
          ))}
          <div className="relative overflow-hidden rounded-2xl border border-line bg-surface/60 p-4 backdrop-blur-sm sm:col-span-2"><div className="flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-wider text-ink-faint">Margin bersih</p><p className="ledger-num mt-2 text-xl font-bold text-turmeric">{summary.pemasukan > 0 ? `${Math.round((summary.bersih / summary.pemasukan) * 100)}%` : '0%'}</p></div><span className="rounded-lg bg-turmeric-bg p-2 text-turmeric"><Wallet size={16} /></span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3"><div className={`h-full rounded-full ${summary.bersih >= 0 ? 'bg-turmeric' : 'bg-chili'}`} style={{ width: `${Math.min(100, Math.max(4, summary.pemasukan ? (summary.bersih / summary.pemasukan) * 100 : 0))}%` }} /></div><p className="mt-2 text-[10px] text-ink-faint">Persentase omzet yang menjadi saldo bersih</p></div>
        </div>
      </div>

      {/* Analisis Kecukupan Dana */}
      {!loading && (
        <div className="rounded-2xl border border-line bg-surface/60 backdrop-blur-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4 mb-4">
            <div>
              <h3 className="font-display text-[17px]">Analisis Kecukupan Operasional &amp; Gaji</h3>
              <p className="text-xs text-ink-muted mt-0.5">Kalkulasi real-time kecukupan dana bulanan</p>
            </div>
            <div>
              {summary.pemasukan >= (summary.pengeluaran + totalGajiKaryawan) ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-herb-bg px-3 py-1 text-xs font-semibold text-herb border border-herb/20">
                  Dana Mencukupi ✓
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-chili-bg px-3 py-1 text-xs font-semibold text-chili border border-chili/20">
                  Dana Kurang ⚠
                </span>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="space-y-1">
              <span className="text-xs text-ink-faint uppercase font-medium">Total Pemasukan</span>
              <p className="ledger-num text-xl font-semibold text-herb">+{formatRupiah(summary.pemasukan)}</p>
            </div>
            
            <div className="space-y-1">
              <span className="text-xs text-ink-faint uppercase font-medium">Total Kebutuhan Beban</span>
              <p className="ledger-num text-xl font-semibold text-chili">-{formatRupiah(summary.pengeluaran + totalGajiKaryawan)}</p>
              <div className="text-[10px] text-ink-muted leading-relaxed">
                <span>Operasional: {formatRupiah(summary.pengeluaran)}</span>
                <span className="mx-2">•</span>
                <span>Beban Gaji: {formatRupiah(totalGajiKaryawan)}</span>
              </div>
            </div>
            
            <div className="space-y-1">
              <span className="text-xs text-ink-faint uppercase font-medium">Sisa Dana (Bersih Real)</span>
              <p className={`ledger-num text-2xl font-bold ${summary.pemasukan >= (summary.pengeluaran + totalGajiKaryawan) ? 'text-herb' : 'text-chili'}`}>
                {summary.pemasukan >= (summary.pengeluaran + totalGajiKaryawan) ? '+' : ''}
                {formatRupiah(summary.pemasukan - (summary.pengeluaran + totalGajiKaryawan))}
              </p>
              <p className="text-[10px] text-ink-faint">
                {summary.pemasukan >= (summary.pengeluaran + totalGajiKaryawan) 
                  ? 'Keuangan aman untuk menutup operasional & gaji karyawan.' 
                  : 'Keuangan defisit. Pendapatan tidak cukup menutup beban.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Ringkasan periode */}
      {!loading && (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface/60 backdrop-blur-sm">
          <div className="border-b border-line px-5 py-5 md:px-6"><p className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-turmeric">Performa penjualan</p><h3 className="font-display text-lg">Omzet &amp; untung</h3><p className="mt-1 text-xs text-ink-muted">Perbandingan pemasukan, pengeluaran, dan hasil bersih berdasarkan periode.</p></div>
          <div className="grid grid-cols-1 divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {[['hari', 'Hari ini', 'Sejak 00:00'], ['minggu', 'Minggu ini', 'Senin sampai hari ini'], ['bulan', 'Bulan ini', 'Periode berjalan']].map(([key, title, subtitle]) => {
              const stats = periodStats[key]
              return <div key={key} className="p-5 md:p-6"><div className="flex items-center justify-between"><div><h4 className="font-display text-base">{title}</h4><p className="mt-1 text-[10px] text-ink-faint">{subtitle}</p></div><span className={`rounded-full border px-2 py-1 text-[10px] font-medium ${stats.bersih >= 0 ? 'border-herb/20 bg-herb-bg text-herb' : 'border-chili/20 bg-chili-bg text-chili'}`}>{stats.bersih >= 0 ? 'Untung' : 'Rugi'}</span></div><div className="mt-6 space-y-3"><div className="flex items-center justify-between text-xs"><span className="text-ink-faint">Omzet</span><span className="ledger-num font-semibold text-herb">{formatRupiah(stats.omzet)}</span></div><div className="flex items-center justify-between text-xs"><span className="text-ink-faint">Pengeluaran</span><span className="ledger-num font-semibold text-chili">{formatRupiah(stats.pengeluaran)}</span></div><div className="flex items-center justify-between border-t border-line pt-3 text-xs"><span className="font-medium text-ink-muted">Untung bersih</span><span className={`ledger-num font-bold ${stats.bersih >= 0 ? 'text-ink' : 'text-chili'}`}>{formatRupiah(stats.bersih)}</span></div></div></div>
            })}
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-xl bg-chili/10 border border-chili/20 text-chili px-4 py-3 text-sm">{error}</p>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-line bg-surface/60 backdrop-blur-sm p-6"
        >
          <h3 className="font-display text-base mb-4">Catat Transaksi Baru</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-xs text-ink-muted">Tanggal</label>
              <input
                type="date"
                required
                value={form.tanggal}
                onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                className="w-full bg-surface-2 border border-line rounded-xl px-4 py-3 text-sm outline-none focus:border-chili/50 focus:ring-2 focus:ring-chili/10 transition-all"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-ink-muted">Jenis</label>
              <select
                value={form.jenis}
                onChange={(e) => {
                  const jenis = e.target.value
                  const kategori = jenis === 'pemasukan' ? KATEGORI_PEMASUKAN[0] : KATEGORI_PENGELUARAN[0]
                  setForm({ ...form, jenis, kategori })
                }}
                className="w-full bg-surface-2 border border-line rounded-xl px-4 py-3 text-sm outline-none focus:border-chili/50 focus:ring-2 focus:ring-chili/10 transition-all"
              >
                <option value="pemasukan">Pemasukan</option>
                <option value="pengeluaran">Pengeluaran</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-ink-muted">Kategori</label>
              <select
                value={form.kategori}
                onChange={(e) => setForm({ ...form, kategori: e.target.value })}
                className="w-full bg-surface-2 border border-line rounded-xl px-4 py-3 text-sm outline-none focus:border-chili/50 focus:ring-2 focus:ring-chili/10 transition-all"
              >
                {kategoriOptions.map((k) => (
                  <option key={k} value={k}>
                    {KATEGORI_LABEL[k]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-ink-muted">Metode Pembayaran</label>
              <select
                value={form.metode_pembayaran}
                onChange={(e) => setForm({ ...form, metode_pembayaran: e.target.value })}
                className="w-full rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm outline-none transition-all focus:border-chili/50 focus:ring-2 focus:ring-chili/10"
              >
                {METODE_PEMBAYARAN.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-ink-muted">Jumlah</label>
              <div className="relative">
                <CurrencyInput
                  value={form.jumlah}
                  onChange={(digits) => setForm({ ...form, jumlah: digits })}
                  required
                />
              </div>
            </div>

            <div className="sm:col-span-2 lg:col-span-4">
              <label className="mb-1.5 block text-xs text-ink-muted">Keterangan (opsional)</label>
              <input
                type="text"
                value={form.keterangan}
                onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
                className="w-full bg-surface-2 border border-line rounded-xl px-4 py-3 text-sm outline-none focus:border-chili/50 focus:ring-2 focus:ring-chili/10 transition-all"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-4 mt-2 flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="bg-gradient-to-r from-chili to-chili-hover text-white rounded-xl px-5 py-2.5 text-sm font-medium shadow-lg shadow-chili/25 hover:shadow-chili/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60 disabled:pointer-events-none"
              >
                {saving ? 'Menyimpan...' : editingId ? 'Perbarui Transaksi' : 'Simpan Transaksi'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setForm(EMPTY_FORM)
                    setEditingId(null)
                    setShowForm(false)
                  }}
                  className="rounded-xl border border-line bg-surface-2 px-5 py-2.5 text-sm font-medium text-ink-muted hover:bg-surface-3 transition-all"
                >
                  Batal
                </button>
              )}
            </div>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-ink-muted">Memuat data...</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Belum ada transaksi"
          description="Catat pemasukan dan pengeluaran di sini."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface/60 backdrop-blur-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wider text-ink-faint">
                <th className="px-4 py-4 font-normal">Tanggal</th>
                <th className="px-4 py-4 font-normal">Kategori</th>
                <th className="px-4 py-4 font-normal">Metode</th>
                <th className="px-4 py-4 font-normal">Keterangan</th>
                <th className="px-4 py-4 font-normal text-right">Jumlah</th>
                <th className="px-4 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-surface-2/50 transition-colors">
                  <td className="px-4 py-4 ledger-num text-ink-muted">
                    {formatTanggal(item.tanggal)}
                  </td>
                  <td className="px-4 py-4">
                    <span className="rounded-full px-3 py-1 text-xs font-medium bg-surface-3 text-ink-muted">
                      {KATEGORI_LABEL[item.kategori] ?? item.kategori}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex rounded-lg border border-line bg-surface-2 px-2.5 py-1 text-xs text-ink-muted">
                      {METODE_PEMBAYARAN.find((method) => method.value === item.metode_pembayaran)?.label ?? item.metode_pembayaran ?? 'Belum diisi'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-ink-muted">{item.keterangan ?? '—'}</td>
                  <td
                    className={`px-4 py-4 text-right font-mono font-medium ${
                      item.jenis === 'pemasukan' ? 'text-herb' : 'text-chili'
                    }`}
                  >
                    {item.jenis === 'pemasukan' ? '+' : '-'}
                    {formatRupiah(item.jumlah)}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setForm({
                            tanggal: item.tanggal,
                            jenis: item.jenis,
                            kategori: item.kategori,
                            metode_pembayaran: item.metode_pembayaran ?? 'cash',
                            jumlah: String(item.jumlah),
                            keterangan: item.keterangan ?? '',
                          })
                          setEditingId(item.id)
                          setShowForm(true)
                        }}
                        aria-label="Edit"
                        className="rounded-lg p-1.5 text-ink-faint transition-all hover:bg-surface-3 hover:text-ink"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        aria-label="Hapus"
                        className="rounded-lg p-1.5 text-ink-faint transition-all hover:bg-chili/10 hover:text-chili"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}