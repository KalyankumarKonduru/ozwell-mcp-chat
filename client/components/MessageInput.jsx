import React, { useState, useEffect } from 'react';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import { Messages } from '/imports/api/messages';

const MessageInput = ({ onSendMessage }) => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Check if any message is in loading state
  const { isLoading } = useTracker(() => {
    const loadingMessages = Messages.find({ loading: true }).fetch();
    return {
      isLoading: loadingMessages.length > 0
    };
  });

  const handleInputChange = (e) => {
    setMessage(e.target.value);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!message.trim() || isSending || isLoading) return;
    
    setIsSending(true);
    
    // Send the message
    onSendMessage(message);
    
    // Clear the input
    setMessage('');
  };

  // Reset sending state when loading state changes
  useEffect(() => {
    if (!isLoading) {
      setIsSending(false);
    }
  }, [isLoading]);

  const handleKeyPress = (e) => {
    // Submit on Enter key (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form className="message-input-container" onSubmit={handleSubmit}>
      <input
        type="text"
        className="message-input"
        placeholder={isLoading ? "AI is thinking..." : "Type your message..."}
        value={message}
        onChange={handleInputChange}
        onKeyPress={handleKeyPress}
        disabled={isSending || isLoading}
      />
      <button 
        type="submit" 
        className="send-button"
        disabled={!message.trim() || isSending || isLoading}
      >
        {isSending || isLoading ? 'Sending...' : 'Send'}
      </button>
    </form>
  );
};

export default MessageInput;