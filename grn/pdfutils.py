# File: debitnote/pdf_utils.py
"""
PDF generation utilities for debit notes
"""
import io
from datetime import datetime
from typing import Optional, Any
from reportlab.lib.pagesizes import A4
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


def generate_debit_note_pdf_content(sanitized_note: dict) -> bytes:
    """
    Generate PDF content for a debit note
    """
    try:
        # Create PDF in memory
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=20*mm,
            leftMargin=20*mm,
            topMargin=20*mm,
            bottomMargin=20*mm
        )
        
        # Get styles
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=16,
            spaceAfter=12,
            alignment=1  # Center
        )
        
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=12,
            spaceAfter=6
        )
        
        normal_style = styles['Normal']
        
        # Build PDF content
        content = []
        
        # Title
        is_amount_only = sanitized_note.get("isAmountOnly", False) or sanitized_note.get("noteType") == "amount_only"
        title_text = "Amount-Only Debit Note" if is_amount_only else "Debit/Credit Note"
        content.append(Paragraph(title_text, title_style))
        content.append(Spacer(1, 10))
        
        # Note Details Section
        content.append(Paragraph("Note Details", heading_style))
        
        # Create note details table
        note_details_data = [
            ["Note ID:", sanitized_note.get("noteId", "N/A")],
            ["Document Type:", sanitized_note.get("documentType", "N/A").replace("_", " ").title()],
            ["Vendor Name:", sanitized_note.get("vendorName", "N/A")],
            ["Created Date:", format_date_for_display(sanitized_note.get("createdDate"))],
            ["Created By:", sanitized_note.get("createdBy", "N/A")],
            ["Status:", sanitized_note.get("status", "Active")],
            ["Note Type:", "Amount-only" if is_amount_only else "Item-wise"],
        ]
        
        # Add reason if available
        reason = sanitized_note.get("reason")
        if reason:
            note_details_data.append(["Reason:", reason])
        
        # Add remaining payable amount if available
        remaining_amount = sanitized_note.get("remainingPayableAmount")
        if remaining_amount is not None:
            note_details_data.append(["Remaining Payable:", f"₹{remaining_amount:,.2f}"])
        
        note_table = Table(note_details_data, colWidths=[100, 300])
        note_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
        ]))
        
        content.append(note_table)
        content.append(Spacer(1, 15))
        
        # Financial Summary
        content.append(Paragraph("Financial Summary", heading_style))
        
        total_amount = sanitized_note.get("totalAmount", 0)
        final_amount = sanitized_note.get("finalAmount", total_amount)
        total_tax = sanitized_note.get("totalTax", 0)
        total_discount = sanitized_note.get("totalDiscount", 0)
        
        financial_data = [
            ["Description", "Amount (₹)"],
            ["Total Amount", f"{total_amount:,.2f}"],
            ["Total Tax", f"{total_tax:,.2f}"],
            ["Total Discount", f"{total_discount:,.2f}"],
            ["Final Amount", f"{final_amount:,.2f}"]
        ]
        
        financial_table = Table(financial_data, colWidths=[200, 200])
        financial_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('BACKGROUND', (0, 0), (-1, 0), colors.lightblue),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('ALIGN', (1, 1), (-1, -1), 'RIGHT'),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('BACKGROUND', (0, -1), (-1, -1), colors.lightgreen),
        ]))
        
        content.append(financial_table)
        content.append(Spacer(1, 15))
        
        # Item Details (for item-wise notes)
        if not is_amount_only and sanitized_note.get("itemDetails"):
            content.append(Paragraph("Item Details", heading_style))
            
            item_headers = ["S.No", "Item Name", "Type", "Quantity", "Unit Price", "Total Price", "Tax", "Final Price"]
            item_data = [item_headers]
            
            for idx, item in enumerate(sanitized_note.get("itemDetails", []), 1):
                item_row = [
                    str(idx),
                    item.get("itemName", "N/A"),
                    item.get("noteType", "debit").title(),
                    f"{item.get('quantity', 0):,.2f}",
                    f"₹{item.get('unitPrice', 0):,.2f}",
                    f"₹{item.get('totalPrice', 0):,.2f}",
                    f"₹{item.get('taxAmount', 0):,.2f}",
                    f"₹{item.get('finalPrice', 0):,.2f}",
                ]
                item_data.append(item_row)
            
            item_table = Table(item_data, colWidths=[30, 120, 50, 50, 60, 70, 50, 70])
            item_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ('BACKGROUND', (0, 0), (-1, 0), colors.lightblue),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
                ('ALIGN', (3, 1), (7, -1), 'RIGHT'),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.whitesmoke]),
            ]))
            
            content.append(item_table)
            content.append(Spacer(1, 10))
        
        # For amount-only notes, show a simple description
        elif is_amount_only:
            content.append(Paragraph("Description", heading_style))
            desc_text = f"This is an amount-only debit note for ₹{final_amount:,.2f}"
            if reason:
                desc_text += f" with reason: {reason}"
            content.append(Paragraph(desc_text, normal_style))
            content.append(Spacer(1, 10))
        
        # Source Document Information
        source_doc = sanitized_note.get("sourceDocument")
        if source_doc:
            content.append(Paragraph("Source Document Information", heading_style))
            
            source_data = [
                ["Document Type:", source_doc.get("type", "N/A").replace("_", " ").title()],
                ["Document ID:", source_doc.get("id", "N/A")],
                ["Vendor:", source_doc.get("vendorName", "N/A")],
                ["Original Payable:", f"₹{source_doc.get('originalPayableAmount', 0):,.2f}"],
                ["Existing Notes:", str(source_doc.get("existingDebitNotesCount", 0))],
            ]
            
            source_table = Table(source_data, colWidths=[100, 300])
            source_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ]))
            
            content.append(source_table)
        
        # Footer
        content.append(Spacer(1, 20))
        footer_text = f"Generated on: {datetime.now().strftime('%d-%m-%Y %H:%M:%S')} | Computer Generated Document"
        content.append(Paragraph(footer_text, ParagraphStyle(
            'Footer',
            parent=styles['Normal'],
            fontSize=8,
            textColor=colors.grey,
            alignment=1
        )))
        
        # Build PDF
        doc.build(content)
        
        # Return PDF bytes
        buffer.seek(0)
        return buffer.getvalue()
        
    except Exception as e:
        logger.error(f"Error generating PDF content: {str(e)}")
        raise


