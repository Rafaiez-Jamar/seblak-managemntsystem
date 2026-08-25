import CurrencyInput from '../components/CurrencyInput'
import { Download, Plus, TrendingDown, TrendingUp, Wallet, X } from 'lucide-react'
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

  useEffect(() => {
    fetchItems()
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

    const { error: insertError } = await supabase.from('transaksi_keuangan').insert(payload)

    if (insertError) {
      setError(insertError.message)
    } else {
      setForm(EMPTY_FORM)
      setShowForm(false)
      await fetchItems()
    }
    setSaving(false)
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

            <div className="sm:col-span-2 lg:col-span-4 mt-2">
              <button
                type="submit"
                disabled={saving}
                className="bg-gradient-to-r from-chili to-chili-hover text-white rounded-xl px-5 py-2.5 text-sm font-medium shadow-lg shadow-chili/25 hover:shadow-chili/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60 disabled:pointer-events-none"
              >
                {saving ? 'Menyimpan...' : 'Simpan Transaksi'}
              </button>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}