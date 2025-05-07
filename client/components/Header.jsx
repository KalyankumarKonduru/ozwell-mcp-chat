import React from 'react';
import { Meteor } from 'meteor/meteor';

const Header = ({ title }) => {
  const clearChat = () => {
    if (confirm('Are you sure you want to clear all messages?')) {
      console.log('Attempting to clear all messages...');
      
      Meteor.call('messages.clear', (error, result) => {
        if (error) {
          console.error('Error clearing messages:', error);
          alert('Failed to clear messages: ' + error.message);
        } else {
          console.log('Messages cleared successfully. Result:', result);
          
          // Force reload the page to ensure UI refreshes
          window.location.reload();
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