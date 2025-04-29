import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { check } from 'meteor/check';
import { mcpClient } from './mcp-client';

export const Messages = new Mongo.Collection('messages');

// Methods for messages
Meteor.methods({
  async 'messages.insert'(text) {
    check(text, String);
    
    if (!text.trim()) {
      throw new Meteor.Error('text-required', 'Message text is required');
    }
    
    // Insert user message
    const userMessageId = await Messages.insertAsync({
      text,
      sender: 'user',
      userId: this.userId || 'anonymous',
      createdAt: new Date()
    });
    
    // Insert a placeholder for AI response with loading status
    const loadingMessageId = await Messages.insertAsync({
      text: 'Thinking...',
      sender: 'bot',
      loading: true,
      createdAt: new Date()
    });
    
    try {
      // Get response from Ozwell AI through our MCP client
      const aiResponse = await mcpClient.sendMessage(text);
      
      // Update the placeholder message with the actual AI response
      await Messages.updateAsync(
        { _id: loadingMessageId },
        { 
          $set: {
            text: aiResponse.text,
            metadata: aiResponse.metadata,
            loading: false
          }
        }
      );
      
      return userMessageId;
    } catch (error) {
      // Update message with error information
      await Messages.updateAsync(
        { _id: loadingMessageId },
        { 
          $set: {
            text: `Sorry, I encountered an error: ${error.reason || error.message || 'Unknown error'}`,
            error: true,
            loading: false
          }
        }
      );
      
      // Rethrow the error for the client to handle
      throw error;
    }
  },
  
  async 'messages.clear'() {
    // Clear all messages (for testing/development)
    await Messages.removeAsync({});
  }
});

// Publish messages to the client
if (Meteor.isServer) {
  Meteor.publish('messages', function () {
    return Messages.find({}, { sort: { createdAt: 1 } });
  });
}