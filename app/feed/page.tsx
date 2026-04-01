'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoaderCircle, Bell } from 'lucide-react'

export default function FeedPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)

  // search
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])

  // notification
  const [requests, setRequests] = useState<any[]>([])
  const [showNoti, setShowNoti] = useState(false)

  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') : null

  // check login
  useEffect(() => {
    if (!token) {
      router.push('/auth/login')
      return
    }

    setLoading(false)
    fetchRequests()
  }, [])

  // search user
  useEffect(() => {
    if (!query) {
      setResults([])
      return
    }

    const fetchUsers = async () => {
      const res = await fetch(
        `http://localhost:3000/users/search?q=${query}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      const data = await res.json()

      // fix crash map
      if (Array.isArray(data)) {
        setResults(data)
      } else {
        setResults([])
      }
    }

    fetchUsers()
  }, [query])

  // load friend requests
  const fetchRequests = async () => {
    const res = await fetch('http://localhost:3000/users/requests', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()

    if (Array.isArray(data)) {
      setRequests(data)
    } else {
      setRequests([])
    }
  }

  // add friend
  const addFriend = async (id: string) => {
    await fetch(`http://localhost:3000/users/${id}/add-friend`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    alert('Friend request sent')
  }

  // follow
  const followUser = async (id: string) => {
    await fetch(`http://localhost:3000/users/${id}/follow`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    alert('Followed')
  }

  // accept
  const accept = async (id: string) => {
    await fetch(`http://localhost:3000/users/request/${id}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    fetchRequests()
  }

  // reject
  const reject = async (id: string) => {
    await fetch(`http://localhost:3000/users/request/${id}/reject`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    fetchRequests()
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoaderCircle className="animate-spin" size={30} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* HEADER */}
      <div className="flex items-center justify-between bg-white px-6 py-4 shadow relative">
        <h1 className="text-xl font-bold text-gray-800">DeVerse</h1>

        <div className="flex items-center gap-4">
          {/* NOTIFICATION */}
          <div className="relative">
            <button onClick={() => setShowNoti(!showNoti)}>
              <Bell />
              {requests.length > 0 && (
                <span className="absolute -top-2 -right-2 text-xs bg-red-500 text-white px-1 rounded">
                  {requests.length}
                </span>
              )}
            </button>

            {/* dropdown */}
            {showNoti && (
              <div className="absolute right-0 mt-2 w-64 bg-white shadow rounded p-3 z-10">
                <h3 className="font-semibold mb-2">Friend Requests</h3>

                {requests.length === 0 && (
                  <p className="text-sm text-gray-500">No requests</p>
                )}

                {requests.map((r) => (
                  <div
                    key={r._id}
                    className="mb-2 border p-2 rounded flex justify-between items-center"
                  >
                    <span className="text-sm">{r.from?.name}</span>

                    <div className="flex gap-1">
                      <button
                        onClick={() => accept(r._id)}
                        className="px-2 py-1 bg-green-500 text-white rounded text-xs"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => reject(r._id)}
                        className="px-2 py-1 bg-red-500 text-white rounded text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* logout */}
          <button
            onClick={() => {
              localStorage.removeItem('token')
              router.push('/auth/login')
            }}
            className="text-sm text-red-500"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="mx-auto mt-6 w-full max-w-xl space-y-4 px-4">
        {/* SEARCH */}
        <div className="rounded-xl bg-white p-4 shadow">
          <input
            placeholder="Search users..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded border p-2"
          />

          {results.map((u) => (
            <div
              key={u._id}
              className="mt-3 flex items-center justify-between border p-3 rounded"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gray-300" />
                <div>
                  <p className="font-semibold">{u.name}</p>
                  <p className="text-sm text-gray-500">{u.email}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => followUser(u._id)}
                  className="px-3 py-1 bg-blue-500 text-white rounded"
                >
                  Follow
                </button>

                <button
                  onClick={() => addFriend(u._id)}
                  className="px-3 py-1 bg-green-500 text-white rounded"
                >
                  Add
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}