import { Meteor } from 'meteor/meteor';
import axios from 'axios';

class MCPClient {
  constructor() {
    this.apiUrl = Meteor.settings.public.ozwellApiUrl || 'https://ai.bluehive.com/api';
    this.apiKey = Meteor.settings.private?.ozwellApiKey || '';
  }

  async sendMessage(message, options = {}) {
    try {
      console.log(`MCPClient: Sending message "${message}"`);
      console.log('Options:', JSON.stringify(options));
      
      let payload = {
        prompt: message,
        systemMessage: "You are a helpful chatbot named Will."
      };
      
      // Handle customHistory parameter directly
      if (options.customHistory && Array.isArray(options.customHistory) && options.customHistory.length > 0) {
        console.log(`Using ${options.customHistory.length} messages from history`);
        
        // Filter out any problematic messages
        const filteredHistory = options.customHistory.filter(msg => 
          msg && msg.role && msg.content && 
          (msg.role === 'user' || msg.role === 'assistant') &&
          typeof msg.content === 'string' && 
          msg.content.trim() !== ''
        );
        
        if (filteredHistory.length > 0) {
          payload.history = filteredHistory;
        }
      }
      
      console.log('Sending payload to AI service:', JSON.stringify(payload));

      const response = await axios.post(`${this.apiUrl}/v1/completion`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        timeout: 30000 // 30 seconds timeout
      });
      
      if (response.data && response.data.choices && response.data.choices.length > 0) {
        console.log('Received AI response successfully');
        const responseText = response.data.choices[0].message.content;
        console.log('AI Response text:', responseText);
        return {
          text: responseText,
          metadata: {
            logId: response.data.logId,
            status: response.data.status,
            timestamp: new Date().toISOString()
          }
        };
      } else {
        console.log('Invalid response format:', JSON.stringify(response.data));
        throw new Error('Invalid response format from AI service');
      }
    } catch (error) {
      console.error('MCP Client Error:', error);
      
      let errorMessage = 'Error communicating with AI service';
      if (error.response) {
        errorMessage = `Server error: ${error.response.status}`;
        if (error.response.data && error.response.data.error) {
          errorMessage += ` - ${error.response.data.error.message || error.response.data.error}`;
        }
      } else if (error.request) {
        errorMessage = 'No response from AI service. Please check your network connection.';
      } else {
        errorMessage = error.message || 'Unknown error during request setup';
      }

      // Development mode fallback
      if (Meteor.isDevelopment) {
        console.warn('Using simulated AI response in development mode');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Create a simple response that acknowledges the message
        let responseText = `I'm responding to your message: "${message}"`;
        
        // Add context if history is provided
        if (payload.history && payload.history.length > 0) {
          responseText += `. Based on our conversation, I understand we're discussing ${message}.`;
        }
        
        return {
          text: responseText,
          metadata: {
            simulated: true,
            timestamp: new Date().toISOString()
          }
        };
      }

      throw new Meteor.Error('mcp-client-error', errorMessage);
    }
  }
}

export const mcpClient = new MCPClient();