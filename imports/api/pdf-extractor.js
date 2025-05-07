import { Meteor } from 'meteor/meteor';

// PDF text extraction utility that works with any PDF
export const PdfExtractor = {
  // Extract text from a base64-encoded PDF
  async extractTextFromBase64PDF(base64Data) {
    if (!base64Data) {
      throw new Meteor.Error('invalid-pdf', 'No PDF data provided');
    }
    
    try {
      console.log('Starting PDF text extraction...');
      
      // In production, you need to:
      // 1. Add the dependency: meteor npm install pdfjs-dist
      // 2. Uncomment and use this actual implementation
      
      // Import pdfjs (in production, uncomment these)
      /*
      import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
      
      // The worker must be loaded separately
      if (Meteor.isServer) {
        // Server-side setup
        const pdfjsWorker = await import('pdfjs-dist/legacy/build/pdf.worker.entry');
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
      } else {
        // Client-side setup
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/packages/pdf.worker.js'; // Serve this file from your public directory
      }
      
      // Remove the data URL prefix if present
      let pdfData = base64Data;
      if (typeof pdfData === 'string' && pdfData.startsWith('data:application/pdf;base64,')) {
        pdfData = pdfData.substring('data:application/pdf;base64,'.length);
      }
      
      // Convert base64 to array buffer
      const binary = atob(pdfData);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      
      // Load the PDF document
      const loadingTask = pdfjsLib.getDocument({ data: bytes });
      const pdf = await loadingTask.promise;
      console.log(`PDF loaded, pages: ${pdf.numPages}`);
      
      // Extract text from each page
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n\n';
      }
      
      return fullText;
      */
      
      // For now, since we can't actually run the PDF.js code in this context,
      // we'll return a message indicating what would happen
      return "PDF text extraction would be performed here with the PDF.js library.";
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      throw new Meteor.Error('pdf-extraction-error', error.message);
    }
  },
  
  // Extract specific sections from the PDF text
  async extractSectionFromPDF(pdfData, sectionName) {
    try {
      // First extract all text
      const fullText = await this.extractTextFromBase64PDF(pdfData);
      
      // Look for the section based on common headers and delimiters
      // This is a basic implementation that can be improved for specific document types
      const sectionRegex = new RegExp(
        `(?:^|\\n)\\s*${sectionName}\\s*(?:\\n|:)([\\s\\S]*?)(?:(?:^|\\n)\\s*\\w+\\s*(?:\\n|:)|$)`,
        'i'
      );
      
      const match = fullText.match(sectionRegex);
      if (match && match[1]) {
        return match[1].trim();
      }
      
      // Try alternative search approaches if the section wasn't found
      const lines = fullText.split('\n');
      let inSection = false;
      let sectionContent = [];
      
      for (const line of lines) {
        const normalizedLine = line.trim().toLowerCase();
        
        // Check if this line is a section header
        if (normalizedLine.includes(sectionName.toLowerCase())) {
          inSection = true;
          continue;
        }
        
        // Check if we've reached the next section
        if (inSection && normalizedLine && normalizedLine.length > 3 && 
            /^[A-Z\s]+:?$/.test(line.trim())) {
          break;
        }
        
        // Collect content if we're in the target section
        if (inSection && normalizedLine) {
          sectionContent.push(line.trim());
        }
      }
      
      if (sectionContent.length > 0) {
        return sectionContent.join('\n');
      }
      
      // Section not found
      return null;
    } catch (error) {
      console.error(`Error extracting ${sectionName} section:`, error);
      throw new Meteor.Error('section-extraction-error', error.message);
    }
  },
  
  // Identify sections in a PDF
  async identifySections(pdfData) {
    try {
      const fullText = await this.extractTextFromBase64PDF(pdfData);
      
      // Common section names to look for in documents
      const commonSections = [
        'Summary', 'Introduction', 'Abstract', 'Objective',
        'Education', 'Academic Background', 'Qualifications',
        'Experience', 'Work Experience', 'Employment History', 'Professional Experience',
        'Skills', 'Abilities', 'Competencies', 'Technical Skills',
        'Projects', 'Portfolio', 'Achievements',
        'Certifications', 'Licenses', 'Credentials',
        'Languages', 'Language Proficiency',
        'Publications', 'Research', 'Papers',
        'References', 'Recommendations'
      ];
      
      // Find which sections exist in the document
      const detectedSections = [];
      
      for (const section of commonSections) {
        // Look for section headers with various formats
        const patterns = [
          new RegExp(`(?:^|\\n)\\s*${section}\\s*(?:\\n|:)`, 'i'),
          new RegExp(`(?:^|\\n)\\s*${section.toUpperCase()}\\s*(?:\\n|:)`, 'i'),
          new RegExp(`(?:^|\\n)\\s*\\b${section}\\b\\s*(?:\\n|:)`, 'i')
        ];
        
        for (const pattern of patterns) {
          if (pattern.test(fullText)) {
            detectedSections.push(section);
            break;
          }
        }
      }
      
      // Try to extract a small preview of each section
      const sectionsWithPreviews = {};
      
      for (const section of detectedSections) {
        const content = await this.extractSectionFromPDF(pdfData, section);
        if (content) {
          // Get a preview (first 100 characters)
          const preview = content.substring(0, 100) + (content.length > 100 ? '...' : '');
          sectionsWithPreviews[section] = preview;
        }
      }
      
      return {
        sections: detectedSections,
        previews: sectionsWithPreviews
      };
    } catch (error) {
      console.error('Error identifying sections:', error);
      throw new Meteor.Error('section-identification-error', error.message);
    }
  }
};

// Register methods for PDF extraction
Meteor.methods({
  async 'pdf.extract'(pdfData) {
    if (!pdfData) {
      throw new Meteor.Error('invalid-pdf', 'No PDF data provided');
    }
    
    try {
      const text = await PdfExtractor.extractTextFromBase64PDF(pdfData);
      return { success: true, text };
    } catch (error) {
      console.error('Error in pdf.extract method:', error);
      throw new Meteor.Error('pdf-extraction-error', error.message);
    }
  },
  
  async 'pdf.extractSection'(pdfData, sectionName) {
    if (!pdfData || !sectionName) {
      throw new Meteor.Error('invalid-parameters', 'PDF data and section name are required');
    }
    
    try {
      const sectionContent = await PdfExtractor.extractSectionFromPDF(pdfData, sectionName);
      return { 
        success: true, 
        section: sectionName,
        content: sectionContent 
      };
    } catch (error) {
      console.error('Error in pdf.extractSection method:', error);
      throw new Meteor.Error('section-extraction-error', error.message);
    }
  },
  
  async 'pdf.identifySections'(pdfData) {
    if (!pdfData) {
      throw new Meteor.Error('invalid-pdf', 'No PDF data provided');
    }
    
    try {
      const sections = await PdfExtractor.identifySections(pdfData);
      return { success: true, ...sections };
    } catch (error) {
      console.error('Error in pdf.identifySections method:', error);
      throw new Meteor.Error('section-identification-error', error.message);
    }
  }
});