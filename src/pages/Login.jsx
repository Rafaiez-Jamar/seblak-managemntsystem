import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login, isAuthenticated } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)
    const result = await login(email, password)
    setSubmitting(false)
    if (!result.ok) {
      setFormError('Email atau password salah. Coba lagi.')
    }
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-base px-4">
      {/* Animated background orbs */}
      <div className="pointer-events-none absolute -right-32 -top-32 h-[500px] w-[500px] animate-pulse rounded-full bg-chili/8 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-32 h-[500px] w-[500px] animate-pulse rounded-full bg-turmeric/8 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-chili/5 blur-3xl" />

      <div className="relative z-10 w-full max-w-sm animate-scale-in">
        {/* Logo + title */}
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-chili to-chili-hover text-2xl shadow-xl shadow-chili/35">
            🍲
          </span>
          <h1 className="font-display text-3xl gradient-text">Seblak HQ</h1>
          <p className="mt-1.5 text-sm text-ink-muted">Akses khusus admin &amp; keluarga</p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-3xl border border-line-strong bg-surface/60 p-8 shadow-2xl shadow-black/50 backdrop-blur-md"
        >
          {/* Email */}
          <div>
            <label htmlFor="email" className="mb-2 block text-xs font-medium text-ink-muted">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@seblakhq.id"
              className="w-full rounded-xl border border-line bg-surface-3/60 px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-faint transition-all focus:border-chili/50 focus:ring-2 focus:ring-chili/10"
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="mb-2 block text-xs font-medium text-ink-muted">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-line bg-surface-3/60 px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-faint transition-all focus:border-chili/50 focus:ring-2 focus:ring-chili/10"
            />
          </div>

          {/* Error */}
          {formError && (
            <p className="rounded-xl border border-chili/20 bg-chili/10 px-4 py-2.5 text-xs text-chili">
              {formError}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-chili to-chili-hover py-3 text-sm font-semibold text-white shadow-lg shadow-chili/30 transition-all hover:scale-[1.02] hover:shadow-chili/50 active:scale-[0.98] disabled:opacity-60 disabled:hover:scale-100"
          >
            {submitting && <LoaderCircle size={16} className="animate-spin" />}
            Masuk
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-ink-faint">
          Belum punya akun? Hubungi admin untuk dibuatkan akses —{' '}
          <span className="text-ink-muted">tidak ada pendaftaran mandiri.</span>
        </p>
      </div>
    </div>
  )
}
