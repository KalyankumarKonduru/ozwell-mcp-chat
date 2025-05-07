import React, { useEffect, useState } from 'react';
import { Meteor } from 'meteor/meteor';
import Message from './Message';

const ChatWindow = () => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Function to load messages
  const loadMessages = () => {
    Meteor.call('messages.getAll', (error, result) => {
      if (error) {
        console.error('Error fetching messages:', error);
      } else {
        console.log(`Loaded ${result.length} messages`, result);
        setMessages(result);
        setIsLoading(false);
        
        // Scroll to bottom after messages load
        setTimeout(() => {
          const chatWindow = document.querySelector('.chat-window');
          if (chatWindow) {
            chatWindow.scrollTop = chatWindow.scrollHeight;
          }
        }, 100);
      }
    });
  };
  
  // Initial load and polling
  useEffect(() => {
    loadMessages();
    
    // Poll for new messages every second
    const interval = setInterval(() => {
      loadMessages();
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Manual refresh handler
  const handleRefresh = () => {
    loadMessages();
  };
  
  return (
    <div className="chat-window">
      <div style={{padding: '5px', fontSize: '12px', color: '#888'}}>
        Messages: {messages.length}
        <button 
          onClick={handleRefresh}
          style={{marginLeft: '10px', fontSize: '10px', padding: '2px 5px'}}
        >
          Refresh
        </button>
      </div>
      
      {isLoading ? (
        <div className="loading">Loading messages...</div>
      ) : messages.length === 0 ? (
        <div className="empty-chat">
          <p>No messages yet. Start a conversation!</p>
        </div>
      ) : (
        messages.map((message) => (
          <Message 
            key={message._id}
            message={message}
          />
        ))
      )}
    </div>
  );
};

export default ChatWindow;