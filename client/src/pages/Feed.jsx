import React, { useEffect, useState } from 'react'
import { dummyPostsData } from '../assets/assets'
import Loading from '../components/Loading'
import StoriesBar from '../components/StoriesBar'
import PostCard from '../components/PostCard'
import RecentMessages from '../components/RecentMessages'

const Feed = () => {

    const [feeds, setFeeds] = useState([])
    const [loading, setLoading] = useState(true)

    const fetchFeeds = async () => {
        setFeeds(dummyPostsData)
        setLoading(false)
    }

    useEffect(() => {
        fetchFeeds()
    }, [])

    return !loading ? (
        <div className='h-full overflow-y-scroll no-scroll py-10 xl:pr-5 flex items-start justify-center xl:gap-8'>

            {/* stories and post  */}
            <div>
                <StoriesBar />
                <div className='p-4 space-y-6'>
                    {feeds.map((post) => (
                        <PostCard key={post._id} post={post} />
                    ))}
                </div>
            </div>

            {/* right sidebar */}
            <div className='max-xl:hidden sticky top-0'>
                <RecentMessages />
            </div>

        </div>
    ) : <Loading />
}

export default Feed