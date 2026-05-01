"use client"
import React from 'react'
import FriendRequestItem from './FriendRequestItem'

type Props = {
  requests: any[]
  onAccept: (id: string) => void
  onReject: (id: string) => void
  processingRequests?: Set<string>
  getImageUrl: (path?: string) => string
}

export default function FriendRequestsPanel({ requests, onAccept, onReject, processingRequests, getImageUrl }: Props) {
  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">Friend Requests</h3>
        <span className="text-sm text-gray-500">{requests.length} pending</span>
      </div>

      <div className="space-y-3">
        {requests.length === 0 ? (
          <div className="text-center text-gray-500 py-10">No friend requests</div>
        ) : (
          requests.map((r) => (
            <FriendRequestItem
              key={r._id}
              request={r}
              onAccept={onAccept}
              onReject={onReject}
              processing={!!processingRequests?.has?.(r._id)}
              getImageUrl={getImageUrl}
            />
          ))
        )}
      </div>
    </div>
  )
}
