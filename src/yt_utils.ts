import axios from 'axios'
import data from '../config/config.json'
import { BraodCastInfo, LiveStatus, Thumbails } from './types'
import { getChannel, getVideo, searchVideo } from './youtube_api'

const { 
    not_live_keyword: NOT_LIVING_KEYWORD, 
    upcoming_keyword: UPCOMING_KEYWORD, 
    live_keyword: LIVE_KEYWORD
} = data.checker


function getCover(thumbnails: Thumbails): string | undefined {
    let url = undefined
    const iterator = ['maxres', 'standard', 'high', 'medium', 'default']
    for (const size of iterator){
        url = thumbnails[size]?.url
        if (url !== undefined) break
    }
    return url
}

// only 100 times per day
export async function getLiveStreamDetails(channel: string, upcoming: boolean = false): Promise<BraodCastInfo | undefined> {
    try {
        const res = await searchVideo(channel, upcoming ? 'upcoming' : 'live')
        if (!res.items.length){
            console.warn(`Cannot find any ${upcoming ? 'upcoming' : 'live'} video from ${channel}`)
            return undefined
        }
        const info = res.items[0]
        const videoItems = await getVideo(info.id.videoId)
        if (!videoItems.items.length){
            console.warn(`Cannot find any ${upcoming ? 'upcoming' : 'live'} video from ${channel}`)
            return undefined
        }
        const video = videoItems.items[0]
        channelNameCache.set(channel, video.snippet.channelTitle) // update channel name cache
        const time = new Date(video.liveStreamingDetails.scheduledStartTime ?? video.liveStreamingDetails.actualStartTime ?? video.snippet.publishedAt)
        time.setUTCHours(time.getUTCHours() + 8) // utc + 8
        return {
            cover: getCover(video.snippet.thumbnails),
            title: video.snippet.title,
            description: video.snippet.description,
            publishTime: time,
            id: video.id
        }
    }catch(err: any | unknown){
        // maybe quota exceeded
        console.log(`Error while searching ${upcoming ? 'upcoming' : 'live'} video from ${channel}: ${err?.message ?? 'no error message'}`)
        console.warn(err)
        return undefined;
    }
}

const channelNameCache = new Map<string, string>()

export async function getChannelName(channel: string): Promise<string> {
    if (channelNameCache.has(channel)) return channelNameCache.get(channel)!!
    const {items} =  await getChannel(channel)
    if (items.length == 0) throw new Error(`Unknown channel ID: ${channel}`)
    const youtubeChannel = items[0]
    channelNameCache.set(channel, youtubeChannel.snippet.title)
    return youtubeChannel.snippet.title
}

export async function getLiveStatus(channel: String): Promise<LiveStatus | undefined> {
    const res = await axios.get(`https://www.youtube.com/channel/${channel}/live`)
    const str = res.data as String
    if (str.indexOf(LIVE_KEYWORD) != -1){
        return str.indexOf(UPCOMING_KEYWORD) == -1 ? 'live' : 'upcoming'
    }else if (str.indexOf(NOT_LIVING_KEYWORD) != -1){
        return 'idle'
    }else{
        console.warn(`無法找到頻道 ${channel} 的狀態，可能被驗證中`)
        return undefined
    }
}


function convertTZ(date: Date, tzString: string) {
    return new Date((typeof date === "string" ? new Date(date) : date).toLocaleString("en-US", {timeZone: tzString}));   
}