import { Plus, Sparkles, Trash2, Users, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import EmptyState from '../components/EmptyState'
import { supabase } from '../lib/supabase'
import { formatRupiah } from '../lib/helpers'

const EMPTY_KARYAWAN_FORM = { nama: '', gaji_pokok: '' }

function bulanIni() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

function labelBulan(periodeStr) {
  const d = new Date(periodeStr)
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(d)
}

export default function Payroll() {
  const [karyawan, setKaryawan] = useState([])
  const [transaksi, setTransaksi] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_KARYAWAN_FORM)
  const [periode, setPeriode] = useState(bulanIni())
  const [generating, setGenerating] = useState(false)
  const [slipTersimpan, setSlipTersimpan] = useState(false)

  async function fetchAll() {
    setLoading(true)
    const [karyawanRes, transaksiRes] = await Promise.all([
      supabase.from('karyawan').select('*').eq('status', 'aktif').order('nama'),
      supabase
        .from('transaksi_keuangan')
        .select('jenis, jumlah, tanggal')
        .gte('tanggal', periode)
        .lt('tanggal', new Date(new Date(periode).setMonth(new Date(periode).getMonth() + 1)).toISOString().slice(0, 10)),
    ])

    if (karyawanRes.error) setError(karyawanRes.error.message)
    else setKaryawan(karyawanRes.data)

    if (transaksiRes.error) setError(transaksiRes.error.message)
    else setTransaksi(transaksiRes.data)

    setLoading(false)
  }

  useEffect(() => {
    fetchAll()
    setSlipTersimpan(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periode])

  const hitung = useMemo(() => {
    const pemasukan = transaksi
      .filter((t) => t.jenis === 'pemasukan')
      .reduce((sum, t) => sum + Number(t.jumlah), 0)
    const pengeluaran = transaksi
      .filter((t) => t.jenis === 'pengeluaran')
      .reduce((sum, t) => sum + Number(t.jumlah), 0)
    const untungBersih = pemasukan - pengeluaran
    const totalGajiPokok = karyawan.reduce((sum, k) => sum + Number(k.gaji_pokok), 0)
    const kolamBonus = Math.max(0, untungBersih - totalGajiPokok)
    const bonusPerOrang = karyawan.length > 0 ? kolamBonus / karyawan.length : 0

    return { pemasukan, pengeluaran, untungBersih, totalGajiPokok, kolamBonus, bonusPerOrang }
  }, [transaksi, karyawan])

  async function handleAddKaryawan(e) {
    e.preventDefault()
    setError(null)
    const { error: insertError } = await supabase.from('karyawan').insert({
      nama: form.nama.trim(),
      gaji_pokok: Number(form.gaji_pokok),
    })
    if (insertError) {
      setError(insertError.message)
    } else {
      setForm(EMPTY_KARYAWAN_FORM)
      setShowForm(false)
      await fetchAll()
    }
  }

  async function handleDeleteKaryawan(id) {
    const { error: deleteError } = await supabase.from('karyawan').delete().eq('id', id)
    if (deleteError) setError(deleteError.message)
    else setKaryawan((prev) => prev.filter((k) => k.id !== id))
  }

  async function handleGenerateSlip() {
    setGenerating(true)
    setError(null)

    const rows = karyawan.map((k) => ({
      karyawan_id: k.id,
      periode,
      gaji_pokok: Number(k.gaji_pokok),
      bonus: Math.round(hitung.bonusPerOrang),
      potongan: 0,
    }))

    const { error: upsertError } = await supabase
      .from('slip_gaji')
      .upsert(rows, { onConflict: 'karyawan_id,periode' })

    if (upsertError) setError(upsertError.message)
    else setSlipTersimpan(true)

    setGenerating(false)
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl">Slip Gaji</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Gaji pokok tetap + bonus dari sisa untung bulanan.
          </p>
        </div>
        <input
          type="month"
          value={periode.slice(0, 7)}
          onChange={(e) => setPeriode(`${e.target.value}-01`)}
          className="rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm outline-none focus:border-chili/50 focus:ring-2 focus:ring-chili/10 transition-all"
        />
      </div>

      {error && (
        <p className="rounded-xl bg-chili/10 border border-chili/20 text-chili px-4 py-3 text-sm">{error}</p>
      )}

      {/* Ringkasan perhitungan */}
      <div className="p-px rounded-2xl bg-gradient-to-br from-turmeric/30 via-line to-chili/20 shadow-inner">
        <div className="bg-surface rounded-2xl p-6">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles size={18} className="text-turmeric" />
            <h3 className="font-display text-lg">
              Perhitungan {labelBulan(periode)}
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="bg-surface-2/60 rounded-xl p-3.5">
              <p className="ledger-num text-xl font-medium">{formatRupiah(hitung.pemasukan)}</p>
              <p className="mt-0.5 text-xs text-ink-muted">Pemasukan</p>
            </div>
            <div className="bg-surface-2/60 rounded-xl p-3.5">
              <p className="ledger-num text-xl font-medium">{formatRupiah(hitung.pengeluaran)}</p>
              <p className="mt-0.5 text-xs text-ink-muted">Pengeluaran</p>
            </div>
            <div className="bg-surface-2/60 rounded-xl p-3.5">
              <p className="ledger-num text-xl font-medium">{formatRupiah(hitung.totalGajiPokok)}</p>
              <p className="mt-0.5 text-xs text-ink-muted">Total Gaji Pokok</p>
            </div>
            <div className="bg-surface-2/60 rounded-xl p-3.5">
              <p className="ledger-num text-xl font-medium text-herb">{formatRupiah(hitung.bonusPerOrang)}</p>
              <p className="mt-0.5 text-xs text-ink-muted">Bonus / Karyawan</p>
            </div>
          </div>
          {hitung.untungBersih - hitung.totalGajiPokok < 0 && (
            <p className="rounded-xl bg-turmeric/10 border border-turmeric/20 text-turmeric px-4 py-2.5 text-sm mt-4">
              Untung bersih bulan ini belum cukup nutup semua gaji pokok — bonus jadi Rp0.
            </p>
          )}
          <button
            type="button"
            onClick={handleGenerateSlip}
            disabled={generating || karyawan.length === 0}
            className="bg-gradient-to-r from-chili to-chili-hover text-white rounded-xl px-5 py-2.5 shadow-lg shadow-chili/25 hover:shadow-chili/40 hover:scale-[1.02] active:scale-[0.98] transition-all mt-5 text-sm font-medium disabled:opacity-50 disabled:pointer-events-none"
          >
            {generating
              ? 'Menyimpan...'
              : slipTersimpan
                ? 'Tersimpan ✓ — Simpan Ulang'
                : `Generate Slip Gaji ${labelBulan(periode)}`}
          </button>
        </div>
      </div>

      {/* Daftar karyawan */}
      <div className="flex items-center justify-between mt-8">
        <h3 className="font-display text-lg">Karyawan Aktif</h3>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/60 px-4 py-2.5 text-sm text-ink-muted hover:bg-surface-3 hover:text-ink transition-all"
        >
          {showForm ? <X size={15} /> : <Plus size={15} />}
          {showForm ? 'Batal' : 'Tambah Karyawan'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleAddKaryawan}
          className="rounded-2xl border border-line bg-surface/60 backdrop-blur-sm p-6"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs text-ink-muted">Nama</label>
              <input
                type="text"
                required
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
                className="w-full bg-surface-2 border border-line rounded-xl px-4 py-3 text-sm outline-none focus:border-chili/50 focus:ring-2 focus:ring-chili/10 transition-all"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-ink-muted">Gaji Pokok (Rp)</label>
              <input
                type="number"
                step="1"
                min="0"
                required
                value={form.gaji_pokok}
                onChange={(e) => setForm({ ...form, gaji_pokok: e.target.value })}
                className="w-full bg-surface-2 border border-line rounded-xl px-4 py-3 text-sm outline-none focus:border-chili/50 focus:ring-2 focus:ring-chili/10 transition-all"
              />
            </div>
            <div className="sm:col-span-3 mt-2">
              <button
                type="submit"
                className="bg-gradient-to-r from-chili to-chili-hover text-white rounded-xl px-5 py-2.5 text-sm font-medium shadow-lg shadow-chili/25 hover:shadow-chili/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Simpan Karyawan
              </button>
            </div>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-ink-muted">Memuat data...</p>
      ) : karyawan.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Belum ada karyawan terdaftar"
          description="Tambahkan karyawan dengan gaji pokoknya dulu."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface/60 backdrop-blur-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wider text-ink-faint">
                <th className="px-4 py-4 font-normal">Nama</th>
                <th className="px-4 py-4 font-normal text-right">Gaji Pokok</th>
                <th className="px-4 py-4 font-normal text-right">Bonus</th>
                <th className="px-4 py-4 font-normal text-right">Total</th>
                <th className="px-4 py-4 font-normal"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {karyawan.map((k) => (
                <tr key={k.id} className="hover:bg-surface-2/50 transition-colors">
                  <td className="px-4 py-4">{k.nama}</td>
                  <td className="px-4 py-4 text-right ledger-num text-ink-muted">
                    {formatRupiah(k.gaji_pokok)}
                  </td>
                  <td className="px-4 py-4 text-right ledger-num text-herb">
                    {formatRupiah(hitung.bonusPerOrang)}
                  </td>
                  <td className="px-4 py-4 text-right ledger-num font-medium">
                    {formatRupiah(Number(k.gaji_pokok) + hitung.bonusPerOrang)}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleDeleteKaryawan(k.id)}
                      aria-label="Hapus"
                      className="rounded-md p-1.5 text-ink-faint transition-colors hover:bg-chili/10 hover:text-chili"
                    >
                      <Trash2 size={16} />
                    </button>
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