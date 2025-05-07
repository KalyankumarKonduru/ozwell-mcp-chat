import { Meteor } from 'meteor/meteor';
import { mongodbMcpClient } from './mongodb-mcp-client';
import { DocumentStorage } from './document-storage';
import { PdfExtractor } from './pdf-extractor';

// Register available MCP tools
export const mcpTools = {
  // MongoDB tool for database operations
  mongodb: {
    name: 'MongoDB',
    icon: 'database',
    description: 'Query and store data in MongoDB using natural language',
    client: mongodbMcpClient,
    async query(prompt, context = {}) {
      console.log(`Executing MongoDB MCP query: "${prompt}"`);
      return await mongodbMcpClient.queryWithNaturalLanguage(prompt, context);
    },
    async storeDocument(document, collection = 'documents') {
      console.log(`Storing document in MongoDB collection: ${collection}`);
      return await mongodbMcpClient.storeDocument(document, collection);
    }
  },
  
  // Document Storage tool with PDF extraction capabilities
  documents: {
    name: 'Documents',
    icon: 'file',
    description: 'Manage and query documents with natural language',
    async query(prompt, context = {}) {
      console.log(`Executing document query: "${prompt}"`);
      
      // Check if this is a request for specific content from a PDF
      const isPdfContentRequest = this.isPdfContentRequest(prompt);
      const isPdfSkillsRequest = this.isSkillsRequest(prompt);
      
      if (isPdfContentRequest || isPdfSkillsRequest) {
        return await this.handlePdfContentRequest(prompt, context);
      }
      
      // Regular document query
      return await DocumentStorage.queryByNaturalLanguage(prompt);
    },
    
    // Check if this is a request for PDF content
    isPdfContentRequest(prompt) {
      const promptLower = prompt.toLowerCase();
      return (
        (promptLower.includes('pdf') || promptLower.includes('document')) &&
        (promptLower.includes('content') || 
         promptLower.includes('extract') || 
         promptLower.includes('read') || 
         promptLower.includes('from') ||
         promptLower.includes('in the') ||
         promptLower.includes('inside'))
      );
    },
    
    // Check if this is a request for skills
    isSkillsRequest(prompt) {
      const promptLower = prompt.toLowerCase();
      return (
        promptLower.includes('skills') ||
        promptLower.includes('abilities') ||
        promptLower.includes('competencies') ||
        promptLower.includes('qualifications')
      );
    },
    
    // Handle requests for PDF content
    async handlePdfContentRequest(prompt, context = {}) {
      console.log('Handling PDF content request:', prompt);
      
      // First, find the most recent PDF document
      const recentDocs = await this.getMostRecentDocuments(1);
      
      if (!recentDocs || recentDocs.length === 0) {
        return {
          success: false,
          message: 'No documents found'
        };
      }
      
      // Get the document
      const doc = recentDocs[0];
      
      // Check if it's a PDF
      const isPdf = doc.mimeType?.includes('pdf') || 
                   doc.filename?.toLowerCase().endsWith('.pdf') ||
                   (doc.content && typeof doc.content === 'string' && 
                    doc.content.startsWith('data:application/pdf;base64,'));
      
      if (!isPdf) {
        return {
          success: false,
          message: 'The most recent document is not a PDF'
        };
      }
      
      try {
        // Extract the relevant section
        let sectionName = 'skills';
        
        // Check if we're looking for a specific section
        const sectionMatches = [
          prompt.match(/(?:find|get|extract|show|display)\s+(?:the)?\s+(\w+)(?:\s+section)?/i),
          prompt.match(/(?:from|in)\s+(?:the)?\s+(\w+)(?:\s+section)?/i)
        ].filter(Boolean);
        
        if (sectionMatches.length > 0) {
          // Use the first match
          const possibleSection = sectionMatches[0][1].toLowerCase();
          
          // Common sections
          const validSections = [
            'skills', 'experience', 'education', 'summary', 
            'contact', 'projects', 'certifications', 'languages'
          ];
          
          if (validSections.includes(possibleSection)) {
            sectionName = possibleSection;
          }
        }
        
        console.log(`Extracting ${sectionName} section from PDF`);
        
        // Get the PDF content
        const pdfContent = doc.content;
        
        // Extract the section
        const result = await Meteor.callAsync('pdf.extractSection', pdfContent, sectionName);
        
        if (result.success && result.content) {
          // Return the results
          return {
            success: true,
            documents: [
              {
                ...doc,
                extractedContent: result.content,
                extractedSection: sectionName
              }
            ],
            count: 1,
            sectionName: sectionName,
            sectionContent: result.content
          };
        } else {
          // Try to identify sections
          const sectionsResult = await Meteor.callAsync('pdf.identifySections', pdfContent);
          
          if (sectionsResult.success && sectionsResult.sections.length > 0) {
            return {
              success: true,
              documents: [doc],
              count: 1,
              message: `I found these sections in the document: ${sectionsResult.sections.join(', ')}`,
              sections: sectionsResult.sections,
              previews: sectionsResult.previews
            };
          }
          
          // Fallback: extract all text
          const extractResult = await Meteor.callAsync('pdf.extract', pdfContent);
          
          if (extractResult.success) {
            return {
              success: true,
              documents: [
                {
                  ...doc,
                  extractedContent: extractResult.text
                }
              ],
              count: 1,
              message: 'I extracted the full text from the document',
              fullText: extractResult.text
            };
          }
        }
      } catch (error) {
        console.error('Error processing PDF content request:', error);
      }
      
      // Fallback response
      return {
        success: false,
        documents: [doc],
        count: 1,
        message: 'I found the document but could not extract the requested content'
      };
    },
    
    async storeDocument(document) {
      console.log(`Storing document via document storage: ${document.filename}`);
      return await DocumentStorage.storeDocument(document);
    },
    
    async getDocumentByName(name) {
      console.log(`Looking for document with name: ${name}`);
      return await DocumentStorage.findDocuments({ 
        filename: { $regex: name, $options: 'i' } 
      });
    },
    
    // Get most recently uploaded documents
    async getMostRecentDocuments(limit = 5) {
      try {
        console.log(`Getting ${limit} most recent documents`);
        
        // First try main documents collection
        const recentDocs = await DocumentStorage.findDocuments(
          {}, // No filters - match all documents
          { 
            sort: { uploadDate: -1, createdAt: -1 }, // Sort by upload date descending
            limit: limit 
          }
        );
        
        if (recentDocs && recentDocs.length > 0) {
          return recentDocs;
        }
        
        // Fallback to checking raw MongoDB collection
        return await mongodbMcpClient.findDocuments(
          {}, 
          'documents',
          { 
            sort: { uploadDate: -1, createdAt: -1 }, 
            limit: limit 
          }
        );
      } catch (error) {
        console.error('Error getting recent documents:', error);
        return [];
      }
    }
  }
};

