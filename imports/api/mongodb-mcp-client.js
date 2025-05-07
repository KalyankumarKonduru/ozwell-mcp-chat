import { Meteor } from 'meteor/meteor';
import { check, Match } from 'meteor/check';
import { MongoClient } from 'mongodb';

// MongoDB MCP Client for integrating with MCP tools
export class MongoDBMCPClient {
  constructor() {
    this.connectionString = Meteor.settings.private?.mongodbMcpUrl || 'mongodb://localhost:27017';
    this.dbName = Meteor.settings.private?.mongodbMcpDbName || 'mcpDB';
    this.client = null;
    this.db = null;
  }

  // Initialize the MongoDB connection
  async connect() {
    if (this.client) return this.db;
    
    try {
      console.log(`Connecting to MongoDB at ${this.connectionString}...`);
      this.client = new MongoClient(this.connectionString);
      await this.client.connect();
      this.db = this.client.db(this.dbName);
      console.log('MongoDB connection established successfully');
      return this.db;
    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      throw new Meteor.Error('mongodb-connection-error', 'Failed to connect to MongoDB');
    }
  }

  // Store a document in MongoDB
  async storeDocument(document, collection = 'documents') {
    check(document, Object);
    check(collection, String);
    
    try {
      await this.connect();
      const result = await this.db.collection(collection).insertOne(document);
      console.log(`Document stored in MongoDB with ID: ${result.insertedId}`);
      return result.insertedId;
    } catch (error) {
      console.error('Error storing document in MongoDB:', error);
      throw new Meteor.Error('mongodb-store-error', 'Failed to store document in MongoDB');
    }
  }

  // Find documents in MongoDB
  async findDocuments(query, collection = 'documents', options = {}) {
    check(query, Object);
    check(collection, String);
    check(options, Object);
    
    try {
      await this.connect();
      const result = await this.db.collection(collection).find(query, options).toArray();
      console.log(`Found ${result.length} documents in MongoDB`);
      return result;
    } catch (error) {
      console.error('Error finding documents in MongoDB:', error);
      throw new Meteor.Error('mongodb-find-error', 'Failed to find documents in MongoDB');
    }
  }

  // Query MongoDB using natural language via MCP
  async queryWithNaturalLanguage(query, context = {}) {
    check(query, String);
    check(context, Object);
    
    try {
      console.log(`Processing natural language query: "${query}"`);
      
      // Parse natural language query
      const queryLower = query.toLowerCase();
      
      // Build MongoDB query based on natural language
      let mongoQuery = {};
      const collection = context.collection || 'documents';
      
      // Check for specific document types
      if (queryLower.includes('patient') || 
          queryLower.includes('medical') || 
          queryLower.includes('health')) {
        mongoQuery.documentType = 'patient';
      } else if (queryLower.includes('invoice') || 
                queryLower.includes('bill') || 
                queryLower.includes('financial')) {
        mongoQuery.documentType = 'financial';
      } else if (queryLower.includes('research') || 
                queryLower.includes('paper') || 
                queryLower.includes('study')) {
        mongoQuery.documentType = 'research';
      }
      
      // Check for specific filenames
      const filenameRegex = /file(?:name)?\s+(?:called|named)\s+["']?([^"']+)["']?/i;
      const filenameMatch = query.match(filenameRegex);
      if (filenameMatch && filenameMatch[1]) {
        mongoQuery.filename = { $regex: filenameMatch[1], $options: 'i' };
      }
      
      // Extract key terms for content search
      const stopWords = ['find', 'get', 'show', 'search', 'about', 'with', 'for', 'the', 'and', 'documents', 'document'];
      const terms = queryLower
        .split(/\s+/)
        .filter(term => term.length > 3 && !stopWords.includes(term));
      
      // If we have meaningful terms, search content
      if (terms.length > 0) {
        // Create conditions for content search
        const contentConditions = terms.map(term => ({
          $or: [
            { 'content': { $regex: term, $options: 'i' } },
            { 'filename': { $regex: term, $options: 'i' } }
          ]
        }));
        
        // Add to existing query
        if (Object.keys(mongoQuery).length > 0) {
          mongoQuery.$and = contentConditions;
        } else {
          mongoQuery.$or = contentConditions.map(c => c.$or).flat();
        }
      }
      
      // If query is empty after all processing, search all documents
      if (Object.keys(mongoQuery).length === 0) {
        mongoQuery = {}; // Match all documents
      }
      
      console.log('Translated to MongoDB query:', JSON.stringify(mongoQuery));
      
      // Execute the MongoDB query
      const results = await this.findDocuments(mongoQuery, collection);
      
      // Format results for display
      const formattedResults = results.map(doc => {
        const result = {
          id: doc._id,
          documentType: doc.documentType || 'unknown',
          filename: doc.filename || 'unnamed'
        };
        
        // Include a preview of content if it's text
        if (doc.content && typeof doc.content === 'string') {
          result.preview = doc.content.substring(0, 100) + '...';
        }
        
        return result;
      });
      
      return {
        query: query,
        mongoQuery: mongoQuery,
        results: formattedResults,
        fullResults: results,
        metadata: {
          timestamp: new Date(),
          resultCount: results.length
        }
      };
    } catch (error) {
      console.error('Error executing natural language query:', error);
      throw new Meteor.Error('mcp-query-error', 'Failed to process natural language query');
    }
  }
  
  // Close the MongoDB connection
  async close() {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      console.log('MongoDB connection closed');
    }
  }
}

export const mongodbMcpClient = new MongoDBMCPClient();