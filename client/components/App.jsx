import React from 'react';
import Header from './Header';
import ChatWindow from './ChatWindow';
import MessageInput from './MessageInput';

const App = () => {
  return (
    <div className="app-container">
      <Header title="Ozwell MCP Chat" />
      <ChatWindow />
      <MessageInput />
    </div>
  );
};

export default App;