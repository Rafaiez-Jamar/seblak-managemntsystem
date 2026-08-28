import { ArrowDownRight, ArrowUpRight, Bot, PackagePlus, Plus, TrendingDown, TrendingUp, Users, WalletCards } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { formatRupiah } from '../lib/helpers'

function rentangBulan(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const awal = `${y}-${m}-01`
  const akhir = new Date(y, date.getMonth() + 1, 1)
  return { awal, akhir: akhir.toISOString().slice(0, 10) }
}

function labelBulanPendek(tahun, bulan) {
  return new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(
    new Date(tahun, bulan - 1, 1)
  )
}

function enamBulanTerakhir() {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return { tahun: d.getFullYear(), bulan: d.getMonth() + 1 }
  })
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-line bg-surface/90 px-4 py-3 text-xs shadow-xl backdrop-blur-sm">
      <p className="mb-2 font-semibold text-ink">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 leading-relaxed">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-ink-muted">{p.name}:</span>
          <span className="font-medium text-ink">{formatRupiah(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

const CATEGORY_COLORS = ['#f59e0b', '#ef4444', '#10b981', '#38bdf8', '#a78bfa']

function labelKategori(kategori) {
  return kategori?.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) ?? 'Lainnya'
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-line bg-surface/60 p-5">
      <div className="skeleton h-10 w-10 rounded-xl mb-4" />
      <div className="skeleton h-7 w-32 mb-2" />
      <div className="skeleton h-3 w-24" />
    </div>
  )
}

function dapatkanStatusStok(jumlah, satuan) {
  const s = satuan.toLowerCase()
  if (s === 'kg' || s === 'liter') {
    if (jumlah >= 20) return { label: 'Stok Melimpah', color: 'text-herb bg-herb-bg border-herb/20' }
    if (jumlah >= 5) return { label: 'Stok Stabil', color: 'text-turmeric bg-turmeric-bg border-turmeric/20' }
    return { label: 'Stok Minim', color: 'text-chili bg-chili-bg border-chili/20' }
  }
  if (s === 'butir' || s === 'gram' || s === 'ml' || s === 'pcs') {
    if (jumlah >= 150) return { label: 'Stok Melimpah', color: 'text-herb bg-herb-bg border-herb/20' }
    if (jumlah >= 40) return { label: 'Stok Stabil', color: 'text-turmeric bg-turmeric-bg border-turmeric/20' }
    return { label: 'Stok Minim', color: 'text-chili bg-chili-bg border-chili/20' }
  }
  return { label: 'Tersedia', color: 'text-ink-muted bg-surface-3 border-line' }
}

