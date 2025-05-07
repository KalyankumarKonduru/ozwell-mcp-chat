// client/components/ChatWindow.jsx
import React, { useEffect, useState, useRef } from 'react';
import { Meteor } from 'meteor/meteor';
import Message from './Message';

const ChatWindow = () => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userScrolled, setUserScrolled] = useState(false);
  const [lastMessageId, setLastMessageId] = useState(null);
  const chatWindowRef = useRef(null);
  
  // Function to load messages
  const loadMessages = (scrollToBottom = false) => {
    Meteor.call('messages.getAll', (error, result) => {
      if (error) {
        console.error('Error fetching messages:', error);
      } else {
        // Only update if we have new messages
        if (!result.length || (messages.length > 0 && messages[messages.length - 1]._id === result[result.length - 1]._id)) {
          return;
        }

        console.log(`Loaded ${result.length} messages`);
        setMessages(result);
        setLastMessageId(result.length > 0 ? result[result.length - 1]._id : null);
        setIsLoading(false);
        
        // Scroll to bottom only if we should
        if (scrollToBottom && !userScrolled) {
          setTimeout(() => {
            scrollToBottomOfChat();
          }, 100);
        }
      }
    });
  };
  
  // Scroll to bottom function
  const scrollToBottomOfChat = () => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  };
  
  // Handle scroll events
  const handleScroll = () => {
    if (!chatWindowRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = chatWindowRef.current;
    const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 10;
    
    if (isAtBottom) {
      setUserScrolled(false);
    } else {
      setUserScrolled(true);
    }
  };
  
  // Initial load and polling
  useEffect(() => {
    loadMessages(true);
    
    // Poll for new messages every 5 seconds instead of every second
    const interval = setInterval(() => {
      loadMessages(true);
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Add scroll event listener
  useEffect(() => {
    const chatWindow = chatWindowRef.current;
    if (chatWindow) {
      chatWindow.addEventListener('scroll', handleScroll);
      return () => chatWindow.removeEventListener('scroll', handleScroll);
    }
  }, []);
  
  // Scroll to bottom when new messages arrive, but only if user hasn't scrolled up
  useEffect(() => {
    if (messages.length > 0 && !userScrolled) {
      scrollToBottomOfChat();
    }
  }, [messages, userScrolled]);
  
  // Manual refresh handler
  const handleRefresh = () => {
    loadMessages(true);
    setUserScrolled(false);
  };
  
  // New messages indicator
  const NewMessagesIndicator = () => {
    if (!userScrolled) return null;
    
    return (
      <div 
        className="new-messages-indicator"
        onClick={() => {
          scrollToBottomOfChat();
          setUserScrolled(false);
        }}
      >
        New messages ↓
      </div>
    );
  };
  
  return (
    <div 
      className="chat-window" 
      ref={chatWindowRef}
      onScroll={handleScroll}
    >
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
      
      <NewMessagesIndicator />
    </div>
  );
};

export default ChatWindow;