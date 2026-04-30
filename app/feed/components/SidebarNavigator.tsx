"use client"
import React from 'react'
import { Home, Users } from 'lucide-react'

type Props = {
  activeTab: 'home' | 'requests'
  setActiveTab: (tab: 'home' | 'requests') => void
  requestsCount: number
}

export default function SidebarNavigator({ activeTab, setActiveTab, requestsCount }: Props) {
  return (
    <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 space-y-1 sticky top-24">
      <button
        onClick={() => setActiveTab('home')}
        className={`flex items-center gap-4 w-full p-3 rounded-xl transition ${
          activeTab === 'home' ? 'bg-green-50 text-green-700 font-bold' : 'hover:bg-gray-50 text-gray-800'
        }`}
      >
        <Home size={20} className="text-green-600" />
        <span>Home</span>
      </button>

      <button
        onClick={() => setActiveTab('requests')}
        className={`relative flex items-center gap-4 w-full p-3 rounded-xl transition ${
          activeTab === 'requests' ? 'bg-green-50 text-green-700 font-bold' : 'hover:bg-gray-50 text-gray-800'
        }`}
      >
        <div className="flex items-center gap-4">
          <Users size={20} className="text-gray-600" />
          <span>Friend requests</span>
        </div>

        {requestsCount > 0 && (
          <span className="absolute right-4 top-3 inline-flex items-center justify-center h-6 w-6 bg-red-500 rounded-full text-white text-xs font-semibold">
            {requestsCount}
          </span>
        )}
      </button>
    </div>
  )
}