def generate_all_notes_pdf_content(notes: list, document_id: str, document_type: str, vendor_name: str) -> bytes:
    """
    Generate PDF containing all debit notes for a document
    """
    try:
        # Create PDF in memory
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=20*mm,
            leftMargin=20*mm,
            topMargin=20*mm,
            bottomMargin=20*mm
        )
        
        # Get styles
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=16,
            spaceAfter=12,
            alignment=1
        )
        
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=12,
            spaceAfter=6
        )
        
        # Build PDF content
        content = []
        
        # Title
        content.append(Paragraph("Debit/Credit Notes Summary", title_style))
        
        # Document Information
        content.append(Paragraph(f"Document ID: {document_id}", heading_style))
        content.append(Paragraph(f"Document Type: {document_type.replace('_', ' ').title()}", heading_style))
        content.append(Paragraph(f"Vendor: {vendor_name}", heading_style))
        content.append(Spacer(1, 10))
        
        # Summary Statistics
        total_notes = len(notes)
        total_amount = sum(note.get("finalAmount", note.get("totalAmount", 0)) for note in notes)
        
        content.append(Paragraph(f"Total Notes: {total_notes}", heading_style))
        content.append(Paragraph(f"Total Amount: ₹{total_amount:,.2f}", heading_style))
        content.append(Spacer(1, 15))
        
        # List all notes
        for idx, note in enumerate(notes, 1):
            is_amount_only = note.get("isAmountOnly", False)
            
            # Note header
            note_type = "Amount-only" if is_amount_only else "Item-wise"
            note_title = f"Note {idx}: {note.get('noteId', 'N/A')} ({note_type})"
            content.append(Paragraph(note_title, heading_style))
            
            # Note details
            note_details = [
                ["Status:", note.get("status", "Active")],
                ["Created:", format_date_for_display(note.get("createdDate"))],
                ["Created By:", note.get("createdBy", "N/A")],
                ["Amount:", f"₹{note.get('finalAmount', 0):,.2f}"],
            ]
            
            if note.get("reason"):
                note_details.append(["Reason:", note.get("reason")])
            
            note_table = Table(note_details, colWidths=[80, 320])
            note_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ('BACKGROUND', (0, 0), (0, -1), colors.whitesmoke),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ]))
            
            content.append(note_table)
            content.append(Spacer(1, 10))
        
        # Footer
        content.append(Spacer(1, 20))
        footer_text = f"Generated on: {datetime.now().strftime('%d-%m-%Y %H:%M:%S')} | Total {total_notes} notes"
        content.append(Paragraph(footer_text, ParagraphStyle(
            'Footer',
            parent=styles['Normal'],
            fontSize=8,
            textColor=colors.grey,
            alignment=1
        )))
        
        # Build PDF
        doc.build(content)
        
        # Return PDF bytes
        buffer.seek(0)
        return buffer.getvalue()
        
    except Exception as e:
        logger.error(f"Error generating all notes PDF: {str(e)}")
        raise