import { Meteor } from 'meteor/meteor';
import { DocumentStorage } from './document-storage';

// File Processing Hooks with enhanced document tracking
export const FileHooks = {
  // Process a file after upload
  async processFile(fileData) {
    try {
      console.log(`Processing uploaded file: ${fileData.filename}`);
      console.log('File metadata:', JSON.stringify({
        filename: fileData.filename,
        filesize: fileData.filesize,
        mimeType: fileData.mimeType
      }));
      
      // Based on file type, process differently
      if (fileData.mimeType) {
        if (fileData.mimeType.startsWith('text/')) {
          await this.processTextFile(fileData);
        } else if (fileData.mimeType.startsWith('image/')) {
          await this.processImageFile(fileData);
        } else if (fileData.mimeType.includes('pdf')) {
          await this.processPdfFile(fileData);
        } else {
          // Default processing for other file types
          await this.processGenericFile(fileData);
        }
      } else {
        // If no mime type, treat as generic
        await this.processGenericFile(fileData);
      }
      
      // Important: Store the file reference in a central registry for retrieval
      await this.registerProcessedFile(fileData);
      
      return {
        success: true,
        message: `File ${fileData.filename} processed successfully`,
        documentType: fileData.documentType
      };
    } catch (error) {
      console.error('Error processing file:', error);
      throw new Meteor.Error('file-processing-error', error.message);
    }
  },
  
  // Register the processed file in a central location for easy retrieval
  async registerProcessedFile(fileData) {
    try {
      // Create a document registry entry
      const registryCollection = 'documentRegistry';
      const registryEntry = {
        filename: fileData.filename,
        originalFilename: fileData.originalFilename || fileData.filename,
        documentType: fileData.documentType || 'unknown',
        mimeType: fileData.mimeType,
        filesize: fileData.filesize,
        uploadDate: new Date(),
        status: 'processed',
        searchTerms: this.generateSearchTerms(fileData)
      };
      
      console.log('Registering processed file:', registryEntry.filename);
      
      // Store in the registry
      await DocumentStorage.storeDocument(registryEntry, { collection: registryCollection });
      
      return true;
    } catch (error) {
      console.error('Error registering processed file:', error);
      // Don't throw here, just log the error
      return false;
    }
  },
  
  // Generate search terms for the document
  generateSearchTerms(fileData) {
    const terms = [];
    
    // Always include the filename
    if (fileData.filename) {
      terms.push(fileData.filename.toLowerCase());
      
      // Split filename by common separators
      const filenameParts = fileData.filename.split(/[_\s\-\.]/);
      terms.push(...filenameParts.filter(part => part.length > 2).map(part => part.toLowerCase()));
    }
    
    // Include document type
    if (fileData.documentType) {
      terms.push(fileData.documentType.toLowerCase());
    }
    
    // Add content-based terms if it's text
    if (fileData.content && typeof fileData.content === 'string') {
      // Extract important words from content (at least 4 chars)
      const contentWords = fileData.content
        .split(/\s+/)
        .filter(word => word.length >= 4)
        .map(word => word.toLowerCase())
        .slice(0, 50); // Limit to first 50 significant words
      
      terms.push(...contentWords);
    }
    
    return [...new Set(terms)]; // Remove duplicates
  },
  
  // Process a text file (plain text, markdown, etc.)
  async processTextFile(fileData) {
    console.log('Processing text file...');
    
    // Extract key information from content if it's a string
    if (typeof fileData.content === 'string') {
      // Detect document type based on content
      fileData.documentType = DocumentStorage.detectDocumentType(fileData);
      
      // Create a preview
      fileData.preview = fileData.content.substring(0, 200) + 
        (fileData.content.length > 200 ? '...' : '');
      
      // Extract potential metadata
      const metadata = this.extractMetadataFromText(fileData.content);
      if (metadata) {
        fileData.metadata = {
          ...(fileData.metadata || {}),
          ...metadata
        };
      }
    }
    
    return fileData;
  },
  
  // Process a PDF file
  async processPdfFile(fileData) {
    console.log('Processing PDF file...');
    
    // Add PDF-specific metadata
    fileData.metadata = {
      ...(fileData.metadata || {}),
      contentType: 'pdf'
    };
    
    // Extract text if possible from base64 PDF data
    if (fileData.content && fileData.content.startsWith('data:application/pdf;base64,')) {
      try {
        // In a real implementation, you would use a PDF parsing library like pdf.js
        // Here's how you might implement it with pdf.js:
        /*
        import * as pdfjsLib from 'pdfjs-dist/build/pdf';
        
        // Get the base64 data without the prefix
        const base64Data = fileData.content.replace(/^data:application\/pdf;base64,/, '');
        const binaryData = atob(base64Data);
        
        // Convert binary data to Uint8Array
        const len = binaryData.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryData.charCodeAt(i);
        }
        
        // Load the PDF document
        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const pdf = await loadingTask.promise;
        
        // Extract text from all pages
        let extractedText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          extractedText += pageText + '\n\n';
        }
        
        fileData.extractedText = extractedText;
        */
        
        // For now, just log that text extraction would happen here
        console.log('PDF text extraction would be performed here with a PDF library');
        
        // Set empty extracted text or assign a dummy section structure for demonstration
        // Don't use plaintext explanations that would be saved to the database
        fileData.extractedText = '';
      } catch (error) {
        console.error('Error extracting text from PDF:', error);
      }
    }
    
    // Since we can't easily extract text from PDF in this setup,
    // rely on filename for document type detection
    fileData.documentType = DocumentStorage.detectDocumentType(fileData);
    
    return fileData;
  },
  
  // Process an image file
  async processImageFile(fileData) {
    console.log('Processing image file...');
    
    // Add image-specific metadata
    fileData.metadata = {
      ...(fileData.metadata || {}),
      contentType: 'image',
      format: fileData.mimeType.split('/')[1]
    };
    
    // Use filename to determine document type
    fileData.documentType = DocumentStorage.detectDocumentType(fileData);
    
    return fileData;
  },
  
  // Process any other file type
  async processGenericFile(fileData) {
    console.log('Processing generic file...');
    
    // Use filename to determine document type
    fileData.documentType = DocumentStorage.detectDocumentType(fileData);
    
    return fileData;
  },
  
  // Helper: Extract metadata from text content
  extractMetadataFromText(text) {
    const metadata = {};
    
    // Look for potential patient information
    const patientNameMatch = text.match(/patient(?:\s+name)?[:=\s]+([^\n,]+)/i);
    if (patientNameMatch) {
      metadata.patientName = patientNameMatch[1].trim();
    }
    
    // Look for dates
    const dateMatches = text.match(/date[:=\s]+([^\n,]+)/gi);
    if (dateMatches && dateMatches.length > 0) {
      metadata.dates = dateMatches.map(match => {
        return match.replace(/date[:=\s]+/i, '').trim();
      });
    }
    
    // Look for diagnoses in medical documents
    const diagnosisMatch = text.match(/diagnosis[:=\s]+([^\n,]+)/i);
    if (diagnosisMatch) {
      metadata.diagnosis = diagnosisMatch[1].trim();
    }
    
    return Object.keys(metadata).length > 0 ? metadata : null;
  }
};

