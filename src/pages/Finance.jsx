import CurrencyInput from '../components/CurrencyInput'
import { Download, Plus, TrendingDown, TrendingUp, Wallet, X, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
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

const EMPTY_FORM = {
  tanggal: new Date().toISOString().slice(0, 10),
  jenis: 'pemasukan',
  kategori: 'penjualan',
  jumlah: '',
  keterangan: '',
}

function toCsv(rows) {
  const header = ['Tanggal', 'Jenis', 'Kategori', 'Jumlah', 'Keterangan']
  const lines = rows.map((r) =>
    [
      r.tanggal,
      r.jenis,
      KATEGORI_LABEL[r.kategori] ?? r.kategori,
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

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const payload = {
      tanggal: form.tanggal,
      jenis: form.jenis,
      kategori: form.kategori,
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl">Keuangan</h2>
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 stagger">
        <div className="rounded-2xl border border-line bg-surface/60 backdrop-blur-sm p-5 hover:border-line-strong hover:shadow-xl transition-all">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-herb/20 to-herb/5 text-herb border border-herb/20">
            <TrendingUp size={18} strokeWidth={1.75} />
          </span>
          <p className="ledger-num mt-4 text-2xl">{formatRupiah(summary.pemasukan)}</p>
          <p className="mt-1 text-xs text-ink-muted">Total Pemasukan</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface/60 backdrop-blur-sm p-5 hover:border-line-strong hover:shadow-xl transition-all">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-chili/20 to-chili/5 text-chili border border-chili/20">
            <TrendingDown size={18} strokeWidth={1.75} />
          </span>
          <p className="ledger-num mt-4 text-2xl">{formatRupiah(summary.pengeluaran)}</p>
          <p className="mt-1 text-xs text-ink-muted">Total Pengeluaran</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface/60 backdrop-blur-sm p-5 hover:border-line-strong hover:shadow-xl transition-all">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-turmeric/20 to-turmeric/5 text-turmeric border border-turmeric/20">
            <Wallet size={18} strokeWidth={1.75} />
          </span>
          <p className="ledger-num mt-4 text-2xl">{formatRupiah(summary.bersih)}</p>
          <p className="mt-1 text-xs text-ink-muted">Untung Bersih</p>
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

      {/* Analisis Balik Modal (Break-Even) */}
      {!loading && (
        <div className="rounded-2xl border border-line bg-surface/60 backdrop-blur-sm p-6 space-y-4">
          <div>
            <h3 className="font-display text-[17px]">📈 Analisis Balik Modal (Break-Even)</h3>
            <p className="text-xs text-ink-muted mt-0.5">Analisis rata-rata omzet untuk menutup beban operasional + gaji</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Harian */}
            <div className="rounded-xl bg-surface-2/40 border border-line p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-ink-muted">Analisis Harian</span>
                {analisisBEP.diffHarian >= 0 ? (
                  <span className="rounded bg-herb-bg px-2 py-0.5 text-[10px] font-bold text-herb">BEP ✓</span>
                ) : (
                  <span className="rounded bg-chili-bg px-2 py-0.5 text-[10px] font-bold text-chili">Defisit ⚠</span>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-ink-faint">Rata-rata Omzet: <span className="ledger-num text-ink font-medium">{formatRupiah(analisisBEP.avgHarian)}/hari</span></p>
                <p className="text-xs text-ink-faint">Target Minimal: <span className="ledger-num text-ink font-medium">{formatRupiah(analisisBEP.targetHarian)}/hari</span></p>
              </div>
              <p className={`text-[11px] font-medium pt-1 ${analisisBEP.diffHarian >= 0 ? 'text-herb' : 'text-chili'}`}>
                {analisisBEP.diffHarian >= 0 
                  ? `Surplus +${formatRupiah(analisisBEP.diffHarian)}/hari` 
                  : `Kurang ${formatRupiah(Math.abs(analisisBEP.diffHarian))}/hari`}
              </p>
            </div>

            {/* Mingguan */}
            <div className="rounded-xl bg-surface-2/40 border border-line p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-ink-muted">Analisis Mingguan</span>
                {analisisBEP.diffMingguan >= 0 ? (
                  <span className="rounded bg-herb-bg px-2 py-0.5 text-[10px] font-bold text-herb">BEP ✓</span>
                ) : (
                  <span className="rounded bg-chili-bg px-2 py-0.5 text-[10px] font-bold text-chili">Defisit ⚠</span>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-ink-faint">Rata-rata Omzet: <span className="ledger-num text-ink font-medium">{formatRupiah(analisisBEP.avgMingguan)}/minggu</span></p>
                <p className="text-xs text-ink-faint">Target Minimal: <span className="ledger-num text-ink font-medium">{formatRupiah(analisisBEP.targetMingguan)}/minggu</span></p>
              </div>
              <p className={`text-[11px] font-medium pt-1 ${analisisBEP.diffMingguan >= 0 ? 'text-herb' : 'text-chili'}`}>
                {analisisBEP.diffMingguan >= 0 
                  ? `Surplus +${formatRupiah(analisisBEP.diffMingguan)}/minggu` 
                  : `Kurang ${formatRupiah(Math.abs(analisisBEP.diffMingguan))}/minggu`}
              </p>
            </div>

            {/* Sisa Hari */}
            <div className="rounded-xl bg-surface-2/40 border border-line p-4 space-y-2">
              <span className="text-xs font-semibold text-ink-muted">Proyeksi Sisa Bulan Ini</span>
              <div className="space-y-1 text-xs text-ink-faint">
                <p>Hari Berlalu: <span className="font-medium text-ink">{analisisBEP.hariIni} / ${analisisBEP.totalHari} Hari</span></p>
                <p>Sisa Target Bulanan: <span className="ledger-num font-medium text-ink">{formatRupiah(analisisBEP.sisaTargetBulan)}</span></p>
              </div>
              {analisisBEP.sisaTargetBulan > 0 ? (
                <div className="text-[11px] text-turmeric pt-1">
                  Butuh <span className="font-semibold ledger-num">{formatRupiah(analisisBEP.targetHarianSisa)}</span>/hari di sisa {analisisBEP.sisa} hari ini untuk balik modal.
                </div>
              ) : (
                <div className="text-[11px] text-herb font-semibold pt-1">
                  Target modal bulanan sudah tercapai! ✓
                </div>
              )}
            </div>
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