export default function Dashboard() {
  const [stats, setStats] = useState({ pemasukan: 0, pengeluaran: 0, totalKaryawan: null, barangMasuk: null })
  const [chartData, setChartData] = useState([])
  const [categoryData, setCategoryData] = useState([])
  const [recentTransactions, setRecentTransactions] = useState([])
  const [stockAnalysis, setStockAnalysis] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDashboard() {
      setLoading(true)
      const { awal, akhir } = rentangBulan()
      const bulanList = enamBulanTerakhir()

      const [transaksiRes, karyawanRes, barangRes, chartRes] = await Promise.all([
        supabase.from('transaksi_keuangan').select('jenis, kategori, jumlah, tanggal, keterangan').gte('tanggal', awal).lt('tanggal', akhir),
        supabase.from('karyawan').select('id', { count: 'exact', head: true }).eq('status', 'aktif'),
        supabase.from('barang_masuk').select('nama_barang, jumlah, satuan, kategori').gte('tanggal', awal).lt('tanggal', akhir),
        supabase.from('transaksi_keuangan').select('jenis, jumlah, tanggal')
          .gte('tanggal', `${bulanList[0].tahun}-${String(bulanList[0].bulan).padStart(2, '0')}-01`)
          .lt('tanggal', akhir),
      ])

      const rawBarang = barangRes.data ?? []

      let pemasukan = 0, pengeluaran = 0
      for (const t of transaksiRes.data ?? []) {
        if (t.jenis === 'pemasukan') pemasukan += Number(t.jumlah)
        else pengeluaran += Number(t.jumlah)
      }
      setStats({
        pemasukan,
        pengeluaran,
        totalKaryawan: karyawanRes.count ?? 0,
        barangMasuk: rawBarang.length
      })
      setRecentTransactions((transaksiRes.data ?? []).slice().sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal)).slice(0, 6))

      const byKategori = {}
      for (const transaksi of transaksiRes.data ?? []) {
        if (transaksi.jenis !== 'pengeluaran') continue
        const kategori = transaksi.kategori || 'lainnya'
        byKategori[kategori] = (byKategori[kategori] ?? 0) + Number(transaksi.jumlah)
      }
      setCategoryData(Object.entries(byKategori).sort(([, a], [, b]) => b - a).map(([name, value]) => ({ name: labelKategori(name), value })))

      // Akumulasi stok barang masuk
      const stockGroups = {}
      rawBarang.forEach((b) => {
        const key = `${b.nama_barang.trim().toLowerCase()}_${b.satuan}`
        if (!stockGroups[key]) {
          stockGroups[key] = {
            nama: b.nama_barang,
            satuan: b.satuan,
            jumlah: 0,
            kategori: b.kategori,
          }
        }
        stockGroups[key].jumlah += Number(b.jumlah)
      })
      const stockArray = Object.values(stockGroups).sort((a, b) => b.jumlah - a.jumlah)
      setStockAnalysis(stockArray)

      const byBulan = {}
      for (const t of chartRes.data ?? []) {
        const d = new Date(t.tanggal)
        const key = `${d.getFullYear()}-${d.getMonth() + 1}`
        if (!byBulan[key]) byBulan[key] = { pemasukan: 0, pengeluaran: 0 }
        if (t.jenis === 'pemasukan') byBulan[key].pemasukan += Number(t.jumlah)
        else byBulan[key].pengeluaran += Number(t.jumlah)
      }
      setChartData(bulanList.map(({ tahun, bulan }) => {
        const key = `${tahun}-${bulan}`
        return { bulan: labelBulanPendek(tahun, bulan), Pemasukan: byBulan[key]?.pemasukan ?? 0, Pengeluaran: byBulan[key]?.pengeluaran ?? 0 }
      }))
      setLoading(false)
    }
    fetchDashboard()
  }, [])

  const cards = [
    { label: 'Pemasukan Bulan Ini', value: formatRupiah(stats.pemasukan), icon: TrendingUp, tone: 'herb', gradient: 'from-herb/20 to-herb/5', glow: 'shadow-herb/20', text: 'text-herb' },
    { label: 'Pengeluaran Bulan Ini', value: formatRupiah(stats.pengeluaran), icon: TrendingDown, tone: 'chili', gradient: 'from-chili/20 to-chili/5', glow: 'shadow-chili/20', text: 'text-chili' },
    { label: 'Karyawan Aktif', value: stats.totalKaryawan === null ? '—' : `${stats.totalKaryawan} orang`, icon: Users, tone: 'turmeric', gradient: 'from-turmeric/20 to-turmeric/5', glow: 'shadow-turmeric/20', text: 'text-turmeric', isText: true },
    { label: 'Barang Masuk Bulan Ini', value: stats.barangMasuk === null ? '—' : `${stats.barangMasuk} item`, icon: PackagePlus, tone: 'herb', gradient: 'from-herb/20 to-herb/5', glow: 'shadow-herb/20', text: 'text-herb', isText: true },
  ]

  const untungBersih = stats.pemasukan - stats.pengeluaran

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div>
        <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-turmeric">Overview bisnis</p>
        <h2 className="font-display text-3xl">Ringkasan operasional</h2>
        <p className="mt-1 text-sm text-ink-muted">Pantau keuangan, persediaan, dan tim Seblak HQ dalam satu tempat.</p>
      </div>

      {/* Balance + chart */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(250px,0.72fr)_minmax(0,1.7fr)]">
        <div className="relative overflow-hidden rounded-2xl border border-chili/30 bg-gradient-to-br from-chili/25 via-surface to-surface-2/50 p-6 shadow-xl shadow-black/20">
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-chili/20 blur-3xl" />
          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-ink-muted">Saldo operasional</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-ink-faint">Bulan berjalan</p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-chili/20 text-chili"><WalletCards size={18} /></span>
          </div>
          <p className={`ledger-num relative mt-7 text-3xl font-bold ${untungBersih >= 0 ? 'text-ink' : 'text-chili'}`}>
            {formatRupiah(untungBersih)}
          </p>
          <div className="relative mt-5 grid grid-cols-2 gap-2 border-t border-white/10 pt-4">
            <div><p className="text-[10px] text-ink-faint">Pemasukan</p><p className="ledger-num mt-1 text-xs font-semibold text-herb">{formatRupiah(stats.pemasukan)}</p></div>
            <div><p className="text-[10px] text-ink-faint">Pengeluaran</p><p className="ledger-num mt-1 text-xs font-semibold text-chili">{formatRupiah(stats.pengeluaran)}</p></div>
          </div>
          <Link to="/keuangan" className="relative mt-6 flex items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-xs font-semibold text-base transition-transform hover:scale-[1.02]">
            Kelola keuangan <ArrowUpRight size={14} />
          </Link>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-surface via-surface/95 to-surface-2/30 p-5 backdrop-blur-sm md:p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-herb/5 blur-3xl" />
        <div className="relative mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-ink-faint">Performa keuangan</p>
            <h3 className="font-display text-lg">Tren 6 Bulan Terakhir</h3>
          </div>
          <div className="rounded-xl border border-herb/20 bg-herb-bg px-3 py-2 text-right">
            <p className="text-[10px] uppercase tracking-wider text-herb/70">Untung bersih</p>
            <p className={`ledger-num mt-0.5 text-sm font-bold ${untungBersih >= 0 ? 'text-herb' : 'text-chili'}`}>
              {formatRupiah(untungBersih)}
            </p>
          </div>
        </div>
        {loading ? (
          <div className="skeleton h-52 w-full rounded-xl" />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} barCategoryGap="30%" barGap={5}>
              <defs>
                <linearGradient id="incomeBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" />
                  <stop offset="100%" stopColor="#059669" />
                </linearGradient>
                <linearGradient id="expenseBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fb7185" />
                  <stop offset="100%" stopColor="#dc2626" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 6" stroke="rgba(245,237,227,0.07)" vertical={false} />
              <XAxis dataKey="bulan" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}jt` : v >= 1000 ? `${(v / 1000).toFixed(0)}rb` : v}
                width={42}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="Pemasukan" fill="url(#incomeBar)" radius={[6, 6, 2, 2]} maxBarSize={30} />
              <Bar dataKey="Pengeluaran" fill="url(#expenseBar)" radius={[6, 6, 2, 2]} maxBarSize={30} />
            </BarChart>
          </ResponsiveContainer>
        )}
        {!loading && (
          <div className="relative mt-1 flex items-center justify-center gap-5 text-[11px] text-ink-muted">
            <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-herb" />Pemasukan</span>
            <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-chili" />Pengeluaran</span>
          </div>
        )}
      </div>
      </div>

      {/* Operational metrics */}
      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 ${!loading ? 'stagger' : ''}`}>
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : cards.map(({ label, value, icon: Icon, gradient, glow, text, isText }) => (
              <div key={label} className="group relative overflow-hidden rounded-2xl border border-line bg-surface/60 p-5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-xl hover:shadow-black/20">
                <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${gradient}`} />
                <div className="flex items-center justify-between">
                  <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} ${text} shadow-lg ${glow}`}><Icon size={18} strokeWidth={1.75} /></span>
                  <span className={`text-[10px] ${text}`}>{isText ? 'Aktif' : label.includes('Pemasukan') ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}</span>
                </div>
                <p className={`mt-5 text-xl font-semibold ${isText ? '' : 'ledger-num'}`}>{value}</p>
                <p className="mt-1 text-xs text-ink-faint">{label}</p>
              </div>
            ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-2xl border border-line bg-surface/60 p-5 backdrop-blur-sm md:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div><p className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-ink-faint">Aksi cepat</p><h3 className="font-display text-lg">Kelola operasional</h3></div>
            <Plus size={18} className="text-turmeric" />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Link to="/keuangan" className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/40 p-3 transition-colors hover:border-chili/40 hover:bg-chili-bg"><span className="rounded-lg bg-chili-bg p-2 text-chili"><WalletCards size={16} /></span><span><span className="block text-xs font-semibold">Catat transaksi</span><span className="block text-[10px] text-ink-faint">Pemasukan atau biaya</span></span></Link>
            <Link to="/barang" className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/40 p-3 transition-colors hover:border-herb/40 hover:bg-herb-bg"><span className="rounded-lg bg-herb-bg p-2 text-herb"><PackagePlus size={16} /></span><span><span className="block text-xs font-semibold">Tambah stok</span><span className="block text-[10px] text-ink-faint">Catat barang masuk</span></span></Link>
          </div>
        </div>
        <Link to="/asisten" className="group relative overflow-hidden rounded-2xl border border-turmeric/20 bg-gradient-to-br from-turmeric/15 via-surface to-surface-2/30 p-5 transition-all hover:border-turmeric/40">
          <div className="pointer-events-none absolute -bottom-12 -right-8 h-32 w-32 rounded-full bg-turmeric/10 blur-2xl" />
          <Bot size={22} className="relative text-turmeric" />
          <h3 className="relative mt-8 font-display text-lg">Tanya Asisten AI</h3>
          <p className="relative mt-1 text-xs leading-relaxed text-ink-muted">Dapatkan insight dari data keuangan dan stok bulan ini.</p>
          <span className="relative mt-5 inline-flex items-center gap-1 text-xs font-semibold text-turmeric">Buka asisten <ArrowUpRight size={13} /></span>
        </Link>
      </div>

      {/* Statistics detail */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="overflow-hidden rounded-2xl border border-line bg-surface/60 p-5 backdrop-blur-sm md:p-6">
          <div className="mb-5 flex items-start justify-between">
            <div><p className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-ink-faint">Aktivitas terbaru</p><h3 className="font-display text-lg">Detail transaksi</h3></div>
            <Link to="/keuangan" className="text-xs text-turmeric hover:text-ink">Lihat semua</Link>
          </div>
          {loading ? <div className="skeleton h-48 w-full rounded-xl" /> : recentTransactions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line-strong px-4 py-10 text-center text-xs text-ink-faint">Belum ada transaksi bulan ini.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-xs">
                <thead><tr className="border-b border-line text-[10px] uppercase tracking-wider text-ink-faint"><th className="pb-3 font-medium">Tanggal</th><th className="pb-3 font-medium">Kategori</th><th className="pb-3 font-medium">Catatan</th><th className="pb-3 text-right font-medium">Jumlah</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {recentTransactions.map((transaction, index) => (
                    <tr key={`${transaction.tanggal}-${index}`} className="text-ink-muted">
                      <td className="py-3">{new Date(transaction.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</td>
                      <td className="py-3 font-medium text-ink">{labelKategori(transaction.kategori)}</td>
                      <td className="max-w-[180px] truncate py-3 text-ink-faint">{transaction.keterangan || 'Tanpa catatan'}</td>
                      <td className={`py-3 text-right font-semibold ledger-num ${transaction.jenis === 'pemasukan' ? 'text-herb' : 'text-chili'}`}>{transaction.jenis === 'pemasukan' ? '+' : '-'}{formatRupiah(transaction.jumlah)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-surface/60 p-5 backdrop-blur-sm md:p-6">
          <div className="mb-1"><p className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-ink-faint">Kontrol biaya</p><h3 className="font-display text-lg">Pengeluaran per kategori</h3></div>
          {loading ? <div className="skeleton mx-auto mt-4 h-44 w-44 rounded-full" /> : categoryData.length === 0 ? (
            <p className="py-16 text-center text-xs text-ink-faint">Belum ada pengeluaran.</p>
          ) : (
            <div className="flex flex-col items-center gap-4 sm:flex-row xl:flex-col">
              <div className="relative h-44 w-44 shrink-0">
                <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={74} paddingAngle={4} stroke="none">{categoryData.map((entry, index) => <Cell key={entry.name} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />)}</Pie><Tooltip content={<CustomTooltip />} /></PieChart></ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-[10px] text-ink-faint">Total</span><span className="ledger-num text-sm font-bold text-ink">{formatRupiah(stats.pengeluaran)}</span></div>
              </div>
              <div className="w-full space-y-2">
                {categoryData.slice(0, 5).map((category, index) => <div key={category.name} className="flex items-center justify-between gap-3 text-xs"><span className="flex min-w-0 items-center gap-2 text-ink-muted"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }} /><span className="truncate">{category.name}</span></span><span className="ledger-num shrink-0 text-ink-faint">{formatRupiah(category.value)}</span></div>)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Analisis Stok Bahan Baku */}
      {!loading && stockAnalysis.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface/60 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-5 md:px-6">
            <div>
              <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-ink-faint">Inventori</p>
              <h3 className="font-display text-lg">Stok bahan baku</h3>
              <p className="mt-1 text-xs text-ink-muted">Volume barang masuk bulan ini</p>
            </div>
            <Link to="/barang" className="flex items-center gap-1.5 rounded-lg border border-line-strong px-3 py-2 text-xs text-ink-muted transition-colors hover:border-herb/40 hover:bg-herb-bg hover:text-herb">
              Kelola stok <ArrowUpRight size={13} />
            </Link>
          </div>
          <div className="divide-y divide-line px-5 md:px-6">
            {stockAnalysis.map((stock) => {
              const status = dapatkanStatusStok(stock.jumlah, stock.satuan)
              const maxQty = Math.max(...stockAnalysis.map(s => s.jumlah), 1)
              const visualPercent = Math.min(100, Math.max(12, (stock.jumlah / maxQty) * 100))

              return (
                <div key={`${stock.nama}_${stock.satuan}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4 sm:grid-cols-[minmax(150px,0.7fr)_minmax(180px,1.5fr)_auto]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold capitalize text-ink">{stock.nama}</p>
                    <p className="mt-1 truncate text-[10px] uppercase tracking-wider text-ink-faint">{stock.kategori.replace('_', ' ')}</p>
                  </div>
                  <div className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">
                    <div className="mb-1.5 flex items-center justify-between text-[10px] text-ink-faint"><span>Kapasitas relatif</span><span>{Math.round(visualPercent)}%</span></div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${
                        status.label === 'Stok Melimpah' ? 'from-herb to-emerald-400' :
                        status.label === 'Stok Stabil' ? 'from-turmeric to-amber-400' :
                        'from-chili to-rose-400'
                      }`}
                      style={{ width: `${visualPercent}%` }}
                    />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="ledger-num text-sm font-bold text-ink">{stock.jumlah.toLocaleString('id-ID')} <span className="text-xs font-normal text-ink-faint">{stock.satuan}</span></p>
                    <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[9px] font-medium ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}
