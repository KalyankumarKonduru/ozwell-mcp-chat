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

    // Create a unique conversation ID to track this specific request
    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Insert a placeholder for AI response with loading status
    const loadingMessageId = await Messages.insertAsync({
      text: 'Thinking...',
      sender: 'bot',
      loading: true,
      conversationId,
      createdAt: new Date()
    });
    
    // Run the AI call outside the method's future to avoid blocking
    Promise.resolve().then(async () => {
      try {
        // Get response from Ozwell AI through our MCP client
        const aiResponse = await mcpClient.sendMessage(text, {
          includeHistory: true,
          messagesCollection: Messages
        });
        
        // Update the placeholder message with the actual AI response
        await Messages.updateAsync(
          { _id: loadingMessageId },
          { 
            $set: {
              text: aiResponse.text,
              metadata: aiResponse.metadata || {},
              loading: false,
              completed: true
            }
          }
        );
      } catch (error) {
        console.error('Error getting AI response:', error);
        
        // Update message with error information
        await Messages.updateAsync(
          { _id: loadingMessageId },
          { 
            $set: {
              text: `Sorry, I encountered a problem. ${error.reason || error.message || 'Please try again later.'}`,
              error: true,
              loading: false,
              completed: true
            }
          }
        );
      }
    }).catch(error => {
      console.error('Unhandled promise rejection in messages.insert method:', error);
    });
    
    // Return the user message ID immediately to unblock the client
    return userMessageId;
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