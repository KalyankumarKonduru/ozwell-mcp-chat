import React, { useState } from 'react';
import { Meteor } from 'meteor/meteor';
import Header from './Header';
import ChatWindow from './ChatWindow';
import MessageInput from './MessageInput';
// Import the Messages collection
import '/imports/api/messages';

const App = () => {
  const [sendingMessage, setSendingMessage] = useState(false);

  const handleSendMessage = async (text, callback) => {
    // Set sending state
    setSendingMessage(true);
    
    try {
      // Use callAsync instead of call for async methods
      const result = await Meteor.callAsync('messages.insert', text);
      
      // Reset sending state
      setSendingMessage(false);
      
      if (callback && typeof callback === 'function') {
        callback(null, result);
      }
    } catch (error) {
      // Reset sending state
      setSendingMessage(false);
      
      console.error('Error sending message:', error);
      
      if (callback && typeof callback === 'function') {
        callback(error);
      }
    }
  };

  return (
    <div className="app-container">
      <Header title="Ozwell MCP Chat" />
      <ChatWindow />
      <MessageInput onSendMessage={handleSendMessage} isSending={sendingMessage} />
    </div>
  );
};

export default App;