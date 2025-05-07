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
    
    console.log(`User message inserted with ID: ${userMessageId}`);
    
    // Handle the AI response as a separate asynchronous process
    if (Meteor.isServer) {
      // Use Promise to handle async operations outside of Meteor's reactivity
      Promise.resolve().then(async () => {
        try {
          // IMPORTANT: Get ALL previous messages to maintain conversation context
          // This is what ensures proper follow-up responses
          const previousMessages = await Messages.find(
            {}, // No filters - get all messages
            { 
              sort: { createdAt: 1 }, // Sort by time ascending to maintain conversation flow
              // No limit - get the full conversation history
            }
          ).fetchAsync();
          
          console.log(`Found ${previousMessages.length} total messages for context`);
          
          // Format history for AI service
          const history = previousMessages.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text
          }));
          
          // Log the full conversation history being sent
          console.log("Full conversation history being sent to AI:");
          history.forEach((msg, i) => {
            console.log(`[${i}] ${msg.role}: ${msg.content.substring(0, 30)}...`);
          });
          
          // Get AI response
          console.log("Requesting AI response with full conversation history...");
          const aiResponse = await mcpClient.sendMessage(text, {
            includeHistory: false,
            customHistory: history
          });
          
          console.log(`AI response received: "${aiResponse.text}"`);
          
          // Insert bot response as a new message
          const botMessageId = await Messages.insertAsync({
            text: aiResponse.text,
            sender: 'bot',
            loading: false,
            completed: true,
            metadata: aiResponse.metadata || {},
            createdAt: new Date()
          });
          
          console.log(`AI response inserted with ID: ${botMessageId}`);
        } catch (error) {
          console.error('Error getting AI response:', error);
          
          // Insert error message
          await Messages.insertAsync({
            text: `Sorry, I encountered a problem: ${error.reason || error.message || 'Unknown error'}`,
            sender: 'bot',
            error: true,
            createdAt: new Date()
          });
        }
      }).catch(error => {
        console.error('Promise rejection in messages.insert:', error);
      });
    }
    
    // Return the user message ID immediately
    return userMessageId;
  },
  
  async 'messages.getAll'() {
    console.log('Executing messages.getAll method...');
    try {
      const allMessages = await Messages.find({}, { 
        sort: { createdAt: 1 }
      }).fetchAsync();
      
      console.log(`Returning ${allMessages.length} messages to client`);
      return allMessages;
    } catch (error) {
      console.error('Error fetching all messages:', error);
      throw new Meteor.Error('fetch-failed', 'Failed to fetch messages: ' + error.message);
    }
  },
  
  async 'messages.clear'() {
    // Clear all messages
    console.log('Executing messages.clear method...');
    try {
      const result = await Messages.removeAsync({});
      console.log(`Removed ${result} messages from collection`);
      return result;
    } catch (error) {
      console.error('Error clearing messages:', error);
      throw new Meteor.Error('clear-failed', 'Failed to clear messages: ' + error.message);
    }
  }
});

// Publish messages to the client
if (Meteor.isServer) {
  Meteor.publish('messages', function () {
    console.log('Publishing messages to client...');
    return Messages.find({}, { 
      sort: { createdAt: 1 }
    });
  });
}