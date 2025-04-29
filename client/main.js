// ... existing code ...

// Make sure the message state is properly reset after sending
Template.messageInput.events({
  'submit .message-form'(event, instance) {
    event.preventDefault();
    
    const messageText = instance.$('.message-input').val().trim();
    if (!messageText) return;
    
    // Clear the input field immediately
    instance.$('.message-input').val('');
    
    // Add user message to the chat
    Messages.insert({
      text: messageText,
      sender: 'user',
      timestamp: new Date(),
    });
    
    // Set loading state
    Session.set('isLoading', true);
    
    // Send message to API
    Meteor.call('sendMessage', messageText, (error, result) => {
      Session.set('isLoading', false);
      
      if (error) {
        console.error('Error sending message:', error);
        Messages.insert({
          text: `Error: ${error.message}`,
          sender: 'system',
          isError: true,
          timestamp: new Date(),
        });
        return;
      }
      
      // Add AI response to the chat
      Messages.insert({
        text: result.text,
        sender: 'ai',
        metadata: result.metadata,
        timestamp: new Date(),
      });
      
      // Make sure the UI is updated and ready for the next message
      setTimeout(() => {
        // Scroll to the bottom of the chat
        const chatWindow = document.querySelector('.chat-window');
        if (chatWindow) {
          chatWindow.scrollTop = chatWindow.scrollHeight;
        }
        
        // Focus the input field for the next message
        instance.$('.message-input').focus();
      }, 100);
    });
  }
});

// ... existing code ...