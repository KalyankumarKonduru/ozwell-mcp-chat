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
// Handler function within mcp-tools-registry.js for processing document content

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
    console.log(`Found document: ${doc.filename}`);
    
    // Check if it's a PDF or other supported document type
    const isPdf = doc.mimeType?.includes('pdf') || 
                 doc.filename?.toLowerCase().endsWith('.pdf') ||
                 (doc.content && typeof doc.content === 'string' && 
                  doc.content.startsWith('data:application/pdf;base64,'));
    
    if (!isPdf) {
      return {
        success: false,
        message: `The document "${doc.filename}" is not a PDF or supported document type.`
      };
    }
    
    try {
      // Parse the query to understand what section or content is being requested
      const promptLower = prompt.toLowerCase();
      let sectionName = null;
      
      // Check for common section requests
      if (promptLower.includes('skill')) {
        sectionName = 'skills';
      } else if (promptLower.includes('experience') || promptLower.includes('work history')) {
        sectionName = 'experience';
      } else if (promptLower.includes('education') || promptLower.includes('academic')) {
        sectionName = 'education';
      } else if (promptLower.includes('summary') || promptLower.includes('profile')) {
        sectionName = 'summary';
      } else if (promptLower.includes('certification')) {
        sectionName = 'certifications';
      } else if (promptLower.includes('project')) {
        sectionName = 'projects';
      } else if (promptLower.match(/(?:from|in|of)\s+(?:the)?\s+(\w+)(?:\s+section)?/i)) {
        // Extract section name from query like "content from the X section"
        const match = promptLower.match(/(?:from|in|of)\s+(?:the)?\s+(\w+)(?:\s+section)?/i);
        sectionName = match[1];
      } else if (promptLower.match(/(?:find|get|extract|show|display)\s+(?:the)?\s+(\w+)(?:\s+section)?/i)) {
        // Extract section name from query like "find the X section"
        const match = promptLower.match(/(?:find|get|extract|show|display)\s+(?:the)?\s+(\w+)(?:\s+section)?/i);
        sectionName = match[1];
      }
      
      // If we don't have a specific section request, identify sections first
      if (!sectionName) {
        console.log('No specific section requested, identifying available sections');
        
        const sectionsResult = await Meteor.callAsync('pdf.identifySections', doc.content);
        
        if (sectionsResult.success && sectionsResult.sections.length > 0) {
          return {
            success: true,
            documents: [doc],
            count: 1,
            message: `I found these sections in the document "${doc.filename}": ${sectionsResult.sections.join(', ')}`,
            sections: sectionsResult.sections,
            previews: sectionsResult.previews,
            documentType: sectionsResult.documentType
          };
        } else {
          // If no sections found, extract all text
          console.log('No sections identified, extracting full text');
          const extractResult = await Meteor.callAsync('pdf.extract', doc.content);
          
          if (extractResult.success) {
            return {
              success: true,
              documents: [
                {
                  ...doc,
                  extractedContent: extractResult.text.substring(0, 2000) + 
                                   (extractResult.text.length > 2000 ? '...' : '')
                }
              ],
              count: 1,
              message: `I extracted text from the document "${doc.filename}"`,
              fullText: extractResult.text.substring(0, 2000) + 
                       (extractResult.text.length > 2000 ? '...' : '')
            };
          }
        }
      } else {
        // Extract the specific requested section
        console.log(`Extracting "${sectionName}" section from PDF`);
        
        const result = await Meteor.callAsync('pdf.extractSection', doc.content, sectionName);
        
        if (result.success) {
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
            sectionContent: result.content,
            message: `I found the "${sectionName}" section in the document "${doc.filename}"`
          };
        } else {
          // If section extraction failed, try identifying sections
          const sectionsResult = await Meteor.callAsync('pdf.identifySections', doc.content);
          
          if (sectionsResult.success && sectionsResult.sections.length > 0) {
            return {
              success: true,
              documents: [doc],
              count: 1,
              message: `I couldn't find a section called "${sectionName}", but I found these sections: ${sectionsResult.sections.join(', ')}`,
              sections: sectionsResult.sections,
              previews: sectionsResult.previews
            };
          }
        }
      }
    } catch (error) {
      console.error('Error processing document content request:', error);
    }
    
    // Fallback response
    return {
      success: false,
      documents: [doc],
      count: 1,
      message: `I found the document "${doc.filename}" but could not extract the requested content. Try asking for available sections first.`
    };
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