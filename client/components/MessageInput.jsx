import React, { useState, useRef, useEffect } from 'react';
import { Meteor } from 'meteor/meteor';
import ToolSelector from './ToolSelector';
import FileUpload from './FileUpload';

const MessageInput = () => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [activeTool, setActiveTool] = useState(null);
  const [autoToolDetected, setAutoToolDetected] = useState(null);
  const inputRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!message.trim() || isSending) return;
    
    setIsSending(true);
    
    // Auto-detect tool from message before sending
    Meteor.call('messages.analyzeIntent', message, (error, result) => {
      if (error) {
        console.error('Error analyzing message intent:', error);
        // Continue with sending the message even if intent analysis fails
        sendMessage();
      } else if (result && result.intent) {
        console.log('Auto-detected tool:', result);
        setAutoToolDetected(result.tool);
        // Send the message with the auto-detected tool context
        sendMessage(result);
      } else {
        // No tool intent detected, send message normally
        sendMessage();
      }
    });
  };
  
  const sendMessage = (toolIntent = null) => {
    // Send the message with optional tool intent
    Meteor.call('messages.insert', message, { 
      toolIntent: toolIntent,
      activeTool: activeTool
    }, (error) => {
      setIsSending(false);
      
      if (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message: ' + error.message);
      } else {
        setMessage('');
        if (inputRef.current) {
          inputRef.current.focus();
        }
        
        // Clear auto-detected tool after a short delay
        if (autoToolDetected) {
          setTimeout(() => {
            setAutoToolDetected(null);
          }, 2000);
        }
      }
    });
  };
  
  const handleToolSelect = (toolId) => {
    setActiveTool(toolId);
    
    // Focus on message input after tool selection
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);
  };
  
  const handleCloseActiveTool = () => {
    setActiveTool(null);
  };

  // Get icon for active tool
  const getToolIcon = (toolId) => {
    switch (toolId) {
      case 'mongodb': return '🗃️';
      case 'documents': return '📑';
      case 'fileUpload': return '📄';
      default: return '🔧';
    }
  };
  
  // Get name for active tool
  const getToolName = (toolId) => {
    switch (toolId) {
      case 'mongodb': return 'MongoDB';
      case 'documents': return 'Documents';
      case 'fileUpload': return 'File Upload';
      default: return 'Tool';
    }
  };

  return (
    <div className="message-input-container">
      {/* Active Tool Display */}
      {activeTool && activeTool !== 'fileUpload' && (
        <div className="active-tool">
          <span className="active-tool-icon">
            {getToolIcon(activeTool)}
          </span>
          <span>Using {getToolName(activeTool)}</span>
          <span 
            className="active-tool-close"
            onClick={handleCloseActiveTool}
          >
            ×
          </span>
        </div>
      )}
      
      {/* Auto-detected Tool Indicator */}
      {autoToolDetected && !activeTool && (
        <div className="auto-tool-indicator">
          <span className="auto-tool-icon">
            {getToolIcon(autoToolDetected)}
          </span>
          <span>Using {getToolName(autoToolDetected)}</span>
        </div>
      )}
      
      {/* File Upload Button - Outside of tool selector */}
      <FileUpload mode="button" />
      
      {/* MCP Tools Selector */}
      <div className="mcp-tools-container">
        <ToolSelector onToolSelect={handleToolSelect} />
      </div>
      
      {/* Message Input */}
      <input
        ref={inputRef}
        type="text"
        className="message-input"
        placeholder={isSending ? "Sending..." : "Type your message..."}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        disabled={isSending}
      />
      
      {/* Send Button */}
      <button 
        type="submit" 
        className="send-button"
        onClick={handleSubmit}
        disabled={!message.trim() || isSending}
      >
        {isSending ? 'Sending...' : 'Send'}
      </button>
    </div>
  );
};

export default MessageInput;