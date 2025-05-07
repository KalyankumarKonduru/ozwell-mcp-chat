import { Meteor } from 'meteor/meteor';
import '/imports/api/messages';
import { mongodbMcpClient } from '/imports/api/mongodb-mcp-client';
import '/imports/api/file-hooks'; // Import file hooks to register methods
import '/imports/api/document-storage'; // Import document storage to register methods

// Server-side startup code
Meteor.startup(async () => {
  console.log('Server started');
  
  // Initialize MongoDB MCP client if the tool is enabled
  const enabledMcpTools = Meteor.settings.public?.enabledMcpTools || [];
  
  if (enabledMcpTools.includes('mongodb')) {
    try {
      console.log('Initializing MongoDB MCP client...');
      await mongodbMcpClient.connect();
      console.log('MongoDB MCP client initialized successfully');
    } catch (error) {
      console.error('Failed to initialize MongoDB MCP client:', error);
    }
  }
});