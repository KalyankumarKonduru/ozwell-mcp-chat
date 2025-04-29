import React from 'react';
import { Meteor } from 'meteor/meteor';
import Header from './Header';
import ChatWindow from './ChatWindow';
import MessageInput from './MessageInput';
import '/imports/api/messages';

const App = () => {
  const handleSendMessage = (text) => {
    Meteor.call('messages.insert', text, (error) => {
      if (error) {
        console.error('Error sending message:', error);
      }
    });
  };

  return (
    <div className="app-container">
      <Header title="Ozwell MCP Chat" />
      <ChatWindow />
      <MessageInput onSendMessage={handleSendMessage} />
    </div>
  );
};

export default App;