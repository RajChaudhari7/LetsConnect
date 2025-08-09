import { Inngest } from "inngest";
import User from "../models/User.js";
import Connection from "../models/Connection.js";
import sendEmail from "../configs/nodeMailer.js";
import Story from "../models/Story.js";
import Message from "../models/Message.js";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "letsconnect-app" });

// Inngest function to save user data in database
const syncUserCreation = inngest.createFunction(
    { id: 'sync-user-from-clerk' },
    { event: 'clerk/user.created' },
    async ({ event }) => {
        const { id, first_name, last_name, email_addresses, image_url } = event.data
        let username = email_addresses[0].email_address.split('@')[0]

        // check availability of username
        const user = await User.findOne({ username })

        if (user) {
            username = username + Math.floor(Math.random() * 10000)
        }

        const userData = {
            _id: id,
            email: email_addresses[0].email_address,
            full_name: first_name + " " + last_name,
            profile_picture: image_url,
            username
        }
        await User.create(userData)
    }
)

// Inngest function update user data in database
const syncUserUpdation = inngest.createFunction(
    { id: 'update-user-from-clerk' },
    { event: 'clerk/user.updated' },
    async ({ event }) => {
        const { id, first_name, last_name, email_addresses, image_url } = event.data

        const updatedUserData = {
            email: email_addresses[0].email_address,
            full_name: first_name + " " + last_name,
            profile_picture: image_url
        }
        await User.findByIdAndUpdate(id, updatedUserData)
    }
)

// Inngest function to delete user data in database
const syncUserDeletion = inngest.createFunction(
    { id: 'delete-user-with-clerk' },
    { event: 'clerk/user.deleted' },
    async ({ event }) => {
        const { id } = event.data
        await User.findByIdAndDelete(id)
    }
)

// inngest function to send Reminder when a new connection request is added
const sendNewConnectionRequestReminder = inngest.createFunction(
    { id: 'send-new-connection-request-reminder' },
    { event: 'app/connection-request' },
    async ({ event, step }) => {
        const { connectionId } = event.data;

        try {
            await step.run('send-connection-request-mail', async () => {
                try {
                    const connection = await Connection.findById(connectionId).populate('from_user_id to_user_id');

                    if (!connection) {
                        console.error(`Connection with ID ${connectionId} not found.`);
                        return;
                    }

                    const subject = `👋 New Connection Request`;
                    const body = `
            <div style="font-family:Arial, sans-serif; padding:20px;">
              <h2>Hi ${connection.to_user_id.full_name},</h2>
              <p>You have a new connection request from ${connection.from_user_id.full_name} - @${connection.from_user_id.username}</p>
              <p>Click <a href="${process.env.FRONTEND_URL}/connections" style="color:#10b981;">here</a> to accept or reject the request</p>
              <br/>
              <p>Thanks,<br/>LetsConnect - Stay Connected</p>
            </div>`;

                    await sendEmail({
                        to: connection.to_user_id.email,
                        subject,
                        body
                    });

                    console.log(`Connection request email sent to ${connection.to_user_id.email}`);
                } catch (error) {
                    console.error('Error sending connection request email:', error);
                }
            });

            const in24Hours = new Date(Date.now() + 24 * 60 * 60 * 1000);
            await step.sleepUntil('wait-for-24-hours', in24Hours);

            await step.run('send-connection-request-reminder', async () => {
                try {
                    const connection = await Connection.findById(connectionId).populate('from_user_id to_user_id');

                    if (!connection) {
                        console.error(`Connection with ID ${connectionId} not found.`);
                        return { message: 'Connection not found' };
                    }

                    if (connection.status === 'accepted') {
                        console.log('Connection request already accepted.');
                        return { message: 'Already Accepted' };
                    }

                    const subject = `👋 Reminder: New Connection Request`;
                    const body = `
            <div style="font-family:Arial, sans-serif; padding:20px;">
              <h2>Hi ${connection.to_user_id.full_name},</h2>
              <p>You have a new connection request from ${connection.from_user_id.full_name} - @${connection.from_user_id.username}</p>
              <p>Click <a href="${process.env.FRONTEND_URL}/connections" style="color:#10b981;">here</a> to accept or reject the request</p>
              <br/>
              <p>Thanks,<br/>LetsConnect - Stay Connected Stay Happy 😃</p>
            </div>`;

                    await sendEmail({
                        to: connection.to_user_id.email,
                        subject,
                        body
                    });

                    console.log(`Reminder email sent to ${connection.to_user_id.email}`);
                    return { message: "Reminder Sent" };
                } catch (error) {
                    console.error('Error sending connection request reminder email:', error);
                }
            });
        } catch (error) {
            console.error('Error in sendNewConnectionRequestReminder function:', error);
        }
    }
);

const deleteStory = inngest.createFunction(
    { id: 'delete-story', name: 'Delete Story' },
    { event: 'app/story.delete' },
    async ({ event, step }) => {
        const { storyId } = event.data;

        // Calculate the time 24 hours from now
        const twentyFourHoursLater = new Date(Date.now() + 24 * 60 * 60 * 1000);

        // Sleep until the calculated time
        await step.sleepUntil('wait-24-hours', twentyFourHoursLater);

        // Delete the story
        await step.run('delete-story', async () => {
            await Story.findByIdAndDelete(storyId);
            console.log(`Story ${storyId} deleted successfully.`);
        });

        return { message: "Story deletion process completed" };
    }
);

// inngest function to send notification for unseen messages
const sendNotificationOfUnseenMessages = inngest.createFunction(
    { id: 'send-unseen-messages-notification' },
    { cron: "TZ=Asia/Kolkata 0 9 * * *" }, // everday at 9 AM
    async ({ step }) => {
        const messages = await Message.find({
            seen: false
        }).populate('to_user_id')
        const unseenCount = {}

        messages.map(message => {
            unseenCount[message.to_user_id._id] = (unseenCount[message.to_user_id._id] || 0) + 1;
        })

        for (const userId in unseenCount) {
            const user = await User.findById(userId);

            const subject = `🙋‍♂️🙋‍♀️ You have ${unseenCount[userId]} unseen messages`;

            const body = `
            <div style="font-family: Arial, sans-serif; padding:20px;">
                <h2<Hi ${user.full_name}>,</h2>
                <p>🙋‍♂️🙋‍♀️ You have ${unseenCount[userId]} unseen messages</p>
                <p>Click <a href="${process.env.FRONTEND_URL}/messages" style="color:#10b981;">here</a> to view them.</p>
                <br/>
                <p>Thanks, <br/> Lets Connect - Stay Connected Stay Happy 😀 </p>
            </div> 
            `;

            await sendEmail({
                to: user.email,
                subject,
                body
            })
        }

        return { message: "Notification Send" }
    }
)

// Create an empty array where we'll export future Inngest functions
export const functions = [
    syncUserCreation,
    syncUserUpdation,
    syncUserDeletion,
    sendNewConnectionRequestReminder,
    deleteStory,
    sendNotificationOfUnseenMessages
];