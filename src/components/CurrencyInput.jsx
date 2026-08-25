/**
 * CurrencyInput — input angka dengan format Rupiah otomatis.
 *
 * Props:
 *   value    {string|number} — nilai mentah (digit saja, e.g. "50000")
 *   onChange {function}     — dipanggil dengan string digit bersih (e.g. "50000")
 *   required {boolean}      — opsional, diteruskan ke <input>
 */
export default function CurrencyInput({ value, onChange, required }) {
  // Format angka ke tampilan Rupiah tanpa simbol, e.g. "50.000"
  function formatDisplay(raw) {
    const digits = String(raw).replace(/\D/g, '')
    if (!digits) return ''
    return Number(digits).toLocaleString('id-ID')
  }

  function handleChange(e) {
    // Ambil hanya digit dari input
    const digits = e.target.value.replace(/\D/g, '')
    onChange(digits)
  }

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted select-none">
        Rp
      </span>
      <input
        type="text"
        inputMode="numeric"
        required={required}
        value={formatDisplay(value)}
        onChange={handleChange}
        placeholder="0"
        className="w-full rounded-lg border border-line bg-surface-2 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-chili"
      />
    </div>
  )
}
