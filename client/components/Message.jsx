import React from 'react';

const Message = ({ message }) => {
  const { text, sender, createdAt, loading, error } = message;
  const messageClassName = `message message-${sender} ${loading ? 'message-loading' : ''} ${error ? 'message-error' : ''}`;
  
  // Format timestamp
  const formatTime = (date) => {
    if (!(date instanceof Date)) {
      // If createdAt is not a Date object, try to convert it
      date = new Date(date);
    }
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Display loading animation for messages that are being processed
  if (loading) {
    return (
      <div className={messageClassName}>
        <div className="message-content">
          <div className="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
        <div className="message-meta">
          <span className="message-sender">AI</span>
          <span className="message-time">{formatTime(createdAt)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={messageClassName}>
      <div className="message-content">{text}</div>
      <div className="message-meta">
        <span className="message-sender">{sender === 'user' ? 'You' : 'AI'}</span>
        <span className="message-time">{formatTime(createdAt)}</span>
      </div>
    </div>
  );
};

export default Message;