// Get enabled MCP tools based on settings
export function getEnabledMcpTools() {
  const enabledTools = Meteor.settings.public?.enabledMcpTools || [];
  
  return enabledTools.reduce((acc, toolId) => {
    if (mcpTools[toolId]) {
      acc[toolId] = mcpTools[toolId];
    }
    return acc;
  }, {});
}

// Helper to check if a specific tool is enabled
export function isMcpToolEnabled(toolId) {
  const enabledTools = Meteor.settings.public?.enabledMcpTools || [];
  return enabledTools.includes(toolId);
}

// Analyze user message to determine intent and automatically select appropriate tool
export function analyzeMessageIntent(message) {
  if (!message || typeof message !== 'string') return null;
  
  const messageLower = message.toLowerCase();
  
  // Special handling for PDF content requests
  if (mcpTools.documents.isPdfContentRequest(message) || 
      mcpTools.documents.isSkillsRequest(message)) {
    return {
      intent: 'extractPdfContent',
      tool: 'documents',
      context: {
        message
      }
    };
  }
  
  // Rest of your intent detection logic...
  // (Keep all your existing intent detection code here)
  
  return null;
}

// Process a message with appropriate MCP tools
export async function processMcpMessage(message, messageContext = {}) {
  console.log('Processing message with MCP tools:', message);
  
  // Check if this is a PDF content request
  if (mcpTools.documents.isPdfContentRequest(message) || 
      mcpTools.documents.isSkillsRequest(message)) {
    console.log('Detected PDF content request');
    
    try {
      const result = await mcpTools.documents.handlePdfContentRequest(message, messageContext);
      
      if (result.success) {
        return {
          tool: 'documents',
          intent: 'extractPdfContent',
          query: message,
          results: result.documents.map(doc => ({
            id: doc._id,
            documentType: doc.documentType || 'unknown',
            filename: doc.filename || 'unnamed',
            extractedSection: result.sectionName || null,
            extractedContent: result.sectionContent || result.fullText || 
                             (result.previews ? JSON.stringify(result.previews) : null)
          })),
          sections: result.sections || [],
          sectionName: result.sectionName || null,
          sectionContent: result.sectionContent || null,
          fullText: result.fullText || null,
          message: result.message || null,
          rawResults: result
        };
      }
    } catch (error) {
      console.error('Error processing PDF content request:', error);
    }
  }
  
  // Rest of your message processing logic...
  // (Keep all your existing processMcpMessage code here)
  
  // No MCP tool applied or no results found
  return null;
}