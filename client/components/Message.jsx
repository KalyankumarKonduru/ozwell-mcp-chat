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

  return (
    <div className={messageClassName}>
      <div className="message-content">
        {loading ? (
          <div className="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        ) : (
          text
        )}
      </div>
      <div className="message-meta">
        <span className="message-sender">{sender === 'user' ? 'You' : 'AI'}</span>
        <span className="message-time">{formatTime(createdAt)}</span>
        {loading && <span className="message-status">Loading...</span>}
      </div>
    </div>
  );
};

export default Message;