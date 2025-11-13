import Groq from "groq-sdk";
import 'dotenv/config';
import { tavily } from "@tavily/core";
import readline from "readline/promises";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

export async function main() {

  const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

  const messages = [
      {
        role: "system",
        content: `You are a smart personal assistant.
        You have access to following tools:
        1. webSearch({query}: {query: string}) // Search the latest information and realtime data on the internet.`,
      },
    ]
    while (true) {

      const userInput = await rl.question("User: ");
      messages.push({
        role: "user",
        content: userInput,
      });

      if (userInput.toLowerCase() === "exit") {
        console.log("Exiting...");
        break;
      }

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
      // console.log("Assistant Message:", completions.choices[0].message);  
      console.log("Tool Calls:", tool_calls);
      if (!tool_calls) {
        // console.log("No tool calls made by the model.");
        console.log(`Assistant Response: ${completions.choices[0].message.content}`);
        break;
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
  rl.close();
}

main();


async function webSearch({ query }) {
  console.log(`Performing web search for query: ${query}`);
  const response = await tvly.search(query);
  const finalResult = response.results.map(result => result.content).join("\n\n");

  return finalResult
}