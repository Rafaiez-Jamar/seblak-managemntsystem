import { PackagePlus, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
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
  const [stockAnalysis, setStockAnalysis] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDashboard() {
      setLoading(true)
      const { awal, akhir } = rentangBulan()
      const bulanList = enamBulanTerakhir()

      const [transaksiRes, karyawanRes, barangRes, chartRes] = await Promise.all([
        supabase.from('transaksi_keuangan').select('jenis, jumlah').gte('tanggal', awal).lt('tanggal', akhir),
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
        <h2 className="font-display text-2xl">Selamat datang kembali 👋</h2>
        <p className="mt-1 text-sm text-ink-muted">Ringkasan operasional Seblak HQ bulan ini.</p>
      </div>

      {/* Summary cards */}
      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 ${!loading ? 'stagger' : ''}`}>
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : cards.map(({ label, value, icon: Icon, gradient, glow, text, isText }) => (
              <div
                key={label}
                className="group rounded-2xl border border-line bg-surface/60 backdrop-blur-sm p-5 transition-all duration-300 hover:border-line-strong hover:shadow-xl hover:shadow-black/20 hover:-translate-y-0.5"
              >
                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} ${text} shadow-lg ${glow}`}>
                  <Icon size={18} strokeWidth={1.75} />
                </span>
                <p className={`mt-4 text-2xl font-semibold ${isText ? '' : 'ledger-num'}`}>{value}</p>
                <p className="mt-1 text-xs text-ink-faint">{label}</p>
              </div>
            ))}
      </div>

      {/* Chart */}
      <div className="rounded-2xl border border-line bg-surface/60 backdrop-blur-sm p-6">
        <h3 className="mb-6 font-display text-base">Tren 6 Bulan Terakhir</h3>
        {loading ? (
          <div className="skeleton h-52 w-full rounded-xl" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barCategoryGap="35%" barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(245,237,227,0.05)" vertical={false} />
              <XAxis dataKey="bulan" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}jt` : v >= 1000 ? `${(v / 1000).toFixed(0)}rb` : v}
                width={42}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="Pemasukan" fill="#10b981" radius={[5, 5, 0, 0]} maxBarSize={28} />
              <Bar dataKey="Pengeluaran" fill="#ef4444" radius={[5, 5, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Analisis Stok Bahan Baku */}
      {!loading && stockAnalysis.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface/60 backdrop-blur-sm p-6 space-y-4">
          <div>
            <h3 className="font-display text-base">📊 Status &amp; Analisis Stok Bahan Baku</h3>
            <p className="text-xs text-ink-muted mt-0.5">Ringkasan estimasi total volume barang masuk bulan ini</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {stockAnalysis.map((stock) => {
              const status = dapatkanStatusStok(stock.jumlah, stock.satuan)
              const maxQty = Math.max(...stockAnalysis.map(s => s.jumlah), 1)
              const visualPercent = Math.min(100, Math.max(12, (stock.jumlah / maxQty) * 100))

              return (
                <div key={`${stock.nama}_${stock.satuan}`} className="rounded-xl border border-line bg-surface-2/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-ink capitalize">{stock.nama}</p>
                      <p className="text-[10px] text-ink-faint uppercase tracking-wider mt-0.5">{stock.kategori.replace('_', ' ')}</p>
                    </div>
                    <div className="text-right">
                      <p className="ledger-num text-sm font-bold text-ink">{stock.jumlah.toLocaleString('id-ID')} {stock.satuan}</p>
                      <span className={`inline-block rounded-full border px-2 py-0.5 text-[9px] font-medium mt-1 ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                  </div>

                  {/* Custom Progress Bar */}
                  <div className="h-1.5 w-full bg-surface-3 rounded-full overflow-hidden">
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
              )
            })}
          </div>
        </div>
      )}

      {/* Untung bersih */}
      {!loading && (
        <div className="p-px rounded-2xl bg-gradient-to-r from-herb/30 via-line to-transparent">
          <div className="rounded-2xl bg-surface p-6">
            <p className="text-xs font-medium uppercase tracking-widest text-ink-faint">Untung Bersih Bulan Ini</p>
            <p className={`ledger-num mt-2 text-4xl font-bold ${untungBersih >= 0 ? 'text-herb' : 'text-chili'}`}>
              {formatRupiah(untungBersih)}
            </p>
            <p className="mt-2 text-xs text-ink-faint">
              {formatRupiah(stats.pemasukan)} pemasukan &minus; {formatRupiah(stats.pengeluaran)} pengeluaran
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