// Register methods
Meteor.methods({
  async 'files.process'(fileData) {
    if (!fileData || typeof fileData !== 'object') {
      throw new Meteor.Error('invalid-file', 'File data must be an object');
    }
    
    return await FileHooks.processFile(fileData);
  },
  
  async 'files.findByName'(filename) {
    try {
      console.log(`Looking for file: ${filename}`);
      
      // Search both standard documents and document registry
      const documents = await DocumentStorage.findDocuments({ 
        $or: [
          { filename: { $regex: filename, $options: 'i' } },
          { originalFilename: { $regex: filename, $options: 'i' } }
        ]
      });
      
      if (documents && documents.length > 0) {
        console.log(`Found ${documents.length} matching documents`);
        return documents;
      }
      
      // If not found in main collection, try registry
      const registryDocuments = await DocumentStorage.findDocuments({ 
        $or: [
          { filename: { $regex: filename, $options: 'i' } },
          { originalFilename: { $regex: filename, $options: 'i' } }
        ]
      }, { collection: 'documentRegistry' });
      
      if (registryDocuments && registryDocuments.length > 0) {
        console.log(`Found ${registryDocuments.length} matching documents in registry`);
        
        // Try to fetch full documents based on registry info
        const fullDocuments = await Promise.all(
          registryDocuments.map(async (regDoc) => {
            try {
              const docs = await DocumentStorage.findDocuments({ 
                filename: regDoc.filename 
              });
              return docs[0] || regDoc;
            } catch (error) {
              return regDoc;
            }
          })
        );
        
        return fullDocuments.filter(Boolean);
      }
      
      console.log('No matching documents found');
      return [];
    } catch (error) {
      console.error('Error finding file by name:', error);
      throw new Meteor.Error('file-find-error', error.message);
    }
  }
});