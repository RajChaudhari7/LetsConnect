import fs from 'fs';
import imagekit from '../configs/imageKit.js';
import Message from '../models/Message.js';

// Create an object to store Server-Side Event Connections
const connections = {};

// Controller function for the Server-Side Event endpoints
export const sseController = (req, res) => {
  const { userId } = req.params;
  console.log('New Client Connected:', userId);

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Add the client's response object to the connections object
  connections[userId] = res;

  // Send an initial event to the client
  res.write('event: log\ndata: Connected to SSE stream\n\n');

  // Handle client disconnection
  req.on('close', () => {
    // Remove the client's response object from the connections object
    delete connections[userId];
    console.log('Client Disconnected');
  });
};

// Send Message
export const sendMessage = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { to_user_id, text } = req.body;
    const image = req.file;

    let media_url = '';
    let message_type = 'text'; // Default to text

    if (image) {
      message_type = 'image';
      try {
        const fileBuffer = fs.readFileSync(image.path);
        const response = await imagekit.upload({
          file: fileBuffer,
          fileName: image.originalname,
        });

        media_url = imagekit.url({
          path: response.filePath,
          transformation: [
            { quality: 'auto' },
            { format: 'webp' },
            { width: '1280' },
          ],
        });
      } catch (uploadError) {
        console.error('Image upload failed:', uploadError);
        return res.status(500).json({ success: false, message: 'Image upload failed' });
      }
    }

    const message = await Message.create({
      from_user_id: userId,
      to_user_id,
      text,
      message_type,
      media_url,
    });

    res.json({ success: true, message });

    // Send message to the recipient using SSE
    const messageWithUserData = await Message.findById(message._id).populate('from_user_id');
    if (connections[to_user_id]) {
      connections[to_user_id].write(`data: ${JSON.stringify(messageWithUserData)}\n\n`);
    }
  } catch (error) {
    console.error('Error in sendMessage:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Chat Messages
export const getChatMessages = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { to_user_id } = req.body;

    const messages = await Message.find({
      $or: [
        { from_user_id: userId, to_user_id },
        { from_user_id: to_user_id, to_user_id: userId },
      ],
    }).sort({ created_at: -1 });

    // Mark messages as seen
    await Message.updateMany(
      { from_user_id: to_user_id, to_user_id: userId },
      { seen: true }
    );

    res.json({ success: true, messages });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get User Recent Messages
export const getUserRecentMessages = async (req, res) => {
  try {
    const { userId } = req.auth();

    const messages = await Message.find({ to_user_id: userId })
      .populate('from_user_id to_user_id')
      .sort({ created_at: -1 });

    res.json({ success: true, messages });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};
