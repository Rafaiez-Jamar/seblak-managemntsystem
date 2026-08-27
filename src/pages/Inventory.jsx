import { AlertTriangle, Boxes, CalendarDays, CircleDollarSign, PackagePlus, Plus, Trash2, X, Pencil } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import CurrencyInput from '../components/CurrencyInput'
import EmptyState from '../components/EmptyState'
import { supabase } from '../lib/supabase'
import { formatKuantitas, formatRupiah, formatTanggal } from '../lib/helpers'

const KATEGORI_OPTIONS = [
  { value: 'frozen_food', label: 'Frozen Food' },
  { value: 'sayuran', label: 'Sayuran' },
  { value: 'bumbu', label: 'Bumbu' },
  { value: 'kemasan', label: 'Kemasan' },
  { value: 'lainnya', label: 'Lainnya' },
]

const SATUAN_OPTIONS = ['butir', 'gram', 'kg', 'liter', 'ml', 'pcs']

const KATEGORI_BADGE = {
  frozen_food: 'bg-chili/10 text-chili border-chili/20',
  sayuran:     'bg-herb/10 text-herb border-herb/20',
  bumbu:       'bg-turmeric/10 text-turmeric border-turmeric/20',
  kemasan:     'bg-surface-3 text-ink-muted border-line',
  lainnya:     'bg-surface-3 text-ink-muted border-line',
}

const EMPTY_FORM = {
  tanggal: new Date().toISOString().slice(0, 10),
  kategori: 'frozen_food',
  nama_barang: '',
  jumlah: '',
  satuan: 'kg',
  harga_total: '',
  tanggal_expired: '',
  catatan: '',
}

const inputCls = 'w-full rounded-xl border border-line bg-surface-2/80 px-4 py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint transition-all focus:border-chili/50 focus:ring-2 focus:ring-chili/10'

function statusExpired(tanggalExpired) {
  if (!tanggalExpired) return null
  const hariIni = new Date()
  hariIni.setHours(0, 0, 0, 0)
  const expired = new Date(`${tanggalExpired}T00:00:00`)
  const selisihHari = Math.ceil((expired - hariIni) / 86400000)
  if (selisihHari < 0) return { label: 'Sudah expired', tone: 'text-chili bg-chili-bg border-chili/30', urgent: true, days: selisihHari }
  if (selisihHari <= 7) return { label: `Expired ${selisihHari} hari lagi`, tone: 'text-turmeric bg-turmeric-bg border-turmeric/30', urgent: true, days: selisihHari }
  return { label: 'Masih aman', tone: 'text-herb bg-herb-bg border-herb/20', urgent: false, days: selisihHari }
}

