// generatePDFTemplate.ts
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Define the interface for the PDF generation parameters
interface PDFData {
  title: string;
  content?: string; // optional content
  headers: string[][];
  rows: any[][];
  footer?: string; // optional footer
}

// Global function to generate a PDF
const generatePDF = ({ title, content, headers, rows, footer }: PDFData) => {
  const doc = new jsPDF();

  // Title
  doc.setFontSize(16);
  doc.text(title, 14, 10);  // Set title at top of the PDF

  // Content Text (can be dynamic)
  doc.setFontSize(12);
  if (content) {
    doc.text(content, 14, 20);  // Display content just below title
  }

  // Table headers and data (Dynamic based on page)
  doc.autoTable({
    head: headers,
    body: rows,
    startY: 30,  // Start the table below the content
    styles: {
      fillColor: [30, 144, 255],  // DodgerBlue color for headers
      textColor: [255, 255, 255], // White text color
    },
    headStyles: {
      fillColor: [30, 144, 255],
      textColor: [255, 255, 255],
    },
    bodyStyles: {
      fillColor: [255, 255, 255],  // White background for rows
      textColor: [0, 0, 0],         // Black text for rows
    },
    columnStyles: {
      4: { halign: 'right' },  // Right-align column 4
    },
  });

  // Footer content (optional)
  if (footer) {
    doc.setFontSize(10);
    doc.text(footer, 14, doc.autoTable.previous.finalY + 10);  // Add footer below the table
  }

  // Save the PDF with a dynamic name
  const pdfFilename = `${title.replace(/\s+/g, '')}.pdf`;
  doc.save(pdfFilename);
};

export default generatePDF;
