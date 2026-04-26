'use client'
import { getSocket } from '@/lib/socket'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Home,
  Bell,
  MessageCircle,
  Bookmark,
  LoaderCircle,
  Image as ImageIcon,
  Heart,
  X,
  Trash2,
  Send
} from 'lucide-react'
import Header from '@/components/header'
import CreatePostBox from './components/CreatePostBox'
import PostList from './components/PostList'

export default function FeedPage() {
  const router = useRouter()
  const API_URL = 'http://localhost:3000'

  // Refs
  const fileRef = useRef<HTMLInputElement>(null)
  const postImageRef = useRef<HTMLInputElement>(null)

  // Auth & User States
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [showMenu, setShowMenu] = useState(false)

  // Search States
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])

  // Notifications
  const [requests, setRequests] = useState<any[]>([])
  const [showNoti, setShowNoti] = useState(false)

  // Posts States
  const [posts, setPosts] = useState<any[]>([])
  const [postText, setPostText] = useState('')
  const [postImages, setPostImages] = useState<File[]>([])
  const [isPosting, setIsPosting] = useState(false)

  // Interactions State
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())
  const [commentInputs, setCommentInputs] = useState<{ [key: string]: string }>({})

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('token') : null

  

  // =====================
  // INITIALIZATION
  // =====================
  useEffect(() => {
    const init = async () => {
      const token = getToken()
      if (!token) {
        router.push('/auth/login')
        return
      }

      try {
        // 1. Fetch User First
        const res = await fetch(`${API_URL}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!res.ok) return;

        const userData = await res.json()
        setUser(userData)

        // 2. Fetch data tied to this specific user
        fetchRequests()
        fetchPosts(userData)

        setLoading(false)
      } catch (error) {
        console.error('Initialization error:', error)
        localStorage.removeItem('token')
        router.push('/auth/login')
      }
    }

    init()
  }, [])

  useEffect(() => {
    const socket = getSocket();

    socket.on("post.updated", (data) => {
      setPosts(prev =>
        prev.map(p => {
          if (p._id !== data.postId) return p;

          if (data.type === "LIKE_UPDATE") {
            const newIsLiked = data.userId === user?._id ? data.isLiked : p.isLiked
            const newLikeCount = data.likeCount

            // persist current user's like state locally
            if (data.userId === user?._id && user?._id) {
              try {
                const key = `likes_${user._id}`
                const likes = JSON.parse(localStorage.getItem(key) || '{}')
                likes[data.postId] = { isLiked: data.isLiked, count: data.likeCount, ts: Date.now() }
                localStorage.setItem(key, JSON.stringify(likes))
              } catch (e) {
                // ignore storage errors
              }
            }

            // persist last-seen like count for this post (helps other users keep counts after reload)
            try {
              const key = 'post_last_likes'
              const store = JSON.parse(localStorage.getItem(key) || '{}')
              store[data.postId] = { count: data.likeCount, ts: Date.now() }
              localStorage.setItem(key, JSON.stringify(store))
            } catch (e) {}

            return {
              ...p,
              likeCount: newLikeCount,
              isLiked: newIsLiked
            };
          }

          if (data.type === "COMMENT_ADD") {
            const existing = Array.isArray(p.comments) ? p.comments : []
            // if comment already exists, skip adding duplicate
            if (existing.some((c: any) => c._id === data.comment._id)) {
              return { ...p, commentCount: data.commentCount }
            }
            try {
              // persist incoming comment to this viewer's cache so it survives reloads
              if (user?._id) {
                const key = `comments_${user._id}`
                const localComments = JSON.parse(localStorage.getItem(key) || '{}')
                const commentToCache = { ...(data.comment || {}), ts: data.comment?.createdAt ? Date.parse(data.comment.createdAt) : Date.now() }
                localComments[data.postId] = dedupeById([commentToCache, ...(localComments[data.postId] || [])])
                localStorage.setItem(key, JSON.stringify(localComments))
              }
            } catch (e) {}

            const merged = dedupeById([data.comment, ...existing])
            return { ...p, commentCount: data.commentCount, comments: merged }
          }

          if (data.type === "COMMENT_DELETE") {
            try {
              // Record deletion tombstone for this viewer so reloads don't re-add it
              if (user?._id) {
                const delKey = `comments_deleted_${user._id}`
                const delCache = JSON.parse(localStorage.getItem(delKey) || '{}')
                delCache[data.postId] = delCache[data.postId] || {}
                delCache[data.postId][data.commentId] = Date.now()
                localStorage.setItem(delKey, JSON.stringify(delCache))

                // also remove from user-scoped cached comments to avoid resurrection
                const cacheKey = `comments_${user._id}`
                const localComments = JSON.parse(localStorage.getItem(cacheKey) || '{}')
                if (localComments[data.postId]) {
                  localComments[data.postId] = localComments[data.postId].filter((c: any) => c._id !== data.commentId)
                  localStorage.setItem(cacheKey, JSON.stringify(localComments))
                }
              }
            } catch (e) {}

            const remaining = (p.comments || []).filter((c: any) => c._id !== data.commentId)
            return { ...p, commentCount: data.commentCount, comments: remaining }
          }

          return p;
        })
      );
    });

    return () => {
      socket.off("post.updated");
    };
  }, [user]);

  // =====================
  // USER-SCOPED LOCAL STATE
  // =====================
    const dedupeById = <T extends { _id?: string }>(items: T[] = []) => {
      const seen = new Set<string>()
      return items.filter(item => {
        const id = item?._id?.toString()
        if (!id) return true
        if (seen.has(id)) return false
        seen.add(id)
        return true
      })
    }

    const syncWithLocalState = (serverPosts: any[], currentUser: any) => {
      if (!currentUser?._id) return serverPosts

      // Safely parse local caches
      let localLikes: Record<string, any> = {}
      let localComments: Record<string, any> = {}
      let deletedComments: Record<string, Record<string, number>> = {}
      let lastLikes: Record<string, any> = {}
      try {
        localLikes = JSON.parse(localStorage.getItem(`likes_${currentUser._id}`) || '{}')
      } catch (e) {}
      try {
        localComments = JSON.parse(localStorage.getItem(`comments_${currentUser._id}`) || '{}')
      } catch (e) {}
      try {
        deletedComments = JSON.parse(localStorage.getItem(`comments_deleted_${currentUser._id}`) || '{}')
      } catch (e) {}
      try {
        lastLikes = JSON.parse(localStorage.getItem('post_last_likes') || '{}')
      } catch (e) {}

      return serverPosts.map(p => {
        const cachedLike = localLikes[p._id]
        const cachedComments = localComments[p._id]

        let mergedComments = Array.isArray(p.comments) ? [...p.comments] : []

        if (Array.isArray(cachedComments) && cachedComments.length) {
          const serverCommentIds = new Set(mergedComments.map((c: any) => c._id))

          // compute server latest comment timestamp (if present)
          const serverLatestTs = mergedComments.reduce((acc: number, c: any) => {
            const t = c?.createdAt ? Date.parse(c.createdAt) : 0
            return Math.max(acc, Number.isFinite(t) ? t : 0)
          }, 0)

          const uniqueLocal = cachedComments.filter((c: any) => {
            // drop if server already has it
            if (serverCommentIds.has(c._id)) return false

            // drop if we have a tombstone recorded for this comment (deleted)
            const tombstonesForPost = deletedComments[p._id] || {}
            const tombstoneTs = tombstonesForPost[c._id]
            if (tombstoneTs && (c.ts ? tombstoneTs >= c.ts : tombstoneTs > 0)) return false

            // include if it's authored by current user (optimistic local comment)
            const authorId = c?.author?._id || c?.author
            if (authorId && authorId.toString() === currentUser._id.toString()) return true

            // otherwise include only if local comment is newer than server snapshot
            if (typeof c.ts === 'number' && c.ts > serverLatestTs) return true

            return false
          })

          mergedComments = [...uniqueLocal, ...mergedComments]
        }

        mergedComments = dedupeById(mergedComments)

        const serverLikeCount = p.likeCount || 0
        const lastEntry = lastLikes[p._id]

        // Prepare candidates with optional timestamps. Server has no timestamp
        const serverCandidate = { value: serverLikeCount, ts: 0 }
        const localCandidate = (cachedLike && typeof cachedLike.count === 'number')
          ? { value: cachedLike.count, ts: typeof cachedLike.ts === 'number' ? cachedLike.ts : 0 }
          : null

        let lastCandidate: { value: number, ts: number } | null = null
        if (lastEntry !== undefined) {
          if (typeof lastEntry === 'number') lastCandidate = { value: lastEntry, ts: 0 }
          else if (lastEntry && typeof lastEntry.count === 'number') lastCandidate = { value: lastEntry.count, ts: typeof lastEntry.ts === 'number' ? lastEntry.ts : 0 }
        }

        // Choose the most recent information when timestamps are available.
        // If no timestamps exist, fall back to Math.max to avoid losing increases.
        let best = serverCandidate
        if (localCandidate && localCandidate.ts > best.ts) best = localCandidate
        if (lastCandidate && lastCandidate.ts > best.ts) best = lastCandidate

        let likeCount: number
        if (best.ts === 0) {
          likeCount = Math.max(serverLikeCount, localCandidate?.value ?? 0, lastCandidate?.value ?? 0)
        } else {
          likeCount = best.value
        }

        return {
          ...p,
          isLiked: (cachedLike && typeof cachedLike === 'object' && typeof cachedLike.isLiked === 'boolean') ? cachedLike.isLiked : !!p.isLiked,
          likeCount,
          comments: mergedComments,
          commentCount: mergedComments.length
        }
      })
    }

  // =====================
  // API FETCHERS
  // =====================

  const fetchRequests = async () => {
    try {
      const res = await fetch(`${API_URL}/users/requests`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      const data = await res.json()
      setRequests(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching requests:', error)
    }
  }

  const fetchPosts = async (currentUser = user) => {
    try {
      const res = await fetch(`${API_URL}/posts/feed?page=1&limit=50`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      const data = await res.json()
      if (Array.isArray(data)) {
        setPosts(syncWithLocalState(data, currentUser))
      }
    } catch (error) {
      console.error('Error fetching posts:', error)
    }
  }

  // =====================
  // ACTIONS: POSTS
  // =====================

  const handleCreatePost = async () => {
    if (!postText.trim() && postImages.length === 0) return
    setIsPosting(true)

    try {
      const formData = new FormData()
      formData.append('content', postText.trim() ? postText : ' ')

      postImages.forEach(file => {
        formData.append('image', file)
      })

      const res = await fetch(`${API_URL}/posts`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      })

      if (res.ok) {
        setPostText('')
        setPostImages([])
        if (postImageRef.current) postImageRef.current.value = ''
        fetchPosts(user)
      } else {
        const errText = await res.text()
        alert(`Failed to create post: ${errText}`)
      }
    } catch (error) {
      console.error('Error creating post:', error)
    } finally {
      setIsPosting(false)
    }
  }

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return

    try {
      const res = await fetch(`${API_URL}/posts/${postId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      })

      if (res.ok) {
        // Clean up user-scoped local cache
        const likeCacheKey = `likes_${user?._id}`
        const localLikes = JSON.parse(localStorage.getItem(likeCacheKey) || '{}')
        delete localLikes[postId]
        localStorage.setItem(likeCacheKey, JSON.stringify(localLikes))

        const commentCacheKey = `comments_${user?._id}`
        const localComments = JSON.parse(localStorage.getItem(commentCacheKey) || '{}')
        delete localComments[postId]
        localStorage.setItem(commentCacheKey, JSON.stringify(localComments))

        setPosts((prev) => prev.filter(p => p._id !== postId))
      }
    } catch (error) {
      console.error('Error deleting post:', error)
    }
  }

  // =====================
  // ACTIONS: LIKES & COMMENTS
  // =====================

  const handleToggleLike = async (postId: string) => {
    setPosts(prev =>
      prev.map(p => {
        if (p._id === postId) {
          const isLiked = !p.isLiked;
          const curr = typeof p.likeCount === 'number' ? p.likeCount : (p.likeCount || 0)
          const newLikeCount = Math.max(0, curr + (isLiked ? 1 : -1))

          // persist like locally for this user
          if (user?._id) {
            try {
              const key = `likes_${user._id}`
              const likes = JSON.parse(localStorage.getItem(key) || '{}')
              likes[postId] = { isLiked, count: newLikeCount, ts: Date.now() }
              localStorage.setItem(key, JSON.stringify(likes))
            } catch (e) {
              // ignore
            }
          }

          // persist last-seen like count globally
          try {
            const key = 'post_last_likes'
            const store = JSON.parse(localStorage.getItem(key) || '{}')
            store[postId] = { count: newLikeCount, ts: Date.now() }
            localStorage.setItem(key, JSON.stringify(store))
          } catch (e) {}

          return {
            ...p,
            isLiked,
            likeCount: newLikeCount
          };
        }
        return p;
      })
    );

    try {
      await fetch(`${API_URL}/posts/${postId}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handlePostComment = async (postId: string) => {
    const content = commentInputs[postId]
    if (!content?.trim()) return

    try {
      const res = await fetch(`${API_URL}/posts/${postId}/comment`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content })
      })

      if (res.ok) {
        const newComment = await res.json()
        const enrichedComment = {
          ...newComment,
          author: { _id: user._id, name: user.name, avatar: user.avatar },
          ts: newComment?.createdAt ? Date.parse(newComment.createdAt) : Date.now()
        }

        setPosts(prev => prev.map(p => {
          if (p._id === postId) {
            const existing = p.comments || []
            const newComments = dedupeById([enrichedComment, ...existing])
            return {
              ...p,
              commentCount: newComments.length,
              comments: newComments
            };
          }
          return p;
        }));

        // Update User-Scoped Cache (deduplicated) and add timestamp
        try {
          const cacheKey = `comments_${user?._id}`
          const localCommentsRaw = localStorage.getItem(cacheKey) || '{}'
          const localComments = JSON.parse(localCommentsRaw)
          localComments[postId] = dedupeById([enrichedComment, ...(localComments[postId] || [])])
          localStorage.setItem(cacheKey, JSON.stringify(localComments))
        } catch (e) {}

        setCommentInputs(prev => ({ ...prev, [postId]: '' }))
      }
    } catch (error) {
      console.error('Error posting comment:', error)
    }
  }

  const handleDeleteComment = async (postId: string, commentId: string) => {
    if (!confirm('Delete this comment?')) return

    try {
      const res = await fetch(`${API_URL}/posts/comment/${commentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      })

      if (res.ok) {
        setPosts(prev => prev.map(p => {
          if (p._id === postId) {
            const newComments = (p.comments || []).filter((c: any) => c._id !== commentId)
            return {
              ...p,
              commentCount: newComments.length,
              comments: newComments
            }
          }
          return p
        }))

        // Sync removal from user-scoped caching
        const cacheKey = `comments_${user?._id}`
        const localComments = JSON.parse(localStorage.getItem(cacheKey) || '{}')
        if (localComments[postId]) {
          localComments[postId] = localComments[postId].filter((c: any) => c._id !== commentId)
          localStorage.setItem(cacheKey, JSON.stringify(localComments))
        }
      }
    } catch (error) {
      console.error('Error deleting comment', error)
    }
  }

  const toggleComments = (postId: string) => {
    const newSet = new Set(expandedComments)
    if (newSet.has(postId)) newSet.delete(postId)
    else newSet.add(postId)
    setExpandedComments(newSet)
  }

  // =====================
  // HELPERS
  // =====================

  const handlePostImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
      setPostImages(prev => [...prev, ...newFiles].slice(0, 10))
    }
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`${API_URL}/users/upload-avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      })

      if (!res.ok) {
        const errText = await res.text()
        alert(`Failed to upload avatar: ${errText}`)
        return
      }

      const updatedUser = await res.json()
      setUser(updatedUser)
    } catch (error) {
      console.error('Error uploading avatar:', error)
      alert('Error uploading avatar')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const removePostImage = (index: number) => {
    setPostImages(prev => prev.filter((_, i) => i !== index))
  }

  const getImageUrl = (path?: string) => {
    if (!path) return ''
    if (path.startsWith('http')) return path
    return `${API_URL}${path}`
  }

 
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <LoaderCircle className="animate-spin text-green-600" size={40} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* HEADER */}
      <Header
        user={user}
        query={query}
        setQuery={setQuery}
        showMenu={showMenu}
        setShowMenu={setShowMenu}
        fileRef={fileRef}
        handleAvatarChange={handleAvatarChange}
        getImageUrl={getImageUrl}
      />

      {/* MAIN LAYOUT */}
      <div className="max-w-7xl mx-auto grid grid-cols-12 gap-6 px-4 md:px-6 mt-6 pb-12">

        {/* LEFT SIDEBAR */}
        <div className="col-span-3 hidden lg:block">
          <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 space-y-1 sticky top-24">
            <button className="flex items-center gap-4 w-full p-3 hover:bg-gray-50 rounded-xl cursor-pointer font-bold text-gray-800 transition">
              <Home size={24} className="text-green-600" /> Home
            </button>
            <div className="relative">
              <button
                onClick={() => setShowNoti(!showNoti)}
                className="flex justify-between items-center w-full p-3 hover:bg-gray-50 rounded-xl cursor-pointer font-bold text-gray-800 transition"
              >
                <div className="flex gap-4 items-center">
                  <Bell size={24} className="text-gray-600" /> Notifications
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* CENTER FEED */}
        <div className="col-span-12 lg:col-span-6 space-y-6">

          <CreatePostBox
            user={user}
            postText={postText}
            setPostText={setPostText}
            postImages={postImages}
            postImageRef={postImageRef}
            handlePostImageChange={handlePostImageChange}
            removePostImage={removePostImage}
            handleCreatePost={handleCreatePost}
            isPosting={isPosting}
          />

          <PostList
            posts={posts}
            user={user}
            expandedComments={expandedComments}
            toggleComments={toggleComments}
            handleToggleLike={handleToggleLike}
            handleDeletePost={handleDeletePost}
            commentInputs={commentInputs}
            setCommentInputs={setCommentInputs}
            handlePostComment={handlePostComment}
            handleDeleteComment={handleDeleteComment}
            getImageUrl={getImageUrl}
          />
        </div>
      </div>
    </div>
  )
}