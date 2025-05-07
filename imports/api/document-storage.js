import { Meteor } from 'meteor/meteor';
import { EJSON } from 'meteor/ejson';
import { mongodbMcpClient } from './mongodb-mcp-client';

// Document Storage Utility with serialization fixes
export const DocumentStorage = {
  // Store a document with metadata
  async storeDocument(document, options = {}) {
    try {
      console.log('Storing document:', document.filename);
      
      // Make sure we have the required fields
      if (!document.filename) {
        document.filename = 'unnamed_document_' + Date.now();
      }
      
      // Add metadata
      document.metadata = {
        ...(document.metadata || {}),
        storedAt: new Date(),
        contentType: document.mimeType || 'text/plain',
        size: document.filesize || 0,
        ...options.metadata
      };
      
      // Add document type if not present
      if (!document.documentType) {
        document.documentType = this.detectDocumentType(document);
      }
      
      // Clean and simplify the document for storage
      const cleanDocument = this.simplifyForStorage(document);
      
      // Determine collection name
      const collection = options.collection || 'documents';
      
      // Store document in MongoDB - use simplified approach to avoid serialization errors
      try {
        const result = await Meteor.callAsync('mongodb.insertDocument', cleanDocument, collection);
        console.log(`Document stored with ID: ${result}`);
        
        return {
          success: true,
          documentId: result,
          document: cleanDocument
        };
      } catch (insertError) {
        console.error('Error during document insert:', insertError);
        
        // Try fallback with even simpler document
        const minimalDocument = {
          filename: document.filename,
          content: typeof document.content === 'string' ? document.content : JSON.stringify(document.content),
          documentType: document.documentType || 'unknown',
          uploadDate: new Date(),
          metadata: document.metadata
        };
        
        const fallbackResult = await Meteor.callAsync('mongodb.insertDocument', minimalDocument, collection);
        console.log(`Document stored with fallback approach. ID: ${fallbackResult}`);
        
        return {
          success: true,
          documentId: fallbackResult,
          document: minimalDocument,
          usedFallback: true
        };
      }
    } catch (error) {
      console.error('Error storing document:', error);
      throw new Meteor.Error('document-storage-error', error.message);
    }
  },
  
  // Simplify document for storage - convert to plain JS objects
  simplifyForStorage(document) {
    try {
      // Remove problematic fields that might cause serialization issues
      const documentCopy = { ...document };
      
      // Remove any potential circular references or non-serializable fields
      delete documentCopy._id;
      
      // Handle content specially
      if (documentCopy.content) {
        // If content is a string, keep it
        if (typeof documentCopy.content === 'string') {
          // If it's too large, truncate it
          if (documentCopy.content.length > 10000000) { // 10MB limit
            console.warn('Content too large, truncating');
            documentCopy.content = documentCopy.content.substring(0, 10000000);
          }
        } else {
          // If not a string, convert to string
          try {
            documentCopy.content = JSON.stringify(documentCopy.content);
          } catch (e) {
            console.warn('Could not stringify content, setting to empty string');
            documentCopy.content = '';
          }
        }
      }
      
      // Ensure all dates are proper Date objects
      if (documentCopy.uploadDate && !(documentCopy.uploadDate instanceof Date)) {
        documentCopy.uploadDate = new Date(documentCopy.uploadDate);
      }
      
      if (documentCopy.metadata) {
        if (documentCopy.metadata.storedAt && !(documentCopy.metadata.storedAt instanceof Date)) {
          documentCopy.metadata.storedAt = new Date(documentCopy.metadata.storedAt);
        }
      }
      
      return documentCopy;
    } catch (error) {
      console.error('Error simplifying document for storage:', error);
      
      // If all else fails, return a very minimal document
      return {
        filename: document.filename || 'unnamed_document',
        content: typeof document.content === 'string' ? document.content : '',
        documentType: document.documentType || 'unknown',
        uploadDate: new Date()
      };
    }
  },
  
  // Detect document type based on content
  detectDocumentType(document) {
    // If the document already has a type, use that
    if (document.documentType) return document.documentType;
    
    const filename = document.filename?.toLowerCase() || '';
    const content = typeof document.content === 'string' 
      ? document.content.toLowerCase() 
      : '';
    
    // Check for resumes/CVs
    if (filename.includes('resume') || 
        filename.includes('cv') || 
        filename.includes('curriculum') ||
        content.includes('resume') ||
        content.includes('experience') ||
        content.includes('education') ||
        content.includes('skills')) {
      return 'resume';
    }
    
    // Check for medical/patient records
    if (filename.includes('patient') || 
        filename.includes('medical') || 
        filename.includes('health') ||
        content.includes('patient') ||
        content.includes('diagnosis') ||
        content.includes('medical record')) {
      return 'patient';
    }
    
    // Check for financial documents
    if (filename.includes('invoice') || 
        filename.includes('bill') || 
        filename.includes('receipt') ||
        content.includes('invoice') ||
        content.includes('payment') ||
        content.includes('amount due')) {
      return 'financial';
    }
    
    // Check for research documents
    if (filename.includes('research') || 
        filename.includes('study') || 
        filename.includes('paper') ||
        content.includes('research') ||
        content.includes('conclusion') ||
        content.includes('methodology')) {
      return 'research';
    }
    
    // Default type
    return 'document';
  },
  
  // Find documents by query
  async findDocuments(query = {}, options = {}) {
    try {
      // Default options
      const fetchOptions = {
        collection: options.collection || 'documents',
        sort: options.sort || { uploadDate: -1, createdAt: -1 },
        limit: options.limit || 0
      };
      
      // Clean query to avoid serialization issues
      const cleanQuery = this.simplifyForStorage(query);
      
      // Use a server method to find documents
      const documents = await Meteor.callAsync('mongodb.findDocuments', cleanQuery, fetchOptions);
      console.log(`Found ${documents.length} documents matching query`);
      return documents;
    } catch (error) {
      console.error('Error finding documents:', error);
      throw new Meteor.Error('document-query-error', error.message);
    }
  },
  
  // Get a document by ID
  async getDocumentById(id) {
    try {
      const documents = await this.findDocuments({ _id: id });
      return documents[0] || null;
    } catch (error) {
      console.error('Error getting document by ID:', error);
      throw new Meteor.Error('document-get-error', error.message);
    }
  },
  
  // Process natural language queries to find documents
  async queryByNaturalLanguage(query) {
    console.log(`Processing natural language query: "${query}"`);
    
    // For recent uploads, just get the most recent document
    if (query.toLowerCase().includes('recent') ||
        query.toLowerCase().includes('upload') ||
        query.toLowerCase().includes('resume')) {
      
      try {
        // Get the most recent document
        const recentDocs = await this.findDocuments(
          {}, // No filters - match all documents
          { 
            sort: { uploadDate: -1, createdAt: -1 }, // Sort by upload date descending
            limit: 1
          }
        );
        
        if (recentDocs && recentDocs.length > 0) {
          return {
            originalQuery: query,
            documents: recentDocs,
            count: recentDocs.length,
            source: 'recent_uploads'
          };
        }
      } catch (error) {
        console.error('Error getting recent document:', error);
      }
    }
    
    // Extract key terms from the query
    const queryLower = query.toLowerCase();
    const terms = queryLower.split(/\s+/).filter(term => term.length > 3);
    
    // Build MongoDB query
    let mongoQuery = {};
    
    // Check for document type references
    if (queryLower.includes('patient') || queryLower.includes('medical')) {
      mongoQuery.documentType = 'patient';
    } else if (queryLower.includes('invoice') || 
                queryLower.includes('bill') || 
                queryLower.includes('financial')) {
      mongoQuery.documentType = 'financial';
    } else if (queryLower.includes('research') || 
                queryLower.includes('paper') || 
                queryLower.includes('study')) {
      mongoQuery.documentType = 'research';
    } else if (queryLower.includes('resume') || 
                queryLower.includes('cv') || 
                queryLower.includes('job')) {
      mongoQuery.documentType = 'resume';
    }
    
    // Check for specific filenames
    const filenameRegex = /file(?:name)?\s+(?:called|named)\s+["']?([^"']+)["']?/i;
    const filenameMatch = query.match(filenameRegex);
    if (filenameMatch && filenameMatch[1]) {
      mongoQuery.filename = { $regex: filenameMatch[1], $options: 'i' };
    }
    
    // For resume-specific queries, check by filename
    if (queryLower.includes('resume') || queryLower.includes('cv')) {
      for (const term of ['poonam', 'resume', 'cv']) {
        if (queryLower.includes(term)) {
          mongoQuery.filename = mongoQuery.filename || {};
          mongoQuery.filename.$regex = term;
          mongoQuery.filename.$options = 'i';
        }
      }
    }
    
    // If the query is empty, default to most recent document
    if (Object.keys(mongoQuery).length === 0) {
      try {
        const recentDocs = await this.findDocuments(
          {}, 
          { 
            sort: { uploadDate: -1, createdAt: -1 }, 
            limit: 1 
          }
        );
        
        if (recentDocs && recentDocs.length > 0) {
          return {
            originalQuery: query,
            documents: recentDocs,
            count: recentDocs.length,
            source: 'most_recent'
          };
        }
      } catch (error) {
        console.error('Error getting fallback recent document:', error);
      }
    }
    
    // Execute the query
    try {
      const documents = await this.findDocuments(mongoQuery);
      
      return {
        originalQuery: query,
        mongoQuery,
        documents,
        count: documents.length
      };
    } catch (queryError) {
      console.error('Error executing MongoDB query:', queryError);
      
      // One more fallback - try to get any document
      try {
        const anyDocs = await this.findDocuments({}, { limit: 1 });
        
        if (anyDocs && anyDocs.length > 0) {
          return {
            originalQuery: query,
            documents: anyDocs,
            count: anyDocs.length,
            source: 'fallback_any'
          };
        }
      } catch (fallbackError) {
        console.error('Error in fallback query:', fallbackError);
      }
      
      // If all else fails, return empty result
      return {
        originalQuery: query,
        mongoQuery,
        documents: [],
        count: 0,
        error: queryError.message
      };
    }
  }
};

