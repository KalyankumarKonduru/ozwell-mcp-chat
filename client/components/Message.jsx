// client/components/Message.jsx
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
  
  // Get icon for document type
  const getDocTypeIcon = (docType) => {
    switch (docType?.toLowerCase()) {
      case 'resume': return '📝';
      case 'patient': return '🏥';
      case 'financial': return '💰';
      case 'research': return '🔬';
      case 'report': return '📊';
      case 'business_plan': return '📈';
      case 'research_paper': return '📚';
      case 'legal': return '⚖️';
      case 'presentation': return '🎯';
      case 'letter': return '✉️';
      case 'invoice': return '🧾';
      case 'manual': return '📙';
      default: return '📃';
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
              {/* Display sections if available */}
              {mcpData.sections && mcpData.sections.length > 0 && (
                <div className="document-sections">
                  <div className="section-header">Document Sections:</div>
                  <div className="section-list">
                    {mcpData.sections.map((section, idx) => (
                      <div key={idx} className="section-item">
                        <span className="section-name">{section}</span>
                        {mcpData.previews && mcpData.previews[section] && (
                          <div className="section-preview">
                            {mcpData.previews[section]}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Display specific section content if available */}
              {mcpData.sectionName && mcpData.sectionContent && (
                <div className="section-content">
                  <div className="section-content-header">
                    <span className="section-icon">📑</span>
                    {mcpData.sectionName.charAt(0).toUpperCase() + mcpData.sectionName.slice(1)}
                  </div>
                  <div className="section-content-body">
                    {mcpData.sectionContent.split('\n').map((line, idx) => (
                      <div key={idx} className="content-line">
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Display full document text if available */}
              {mcpData.fullText && (
                <div className="full-text-content">
                  <div className="full-text-header">Document Text</div>
                  <div className="full-text-body">
                    {mcpData.fullText.split('\n').map((line, idx) => (
                      <div key={idx} className="content-line">
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Display document list */}
              {mcpData.results && mcpData.results.length > 0 ? (
                <div className="results-container">
                  <div className="results-summary">
                    Found {mcpData.results.length} {mcpData.results.length === 1 ? 'result' : 'results'}
                    {mcpData.query && <span> for query: "{mcpData.query}"</span>}
                  </div>
                  
                  <div className="results-list">
                    {mcpData.results.map((result, idx) => (
                      <div key={idx} className="result-item">
                        <div className="result-type">
                          {getDocTypeIcon(result.documentType)} 
                          {result.documentType ? (result.documentType.charAt(0).toUpperCase() + result.documentType.slice(1)) : 'Document'}
                        </div>
                        
                        <div className="result-filename">
                          {result.filename}
                        </div>
                        
                        {result.extractedContent && (
                          <div className="result-extracted-content">
                            <div className="extracted-content-header">
                              {result.extractedSection ? `${result.extractedSection} Section` : 'Extracted Content'}
                            </div>
                            <div className="extracted-content-body">
                              {result.extractedContent.split('\n').map((line, lineIdx) => (
                                <div key={lineIdx} className="content-line">
                                  {line}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {result.preview && !result.extractedContent && (
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