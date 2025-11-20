import express from 'express';
import cors from 'cors';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpServerTransport } from "@modelcontextprotocol/sdk/server/http.js";
import { createSlackChannel, listSlackChannels, sendMessageToUser, sendMessageToChannel } from "./slackBot.js";

const app = express();
const PORT = process.env.MCP_PORT || 3001;

app.use(cors());
app.use(express.json());

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
      type: "object",
      properties: {
        channelName: {
          type: "string",
          description: "The name of the channel to create",
        },
        isPrivate: {
          type: "boolean",
          description: "Whether the channel should be private (true) or public (false)",
          default: false,
        },
      },
      required: ["channelName"],
    },
  },
  async (input) => {
    const result = await createSlackChannel(input);
    return {
      content: [{ type: "text", text: result }],
    };
  }
);

mcpServer.registerTool(
  "list_slack_channels",
  {
    description: "List all channels in the Slack workspace",
    inputSchema: {
      type: "object",
      properties: {},
    },
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
      type: "object",
      properties: {
        userId: {
          type: "string",
          description: "The ID of the user to send the message to",
        },
        message: {
          type: "string",
          description: "The message to send to the user",
        },
      },
      required: ["userId", "message"],
    },
  },
  async (input) => {
    const result = await sendMessageToUser(input);
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
      type: "object",
      properties: {
        channelName: {
          type: "string",
          description: "The name of the channel to send the message to",
        },
        message: {
          type: "string",
          description: "The message to send to the channel",
        },
      },
      required: ["channelName", "message"],
    },
  },
  async (input) => {
    const result = await sendMessageToChannel(input);
    return {
      content: [{ type: "text", text: result }],
    };
  }
);

// Set up HTTP transport
const transport = new HttpServerTransport({ 
  app, 
  endpoint: "/mcp" 
});

// Connect the MCP server to the HTTP transport
mcpServer.connect(transport);

// Add a simple health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: "Slack MCP Server is running", 
    tools: [
      "create_slack_channel",
      "list_slack_channels",
      "send_message_to_user",
      "send_message_to_channel"
    ]
  });
});

app.listen(PORT, () => {
  console.log(`Slack MCP Server running on http://localhost:${PORT}`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
});