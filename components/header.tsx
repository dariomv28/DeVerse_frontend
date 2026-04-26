 'use client'
import React, { useEffect, useState, useRef } from 'react'
import { Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { getSocket } from '../lib/socket'

type Props = {
  user: any
  query: string
  setQuery: React.Dispatch<React.SetStateAction<string>>
  showMenu: boolean
  setShowMenu: React.Dispatch<React.SetStateAction<boolean>>
  fileRef: React.RefObject<HTMLInputElement | null>
  handleAvatarChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void> | void
  getImageUrl: (path?: string) => string
}

export default function Header({
  user,
  query,
  setQuery,
  showMenu,
  setShowMenu,
  fileRef,
  handleAvatarChange,
  getImageUrl,
}: Props) {
  const router = useRouter()
  const [results, setResults] = useState<any[]>([])
  const [loadingSearch, setLoadingSearch] = useState(false)
  const mountedRef = useRef(true)

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('token') : null

  const fetchSearch = async (q: string) => {
    setLoadingSearch(true)
    try {
      const token = getToken()
      const res = await fetch(`http://localhost:3000/users/search?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!mountedRef.current) return
      setResults(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Search error', e)
    } finally {
      setLoadingSearch(false)
    }
  }

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (!query || query.trim() === '') {
      setResults([])
      return
    }

    const t = setTimeout(() => fetchSearch(query), 260)

    return () => clearTimeout(t)
  }, [query])

  // socket updates
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const onFollow = (payload: any) => {
      setResults(prev => prev.map(r => {
        if (r._id === payload.to) return { ...r, isFollowing: !!payload.following }
        return r
      }))
    }

    const onFriendRequest = (payload: any) => {
      setResults(prev => prev.map(r => {
        // we sent the request
        if (payload.from === user?._id && r._id === payload.to) {
          return { ...r, friendRequestStatus: 'sent', friendRequestId: payload.requestId }
        }

        // we received the request
        if (payload.to === user?._id && r._id === payload.from) {
          return { ...r, friendRequestStatus: 'received', friendRequestId: payload.requestId }
        }

        return r
      }))
    }

    const onFriendCancelled = (payload: any) => {
      setResults(prev => prev.map(r => {
        if (payload.from === user?._id && r._id === payload.to) {
          return { ...r, friendRequestStatus: 'none', friendRequestId: null }
        }
        if (payload.to === user?._id && r._id === payload.from) {
          return { ...r, friendRequestStatus: 'none', friendRequestId: null }
        }
        return r
      }))
    }

    const onFriendAccepted = (payload: any) => {
      setResults(prev => prev.map(r => {
        if (r._id === payload.to || r._id === payload.from) {
          return { ...r, isFriend: true, friendRequestStatus: 'none', friendRequestId: null }
        }
        return r
      }))
    }

    socket.on('user.followed', onFollow)
    socket.on('friend.request', onFriendRequest)
    socket.on('friend.request.cancelled', onFriendCancelled)
    socket.on('friend.accepted', onFriendAccepted)

    return () => {
      socket.off('user.followed', onFollow)
      socket.off('friend.request', onFriendRequest)
      socket.off('friend.request.cancelled', onFriendCancelled)
      socket.off('friend.accepted', onFriendAccepted)
    }
  }, [user])

  const handleToggleFollow = async (targetId: string, idx: number) => {
    // optimistic update
    setResults(prev => prev.map((r, i) => i === idx ? { ...r, isFollowing: !r.isFollowing } : r))
    try {
      const res = await fetch(`http://localhost:3000/users/${targetId}/follow`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      const data = await res.json()
      setResults(prev => prev.map((r, i) => i === idx ? { ...r, isFollowing: !!data.following } : r))
      // refresh server-driven state for the current query
      if (query && query.trim() !== '') fetchSearch(query)
    } catch (e) {
      console.error(e)
    }
  }

  const handleAddFriend = async (targetId: string, idx: number) => {
    // optimistic UI update
    setResults(prev => prev.map((r, i) => i === idx ? { ...r, friendRequestStatus: 'sent' } : r))

    try {
      const res = await fetch(`http://localhost:3000/users/${targetId}/add-friend`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      const data = await res.json()
      const reqId = data && (data._id || data.id || data.requestId) ? (data._id || data.id || data.requestId) : null
      setResults(prev => prev.map((r, i) => i === idx ? { ...r, friendRequestStatus: 'sent', friendRequestId: reqId } : r))
      if (query && query.trim() !== '') fetchSearch(query)
    } catch (e) {
      console.error(e)
      // rollback UI on error
      setResults(prev => prev.map((r, i) => i === idx ? { ...r, friendRequestStatus: 'none', friendRequestId: null } : r))
    }
  }

  const handleCancelRequest = async (targetId: string, idx: number) => {
    // optimistic UI
    setResults(prev => prev.map((r, i) => i === idx ? { ...r, friendRequestStatus: 'none', friendRequestId: null } : r))

    try {
      await fetch(`http://localhost:3000/users/${targetId}/cancel-request`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (query && query.trim() !== '') fetchSearch(query)
    } catch (e) {
      console.error(e)
      // rollback UI on error
      setResults(prev => prev.map((r, i) => i === idx ? { ...r, friendRequestStatus: 'sent' } : r))
    }
  }

  return (
    <div className="flex items-center justify-between px-6 py-3 bg-white shadow-sm sticky top-0 z-50 border-b border-gray-100">
      <h1 className="text-2xl font-black tracking-tight text-green-600">DeVerse</h1>

      <div className="relative hidden md:block">
        <div className="flex items-center bg-gray-100 px-4 py-2 rounded-full w-80 focus-within:ring-2 focus-within:ring-green-100 transition">
          <Search size={18} className="text-gray-500 mr-2" />
          <input
            placeholder="Search users..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-transparent outline-none w-full text-sm"
          />
        </div>
        {results.length > 0 && (
          <div className="absolute left-0 mt-2 w-80 bg-white border rounded-lg shadow-lg z-50 overflow-hidden">
            {results.map((r, idx) => (
              <div key={r._id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <img src={getImageUrl(r.avatar) || '/avatar.png'} className="h-10 w-10 rounded-full object-cover" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{r.name}</div>
                    <div className="text-xs text-gray-500 truncate">{r.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!r.isFriend && (
                    r.friendRequestStatus === 'sent' ? (
                      <button onClick={() => handleCancelRequest(r._id, idx)} className="px-3 py-1 text-sm bg-gray-100 rounded">Cancel request</button>
                    ) : (
                      <button onClick={() => handleAddFriend(r._id, idx)} className="px-3 py-1 text-sm bg-green-500 text-white rounded">Add friend</button>
                    )
                  )}
                  <button onClick={() => handleToggleFollow(r._id, idx)} className={`px-3 py-1 text-sm rounded ${r.isFollowing ? 'bg-gray-100' : 'bg-blue-500 text-white'}`}>
                    {r.isFollowing ? 'Unfollow' : 'Follow'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="relative flex items-center gap-4">
        <img
          src={getImageUrl(user?.avatar) || '/avatar.png'}
          alt="profile"
          onClick={() => setShowMenu(!showMenu)}
          className="h-10 w-10 rounded-full object-cover cursor-pointer border-2 border-gray-200 hover:border-green-500 transition"
        />
        <input
          type="file"
          ref={fileRef}
          hidden
          accept="image/*"
          onChange={handleAvatarChange}
        />

        {showMenu && (
          <div className="absolute right-0 top-12 mt-2 w-56 bg-white shadow-2xl rounded-xl p-2 z-50 border border-gray-100">
            <div className="px-3 py-3 border-b border-gray-100 mb-2">
              <p className="text-sm font-bold truncate text-gray-800">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
            <button
              onClick={() => {
                if (fileRef.current) fileRef.current.click()
              }}
              className="w-full text-left px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg cursor-pointer transition"
            >
              Upload Avatar
            </button>
            <button
              onClick={() => {
                localStorage.removeItem('token')
                router.push('/auth/login')
              }}
              className="w-full text-left px-3 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition"
            >
              Log Out
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
