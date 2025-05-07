import React, { useState } from 'react';

const ToolSelector = ({ onToolSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Available MCP tools
  const tools = [
    {
      id: 'mongodb',
      name: 'MongoDB',
      icon: '🗃️',
      description: 'Query or store data in MongoDB'
    },
    {
      id: 'fileUpload',
      name: 'File Upload',
      icon: '📄',
      description: 'Upload documents to the database'
    },
    {
      id: 'documents',
      name: 'Documents',
      icon: '📑',
      description: 'Natural language search for documents'
    }
  ];
  
  const handleToolClick = (toolId) => {
    setIsOpen(false);
    
    if (onToolSelect) {
      onToolSelect(toolId);
    }
  };
  
  return (
    <div className="tool-selector">
      <button 
        className={`tool-button ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Select MCP Tools"
      >
        🔨
      </button>
      
      {isOpen && (
        <div className="tool-dropdown">
          <div className="tool-dropdown-header">
            <h3>MCP Tools</h3>
            <button 
              className="close-button"
              onClick={() => setIsOpen(false)}
            >
              ×
            </button>
          </div>
          <div className="tool-list">
            {tools.map(tool => (
              <div 
                key={tool.id} 
                className="tool-item"
                onClick={() => handleToolClick(tool.id)}
              >
                <span className="tool-icon">{tool.icon}</span>
                <div className="tool-info">
                  <div className="tool-name">{tool.name}</div>
                  <div className="tool-description">{tool.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ToolSelector;