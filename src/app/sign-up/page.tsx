'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignUpPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [checking, setChecking] = useState(true)

  // Redirect already authenticated users
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/dashboard')
      else setChecking(false)
    })
  }, [])

  if (checking) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="w-9 h-9 rounded-full border-2 border-transparent border-t-indigo-600 border-r-indigo-100 animate-spin" />
      </div>
    )
  }

  const handleGoogleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    setSubmitting(true)
    const { error } = await supabase.auth.signUp({ email, password })
    setSubmitting(false)

    if (error) {
      if (
        error.message.includes('already registered') ||
        error.message.includes('User already registered')
      ) {
        setError('Este correo ya está registrado. ¿Quieres iniciar sesión?')
      } else {
        setError(error.message)
      }
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <Link
            href="/"
            className="flex items-center gap-2 font-heading font-bold text-xl text-gray-950"
          >
            <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black bg-indigo-600 text-white">
              N
            </span>
            Nukor
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-xl">
          <h1 className="font-heading text-2xl font-bold mb-1 text-gray-950">
            Crea tu cuenta
          </h1>
          <p className="text-sm mb-6 text-gray-500">
            Empieza gratis, sin tarjeta de crédito.
          </p>

          {/* Google sign-in */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
            </svg>
            Continuar con Google
          </button>

          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">o</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {error && (
            <div className="rounded-lg px-4 py-3 mb-1 text-sm bg-red-50 border border-red-100 text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email"
                className="text-xs font-semibold uppercase tracking-wide text-gray-500"
              >
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@empresa.com"
                className="w-full rounded-lg px-4 py-3 text-sm outline-none bg-white border border-gray-200 text-gray-950 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 transition-all duration-200"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-xs font-semibold uppercase tracking-wide text-gray-500"
              >
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full rounded-lg px-4 py-3 text-sm outline-none bg-white border border-gray-200 text-gray-950 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 transition-all duration-200"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="confirm-password"
                className="text-xs font-semibold uppercase tracking-wide text-gray-500"
              >
                Confirmar contraseña
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite tu contraseña"
                className="w-full rounded-lg px-4 py-3 text-sm outline-none bg-white border border-gray-200 text-gray-950 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 transition-all duration-200"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full py-3 mt-1 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
            >
              {submitting ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            ¿Ya tienes cuenta?{' '}
            <Link
              href="/sign-in"
              className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