export default function Inventory() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)

  async function fetchItems() {
    setLoading(true)
    const { data, error: fetchError } = await supabase
      .from('barang_masuk')
      .select('*')
      .order('tanggal', { ascending: false })
      .order('created_at', { ascending: false })
    if (fetchError) setError(fetchError.message)
    else { setItems(data); setError(null) }
    setLoading(false)
  }

  useEffect(() => { fetchItems() }, [])

  // Mengelompokkan dan menjumlahkan stok barang masuk berdasarkan Nama Barang & Satuan
  const stockSummary = useMemo(() => {
    const summary = {}
    items.forEach((item) => {
      // Kelompokkan case-insensitive dan bersihkan spasi
      const namaBersih = item.nama_barang.trim().toLowerCase()
      const key = `${namaBersih}_${item.satuan}`
      if (!summary[key]) {
        summary[key] = {
          nama_barang: item.nama_barang, // simpan nama asli
          satuan: item.satuan,
          jumlah: 0,
          kategori: item.kategori,
        }
      }
      summary[key].jumlah += Number(item.jumlah)
    })
    // Urutkan berdasarkan nama barang
    return Object.values(summary).sort((a, b) => a.nama_barang.localeCompare(b.nama_barang))
  }, [items])

  const inventoryStats = useMemo(() => ({
    totalCatatan: items.length,
    kategoriAktif: new Set(items.map((item) => item.kategori)).size,
    totalBelanja: items.reduce((sum, item) => sum + Number(item.harga_total ?? 0), 0),
  }), [items])

  const expiredAlerts = useMemo(() => items
    .map((item) => ({ ...item, expiredStatus: statusExpired(item.tanggal_expired) }))
    .filter((item) => item.expiredStatus?.urgent)
    .sort((a, b) => a.expiredStatus.days - b.expiredStatus.days), [items])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const payload = {
      tanggal: form.tanggal,
      kategori: form.kategori,
      nama_barang: form.nama_barang.trim(),
      jumlah: Number(form.jumlah),
      satuan: form.satuan,
      harga_total: form.harga_total ? Number(form.harga_total) : null,
      tanggal_expired: form.tanggal_expired || null,
      catatan: form.catatan.trim() || null,
    }
    const { error: submitError } = editingId
      ? await supabase.from('barang_masuk').update(payload).eq('id', editingId)
      : await supabase.from('barang_masuk').insert(payload)

    if (submitError) setError(submitError.message)
    else {
      setForm(EMPTY_FORM)
      setEditingId(null)
      setShowForm(false)
      await fetchItems()
    }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!confirm('Apakah kamu yakin ingin menghapus catatan barang ini?')) return
    const { error: deleteError } = await supabase.from('barang_masuk').delete().eq('id', id)
    if (deleteError) setError(deleteError.message)
    else setItems((prev) => prev.filter((item) => item.id !== id))
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl">Pemasukan Barang</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Catat stok masuk — frozen food, sayuran, dan bahan lainnya.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-chili to-chili-hover px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-chili/25 transition-all hover:scale-[1.02] hover:shadow-chili/40 active:scale-[0.98]"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Batal' : 'Tambah Barang'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Catatan stok', value: inventoryStats.totalCatatan, suffix: 'transaksi', icon: Boxes, tone: 'text-herb', bg: 'bg-herb-bg' },
          { label: 'Kategori aktif', value: inventoryStats.kategoriAktif, suffix: 'kategori', icon: CalendarDays, tone: 'text-turmeric', bg: 'bg-turmeric-bg' },
          { label: 'Total belanja tercatat', value: formatRupiah(inventoryStats.totalBelanja), suffix: 'bulan ini', icon: CircleDollarSign, tone: 'text-chili', bg: 'bg-chili-bg' },
        ].map(({ label, value, suffix, icon: Icon, tone, bg }) => (
          <div key={label} className="relative overflow-hidden rounded-2xl border border-line bg-surface/60 p-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg} ${tone}`}><Icon size={18} /></span>
              <div className="min-w-0"><p className="truncate text-[10px] uppercase tracking-wider text-ink-faint">{label}</p><p className={`ledger-num mt-1 truncate text-lg font-bold ${tone}`}>{value} <span className="font-sans text-[10px] font-normal text-ink-faint">{suffix}</span></p></div>
            </div>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <p className="rounded-xl border border-chili/20 bg-chili/10 px-4 py-3 text-sm text-chili">
          {error}
        </p>
      )}

      {expiredAlerts.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-turmeric/30 bg-gradient-to-r from-turmeric/15 via-turmeric-bg to-transparent px-4 py-4 text-sm">
          <AlertTriangle size={19} className="mt-0.5 shrink-0 text-turmeric" />
          <div className="min-w-0"><p className="font-semibold text-ink">Perhatian tanggal kedaluwarsa</p><p className="mt-1 text-xs leading-relaxed text-ink-muted">{expiredAlerts.length} barang perlu dicek: {expiredAlerts.slice(0, 3).map((item) => `${item.nama_barang} (${item.expiredStatus.label.toLowerCase()})`).join(', ')}{expiredAlerts.length > 3 ? ', dan lainnya.' : '.'}</p></div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-line bg-surface/60 backdrop-blur-sm p-6 animate-slide-up"
        >
          <h3 className="font-display text-base text-ink-muted mb-5">Detail Barang Masuk</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs text-ink-faint">Tanggal</label>
              <input
                type="date"
                required
                value={form.tanggal}
                onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                className={inputCls}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-ink-faint">Kategori</label>
              <select
                value={form.kategori}
                onChange={(e) => setForm({ ...form, kategori: e.target.value })}
                className={inputCls}
              >
                {KATEGORI_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-ink-faint">Nama Barang</label>
              <input
                type="text"
                required
                placeholder="Cth: Kerupuk mentah"
                value={form.nama_barang}
                onChange={(e) => setForm({ ...form, nama_barang: e.target.value })}
                className={inputCls}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-ink-faint">Jumlah</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={form.jumlah}
                onChange={(e) => setForm({ ...form, jumlah: e.target.value })}
                className={inputCls}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-ink-faint">Satuan</label>
              <select
                value={form.satuan}
                onChange={(e) => setForm({ ...form, satuan: e.target.value })}
                className={inputCls}
              >
                {SATUAN_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-ink-faint">Harga Total (opsional)</label>
              <CurrencyInput
                value={form.harga_total}
                onChange={(digits) => setForm({ ...form, harga_total: digits })}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-ink-faint">Tanggal Expired (opsional)</label>
              <input
                type="date"
                value={form.tanggal_expired}
                onChange={(e) => setForm({ ...form, tanggal_expired: e.target.value })}
                className={inputCls}
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label className="mb-1.5 block text-xs text-ink-faint">Catatan (opsional)</label>
              <input
                type="text"
                value={form.catatan}
                onChange={(e) => setForm({ ...form, catatan: e.target.value })}
                className={inputCls}
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3 flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-gradient-to-r from-chili to-chili-hover px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-chili/25 transition-all hover:scale-[1.02] hover:shadow-chili/40 active:scale-[0.98] disabled:opacity-60 disabled:hover:scale-100"
              >
                {saving ? 'Menyimpan...' : editingId ? 'Perbarui Barang' : 'Simpan Barang'}
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

      {/* Ringkasan Saldo Stok (Akumulasi) */}
      {!loading && stockSummary.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-herb/20 bg-gradient-to-r from-herb/10 via-surface/80 to-surface/60 p-5">
          <div className="relative mb-4 flex items-center justify-between gap-3">
            <div><p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-herb/70">Live inventory</p><h3 className="font-display text-base">Saldo bahan baku</h3></div>
            <span className="rounded-full border border-herb/20 bg-herb-bg px-2.5 py-1 text-[10px] text-herb">{stockSummary.length} jenis</span>
          </div>
          <div className="relative grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {stockSummary.map((stock) => (
              <div key={`${stock.nama_barang}_${stock.satuan}`} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface/70 px-3.5 py-3 transition-all hover:border-herb/30">
                <span className="truncate text-sm font-medium capitalize text-ink">{stock.nama_barang}</span>
                <span className="ledger-num shrink-0 text-sm font-semibold text-herb">{formatKuantitas(stock.jumlah, stock.satuan)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table / empty */}
      {loading ? (
        <div className="rounded-2xl border border-line bg-surface/60 backdrop-blur-sm p-5 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={PackagePlus}
          title="Belum ada barang tercatat"
          description="Setiap kali barang datang, catat di sini: jenis, jumlah, dan sumbernya."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface/60 backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-line px-5 py-4"><div><p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-ink-faint">Riwayat penerimaan</p><h3 className="font-display text-base">Barang masuk terbaru</h3></div><span className="text-xs text-ink-faint">{items.length} catatan</span></div>
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2/80">
                <th className="px-5 py-3.5 text-xs font-normal uppercase tracking-widest text-ink-faint">Tanggal</th>
                <th className="px-5 py-3.5 text-xs font-normal uppercase tracking-widest text-ink-faint">Kategori</th>
                <th className="px-5 py-3.5 text-xs font-normal uppercase tracking-widest text-ink-faint">Barang</th>
                <th className="px-5 py-3.5 text-xs font-normal uppercase tracking-widest text-ink-faint">Jumlah</th>
                <th className="px-5 py-3.5 text-xs font-normal uppercase tracking-widest text-ink-faint">Expired</th>
                <th className="px-5 py-3.5 text-xs font-normal uppercase tracking-widest text-ink-faint">Harga</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((item) => (
                <tr key={item.id} className="transition-colors hover:bg-surface-2/40">
                  <td className="px-5 py-3.5 ledger-num text-sm text-ink-faint">
                    {formatTanggal(item.tanggal)}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${KATEGORI_BADGE[item.kategori] ?? KATEGORI_BADGE.lainnya}`}>
                      {KATEGORI_OPTIONS.find((k) => k.value === item.kategori)?.label ?? item.kategori}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-medium text-ink">{item.nama_barang}</td>
                  <td className="px-5 py-3.5 ledger-num text-ink-muted">
                    {formatKuantitas(item.jumlah, item.satuan)}
                  </td>
                  <td className="px-5 py-3.5">
                    {item.tanggal_expired ? <div><p className="ledger-num text-xs text-ink-muted">{formatTanggal(item.tanggal_expired)}</p><span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[9px] ${statusExpired(item.tanggal_expired)?.tone}`}>{statusExpired(item.tanggal_expired)?.label}</span></div> : <span className="text-xs text-ink-faint">Belum diisi</span>}
                  </td>
                  <td className="px-5 py-3.5 ledger-num text-ink-muted">
                    {item.harga_total ? formatRupiah(item.harga_total) : '—'}
                  </td>
                   <td className="px-5 py-3.5 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setForm({
                            tanggal: item.tanggal,
                            kategori: item.kategori,
                            nama_barang: item.nama_barang,
                            jumlah: String(item.jumlah),
                            satuan: item.satuan,
                            harga_total: item.harga_total ? String(item.harga_total) : '',
                            tanggal_expired: item.tanggal_expired ?? '',
                            catatan: item.catatan ?? '',
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
        </div>
      )}
    </div>
  )
}