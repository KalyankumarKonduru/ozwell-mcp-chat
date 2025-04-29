import React, { useState, useRef, useEffect } from 'react';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import { Messages } from '/imports/api/messages';

const MessageInput = ({ onSendMessage, isSending }) => {
  const [message, setMessage] = useState('');
  const inputRef = useRef(null);
  
  // Track loading messages more reliably
  const { isProcessing } = useTracker(() => {
    // Find any message that's currently loading
    const loadingMessages = Messages.find({ loading: true }).fetch();
    return {
      isProcessing: loadingMessages.length > 0
    };
  });

  // Focus the input field when the component mounts
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Also focus after a message is sent
  useEffect(() => {
    if (!isProcessing && !isSending && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isProcessing, isSending]);

  const handleInputChange = (e) => {
    setMessage(e.target.value);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!message.trim() || isProcessing || isSending) return;
    
    // Send the message through the parent component
    onSendMessage(message);
    
    // Clear the input right away
    setMessage('');
  };

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
        ref={inputRef}
        type="text"
        className="message-input"
        placeholder={isProcessing ? "AI is thinking..." : "Type your message..."}
        value={message}
        onChange={handleInputChange}
        onKeyPress={handleKeyPress}
        disabled={isProcessing || isSending}
      />
      <button 
        type="submit" 
        className="send-button"
        disabled={!message.trim() || isProcessing || isSending}
      >
        {isProcessing ? 'Thinking...' : isSending ? 'Sending...' : 'Send'}
      </button>
    </form>
  );
};

export default MessageInput;