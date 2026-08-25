import { useEffect, useState } from 'react'

function formatRibuan(digitsOnly) {
  if (!digitsOnly) return ''
  return new Intl.NumberFormat('id-ID').format(Number(digitsOnly))
}

export default function CurrencyInput({ value, onChange, placeholder, required }) {
  const [display, setDisplay] = useState(formatRibuan(value))

  useEffect(() => {
    setDisplay(formatRibuan(value))
  }, [value])

  function handleChange(e) {
    const digitsOnly = e.target.value.replace(/\D/g, '')
    setDisplay(formatRibuan(digitsOnly))
    onChange(digitsOnly)
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-faint">
        Rp
      </span>
      <input
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        placeholder={placeholder}
        required={required}
        className="ledger-num w-full rounded-lg border border-line bg-surface-2 py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-ink-faint focus:border-chili"
      />
    </div>
  )
}