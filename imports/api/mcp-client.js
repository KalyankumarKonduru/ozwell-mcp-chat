import { Meteor } from 'meteor/meteor';
import axios from 'axios';

class MCPClient {
  constructor() {
    // Make sure these settings exist and are properly defined
    if (!Meteor.settings || !Meteor.settings.public || !Meteor.settings.public.ozwellApiUrl) {
      console.error('Missing required settings: ozwellApiUrl');
    }
    
    if (!Meteor.settings || !Meteor.settings.private || !Meteor.settings.private.ozwellApiKey) {
      console.error('Missing required settings: ozwellApiKey');
    }
    
    this.apiUrl = Meteor.settings.public?.ozwellApiUrl || 'https://ai.bluehive.com/api';
    this.apiKey = Meteor.settings.private?.ozwellApiKey || '';
    
    // Validate that the API key and URL are set
    if (!this.apiUrl) {
      console.error('API URL is not set. Check your settings.json file.');
    }
    
    if (!this.apiKey) {
      console.error('API Key is not set. Check your settings.json file.');
    }
  }

  async sendMessage(message, options = {}) {
    if (!message) {
      throw new Meteor.Error('message-required', 'Message text is required');
    }
    
    try {
      console.log(`MCPClient: Sending message "${message}"`);
      console.log('Options:', JSON.stringify(options));
      
      // Create a local payload variable
      const payload = {
        prompt: message,
        systemMessage: options.systemMessage || "You are a helpful chatbot named Will."
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

      // Make sure the API URL and endpoint are correct
      const apiEndpoint = `${this.apiUrl}/v1/completion`;
      console.log('API Endpoint:', apiEndpoint);

      const response = await axios.post(apiEndpoint, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        timeout: 30000 // 30 seconds timeout
      });
      
      console.log('API response status:', response.status);
      
      if (response.data && response.data.choices && response.data.choices.length > 0) {
        console.log('Received AI response successfully');
        const responseText = response.data.choices[0].message.content;
        console.log('AI Response text:', responseText.substring(0, 100) + '...');
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
        
        // Create a simple response that acknowledges the message
        let responseText = `I'm responding to your message: "${message}"`;
        
        // Use a local payload variable reference inside the development fallback
        const fallbackPayload = {
          prompt: message,
          systemMessage: options.systemMessage || "You are a helpful chatbot named Will."
        };
        
        // Add context if history is provided
        if (options.customHistory && options.customHistory.length > 0) {
          responseText += `. Based on our conversation, I understand we're discussing ${message}.`;
        }
        
        // Add MCP context if present
        if (options.mcpContext) {
          responseText += ` I found information related to your query: ${JSON.stringify(options.mcpContext)}`;
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

// Make sure the mcpClient instance is exported and initialized properly
export const mcpClient = new MCPClient();

// Export the class as well for testing or other uses
export { MCPClient };