// Add this to server/main.js to help with debugging

import { Meteor } from 'meteor/meteor';
import { Messages } from '/imports/api/messages';
import { MongoDBMCPClient } from '/imports/api/mongodb-mcp-client';
import '/imports/api/file-hooks';

// Create debug method
Meteor.methods({
  'debug.checkDocumentStorage': async function() {
    console.log('Checking document storage...');
    
    // Get MongoDB client
    const mongoClient = new MongoDBMCPClient();
    await mongoClient.connect();
    
    // Check documents collection
    const documents = await mongoClient.findDocuments({}, 'documents', { limit: 10 });
    console.log(`Found ${documents.length} documents in storage`);
    
    // Log document info without large content
    documents.forEach(doc => {
      const docInfo = {
        _id: doc._id,
        filename: doc.filename,
        documentType: doc.documentType,
        mimeType: doc.mimeType,
        uploadDate: doc.uploadDate,
        contentLength: doc.content ? (typeof doc.content === 'string' ? doc.content.length : 'Not string') : 'No content',
        hasContent: !!doc.content
      };
      console.log('Document info:', docInfo);
    });
    
    return {
      documentCount: documents.length,
      documents: documents.map(doc => ({
        _id: doc._id,
        filename: doc.filename,
        documentType: doc.documentType,
        uploadDate: doc.uploadDate,
        hasContent: !!doc.content
      }))
    };
  },
  
  'debug.extractPdfText': async function(documentId) {
    console.log(`Attempting to extract text from document: ${documentId}`);
    
    try {
      // Get MongoDB client
      const mongoClient = new MongoDBMCPClient();
      await mongoClient.connect();
      
      // Find the document
      const documents = await mongoClient.findDocuments({ _id: documentId }, 'documents');
      
      if (!documents || documents.length === 0) {
        console.log(`Document not found: ${documentId}`);
        return { success: false, error: 'Document not found' };
      }
      
      const doc = documents[0];
      console.log(`Found document: ${doc.filename}`);
      
      // Check if content exists
      if (!doc.content) {
        console.log('Document has no content');
        return { success: false, error: 'Document has no content' };
      }
      
      // Import the PdfExtractor
      const { PdfExtractor } = await import('/imports/api/pdf-extractor');
      
      // Try to extract text
      console.log('Attempting text extraction...');
      const extractionResult = await Meteor.callAsync('pdf.extract', doc.content);
      
      console.log(`Extraction success: ${extractionResult.success}`);
      if (extractionResult.success) {
        // Log first 200 chars of text for debugging
        console.log('Extracted text sample: ', extractionResult.text.substring(0, 200));
        
        // Try to identify sections
        console.log('Identifying sections...');
        const sectionsResult = await Meteor.callAsync('pdf.identifySections', doc.content);
        
        return {
          success: true,
          textSample: extractionResult.text.substring(0, 500) + '...',
          textLength: extractionResult.text.length,
          sections: sectionsResult.success ? sectionsResult.sections : [],
          documentType: sectionsResult.success ? sectionsResult.documentType : 'unknown'
        };
      } else {
        return { success: false, error: 'Text extraction failed' };
      }
    } catch (error) {
      console.error('Error in debug.extractPdfText:', error);
      return { 
        success: false, 
        error: error.message || 'Unknown error',
        stack: error.stack
      };
    }
  },
  
  'debug.addDebugMessage': async function(text) {
    // Add a debug message to the chat
    try {
      const messageId = await Messages.insertAsync({
        text: `DEBUG: ${text}`,
        sender: 'system',
        createdAt: new Date(),
        isDebug: true
      });
      
      return { success: true, messageId };
    } catch (error) {
      console.error('Error adding debug message:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Enhanced method to directly extract skills from most recent document
  'debug.extractSkillsFromLastDocument': async function() {
    try {
      console.log('Attempting to extract skills from most recent document...');
      
      // Get MongoDB client
      const mongoClient = new MongoDBMCPClient();
      await mongoClient.connect();
      
      // Find most recent document
      const documents = await mongoClient.findDocuments(
        {}, 
        'documents', 
        { 
          sort: { uploadDate: -1 }, 
          limit: 1 
        }
      );
      
      if (!documents || documents.length === 0) {
        console.log('No documents found');
        return { success: false, error: 'No documents found' };
      }
      
      const doc = documents[0];
      console.log(`Found most recent document: ${doc.filename}`);
      
      // Check if content exists
      if (!doc.content) {
        console.log('Document has no content');
        return { success: false, error: 'Document has no content' };
      }
      
      // Import the PdfExtractor
      const { PdfExtractor } = await import('/imports/api/pdf-extractor');
      
      // Try to extract skills section
      console.log('Attempting to extract skills section...');
      const skillsResult = await Meteor.callAsync('pdf.extractSection', doc.content, 'skills');
      
      if (skillsResult.success) {
        console.log('Skills section extracted successfully');
        
        // Add a message showing the skills
        const messageText = `Skills section from "${doc.filename}":\n\n${skillsResult.content}`;
        
        const messageId = await Messages.insertAsync({
          text: messageText,
          sender: 'bot',
          createdAt: new Date(),
          mcpData: {
            tool: 'documents',
            results: [{
              id: doc._id,
              documentType: doc.documentType || 'resume',
              filename: doc.filename,
              extractedContent: skillsResult.content,
              extractedSection: 'skills'
            }],
            count: 1,
            sectionName: 'skills',
            sectionContent: skillsResult.content
          }
        });
        
        return { 
          success: true, 
          message: 'Skills extracted and added to chat',
          skills: skillsResult.content,
          messageId
        };
      } else {
        console.log('Skills section extraction failed, trying to identify sections');
        
        // Try to identify sections
        const sectionsResult = await Meteor.callAsync('pdf.identifySections', doc.content);
        
        if (sectionsResult.success && sectionsResult.sections.length > 0) {
          console.log(`Identified sections: ${sectionsResult.sections.join(', ')}`);
          
          // Add a message showing the sections
          const messageText = `Sections found in "${doc.filename}":\n\n${sectionsResult.sections.join('\n')}`;
          
          const messageId = await Messages.insertAsync({
            text: messageText,
            sender: 'bot',
            createdAt: new Date(),
            mcpData: {
              tool: 'documents',
              results: [{
                id: doc._id,
                documentType: doc.documentType || 'document',
                filename: doc.filename
              }],
              count: 1,
              sections: sectionsResult.sections,
              previews: sectionsResult.previews
            }
          });
          
          return { 
            success: true, 
            message: 'Sections identified and added to chat',
            sections: sectionsResult.sections,
            messageId
          };
        } else {
          // Try getting the full text
          const extractionResult = await Meteor.callAsync('pdf.extract', doc.content);
          
          if (extractionResult.success) {
            const textSample = extractionResult.text.substring(0, 1000) + 
                             (extractionResult.text.length > 1000 ? '...' : '');
            
            const messageId = await Messages.insertAsync({
              text: `Content from "${doc.filename}":\n\n${textSample}`,
              sender: 'bot',
              createdAt: new Date(),
              mcpData: {
                tool: 'documents',
                results: [{
                  id: doc._id,
                  documentType: doc.documentType || 'document',
                  filename: doc.filename,
                  extractedContent: textSample
                }],
                count: 1,
                fullText: textSample
              }
            });
            
            return { 
              success: true, 
              message: 'Full text extracted and added to chat',
              textSample: textSample,
              messageId
            };
          }
          
          return { 
            success: false, 
            error: 'Could not extract skills or identify sections'
          };
        }
      }
    } catch (error) {
      console.error('Error in debug.extractSkillsFromLastDocument:', error);
      return { 
        success: false, 
        error: error.message || 'Unknown error',
        stack: error.stack
      };
    }
  }
});