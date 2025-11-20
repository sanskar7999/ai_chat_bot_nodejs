import { WebClient } from "@slack/web-api";
import 'dotenv/config';

/**
 * Create a new Slack channel with the given name
 * @param {Object} params - The parameters for creating a channel
 * @param {string} params.channelName - The name of the channel to create
 * @param {boolean} params.isPrivate - Whether the channel should be private (true) or public (false)
 * @returns {Promise<string>} - JSON stringified result or error message
 */
export async function createSlackChannel({ channelName, isPrivate = false }) {
  try {
    // Initialize Slack client
    const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
    
    // Create the channel
    const result = await slackClient.conversations.create({
      name: channelName,
      is_private: isPrivate
    });
    console.log(`Channel created: ${result.channel.name}`);
    
    return JSON.stringify(result.channel);
  } catch (error) {
    console.error(`Error creating channel: ${error}`);
    return `Sorry, I encountered an error creating the channel. Please make sure the channel name is valid and I have the necessary permissions.`;
  }
}

/**
 * List all channels in the Slack workspace
 * @returns {Promise<string>} - JSON stringified result or error message
 */
export async function listSlackChannels() {
  try {
    // Initialize Slack client
    const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
    
    // Fetch all channels
    const result = await slackClient.conversations.list({
      exclude_archived: true
    });
    
    return JSON.stringify(result.channels);
  } catch (error) {
    console.error(`Error listing channels: ${error}`);
    return `Sorry, I encountered an error fetching the channels. Please make sure I have the necessary permissions.`;
  }
}

/**
 * Send a direct message to a user
 * @param {Object} params - The parameters for sending a message to a user
 * @param {string} params.userId - The ID of the user to send the message to
 * @param {string} params.message - The message to send to the user
 * @returns {Promise<string>} - JSON stringified result or error message
 */
export async function sendMessageToUser({ userId, message }) {
  try {
    // Initialize Slack client
    const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
    
    // Send direct message to user
    const result = await slackClient.chat.postMessage({
      channel: userId,
      text: message
    });
    
    return JSON.stringify(result);
  } catch (error) {
    console.error(`Error sending message to user: ${error}`);
    return `Sorry, I encountered an error sending the message to the user. Please make sure I have the necessary permissions.`;
  }
}

/**
 * Send a message to a channel
 * @param {Object} params - The parameters for sending a message to a channel
 * @param {string} params.channelName - The name of the channel to send the message to
 * @param {string} params.message - The message to send to the channel
 * @returns {Promise<string>} - JSON stringified result or error message
 */
export async function sendMessageToChannel({ channelName, message }) {
  try {
    // Initialize Slack client
    const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
    
    // Find the channel by name
    const channelList = await slackClient.conversations.list({
      exclude_archived: true
    });
    
    const channel = channelList.channels.find(c => c.name === channelName);
    
    if (!channel) {
      return `Channel #${channelName} not found.`;
    }
    
    // Send message to channel
    const result = await slackClient.chat.postMessage({
      channel: channel.id,
      text: message
    });
    
    return JSON.stringify(result);
  } catch (error) {
    console.error(`Error sending message to channel: ${error}`);
    return `Sorry, I encountered an error sending the message to the channel. Please make sure I have the necessary permissions.`;
  }
}