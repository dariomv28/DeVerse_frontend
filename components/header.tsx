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

type Relation = {
  id: string
  isFollowing: boolean
  isFriend: boolean
  friendRequestStatus: 'none' | 'sent' | 'received'
  friendRequestId: string | null
}

type Result = {
  _id: string
  name?: string
  email?: string
  avatar?: string
  isFollowing?: boolean
  isFriend?: boolean
  friendRequestStatus?: 'none' | 'sent' | 'received'
  friendRequestId?: string | null
  [key: string]: any
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
  const [results, setResults] = useState<Result[]>([])
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
      const users = Array.isArray(data) ? data : []
      setResults(users as Result[])

      // fetch authoritative relationship statuses for these users
      const ids = (users as any[]).map(u => u._id).filter(Boolean)
      if (ids.length > 0) {
        const rels = await fetchRelations(ids)
        if (!mountedRef.current) return
        const relMap = new Map<string, Relation>(rels.map((r: Relation) => [r.id, r]))
        setResults(prev => prev.map((r: Result) => {
          const info = relMap.get(r._id)
          if (!info) return r
          return { ...r, isFollowing: info.isFollowing, isFriend: info.isFriend, friendRequestStatus: info.friendRequestStatus, friendRequestId: info.friendRequestId }
        }))
      }
    } catch (e) {
      console.error('Search error', e)
    } finally {
      setLoadingSearch(false)
    }
  }

  const fetchRelations = async (ids: string[]) => {
    try {
      const token = getToken()
      const res = await fetch('http://localhost:3000/users/relations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids }),
      })
      if (!res.ok) return []
      return await res.json()
    } catch (e) {
      console.error('fetchRelations error', e)
      return []
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
      setResults(prev => prev.map((r: Result) => {
        if (r._id === payload.to) return { ...r, isFollowing: !!payload.following }
        return r
      }))
    }

    const onFriendRequest = (payload: any) => {
      setResults(prev => prev.map((r: Result) => {
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
      setResults(prev => prev.map((r: Result) => {
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
      setResults(prev => prev.map((r: Result) => {
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
    try {
      const res = await fetch(`http://localhost:3000/users/${targetId}/follow`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) {
        const err = await res.text()
        console.error('Follow error', err)
        return
      }
      // refresh authoritative data
      if (query && query.trim() !== '') fetchSearch(query)
    } catch (e) {
      console.error(e)
    }
  }

  const handleAddFriend = async (targetId: string, idx: number) => {
    try {
      const res = await fetch(`http://localhost:3000/users/${targetId}/add-friend`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) {
        const err = await res.text()
        console.error('Add friend error', err)
        return
      }
      await res.json()
      // refresh authoritative data from server
      if (query && query.trim() !== '') fetchSearch(query)
    } catch (e) {
      console.error(e)
    }
  }

  const handleCancelRequest = async (targetId: string, idx: number) => {
    try {
      const res = await fetch(`http://localhost:3000/users/${targetId}/cancel-request`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) {
        const err = await res.text()
        console.error('Cancel request error', err)
        return
      }
      await res.json()
      if (query && query.trim() !== '') fetchSearch(query)
    } catch (e) {
      console.error(e)
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
                    ) : r.friendRequestStatus === 'none' ? (
                      <button onClick={() => handleAddFriend(r._id, idx)} className="px-3 py-1 text-sm bg-green-500 text-white rounded">Add friend</button>
                    ) : null
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
