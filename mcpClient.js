import { spawn } from 'child_process';
import { createInterface } from 'readline';

/**
 * MCP Client for communicating with the Slack MCP Server
 */
export class SlackMcpClient {
  constructor() {
    this.process = null;
    this.rl = null;
    this.pendingRequests = new Map();
    this.requestId = 0;
  }

  /**
   * Start the MCP server process
   */
  async connect() {
    return new Promise((resolve, reject) => {
      // Spawn the MCP server as a child process
      this.process = spawn('node', ['mcpSlackServer.js'], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.rl = createInterface({
        input: this.process.stdout,
        output: this.process.stdin,
        terminal: false
      });

      // Handle incoming messages from the MCP server
      this.rl.on('line', (line) => {
        // Only process non-empty lines that might be JSON
        if (line.trim() === '') return;
        
        try {
          const message = JSON.parse(line);
          this.handleMessage(message);
        } catch (err) {
          // Ignore non-JSON lines (like log messages)
          // Only log if it looks like it might be JSON but failed to parse
          if (line.trim().startsWith('{') || line.trim().startsWith('[')) {
            console.error('Error parsing MCP message:', err, 'Line:', line);
          }
        }
      });

      // Handle process errors
      this.process.on('error', (err) => {
        console.error('MCP Server process error:', err);
        reject(err);
      });

      this.process.on('exit', (code) => {
        console.log(`MCP Server process exited with code ${code}`);
      });

      // Give the server a moment to start
      setTimeout(() => {
        console.log('MCP Client connected to Slack MCP Server');
        resolve();
      }, 1000);
    });
  }

  /**
   * Handle incoming messages from the MCP server
   */
  handleMessage(message) {
    // Debug log to see what messages we're receiving
    console.log('Received message from MCP server:', JSON.stringify(message, null, 2));
    
    if (message.id && this.pendingRequests.has(message.id)) {
      // This is a response to a pending request
      const { resolve, reject } = this.pendingRequests.get(message.id);
      this.pendingRequests.delete(message.id);

      if (message.error) {
        reject(new Error(message.error.message));
      } else {
        resolve(message.result);
      }
    }
  }

  /**
   * Send a request to the MCP server and wait for a response
   */
  async sendRequest(method, params = {}) {
    if (!this.process) {
      throw new Error('MCP Client not connected');
    }

    const id = ++this.requestId;
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    // Debug log to see what we're sending
    console.log('Sending request to MCP server:', JSON.stringify(request, null, 2));

    return new Promise((resolve, reject) => {
      // Store the promise callbacks
      this.pendingRequests.set(id, { resolve, reject });

      // Send the request to the MCP server
      this.process.stdin.write(JSON.stringify(request) + '\n');

      // Set a timeout for the request
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000); // 30 second timeout
    });
  }

  /**
   * Call a tool on the MCP server
   */
  async callTool(toolName, argumentsObj = {}) {
    try {
      const result = await this.sendRequest('tools/call', {
        name: toolName,
        arguments: argumentsObj
      });
      return result;
    } catch (error) {
      console.error(`Error calling tool ${toolName}:`, error);
      throw error;
    }
  }

  /**
   * List available tools
   */
  async listTools() {
    try {
      const result = await this.sendRequest('tools/list');
      return result;
    } catch (error) {
      console.error('Error listing tools:', error);
      throw error;
    }
  }

  /**
   * Close the connection to the MCP server
   */
  disconnect() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
  }

  /**
   * Create a new Slack channel
   */
  async createSlackChannel({ channelName, isPrivate = false }) {
    try {
      const result = await this.callTool('create_slack_channel', { channelName, isPrivate });
      return JSON.stringify(result);
    } catch (error) {
      console.error('Error creating Slack channel:', error);
      return `Sorry, I encountered an error creating the channel. Please make sure the channel name is valid and I have the necessary permissions.`;
    }
  }

  /**
   * List all Slack channels
   */
  async listSlackChannels() {
    try {
      const result = await this.callTool('list_slack_channels', {});
      return JSON.stringify(result);
    } catch (error) {
      console.error('Error listing Slack channels:', error);
      return `Sorry, I encountered an error fetching the channels. Please make sure I have the necessary permissions.`;
    }
  }

  /**
   * Send a direct message to a user
   */
  async sendMessageToUser({ userId, message }) {
    try {
      const result = await this.callTool('send_message_to_user', { userId, message });
      return JSON.stringify(result);
    } catch (error) {
      console.error('Error sending message to user:', error);
      return `Sorry, I encountered an error sending the message to the user. Please make sure I have the necessary permissions.`;
    }
  }

  /**
   * Send a message to a channel
   */
  async sendMessageToChannel({ channelName, message }) {
    try {
      const result = await this.callTool('send_message_to_channel', { channelName, message });
      return JSON.stringify(result);
    } catch (error) {
      console.error('Error sending message to channel:', error);
      return `Sorry, I encountered an error sending the message to the channel. Please make sure I have the necessary permissions.`;
    }
  }
}