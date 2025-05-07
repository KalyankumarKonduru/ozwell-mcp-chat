import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { check, Match } from 'meteor/check';
import { mcpClient } from './mcp-client';
import { processMcpMessage, isMcpToolEnabled, analyzeMessageIntent } from './mcp-tools-registry';

export const Messages = new Mongo.Collection('messages');

// Methods for messages
Meteor.methods({
  // Analyze message intent before sending
  async 'messages.analyzeIntent'(text) {
    check(text, String);
    
    if (!text.trim()) {
      return null;
    }
    
    // Analyze message intent using the MCP tools registry
    const intent = analyzeMessageIntent(text);
    return intent;
  },
  
  async 'messages.insert'(text, options = {}) {
    check(text, String);
    check(options, Match.Maybe(Object));
    
    if (!text.trim()) {
      throw new Meteor.Error('text-required', 'Message text is required');
    }
    
    // Insert user message
    const userMessageId = await Messages.insertAsync({
      text,
      sender: 'user',
      userId: this.userId || 'anonymous',
      createdAt: new Date(),
      toolIntent: options.toolIntent || null,
      activeTool: options.activeTool || null
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
          
          // Check for active tool or auto-detected tool intent
          const toolIntent = options.toolIntent || null;
          const activeTool = options.activeTool || null;
          
          // Process with MCP tools (automatic detection)
          let mcpResponse = null;
          try {
            // Try to process with MCP tools automatically
            mcpResponse = await processMcpMessage(text, { 
              history,
              toolIntent,
              activeTool
            });
            
            if (mcpResponse) {
              console.log("MCP processing result:", mcpResponse);
            } else {
              console.log("No automatic MCP tools applied");
            }
          } catch (mcpError) {
            console.error("Error in MCP processing:", mcpError);
          }
          
          // Create a modified system message if MCP tools were used
          let systemMessage = "You are a helpful chatbot named Will with access to MongoDB and document storage tools. ";
          
          if (mcpResponse) {
            // Add MCP context to the system message based on the tool used
            if (mcpResponse.tool === 'mongodb') {
              systemMessage += "You have retrieved information from the MongoDB database. " + 
                              "The following information was found: " + 
                              JSON.stringify(mcpResponse.results);
            } else if (mcpResponse.tool === 'documents') {
              systemMessage += "You have retrieved documents matching the query. ";
              
              if (mcpResponse.intent === 'retrieveDocument') {
                // Document retrieval response
                systemMessage += `I found ${mcpResponse.results.length} document(s) matching the name "${mcpResponse.documentName}". `;
              } else if (mcpResponse.intent === 'extractContent') {
                // Content extraction response
                systemMessage += `I found ${mcpResponse.results.length} document(s) matching "${mcpResponse.documentName}". `;
                systemMessage += `The user wants to know about the ${mcpResponse.contentToExtract} in this document. `;
              } else if (mcpResponse.intent === 'documentSearch') {
                // Document search response
                systemMessage += `I found ${mcpResponse.results.length} document(s) matching the search. `;
              }
              
              // Add document information
              if (mcpResponse.results && mcpResponse.results.length > 0) {
                // Instead of including the entire document content, just include metadata
                const sanitizedResults = mcpResponse.results.map(doc => ({
                  id: doc.id,
                  documentType: doc.documentType,
                  filename: doc.filename,
                  // Include a short preview if available, but limit to 500 chars
                  preview: doc.preview ? 
                    (typeof doc.preview === 'string' && !doc.preview.startsWith('data:') ? 
                      doc.preview.substring(0, 500) : 
                      "Preview not available in text format") : 
                    "No preview available",
                  // For content, include a truncated version if it's text and not a data URL
                  content: doc.content ? 
                    (typeof doc.content === 'string' && !doc.content.startsWith('data:') ? 
                      doc.content.substring(0, 1000) + (doc.content.length > 1000 ? "..." : "") : 
                      "This is a resume in PDF format. You can extract information about work experience, education, skills, contact information, etc. from it.") : 
                    "Content not available"
                }));
                
                systemMessage += "Here are the documents: " + JSON.stringify(sanitizedResults);
              } else {
                systemMessage += "No matching documents were found.";
              }
            }
          }
          
          // Make sure the system message is not too large
          const MAX_SYSTEM_MESSAGE_SIZE = 10000; // 10KB is a safe limit for most APIs
          if (systemMessage.length > MAX_SYSTEM_MESSAGE_SIZE) {
            systemMessage = systemMessage.substring(0, MAX_SYSTEM_MESSAGE_SIZE) + 
              "... (message truncated due to size limits)";
            console.log("System message was truncated due to size limits");
          }
          
          // Get AI response
          console.log("Requesting AI response with full conversation history...");
          console.log("System message (truncated):", systemMessage.substring(0, 200) + "...");
          
          let aiResponse;
          try {
            // Check if mcpClient is properly initialized
            if (!mcpClient || typeof mcpClient.sendMessage !== 'function') {
              throw new Error('MCP client is not properly initialized');
            }
            
            aiResponse = await mcpClient.sendMessage(text, {
              includeHistory: false,
              customHistory: history,
              systemMessage: systemMessage
            });
            
            console.log(`AI response received: "${aiResponse.text}"`);
          } catch (aiError) {
            console.error('Error getting AI response:', aiError);
            
            // Create a fallback response
            aiResponse = {
              text: `I'm sorry, I encountered a problem while processing your request. ${aiError.message || 'Please try again.'}`,
              metadata: {
                error: true,
                errorMessage: aiError.message,
                timestamp: new Date().toISOString()
              }
            };
          }
          
          // Insert bot response as a new message
          const botMessageId = await Messages.insertAsync({
            text: aiResponse.text,
            sender: 'bot',
            loading: false,
            completed: true,
            mcpData: mcpResponse,
            metadata: aiResponse.metadata || {},
            createdAt: new Date()
          });
          
          console.log(`AI response inserted with ID: ${botMessageId}`);
        } catch (error) {
          console.error('Error in message processing:', error);
          
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
  },
  
  // Method to store a document in MongoDB
  async 'messages.storeDocument'(document, collection = 'documents') {
    check(document, Object);
    check(collection, String);
    
    if (!isMcpToolEnabled('mongodb')) {
      throw new Meteor.Error('tool-disabled', 'MongoDB MCP tool is not enabled');
    }
    
    console.log('Storing document in MongoDB:', document);
    
    try {
      const { mcpTools } = await import('./mcp-tools-registry');
      const documentId = await mcpTools.mongodb.storeDocument(document, collection);
      
      return {
        success: true,
        documentId: documentId
      };
    } catch (error) {
      console.error('Error storing document in MongoDB:', error);
      throw new Meteor.Error('store-failed', 'Failed to store document: ' + error.message);
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