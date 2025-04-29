import React from 'react';
import { Meteor } from 'meteor/meteor';

const Header = ({ title }) => {
  const clearChat = () => {
    if (confirm('Are you sure you want to clear all messages?')) {
      Meteor.call('messages.clear', (error) => {
        if (error) {
          console.error('Error clearing messages:', error);
        }
      });
    }
  };

  return (
    <header className="header">
      <h1>{title}</h1>
      <div className="header-actions">
        <button 
          className="clear-button"
          onClick={clearChat}
        >
          Clear Chat
        </button>
      </div>
    </header>
  );
};

export default Header;