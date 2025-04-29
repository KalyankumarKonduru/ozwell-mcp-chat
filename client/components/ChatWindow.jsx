import React, { useEffect, useRef } from 'react';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import { Messages } from '/imports/api/messages';
import Message from './Message';

const ChatWindow = () => {
  const messagesEndRef = useRef(null);
  const { messages, isLoading } = useTracker(() => {
    const subscription = Meteor.subscribe('messages');
    const messages = Messages.find({}, { sort: { createdAt: 1 } }).fetch();
    
    return {
      messages,
      isLoading: !subscription.ready()
    };
  });
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  return (
    <div className="chat-window">
      {isLoading ? (
        <div className="loading">Loading messages...</div>
      ) : messages.length === 0 ? (
        <div className="empty-chat">
          <p>No messages yet. Start a conversation!</p>
        </div>
      ) : (
        messages.map(message => (
          <Message 
            key={message._id}
            message={message}
          />
        ))
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatWindow;