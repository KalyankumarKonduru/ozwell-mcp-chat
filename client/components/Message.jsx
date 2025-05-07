import React, { useState } from 'react';

const Message = ({ message }) => {
  const { text, sender, createdAt, loading, error, mcpData } = message;
  const [isExpanded, setIsExpanded] = useState(false);
  
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

  // Format MCP data for display
  const formatMcpData = (data) => {
    if (!data) return null;
    
    try {
      return JSON.stringify(data, null, 2);
    } catch (error) {
      console.error('Error formatting MCP data:', error);
      return 'Error formatting MCP data';
    }
  };
  
  // Toggle expanded view for MCP data
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
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

  // Determine what tool icon to show
  const getToolIcon = (toolName) => {
    switch (toolName) {
      case 'mongodb': return '🗃️';
      case 'documents': return '📄';
      default: return '🔧';
    }
  };

  // Regular message with potential MCP data
  return (
    <div className={`message message-${sender}`}>
      <div className="message-content">{text}</div>
      
      {/* Display MCP data if present */}
      {mcpData && (
        <div className="message-mcp-data">
          <div className="message-mcp-data-header" onClick={toggleExpanded}>
            <span className="tool-icon">{getToolIcon(mcpData.tool)}</span>
            {mcpData.tool === 'mongodb' && 'MongoDB Results'}
            {mcpData.tool === 'documents' && 'Document Results'}
            <span className="expand-toggle">{isExpanded ? '▼' : '►'}</span>
          </div>
          
          {isExpanded && (
            <div className="message-mcp-data-content">
              {mcpData.results && mcpData.results.length > 0 ? (
                <div className="results-container">
                  <div className="results-summary">
                    Found {mcpData.results.length} {mcpData.results.length === 1 ? 'result' : 'results'} for query: "{mcpData.query}"
                  </div>
                  
                  <div className="results-list">
                    {mcpData.results.map((result, idx) => (
                      <div key={idx} className="result-item">
                        <div className="result-type">
                          {getToolIcon(result.documentType)} 
                          {result.documentType.charAt(0).toUpperCase() + result.documentType.slice(1)}
                        </div>
                        
                        <div className="result-filename">
                          {result.filename}
                        </div>
                        
                        {result.preview && (
                          <div className="result-preview">
                            {result.preview}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="no-results">No results found</div>
              )}
            </div>
          )}
        </div>
      )}
      
      <div className="message-meta">
        <span className="message-sender">{sender === 'user' ? 'You' : 'AI'}</span>
        <span className="message-time">{formatTime(createdAt)}</span>
      </div>
    </div>
  );
};

export default Message;