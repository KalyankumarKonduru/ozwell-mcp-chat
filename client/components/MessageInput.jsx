import React, { useState, useRef } from 'react';
import { Meteor } from 'meteor/meteor';

const MessageInput = () => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!message.trim() || isSending) return;
    
    setIsSending(true);
    
    Meteor.call('messages.insert', message, (error) => {
      setIsSending(false);
      
      if (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message: ' + error.message);
      } else {
        setMessage('');
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }
    });
  };

  return (
    <form className="message-input-container" onSubmit={handleSubmit}>
      <input
        ref={inputRef}
        type="text"
        className="message-input"
        placeholder={isSending ? "Sending..." : "Type your message..."}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        disabled={isSending}
      />
      <button 
        type="submit" 
        className="send-button"
        disabled={!message.trim() || isSending}
      >
        {isSending ? 'Sending...' : 'Send'}
      </button>
    </form>
  );
};

export default MessageInput;