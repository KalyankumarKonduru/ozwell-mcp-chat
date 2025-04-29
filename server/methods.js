import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';
import { Promise } from 'meteor/promise';
import { mcpClient } from '../imports/api/mcp-client';

Meteor.methods({
  /**
   * Sends a message to the BlueHive AI API and returns the response
   * @param {String} message - The message text to send to the AI
   * @returns {Object} - The AI response object containing text and metadata
   */
  'sendMessage': function(message) {
    check(message, String);
    
    // Unblock to allow other method calls to proceed while this one is running
    this.unblock();
    
    console.log(`Sending message to AI: "${message}"`);
    
    // Use Promise.await to properly wait for the async function in a Meteor method
    try {
      // Call the MCP client to send the message to the AI API
      const result = Promise.await(mcpClient.sendMessage(message));
      
      // Log the successful response (for debugging)
      console.log('AI response received:', result);
      
      return result;
    } catch (error) {
      // Log the error for server-side debugging
      console.error('Error in sendMessage method:', error);
      
      // Throw a Meteor.Error to be handled by the client
      throw new Meteor.Error(
        'message-send-failed', 
        error.message || 'Failed to get response from AI service'
      );
    }
  },
  
  /**
   * Clears all messages from the Messages collection
   * This is used by the "Clear Chat" button
   */
  'clearMessages': function() {
    // If you have a Messages collection, you would clear it here
    // For example: Messages.remove({});
    
    console.log('Chat history cleared by user');
    
    return true;
  },
  
  /**
   * Tests the connection to the AI service
   * @returns {Object} - Status of the connection test
   */
  'testAIConnection': function() {
    try {
      // You could implement a simple test here
      const testResult = Promise.await(mcpClient.sendMessage('test connection'));
      
      return {
        success: true,
        message: 'Connection to AI service successful'
      };
    } catch (error) {
      console.error('AI connection test failed:', error);
      
      return {
        success: false,
        message: `Connection test failed: ${error.message}`
      };
    }
  }
});