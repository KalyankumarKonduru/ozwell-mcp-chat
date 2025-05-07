import React from 'react';

const Message = ({ message }) => {
  const { text, sender, createdAt, loading, error } = message;
  
  // Format timestamp
  const formatTime = (date) => {
    if (!(date instanceof Date) && date) {
      // If createdAt is not a Date object, try to convert it
      date = new Date(date);
    }
    if (!date) {
      return 'Unknown time';
    }
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // If it's loading
  if (loading) {
    return (
      <div className={`message message-${sender} message-loading`}>
        <div className="message-content">
          <div className="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
        <div className="message-meta">
          <span className="message-sender">{sender === 'user' ? 'You' : 'AI'}</span>
          <span className="message-time">{formatTime(createdAt)}</span>
        </div>
      </div>
    );
  }

  // If it's an error
  if (error) {
    return (
      <div className={`message message-${sender} message-error`}>
        <div className="message-content">{text}</div>
        <div className="message-meta">
          <span className="message-sender">{sender === 'user' ? 'You' : 'AI'}</span>
          <span className="message-time">{formatTime(createdAt)}</span>
        </div>
      </div>
    );
  }

  // Regular message
  return (
    <div className={`message message-${sender}`}>
      <div className="message-content">{text}</div>
      <div className="message-meta">
        <span className="message-sender">{sender === 'user' ? 'You' : 'AI'}</span>
        <span className="message-time">{formatTime(createdAt)}</span>
      </div>
    </div>
  );
};

export default Message;