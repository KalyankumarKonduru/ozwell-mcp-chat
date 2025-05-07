// Update client/components/App.jsx to include the direct commands

import React from 'react';
import Header from './Header';
import ChatWindow from './ChatWindow';
import MessageInput from './MessageInput';
import DirectCommands from './DirectCommands'; // Import the new component

const App = () => {
  return (
    <div className="app-container">
      <Header title="Ozwell MCP Chat" />
      <DirectCommands /> {/* Add the direct commands component */}
      <ChatWindow />
      <div className="input-container">
        <MessageInput />
      </div>
    </div>
  );
};

export default App;