# File: debitnote/pdf_utils.py
"""
PDF generation utilities for debit notes
"""
import io
from datetime import datetime
import traceback
from fastapi import Request
from typing import Optional, Any
from reportlab.lib.pagesizes import A4,letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
import logging

logger = logging.getLogger(__name__)


def format_date_for_display(date_value: Any) -> str:
    """
    Format date for display in PDF
    """
    if not date_value:
        return "N/A"
    
    try:
        if isinstance(date_value, str):
            # Try to parse ISO format
            if 'Z' in date_value:
                date_value = date_value.replace('Z', '+00:00')
            date_value = datetime.fromisoformat(date_value)
        
        if isinstance(date_value, datetime):
            return date_value.strftime("%d-%m-%Y %H:%M:%S")
        
        return str(date_value)
    except Exception as e:
        logger.warning(f"Failed to format date {date_value}: {e}")
        return str(date_value)
def generate_debit_note_pdf_content(note: dict) -> bytes:
    """Generate PDF for a specific debit/credit note with proper formatting"""
    try:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, 
                               topMargin=72, bottomMargin=72,
                               leftMargin=72, rightMargin=72)
        
        # Styles
        styles = getSampleStyleSheet()
        
        # Custom styles
        title_style = ParagraphStyle(
            'TitleStyle',
            parent=styles['Heading1'],
            fontSize=18,
            textColor=colors.HexColor('#1a237e'),
            spaceAfter=20,
            alignment=1
        )
        
        subtitle_style = ParagraphStyle(
            'SubtitleStyle',
            parent=styles['Heading2'],
            fontSize=12,
            textColor=colors.HexColor('#283593'),
            spaceAfter=10
        )
        
        normal_style = ParagraphStyle(
            'NormalStyle',
            parent=styles['Normal'],
            fontSize=10,
            spaceAfter=6
        )
        
        bold_style = ParagraphStyle(
            'BoldStyle',
            parent=styles['Normal'],
            fontSize=10,
            fontName='Helvetica-Bold'
        )
        
        header_style = ParagraphStyle(
            'HeaderStyle',
            parent=styles['Normal'],
            fontSize=10,
            fontName='Helvetica-Bold',
            textColor=colors.white,
            alignment=1
        )
        
        story = []
        
        # Title
        title_text = "DEBIT NOTE"
        story.append(Paragraph(title_text, title_style))
        
        # Separator line
        story.append(Spacer(1, 10))
        story.append(Paragraph("<hr/>", styles['Normal']))
        story.append(Spacer(1, 20))
        
        # Company Info
        company_info = [
            ["Company Name:", "Your Company Name"],
            ["Address:", "Your Company Address"],
            ["City, State, ZIP:", "City, State, ZIP Code"],
            ["GST Number:", "GSTIN Number Here"],
            ["Contact:", "Phone: +91-XXXXXXXXXX | Email: info@company.com"]
        ]
        
        company_table = Table(company_info, colWidths=[120, 300])
        company_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        story.append(company_table)
        story.append(Spacer(1, 20))
        
        # Debit Note Details
        note_details = [
            ["Debit Note No:", note.get("noteId", "N/A")],
            ["Date:", note.get("createdDate", datetime.now()).strftime("%d %B %Y")],
            ["Status:", note.get("status", "Active")],
            ["Type:", "Amount Only" if note.get("isAmountOnly", False) else "Item Wise"],
            ["Vendor:", note.get("vendorName", "N/A")],
            ["Source Document:", note.get("sourceDocumentRef", "N/A")]
        ]
        
        if note.get("reason"):
            note_details.append(["Reason:", note.get("reason")])
        
        note_table = Table(note_details, colWidths=[120, 300])
        note_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f5f5f5')),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(note_table)
        story.append(Spacer(1, 30))
        
        # Items Table
        story.append(Paragraph("Item Details", subtitle_style))
        
        item_details = note.get("itemDetails", [])
        if note.get("isAmountOnly"):
            # Amount-only note - simplified table
            table_data = [
                [Paragraph("Description", header_style), 
                 Paragraph("Quantity", header_style), 
                 Paragraph("Unit Price (₹)", header_style), 
                 Paragraph("Total Amount (₹)", header_style)]
            ]
            
            table_data.append([
                Paragraph(note.get("reason", "Amount Adjustment"), normal_style),
                Paragraph("1", normal_style),
                Paragraph(f"{note.get('totalAmount', 0):,.2f}", normal_style),
                Paragraph(f"{note.get('totalAmount', 0):,.2f}", normal_style)
            ])
            
            col_widths = [250, 70, 90, 90]
        else:
            # Item-wise note - detailed table
            table_data = [
                [Paragraph("Item ID", header_style), 
                 Paragraph("Item Name", header_style), 
                 Paragraph("Quantity", header_style), 
                 Paragraph("Unit Price (₹)", header_style), 
                 Paragraph("Total (₹)", header_style),
                 Paragraph("Reason", header_style)]
            ]
            
            for item in item_details:
                table_data.append([
                    Paragraph(item.get("itemId", ""), normal_style),
                    Paragraph(item.get("itemName", ""), normal_style),
                    Paragraph(f"{item.get('quantity', 0):,.2f}", normal_style),
                    Paragraph(f"{item.get('unitPrice', 0):,.2f}", normal_style),
                    Paragraph(f"{item.get('totalPrice', 0):,.2f}", normal_style),
                    Paragraph(item.get("reason", ""), normal_style)
                ])
            
            col_widths = [80, 150, 60, 80, 80, 80]
        
        items_table = Table(table_data, colWidths=col_widths)
        items_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3f51b5')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e0e0e0')),
            ('ALIGN', (2, 1), (-2, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(items_table)
        story.append(Spacer(1, 30))
        
        # Amount Summary
        story.append(Paragraph("Amount Summary", subtitle_style))
        
        total_amount = note.get("totalAmount", 0)
        final_amount = note.get("finalAmount", total_amount)
        pending_amount = note.get("pendingAmount", final_amount)
        
        summary_data = [
            ["Total Amount:", f"₹{total_amount:,.2f}"],
            ["Final Amount:", f"₹{final_amount:,.2f}"],
            ["Pending Amount:", f"₹{pending_amount:,.2f}"],
        ]
        
        if note.get("remainingPayableAmount") is not None:
            summary_data.append(["Remaining Payable:", f"₹{note.get('remainingPayableAmount'):,.2f}"])
        
        summary_table = Table(summary_data, colWidths=[150, 150])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f5f5f5')),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('PADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(summary_table)
        story.append(Spacer(1, 30))
        
        # Payment History (if any)
        payment_history = note.get("paymentHistory", [])
        if payment_history:
            story.append(Paragraph("Payment History", subtitle_style))
            
            payment_data = [
                [Paragraph("Date", header_style), 
                 Paragraph("Payment ID", header_style), 
                 Paragraph("Cleared By", header_style), 
                 Paragraph("Amount (₹)", header_style)]
            ]
            
            for payment in payment_history:
                payment_date = payment.get("date", datetime.now())
                if isinstance(payment_date, str):
                    try:
                        payment_date = datetime.fromisoformat(payment_date.replace('Z', '+00:00'))
                    except:
                        payment_date = datetime.now()
                
                payment_data.append([
                    Paragraph(payment_date.strftime("%d-%m-%Y"), normal_style),
                    Paragraph(payment.get("outgoingPaymentId", "N/A"), normal_style),
                    Paragraph(payment.get("clearedBy", "N/A"), normal_style),
                    Paragraph(f"{payment.get('amount', 0):,.2f}", normal_style)
                ])
            
            payment_table = Table(payment_data, colWidths=[80, 120, 100, 100])
            payment_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4caf50')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.white),
                ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e0e0e0')),
                ('ALIGN', (3, 1), (3, -1), 'RIGHT'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('PADDING', (0, 0), (-1, -1), 6),
            ]))
            story.append(payment_table)
            story.append(Spacer(1, 20))
        
        # Footer
        story.append(Spacer(1, 40))
        story.append(Paragraph("<hr/>", styles['Normal']))
        story.append(Spacer(1, 10))
        
        footer_text = "This is a computer-generated document and does not require a signature."
        story.append(Paragraph(footer_text, ParagraphStyle(
            'FooterStyle',
            parent=styles['Normal'],
            fontSize=9,
            textColor=colors.grey,
            alignment=1
        )))
        
        # Build PDF
        doc.build(story)
        return buffer.getvalue()
        
    except Exception as e:
        logger.error(f"Error in generate_debit_note_pdf_content: {str(e)}\n{traceback.format_exc()}")
        # Return a simple PDF with error message
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        story = []
        story.append(Paragraph("Error Generating Debit Note PDF", ParagraphStyle(
            'Error',
            parent=getSampleStyleSheet()['Heading1'],
            fontSize=16,
            textColor=colors.red
        )))
        story.append(Paragraph(f"Error: {str(e)}", getSampleStyleSheet()['Normal']))
        doc.build(story)
        return buffer.getvalue()
