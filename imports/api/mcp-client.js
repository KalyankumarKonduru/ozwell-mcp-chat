import { Meteor } from 'meteor/meteor';
import axios from 'axios';

class MCPClient {
  constructor() {
    this.apiUrl = Meteor.settings.public.ozwellApiUrl || 'https://ai.bluehive.com/api';
    this.apiKey = Meteor.settings.private?.ozwellApiKey || '';
  }

  async sendMessage(message, options = {}) {
    try {
      const payload = {
        prompt: message,
        systemMessage: "You are a helpful chatbot named Will."
      };
      const response = await axios.post(`${this.apiUrl}/v1/completion`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      if (response.data && response.data.choices && response.data.choices.length > 0) {
        return {
          text: response.data.choices[0].message.content,
          metadata: {
            logId: response.data.logId,
            status: response.data.status
          }
        };
      } else {
        throw new Error('Invalid response format from BlueHive AI');
      }
    } catch (error) {
      console.error('MCP Client Error:', error);
      
      // Create a user-friendly error message
      let errorMessage = 'Error communicating with AI service';
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        errorMessage = `Server error: ${error.response.status}`;
        if (error.response.data && error.response.data.error) {
          errorMessage += ` - ${error.response.data.error.message || error.response.data.error}`;
        }
      } else if (error.request) {
        // The request was made but no response was received
        errorMessage = 'No response from AI service. Please check your network connection.';
      } else {
        // Something happened in setting up the request that triggered an Error
        errorMessage = error.message || 'Unknown error during request setup';
      }

      // For development, we'll simulate a response while setting up real API access
      if (Meteor.isDevelopment && !this.apiKey) {
        console.warn('Using simulated AI response in development mode (no API key provided)');
        return {
          text: `I'm a simulated AI response. You said: "${message}"`,
          metadata: {
            model: 'simulated-model',
            simulated: true
          }
        };
      }

      throw new Meteor.Error('mcp-client-error', errorMessage);
    }
  }
}

// Create a singleton instance
export const mcpClient = new MCPClient();