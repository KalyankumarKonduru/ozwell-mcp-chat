import React, { useState, useRef } from 'react';
import { Meteor } from 'meteor/meteor';

const FileUpload = ({ mode = 'button' }) => {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setUploadStatus('');
    
    // Automatically upload when file is selected in button mode
    if (selectedFile && mode === 'button') {
      handleUpload(selectedFile);
    }
  };

  const handleUpload = async (selectedFile = null) => {
    const fileToUpload = selectedFile || file;
    
    if (!fileToUpload) {
      setUploadStatus('Please select a file first');
      return;
    }

    setIsUploading(true);
    setUploadStatus('Reading file...');

    try {
      // Read the file
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const fileContent = e.target.result;
          let documentData;
          
          // Process based on file type
          if (fileToUpload.type === 'application/json') {
            // Parse JSON file
            documentData = JSON.parse(fileContent);
          } else if (fileToUpload.type === 'text/plain' || fileToUpload.type === 'text/markdown') {
            // Store text files as plain text
            documentData = {
              content: fileContent,
              format: 'text'
            };
          } else if (fileToUpload.type.startsWith('image/')) {
            // For image files, store the base64 data
            documentData = {
              content: fileContent,
              format: 'image',
              mimeType: fileToUpload.type
            };
          } else {
            // Default handling for other file types
            documentData = {
              content: fileContent,
              format: 'binary',
              mimeType: fileToUpload.type
            };
          }
          
          // Add metadata
          documentData.filename = fileToUpload.name;
          documentData.originalFilename = fileToUpload.name; // For searching
          documentData.filesize = fileToUpload.size;
          documentData.mimeType = fileToUpload.type;
          documentData.uploadDate = new Date();
          
          setUploadStatus('Processing file...');
          
          // First process the file to extract content, detect type, etc.
          Meteor.call('files.process', documentData, (processError, processResult) => {
            if (processError) {
              console.error('Error processing file:', processError);
              setUploadStatus(`Error processing: ${processError.message}`);
              setIsUploading(false);
              return;
            }
            
            console.log('File processed:', processResult);
            
            // If file processing worked, update document with any extracted information
            if (processResult && processResult.documentType) {
              documentData.documentType = processResult.documentType;
            }
            
            setUploadStatus('Storing in database...');
            
            // Store the processed document
            Meteor.call('documents.store', documentData, (storeError, storeResult) => {
              if (storeError) {
                console.error('Error storing document:', storeError);
                setUploadStatus(`Error storing: ${storeError.message}`);
                setIsUploading(false);
              } else {
                console.log('Document stored successfully:', storeResult);
                setUploadStatus('File uploaded and processed successfully!');
                
                // Reset the file input
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
                setFile(null);
                
                // Add a message to the chat about the upload
                const docType = documentData.documentType 
                  ? ` (${documentData.documentType})`
                  : '';
                  
                Meteor.call('messages.insert', 
                  `I've uploaded a document: ${fileToUpload.name}${docType} (${formatFileSize(fileToUpload.size)})`, 
                  (msgError) => {
                    if (msgError) {
                      console.error('Error sending message about upload:', msgError);
                    }
                  }
                );
                
                // Clear upload status after a delay
                setTimeout(() => {
                  setUploadStatus('');
                  setIsUploading(false);
                }, 3000);
              }
            });
          });
        } catch (error) {
          console.error('Error processing file:', error);
          setUploadStatus(`Error processing file: ${error.message}`);
          setIsUploading(false);
        }
      };
      
      reader.onerror = () => {
        setUploadStatus('Error reading file');
        setIsUploading(false);
      };
      
      // Read as appropriate format based on file type
      if (fileToUpload.type.startsWith('image/') || 
          fileToUpload.type === 'application/pdf' || 
          fileToUpload.type.includes('office') || 
          fileToUpload.type.includes('openxmlformats')) {
        reader.readAsDataURL(fileToUpload);
      } else {
        reader.readAsText(fileToUpload);
      }
    } catch (error) {
      console.error('Error in file upload:', error);
      setUploadStatus(`Error: ${error.message}`);
      setIsUploading(false);
    }
  };
  
  // Helper to format file size
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' bytes';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Render the component based on mode
  if (mode === 'button') {
    // Render as a simple button
    return (
      <div className="file-upload-button">
        <input
          ref={fileInputRef}
          type="file"
          id="file-upload-input"
          onChange={handleFileChange}
          disabled={isUploading}
          className="file-input"
        />
        <label htmlFor="file-upload-input" className="file-upload-label" title="Upload a document">
          {isUploading ? (
            <span className="upload-spinner"></span>
          ) : (
            <span className="upload-icon">📄</span>
          )}
        </label>
        
        {uploadStatus && (
          <div className={`upload-status-tooltip ${uploadStatus.includes('Error') ? 'error' : ''}`}>
            {uploadStatus}
          </div>
        )}
      </div>
    );
  } else {
    // Render as full file upload component with progress
    return (
      <div className="file-upload">
        <div className="file-upload-container">
          <input
            ref={fileInputRef}
            type="file"
            id="file-input"
            onChange={handleFileChange}
            disabled={isUploading}
            className="file-input"
          />
          <label htmlFor="file-input" className="file-label">
            {file ? file.name : 'Choose File'}
          </label>
          <button
            onClick={() => handleUpload()}
            disabled={!file || isUploading}
            className={`upload-button ${isUploading ? 'uploading' : ''}`}
          >
            {isUploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
        
        {file && !isUploading && (
          <div className="file-info">
            Selected: {file.name} ({formatFileSize(file.size)})
          </div>
        )}
        
        {uploadStatus && (
          <div className={`upload-status ${uploadStatus.includes('Error') ? 'error' : ''}`}>
            {uploadStatus}
          </div>
        )}
      </div>
    );
  }
};

export default FileUpload;