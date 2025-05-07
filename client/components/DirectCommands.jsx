// client/components/DirectCommands.jsx
import React from 'react';
import { Meteor } from 'meteor/meteor';

const DirectCommands = () => {
  const handleDebugCommand = (command) => {
    if (command === 'check-storage') {
      Meteor.call('debug.checkDocumentStorage', (error, result) => {
        if (error) {
          console.error('Error checking document storage:', error);
          alert('Error checking document storage: ' + error.message);
        } else {
          console.log('Document storage check result:', result);
          alert(`Found ${result.documentCount} documents in storage.`);
        }
      });
    } else if (command === 'extract-skills') {
      Meteor.call('debug.extractSkillsFromLastDocument', (error, result) => {
        if (error) {
          console.error('Error extracting skills:', error);
          alert('Error extracting skills: ' + error.message);
        } else {
          console.log('Skills extraction result:', result);
          if (result.success) {
            alert('Skills extracted successfully and added to chat!');
          } else {
            alert('Failed to extract skills: ' + result.error);
          }
        }
      });
    }
  };

  return (
    <div className="direct-commands">
      <div className="command-buttons">
        <button 
          className="debug-button" 
          onClick={() => handleDebugCommand('check-storage')}
          title="Check document storage"
        >
          🔍 Check Storage
        </button>
        <button 
          className="debug-button" 
          onClick={() => handleDebugCommand('extract-skills')}
          title="Extract skills from most recent document"
        >
          📋 Extract Skills
        </button>
      </div>
    </div>
  );
};

export default DirectCommands;