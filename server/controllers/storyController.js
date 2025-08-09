import fs from 'fs';
import imagekit from '../configs/imageKit.js';
import Story from '../models/Story.js';
import User from '../models/User.js';
import { inngest } from '../inngest/index.js';

// Add USer Story
export const addUserStory = async (req, res) => {
    try {

        const { userId } = req.auth()
        const { content, media_type, background_color } = req.body;
        const media = req.file
        let media_url = ''

        // upload media to imagekit
        if (media_type === 'image' || media_type === 'video') {
            const fileBuffer = fs.readFileSync(media.path)
            const response = await imagekit.upload({
                file: fileBuffer,
                fileName: media.originalname,
            })
            media_url = response.url
        }
        // create a story
        const story = await Story.create({
            user: userId,
            content,
            media_url,
            media_type,
            background_color
        })

        // schedule story deletion after 24 hours

        await inngest.send({
            name: 'app/story.delete',
            data: { storyId: story._id },
            timestamp: Math.floor(Date.now() / 1000) + 86400,
        })

        res.json({ success: true })

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message })
    }
}

// Get User Story
export const getStories = async (req, res) => {
    try {

        const { userId } = req.auth()
        const user = await User.findById(userId)

        // user connections and followings
        const userIds = [userId, ...user.connections, ...user.following]

        const stories = await Story.find({
            user: { $in: userIds }
        }).populate('user').sort({ createdAt: -1 });

        res.json({ success: true, stories })

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message })
    }
}

// Delete User Story
export const deleteStory = async (req, res) => {
    try {
        const { storyId } = req.params;
        const { userId } = req.auth();

        // Check if the story belongs to the user
        const story = await Story.findById(storyId);
        if (!story) {
            return res.json({ success: false, message: "Story not found" });
        }

        if (story.user.toString() !== userId) {
            return res.json({ success: false, message: "Unauthorized" });
        }

        // Delete the story
        await Story.findByIdAndDelete(storyId);

        res.json({ success: true, message: "Story deleted successfully" });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};