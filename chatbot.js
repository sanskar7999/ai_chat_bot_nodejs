import Groq from "groq-sdk";
import 'dotenv/config';
import { tavily } from "@tavily/core";
import NodeCache from "node-cache";
import { json } from "express";

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
          You have access to the following tool:
          webSearch(query: string): Use this to search the internet for current or unknown information.
          Decide when to use your own knowledge and when to use the tool.
          DO not mention the tool unless needed.

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

  while (true) {
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