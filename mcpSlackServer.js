import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createSlackChannel, listSlackChannels, sendMessageToUser, sendMessageToChannel } from "./slackBot.js";
import { z } from 'zod';

// Create the MCP server
const mcpServer = new McpServer(
  {
    name: "slack-mcp-server",
    version: "0.1.0",
  }
);

// Register the Slack tools with the MCP server
mcpServer.registerTool(
  "create_slack_channel",
  {
    description: "Create a new Slack channel with the given name",
    inputSchema: {
      channelName: z.string().describe("The name of the channel to create"),
      isPrivate: z.boolean().optional().default(false).describe("Whether the channel should be private (true) or public (false)"),
    },
  },
  async ({ channelName, isPrivate }) => {
    const result = await createSlackChannel({ channelName, isPrivate });
    return {
      content: [{ type: "text", text: result }],
    };
  }
);

mcpServer.registerTool(
  "list_slack_channels",
  {
    description: "List all channels in the Slack workspace",
    inputSchema: {},
  },
  async () => {
    const result = await listSlackChannels();
    return {
      content: [{ type: "text", text: result }],
    };
  }
);

mcpServer.registerTool(
  "send_message_to_user",
  {
    description: "Send a direct message to a user",
    inputSchema: {
      userId: z.string().describe("The ID of the user to send the message to"),
      message: z.string().describe("The message to send to the user"),
    },
  },
  async ({ userId, message }) => {
    const result = await sendMessageToUser({ userId, message });
    return {
      content: [{ type: "text", text: result }],
    };
  }
);

mcpServer.registerTool(
  "send_message_to_channel",
  {
    description: "Send a message to a channel",
    inputSchema: {
      channelName: z.string().describe("The name of the channel to send the message to"),
      message: z.string().describe("The message to send to the channel"),
    },
  },
  async ({ channelName, message }) => {
    const result = await sendMessageToChannel({ channelName, message });
    return {
      content: [{ type: "text", text: result }],
    };
  }
);

// Start the server using stdio transport
async function runServer() {
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  // Log to stderr instead of stdout to avoid interfering with JSON-RPC communication
  console.error("Slack MCP Server running on stdio");
}

runServer().catch(console.error);