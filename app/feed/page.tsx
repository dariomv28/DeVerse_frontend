'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoaderCircle } from 'lucide-react'

type Post = {
  id: number
  author: string
  content: string
}

export default function FeedPage() {
  const router = useRouter()

  const [posts, setPosts] = useState<Post[]>([])
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)

  // Check login
  useEffect(() => {
    const token = localStorage.getItem('token')

    if (!token) {
      router.push('/auth/login')
      return
    }

    // fake fetch posts
    setTimeout(() => {
      setPosts([
        { id: 1, author: 'Dang Vo', content: 'Hello DevVerse 🚀' },
        { id: 2, author: 'John Doe', content: 'This is my first post!' },
      ])
      setLoading(false)
    }, 1000)
  }, [])

  // Create post
  const handlePost = () => {
    if (!content.trim()) return

    const newPost: Post = {
      id: Date.now(),
      author: 'You',
      content,
    }

    setPosts([newPost, ...posts])
    setContent('')
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
      {/* Header */}
      <div className="flex items-center justify-between bg-white px-6 py-4 shadow">
        <h1 className="text-xl font-bold text-gray-800">DeVerse</h1>
        <button
          onClick={() => {
            localStorage.removeItem('token')
            router.push('/auth/login')
          }}
          className="text-sm text-red-500 hover:underline"
        >
          Logout
        </button>
      </div>

      {/* Main */}
      <div className="mx-auto mt-6 w-full max-w-xl space-y-4 px-4">
        {/* Create Post */}
        <div className="rounded-xl bg-white p-4 shadow">
          <textarea
            placeholder="What's on your mind?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full resize-none rounded-lg border p-3 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <div className="mt-3 flex justify-end">
            <button
              onClick={handlePost}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-500"
            >
              Post
            </button>
          </div>
        </div>

        {/* Posts */}
        {posts.map((post) => (
          <div key={post.id} className="rounded-xl bg-white p-4 shadow">
            <h3 className="font-semibold text-gray-800">{post.author}</h3>
            <p className="mt-2 text-gray-700">{post.content}</p>
          </div>
        ))}
      </div>
    </div>
  )
}