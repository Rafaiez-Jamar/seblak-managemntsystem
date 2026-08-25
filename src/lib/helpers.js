/**
 * Format angka jadi Rupiah, contoh: 1500000 -> "Rp1.500.000"
 */
export function formatRupiah(amount) {
  const value = Number(amount) || 0
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Format tanggal ke format Indonesia yang ringkas, contoh: "25 Agu 2026"
 */
export function formatTanggal(date) {
  const d = date instanceof Date ? date : new Date(date)
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

/**
 * Format kuantitas barang dengan satuan, contoh: formatKuantitas(2.5, 'kg') -> "2,5 kg"
 */
export function formatKuantitas(amount, unit) {
  const value = new Intl.NumberFormat('id-ID').format(Number(amount) || 0)
  return `${value} ${unit}`
}