def generate_all_notes_pdf_content(notes, document_id, document_type, vendor_name, 
                                   source_doc_ref, original_amount):
    """Generate PDF for ALL debit notes with proper alignment"""
    try:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, 
                               topMargin=72, bottomMargin=72,
                               leftMargin=72, rightMargin=72)
        
        # Styles
        styles = getSampleStyleSheet()
        
        title_style = ParagraphStyle(
            'TitleStyle',
            parent=styles['Heading1'],
            fontSize=18,
            textColor=colors.HexColor('#1a237e'),
            spaceAfter=20,
            alignment=1
        )
        
        subtitle_style = ParagraphStyle(
            'SubtitleStyle',
            parent=styles['Heading2'],
            fontSize=14,
            textColor=colors.HexColor('#283593'),
            spaceAfter=10
        )
        
        normal_style = ParagraphStyle(
            'NormalStyle',
            parent=styles['Normal'],
            fontSize=10,
            spaceAfter=6
        )
        
        header_style = ParagraphStyle(
            'HeaderStyle',
            parent=styles['Normal'],
            fontSize=10,
            fontName='Helvetica-Bold',
            textColor=colors.white,
            alignment=1
        )
        
        story = []
        
        # Title
        doc_type_formatted = document_type.replace("_", " ").title()
        title_text = f"ALL DEBIT NOTES - {doc_type_formatted}"
        story.append(Paragraph(title_text, title_style))
        
        # Document Info Table
        info_data = [
            [Paragraph("Document Reference", header_style), 
             Paragraph("Document Type", header_style), 
             Paragraph("Vendor", header_style),
             Paragraph("Original Amount", header_style)],
            [
                Paragraph(source_doc_ref or "N/A", normal_style),
                Paragraph(doc_type_formatted, normal_style),
                Paragraph(vendor_name or "N/A", normal_style),
                Paragraph(f"₹{original_amount:,.2f}", normal_style)
            ]
        ]
        
        info_table = Table(info_data, colWidths=[120, 100, 120, 120])
        info_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3f51b5')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e0e0e0')),
            ('ALIGN', (3, 1), (3, 1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('PADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(info_table)
        story.append(Spacer(1, 30))
        
        # Summary Section
        story.append(Paragraph("Summary", subtitle_style))
        
        total_amount = sum(n.get("finalAmount", n.get("totalAmount", 0)) for n in notes)
        item_wise_count = sum(1 for n in notes if n.get("noteType") == "item_wise" or not n.get("isAmountOnly"))
        amount_only_count = sum(1 for n in notes if n.get("noteType") == "amount_only" or n.get("isAmountOnly"))
        active_count = sum(1 for n in notes if n.get("status") != "Cleared")
        cleared_count = sum(1 for n in notes if n.get("status") == "Cleared")
        
        summary_data = [
            ["Total Notes:", str(len(notes))],
            ["Item-wise Notes:", str(item_wise_count)],
            ["Amount-only Notes:", str(amount_only_count)],
            ["Active Notes:", str(active_count)],
            ["Cleared Notes:", str(cleared_count)],
            ["Total Debit Amount:", f"₹{total_amount:,.2f}"],
            ["Available Amount:", f"₹{(original_amount - total_amount):,.2f}"]
        ]
        
        summary_table = Table(summary_data, colWidths=[150, 100])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f5f5f5')),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(summary_table)
        story.append(Spacer(1, 30))
        
        # Individual Notes Section
        story.append(Paragraph("Individual Debit Notes", subtitle_style))
        story.append(Spacer(1, 10))
        
        for i, note in enumerate(notes, 1):
            # Note Header
            note_header = f"Note {i}: {note.get('noteId', 'N/A')}"
            story.append(Paragraph(note_header, ParagraphStyle(
                'NoteHeader',
                parent=styles['Heading3'],
                fontSize=12,
                textColor=colors.HexColor('#3949ab'),
                spaceAfter=6
            )))
            
            # Note Details Table
            note_type = "Item-wise" if note.get("noteType") == "item_wise" else "Amount-only"
            created_date = note.get("createdDate", datetime.now())
            if isinstance(created_date, str):
                try:
                    created_date = datetime.fromisoformat(created_date.replace('Z', '+00:00'))
                except:
                    created_date = datetime.now()
            
            note_details = [
                ["Type:", note_type],
                ["Status:", note.get("status", "Active")],
                ["Amount:", f"₹{note.get('finalAmount', 0):,.2f}"],
                ["Created:", created_date.strftime("%d %B %Y")],
            ]
            
            if note.get("reason"):
                note_details.append(["Reason:", note.get("reason")])
            
            note_table = Table(note_details, colWidths=[80, 320])
            note_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f8f9fa')),
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dee2e6')),
                ('PADDING', (0, 0), (-1, -1), 4),
            ]))
            story.append(note_table)
            story.append(Spacer(1, 15))
        
        # Footer
        story.append(Spacer(1, 40))
        story.append(Paragraph("<hr/>", styles['Normal']))
        story.append(Spacer(1, 10))
        
        footer_text = f"Generated on {datetime.now().strftime('%d %B %Y, %I:%M %p')}"
        story.append(Paragraph(footer_text, ParagraphStyle(
            'FooterStyle',
            parent=styles['Normal'],
            fontSize=9,
            textColor=colors.grey,
            alignment=1
        )))
        
        # Build PDF
        doc.build(story)
        return buffer.getvalue()
        
    except Exception as e:
        logger.error(f"Error in generate_all_notes_pdf_content: {str(e)}")
        raise