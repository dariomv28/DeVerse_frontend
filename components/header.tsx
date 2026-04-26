'use client'
import React from 'react'
import { Search } from 'lucide-react'
import { useRouter } from 'next/navigation'

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
