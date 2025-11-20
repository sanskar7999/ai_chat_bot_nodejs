import Groq from "groq-sdk";
import 'dotenv/config';
import { tavily } from "@tavily/core";
import NodeCache from "node-cache";
import { SlackMcpClient } from "./mcpClient.js";

// Initialize the MCP client
const mcpClient = new SlackMcpClient();
let mcpClientConnected = false;

// Connect to the MCP server
async function connectMcpClient() {
  if (!mcpClientConnected) {
    try {
      await mcpClient.connect();
      mcpClientConnected = true;
      console.log('Connected to Slack MCP Server');
    } catch (error) {
      console.error('Failed to connect to Slack MCP Server:', error);
    }
  }
}

// Connect when the module is loaded
connectMcpClient().catch(console.error);

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

const cache = new NodeCache({ stdTTL: 3600 * 1 }); // cache for 1 hour

export async function generate(userMessage, threadId) {

  const baseMessages = [
      {
        role: "system",
        content: `You are a smart personal assistant.
          If you know the answer to a question, answer it directly in plain English.
          If the answer requires real-time, local, or up-to-date information, or if you don't know the answer, use the available tools to find it.
          You have access to the following tools:
          webSearch(query: string): Use this to search the internet for current or unknown information.
          createSlackChannel(channelName: string, isPrivate: boolean): Create a new Slack channel with the given name. Set isPrivate to true for private channels.
          listSlackChannels(): List all channels in the Slack workspace.
          sendMessageToUser(userId: string, message: string): Send a direct message to a user.
          sendMessageToChannel(channelName: string, message: string): Send a message to a channel.
          Decide when to use your own knowledge and when to use the tools.
          DO not mention the tools unless needed.

          Example:
          Q: What is the capital of France?
          A: The capital of France is Paris. 

          Q: What's is the weather in Mumbai righr now?
          A: (use the search tool to find the latest weather)

          Q: Who is the Prime Minister of India?
          A: The current Prime Minister of India is Narendra Modi.

          Q: Tell me the latest IT news.
          A: (use the search tool to get the latest news)
          current date and time is ${new Date().toLocaleString()}`,
      },
    ]
  const messages = cache.get(threadId) ?? baseMessages;

  messages.push({
    role: "user",
    content: userMessage,
  });

  const MAX_RETRIES = 5;
  let count = 0;

  while (true) {

    if (count >= MAX_RETRIES) {
      return "I Could not find the result, please try again later.";
    }
    count++;

    const completions = await groq.chat.completions.create({
      temperature: 0.7,
      model: "llama-3.3-70b-versatile",
      messages: messages,
      
      tools: [
        {
          type: "function",
          function: {
            name: "webSearch",
            description: "Search the latest information and realtime data on the internet.",
            parameters: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "The search query to perform search on the internet.",
                },
              },
              required: ["query"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "createSlackChannel",
            description: "Create a new Slack channel with the given name.",
            parameters: {
              type: "object",
              properties: {
                channelName: {
                  type: "string",
                  description: "The name of the channel to create.",
                },
                isPrivate: {
                  type: "boolean",
                  description: "Whether the channel should be private (true) or public (false).",
                },
              },
              required: ["channelName"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "listSlackChannels",
            description: "List all channels in the Slack workspace.",
            parameters: {
              type: "object",
              properties: {},
            }
          }
        },
        {
          type: "function",
          function: {
            name: "sendMessageToUser",
            description: "Send a direct message to a user.",
            parameters: {
              type: "object",
              properties: {
                userId: {
                  type: "string",
                  description: "The ID of the user to send the message to.",
                },
                message: {
                  type: "string",
                  description: "The message to send to the user.",
                },
              },
              required: ["userId", "message"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "sendMessageToChannel",
            description: "Send a message to a channel.",
            parameters: {
              type: "object",
              properties: {
                channelName: {
                  type: "string",
                  description: "The name of the channel to send the message to.",
                },
                message: {
                  type: "string",
                  description: "The message to send to the channel.",
                },
              },
              required: ["channelName", "message"]
            }
          }
        }
      ],
      tool_choice: "auto",
    });

  messages.push(completions.choices[0].message);

  const tool_calls = completions.choices[0].message.tool_calls

  if (!tool_calls) {
    // here we have final answer
    cache.set(threadId, messages);
    return completions.choices[0].message.content;
  }

  for (const tool of tool_calls) { 
      const functionName = tool.function.name
      const functionParams = tool.function.arguments

      if (functionName == "webSearch") {
          const tool_result = await webSearch(JSON.parse(functionParams));
          // console.log(`Tool Result: ${tool_result}`);
          messages.push({
            tool_call_id: tool.id,
            role: "tool",
            name: functionName,
            content: tool_result,
          });
      } else if (functionName == "createSlackChannel") {
          const tool_result = await mcpClient.createSlackChannel(JSON.parse(functionParams));
          messages.push({
            tool_call_id: tool.id,
            role: "tool",
            name: functionName,
            content: tool_result,
          });
      } else if (functionName == "listSlackChannels") {
          const tool_result = await mcpClient.listSlackChannels();
          messages.push({
            tool_call_id: tool.id,
            role: "tool",
            name: functionName,
            content: tool_result,
          });
      } else if (functionName == "sendMessageToUser") {
          const tool_result = await mcpClient.sendMessageToUser(JSON.parse(functionParams));
          messages.push({
            tool_call_id: tool.id,
            role: "tool",
            name: functionName,
            content: tool_result,
          });
      } else if (functionName == "sendMessageToChannel") {
          const tool_result = await mcpClient.sendMessageToChannel(JSON.parse(functionParams));
          messages.push({
            tool_call_id: tool.id,
            role: "tool",
            name: functionName,
            content: tool_result,
          });
      }
  }
  }
}

async function webSearch({ query }) {
  console.log(`Performing web search for query: ${query}`);
  const response = await tvly.search(query);
  const finalResult = response.results.map(result => result.content).join("\n\n");

  return finalResult
}
