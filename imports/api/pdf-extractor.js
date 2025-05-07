// imports/api/pdf-extractor.js
import { Meteor } from 'meteor/meteor';

// PDF text extraction utility that works with any document type
export const PdfExtractor = {
  // Extract text from a base64-encoded PDF
  async extractTextFromBase64PDF(base64Data) {
    if (!base64Data) {
      throw new Meteor.Error('invalid-pdf', 'No PDF data provided');
    }
    
    try {
      console.log('Starting PDF text extraction...');
      
      // Import pdfjs - using older version for compatibility
      const pdfjsLib = require('pdfjs-dist/build/pdf.js');
      
      // The worker must be loaded separately
      if (Meteor.isServer) {
        // Server-side setup - use the node version
        const pdfjsWorker = require('pdfjs-dist/build/pdf.worker.js');
        if (!globalThis.pdfjsWorker) {
          globalThis.pdfjsWorker = pdfjsWorker;
        }
      } else {
        // Client-side setup
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@2.14.305/build/pdf.worker.js';
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
      
      // Load the PDF document - using regular promises instead of Promise.await
      const loadingTask = pdfjsLib.getDocument({ data: bytes });
      const pdf = await loadingTask.promise; // Changed from Promise.await
      console.log(`PDF loaded, pages: ${pdf.numPages}`);
      
      // Extract text from each page - using regular promises
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i); // Changed from Promise.await
        const textContent = await page.getTextContent(); // Changed from Promise.await
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += `--- Page ${i} ---\n${pageText}\n\n`;
      }
      
      return fullText;
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      throw new Meteor.Error('pdf-extraction-error', error.message);
    }
  },
  
  // Extract specific sections from the PDF text based on section name
  async extractSectionFromPDF(pdfData, sectionName) {
    try {
      // First extract all text
      const fullText = await this.extractTextFromBase64PDF(pdfData);
      console.log(`Full text extracted, length: ${fullText.length} chars`);
      
      // Common section patterns in various document types
      const commonSections = {
        // Resume sections
        skills: ['skills', 'technical skills', 'core competencies', 'key skills', 'expertise'],
        experience: ['experience', 'work experience', 'professional experience', 'employment history'],
        education: ['education', 'academic background', 'qualifications'],
        
        // Report sections
        summary: ['summary', 'executive summary', 'abstract', 'overview'],
        introduction: ['introduction', 'background', 'context'],
        methodology: ['methodology', 'methods', 'approach', 'procedure'],
        results: ['results', 'findings', 'analysis', 'data analysis'],
        conclusion: ['conclusion', 'conclusions', 'final remarks'],
        recommendations: ['recommendations', 'next steps', 'proposed actions'],
        
        // Legal document sections
        parties: ['parties', 'between', 'this agreement'],
        terms: ['terms', 'conditions', 'provisions'],
        payment: ['payment', 'compensation', 'fees', 'financial terms'],
        
        // Academic paper sections
        abstract: ['abstract', 'summary'],
        literature: ['literature review', 'related work', 'previous work'],
        discussion: ['discussion', 'interpretation'],
        references: ['references', 'bibliography', 'works cited']
      };
      
      // Get the possible headers for the requested section
      const possibleHeaders = commonSections[sectionName.toLowerCase()] || [sectionName];
      
      // Try to find the section in the text
      let sectionContent = null;
      
      // Method 1: Regex-based section extraction
      for (const header of possibleHeaders) {
        if (sectionContent) break;
        
        // Different regex patterns to try
        const patterns = [
          // Section header followed by content until next section header
          new RegExp(`(?:^|\\n)\\s*(${header})\\s*(?:\\n|:)([\\s\\S]*?)(?:(?:^|\\n)\\s*[A-Z][A-Za-z\\s]+(?:\\n|:)|$)`, 'i'),
          
          // Section header with colon followed by content
          new RegExp(`(?:^|\\n)\\s*(${header})\\s*:([\\s\\S]*?)(?:(?:^|\\n)\\s*\\w+\\s*:|$)`, 'i'),
          
          // Section header with numbered or bullet points
          new RegExp(`(?:^|\\n)\\s*(${header})\\s*(?:\\n|:)([\\s\\S]*?)(?:(?:^|\\n)\\s*[\\d\\.\\-•\\*]\\s+|$)`, 'i')
        ];
        
        for (const pattern of patterns) {
          const match = fullText.match(pattern);
          if (match && match[2]) {
            sectionContent = match[2].trim();
            console.log(`Found section '${header}' using regex pattern`);
            break;
          }
        }
      }
      
      // Method 2: Line-by-line parsing approach
      if (!sectionContent) {
        console.log('Section not found using regex, trying line-by-line approach');
        const lines = fullText.split('\n');
        let inSection = false;
        let sectionLines = [];
        let currentSection = '';
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          const lineNormalized = line.toLowerCase();
          
          // Check if this line starts a new section
          for (const section in commonSections) {
            if (inSection && section !== sectionName.toLowerCase()) {
              // If we're already in our target section, check if this line starts a different section
              const isNewSection = commonSections[section].some(header =>
                lineNormalized.includes(header.toLowerCase()) &&
                (line.length < 50) // Section headers are typically short
              );
              
              if (isNewSection) {
                // We found the end of our section
                console.log(`Found end of section at line ${i}`);
                inSection = false;
                break;
              }
            } else if (!inSection && section === sectionName.toLowerCase()) {
              // If we're not in our section yet, check if this line starts our target section
              const isTargetSection = commonSections[section].some(header =>
                lineNormalized.includes(header.toLowerCase()) &&
                (line.length < 50)
              );
              
              if (isTargetSection) {
                inSection = true;
                currentSection = line;
                console.log(`Found section start at line ${i}: ${line}`);
                break;
              }
            }
          }
          
          // If we're in our target section, collect the line
          if (inSection && line !== currentSection) {
            sectionLines.push(line);
          }
        }
        
        if (sectionLines.length > 0) {
          sectionContent = sectionLines.join('\n');
        }
      }
      
      // Method 3: Keyword-based extraction
      if (!sectionContent) {
        console.log('Section not found using structured approach, trying keyword search');
        
        // Look for paragraphs containing keywords related to the section
        const keywords = possibleHeaders.concat([sectionName]);
        const paragraphs = fullText.split(/\n\s*\n/);
        
        const relevantParagraphs = paragraphs.filter(para => {
          const paraNormalized = para.toLowerCase();
          return keywords.some(keyword => paraNormalized.includes(keyword.toLowerCase()));
        });
        
        if (relevantParagraphs.length > 0) {
          sectionContent = relevantParagraphs.join('\n\n');
        }
      }
      
      return sectionContent || `No section named "${sectionName}" found in the document.`;
    } catch (error) {
      console.error(`Error extracting ${sectionName} section:`, error);
      throw new Meteor.Error('section-extraction-error', error.message);
    }
  },
  
  // Identify all sections in a PDF document
  async identifySections(pdfData) {
    try {
      const fullText = await this.extractTextFromBase64PDF(pdfData);
      
      // Common section names to look for in various document types
      const commonSectionPatterns = [
        // General document sections
        'summary', 'introduction', 'abstract', 'objective', 'background',
        'methodology', 'methods', 'approach', 'procedure',
        'results', 'findings', 'analysis', 'data',
        'discussion', 'interpretation', 'evaluation',
        'conclusion', 'recommendations', 'next steps',
        'references', 'bibliography', 'appendix', 'glossary',
        
        // Resume/CV sections
        'education', 'academic', 'qualifications',
        'experience', 'employment', 'work history', 'professional',
        'skills', 'abilities', 'competencies', 'technical skills',
        'projects', 'portfolio', 'achievements',
        'certifications', 'licenses', 'credentials',
        'languages', 'publications', 'research',
        
        // Business document sections
        'executive summary', 'purpose', 'scope', 'goals',
        'market analysis', 'competition', 'strategy',
        'implementation', 'timeline', 'budget', 'financials',
        'risks', 'assumptions', 'constraints',
        
        // Legal document sections
        'parties', 'terms', 'conditions', 'provisions',
        'payment', 'compensation', 'confidentiality',
        'termination', 'governing law', 'signatures'
      ];
      
      // Find which sections exist in the document
      const detectedSections = [];
      
      // Method 1: Check for formatted section headers
      const lines = fullText.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.length > 0 && line.length < 50) { // Section headers are typically short
          const lineNormalized = line.toLowerCase();
          
          for (const pattern of commonSectionPatterns) {
            if (lineNormalized.includes(pattern.toLowerCase())) {
              // Check if it looks like a header (uppercase, followed by empty line, etc.)
              const isLikelyHeader = line === line.toUpperCase() || 
                                    (i < lines.length - 1 && lines[i+1].trim() === '') ||
                                    /^\d+\.\s+\w+/.test(line) || // Numbered section
                                    /^[A-Z][a-z]+:/.test(line);  // Title with colon
                                    
              if (isLikelyHeader) {
                detectedSections.push(line);
                break;
              }
            }
          }
        }
      }
      
      // Method 2: Analyze document structure
      const paragraphs = fullText.split(/\n\s*\n/);
      const sectionParagraphMap = {};
      
      for (const section of detectedSections) {
        // Find the paragraph that starts with this section heading
        const sectionIndex = paragraphs.findIndex(p => p.trim().startsWith(section));
        
        if (sectionIndex >= 0 && sectionIndex < paragraphs.length - 1) {
          // Get the following paragraph as a preview
          sectionParagraphMap[section] = paragraphs[sectionIndex + 1].substring(0, 200) + 
                                        (paragraphs[sectionIndex + 1].length > 200 ? '...' : '');
        }
      }
      
      return {
        sections: detectedSections,
        previews: sectionParagraphMap,
        documentType: this.detectDocumentType(fullText, detectedSections)
      };
    } catch (error) {
      console.error('Error identifying sections:', error);
      throw new Meteor.Error('section-identification-error', error.message);
    }
  },
  
  // Try to detect the document type based on content and sections
  detectDocumentType(text, sections = []) {
    // Convert to lowercase for easier matching
    const lowerText = text.toLowerCase();
    const lowerSections = sections.map(s => s.toLowerCase());
    
    // Document type patterns
    const documentPatterns = {
      resume: ['resume', 'cv', 'curriculum vitae', 'work experience', 'education', 'skills', 'professional experience'],
      report: ['report', 'executive summary', 'findings', 'conclusion', 'recommendations'],
      business_plan: ['business plan', 'market analysis', 'financials', 'executive summary', 'competition'],
      research_paper: ['abstract', 'methodology', 'literature review', 'results', 'discussion', 'references'],
      legal: ['agreement', 'contract', 'terms', 'parties', 'provisions', 'governing law'],
      presentation: ['slide', 'presentation', 'agenda', 'introduction', 'thank you'],
      letter: ['dear', 'sincerely', 'regards', 'to whom it may concern'],
      invoice: ['invoice', 'bill', 'payment', 'amount due', 'total', 'paid', 'item', 'quantity', 'price'],
      manual: ['manual', 'guide', 'instructions', 'step', 'procedure', 'troubleshooting']
    };
    
    // Count matches for each document type
    const scores = {};
    
    for (const [type, patterns] of Object.entries(documentPatterns)) {
      scores[type] = 0;
      
      // Check text content
      for (const pattern of patterns) {
        if (lowerText.includes(pattern)) {
          scores[type] += 1;
        }
      }
      
      // Check sections
      for (const section of lowerSections) {
        for (const pattern of patterns) {
          if (section.includes(pattern)) {
            scores[type] += 2; // Sections are stronger indicators
          }
        }
      }
    }
    
    // Find the document type with the highest score
    let maxScore = 0;
    let detectedType = 'document'; // Default
    
    for (const [type, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        detectedType = type;
      }
    }
    
    return detectedType;
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