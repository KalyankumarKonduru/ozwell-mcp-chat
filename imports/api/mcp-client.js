import { Meteor } from 'meteor/meteor';
import axios from 'axios';

class MCPClient {
  constructor() {
    // The endpoint should be configured in settings
    this.apiUrl = Meteor.settings.public.ozwellApiUrl || 'https://ai.bluehive.com/api';
    this.apiKey = Meteor.settings.private?.ozwellApiKey || '';
    this._pendingRequest = false;
  }

  async sendMessage(message, options = {}) {
    // Prevent multiple concurrent requests
    if (this._pendingRequest) {
      console.warn('Another request is already in progress');
      await this._waitForPendingRequest();
    }
    
    this._pendingRequest = true;
    
    try {
      // Prepare the request to BlueHive API
      const payload = {
        prompt: message,
        systemMessage: "You are a helpful chatbot named Will."
      };

      console.log('Sending request to API:', this.apiUrl);
      
      // Make the API request with Bearer token authentication
      const response = await axios.post(`${this.apiUrl}/v1/completion`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        // Add timeout to prevent hanging requests
        timeout: 30000
      });

      console.log('Response received:', response.status);
      
      // Reset pending request flag
      this._pendingRequest = false;
      
      // Return the AI response
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
      // Reset pending request flag even on error
      this._pendingRequest = false;
      
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
  
  // Helper method to wait for pending request to complete
  async _waitForPendingRequest() {
    return new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (!this._pendingRequest) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }
}

// Create a singleton instance
export const mcpClient = new MCPClient();