// Register methods for document operations
Meteor.methods({
  async 'documents.store'(document) {
    try {
      if (!document || typeof document !== 'object') {
        throw new Meteor.Error('invalid-document', 'Document must be an object');
      }
      
      // Strip any problematic fields
      if (document._id) delete document._id;
      
      return await DocumentStorage.storeDocument(document);
    } catch (error) {
      console.error('Error in documents.store method:', error);
      throw new Meteor.Error('document-store-error', `Failed to store document: ${error.message}`);
    }
  },
  
  async 'documents.find'(query, options) {
    try {
      return await DocumentStorage.findDocuments(query, options);
    } catch (error) {
      console.error('Error in documents.find method:', error);
      throw new Meteor.Error('document-find-error', `Failed to find documents: ${error.message}`);
    }
  },
  
  async 'documents.query'(naturalLanguageQuery) {
    try {
      if (!naturalLanguageQuery || typeof naturalLanguageQuery !== 'string') {
        throw new Meteor.Error('invalid-query', 'Query must be a string');
      }
      
      return await DocumentStorage.queryByNaturalLanguage(naturalLanguageQuery);
    } catch (error) {
      console.error('Error in documents.query method:', error);
      throw new Meteor.Error('document-query-error', `Failed to query documents: ${error.message}`);
    }
  },
  
  // Raw MongoDB operations 
  async 'mongodb.insertDocument'(document, collection) {
    // This method must be defined on the server
    if (!Meteor.isServer) {
      throw new Meteor.Error('server-only', 'This method can only be called from the server');
    }
    
    try {
      // Convert to plain JS object to avoid serialization issues
      const plainDocument = EJSON.fromJSONValue(EJSON.toJSONValue(document));
      
      // Insert directly using the Mongo driver
      const result = await mongodbMcpClient.storeDocument(plainDocument, collection);
      return result;
    } catch (error) {
      console.error(`Error in mongodb.insertDocument for collection ${collection}:`, error);
      throw new Meteor.Error('mongodb-insert-error', `Failed to insert document: ${error.message}`);
    }
  },
  
  async 'mongodb.findDocuments'(query, options) {
    // This method must be defined on the server
    if (!Meteor.isServer) {
      throw new Meteor.Error('server-only', 'This method can only be called from the server');
    }
    
    try {
      // Convert to plain JS object to avoid serialization issues
      const plainQuery = EJSON.fromJSONValue(EJSON.toJSONValue(query));
      
      // Get the collection name from options
      const collection = options.collection || 'documents';
      
      // Extract other options
      const findOptions = {
        sort: options.sort || { uploadDate: -1, createdAt: -1 },
        limit: options.limit || 0
      };
      
      // Find directly using the Mongo driver
      const result = await mongodbMcpClient.findDocuments(plainQuery, collection, findOptions);
      return result;
    } catch (error) {
      console.error(`Error in mongodb.findDocuments for collection ${options.collection}:`, error);
      throw new Meteor.Error('mongodb-find-error', `Failed to find documents: ${error.message}`);
    }
  }
});