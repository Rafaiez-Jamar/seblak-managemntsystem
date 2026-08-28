import { ArrowUpRight, CircleDollarSign, Mail, Pencil, Plus, Sparkles, Trash2, Users, WalletCards, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import CurrencyInput from '../components/CurrencyInput'
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
  const [editingId, setEditingId] = useState(null)

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
    const payload = {
      nama: form.nama.trim(),
      gaji_pokok: Number(form.gaji_pokok),
    }
    const { error: saveError } = editingId
      ? await supabase.from('karyawan').update(payload).eq('id', editingId)
      : await supabase.from('karyawan').insert(payload)
    if (saveError) {
      setError(saveError.message)
    } else {
      setForm(EMPTY_KARYAWAN_FORM)
      setEditingId(null)
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
          <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-turmeric">Pusat payroll</p>
          <h2 className="font-display text-3xl">Slip Gaji</h2>
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
      <div className="overflow-hidden rounded-2xl border border-turmeric/25 bg-gradient-to-br from-turmeric/15 via-surface to-surface-2/30 shadow-xl shadow-black/10">
        <div className="relative p-6">
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-turmeric/10 blur-3xl" />
          <div className="relative mb-6 flex flex-wrap items-start justify-between gap-3">
            <div><p className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-turmeric">Payroll overview</p><h3 className="font-display text-xl">Perhitungan {labelBulan(periode)}</h3></div>
            <span className="flex items-center gap-1.5 rounded-full border border-turmeric/20 bg-turmeric-bg px-3 py-1.5 text-[10px] text-turmeric"><Sparkles size={12} /> Periode aktif</span>
          </div>
          <div className="relative grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Pemasukan', value: hitung.pemasukan, color: 'text-herb', icon: ArrowUpRight },
              { label: 'Pengeluaran', value: hitung.pengeluaran, color: 'text-chili', icon: ArrowUpRight },
              { label: 'Total gaji pokok', value: hitung.totalGajiPokok, color: 'text-ink', icon: WalletCards },
              { label: 'Bonus / karyawan', value: hitung.bonusPerOrang, color: 'text-turmeric', icon: CircleDollarSign },
            ].map(({ label, value, color, icon: Icon }) => <div key={label} className="rounded-xl border border-line bg-surface-2/60 p-3.5"><div className="flex items-center justify-between"><p className={`ledger-num text-lg font-bold ${color}`}>{formatRupiah(value)}</p><Icon size={14} className={color} /></div><p className="mt-1 text-[10px] text-ink-faint">{label}</p></div>)}
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
      <div className="flex items-end justify-between mt-8">
        <div><p className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-ink-faint">Tim aktif</p><h3 className="font-display text-xl">Daftar karyawan</h3></div>
        <button
          type="button"
          onClick={() => {
            setShowForm((v) => !v)
            setEditingId(null)
            setForm(EMPTY_KARYAWAN_FORM)
          }}
          className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/60 px-4 py-2.5 text-sm text-ink-muted hover:bg-surface-3 hover:text-ink transition-all"
        >
          {showForm ? <X size={15} /> : <Plus size={15} />}
          {showForm ? 'Batal' : 'Tambah Karyawan'}
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleAddKaryawan}
            className="w-full max-w-lg rounded-2xl border border-line-strong bg-surface p-6 shadow-2xl shadow-black/40 animate-scale-in"
          >
            <div className="mb-5 flex items-start justify-between gap-4"><div><p className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-turmeric">Data tim</p><h3 className="font-display text-xl">{editingId ? 'Edit karyawan' : 'Tambah karyawan'}</h3><p className="mt-1 text-xs text-ink-muted">Atur nama dan gaji pokok untuk payroll.</p></div><button type="button" onClick={() => { setForm(EMPTY_KARYAWAN_FORM); setEditingId(null); setShowForm(false) }} aria-label="Tutup form" className="rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"><X size={17} /></button></div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              <CurrencyInput
                value={form.gaji_pokok}
                onChange={(digits) => setForm({ ...form, gaji_pokok: digits })}
                required
              />
            </div>
            <div className="sm:col-span-2 mt-2 flex gap-2">
              <button
                type="submit"
                className="bg-gradient-to-r from-chili to-chili-hover text-white rounded-xl px-5 py-2.5 text-sm font-medium shadow-lg shadow-chili/25 hover:shadow-chili/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                {editingId ? 'Perbarui Karyawan' : 'Simpan Karyawan'}
              </button>
              {editingId && <button type="button" onClick={() => { setForm(EMPTY_KARYAWAN_FORM); setEditingId(null); setShowForm(false) }} className="rounded-xl border border-line bg-surface-2 px-5 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-3">Batal</button>}
            </div>
          </div>
          </form>
        </div>
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
        <div className="overflow-hidden rounded-2xl border border-line bg-surface/60 backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-line px-5 py-4"><div><p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-ink-faint">Payroll aktif</p><p className="text-xs text-ink-muted">{karyawan.length} orang menerima gaji periode ini</p></div><Users size={18} className="text-turmeric" /></div>
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {karyawan.map((k) => {
              const totalDiterima = Number(k.gaji_pokok) + hitung.bonusPerOrang
              const initial = k.nama.trim().charAt(0).toUpperCase()
              return (
                <article key={k.id} className="group relative overflow-hidden rounded-2xl border border-line bg-surface-2/35 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-turmeric/30 hover:bg-surface-2/60">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-chili/30 to-turmeric/20 text-base font-bold text-ink shadow-lg shadow-chili/10">{initial}</span>
                      <div className="min-w-0"><h4 className="truncate text-sm font-semibold text-ink">{k.nama}</h4><p className="mt-0.5 text-[10px] text-ink-faint">Karyawan aktif</p></div>
                    </div>
                    <span className="shrink-0 rounded-full border border-herb/20 bg-herb-bg px-2 py-1 text-[9px] font-medium text-herb">Aktif</span>
                  </div>
                  <div className="mt-4 rounded-xl border border-line bg-surface/50 p-3"><p className="text-[10px] uppercase tracking-wider text-ink-faint">Total diterima</p><p className="ledger-num mt-1 text-lg font-bold text-ink">{formatRupiah(totalDiterima)}</p><div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-2 text-[10px]"><span className="text-ink-faint">Pokok <strong className="ledger-num block mt-0.5 text-ink-muted">{formatRupiah(k.gaji_pokok)}</strong></span><span className="text-ink-faint">Bonus <strong className="ledger-num block mt-0.5 text-herb">{formatRupiah(hitung.bonusPerOrang)}</strong></span></div></div>
                  <div className="mt-3 flex items-center justify-between"><span className="flex items-center gap-1.5 text-[10px] text-ink-faint"><Mail size={12} /> Slip {labelBulan(periode)}</span><div className="flex items-center gap-1"><button type="button" onClick={() => { setForm({ nama: k.nama, gaji_pokok: String(k.gaji_pokok) }); setEditingId(k.id); setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }} aria-label={`Edit ${k.nama}`} className="rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-turmeric-bg hover:text-turmeric"><Pencil size={14} /></button><button type="button" onClick={() => handleDeleteKaryawan(k.id)} aria-label={`Hapus ${k.nama}`} className="rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-chili/10 hover:text-chili"><Trash2 size={14} /></button></div></div>
                </article>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}