"use client"
import React from 'react'
import { Check, Trash2 } from 'lucide-react'

type Props = {
  request: any
  onAccept: (id: string) => void
  onReject: (id: string) => void
  processing?: boolean
  getImageUrl: (path?: string) => string
}

export default function FriendRequestItem({ request, onAccept, onReject, processing, getImageUrl }: Props) {
  const user = request?.from || {}

  return (
    <div className="flex items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-gray-100">
      <div className="flex items-center gap-3">
        <img
          src={getImageUrl(user?.avatar)}
          alt={user?.name || 'avatar'}
          className="h-12 w-12 object-cover rounded-full bg-gray-100"
        />
        <div>
          <div className="font-semibold text-gray-900">{user?.name || 'Unknown'}</div>
          <div className="text-sm text-gray-500">{user?.email || ''}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onAccept(request._id)}
          disabled={!!processing}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition ${processing ? 'opacity-60 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}
        >
          <Check size={16} />
          <span>Accept</span>
        </button>

        <button
          onClick={() => onReject(request._id)}
          disabled={!!processing}
          className={`p-2 rounded-md transition ${processing ? 'opacity-60 cursor-not-allowed' : 'text-red-600 hover:bg-red-50'}`}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  )
}
