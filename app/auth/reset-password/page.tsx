'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState } from 'react'

export default function ResetPassword() {
  const params = useSearchParams()
  const router = useRouter()

  const token = params.get('token')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: any) => {
    e.preventDefault()

    if (!password || !confirm) {
      setError('Please fill all fields')
      return
    }

    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    try {
      setLoading(true)

      const res = await fetch('http://localhost:3000/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password,
        }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.message)

      alert('Password reset successful')

      router.push('/auth/login')

    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md bg-white p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Reset Password</h2>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full mb-3 border p-2 rounded"
          />

          <input
            type="password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full mb-3 border p-2 rounded"
          />

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button className="w-full bg-black text-white py-2 rounded">
            {loading ? 'Loading...' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  )
}