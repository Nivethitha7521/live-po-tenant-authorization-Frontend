from typing import List
from fastapi import APIRouter, HTTPException,Request
from fastapi.responses import StreamingResponse
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, PageBreak, KeepTogether, Frame, PageTemplate, BaseDocTemplate
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.pdfgen import canvas
import io
import requests
from datetime import datetime as dt
from PIL import Image as PilImage
from utils.database import get_image_collection
from reportlab.platypus.flowables import HRFlowable
import math

router = APIRouter()

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        canvas.Canvas.__init__(self, *args, **kwargs)
        self._saved_page_states = []
        self._page_number = 1

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state_index, page_state in enumerate(self._saved_page_states):
            self.__dict__.update(page_state)
            self._page_number = state_index + 1
            self.draw_page_number(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_number(self, page_count):
        y_position = 36  # Same y for both elements to place them on the same row
        
        # Page number at bottom right
        self.setFont("Helvetica", 9)
        self.drawRightString(A4[0] - 72, y_position, f"Page {self._page_number} of {page_count}")
        
        # "This is computer generated" centered on the same row
        self.setFont("Helvetica", 7)
        text = "This is computer generated"
        width = self.stringWidth(text, "Helvetica", 7)
        x = (A4[0] - width) / 2  # Center x position
        self.drawString(x, y_position, text)


def calculate_tax_breakdown(items):
    """Calculate proper tax breakdown from items based on taxType"""
    tax_data = {
        '0%': {'value': 0, 'cgst': 0, 'sgst': 0, 'igst': 0},
        '5%': {'value': 0, 'cgst': 0, 'sgst': 0, 'igst': 0},
        '12%': {'value': 0, 'cgst': 0, 'sgst': 0, 'igst': 0},
        '18%': {'value': 0, 'cgst': 0, 'sgst': 0, 'igst': 0},
        '28%': {'value': 0, 'cgst': 0, 'sgst': 0, 'igst': 0}
    }
    
    total_taxable_value = 0
    total_cgst = 0
    total_sgst = 0
    total_igst = 0
    
    for item in items:
        # Get unit price - try grnPrice first, then newPrice, then existingPrice
        unit_price = item.get('grnPrice') or item.get('newPrice') or item.get('existingPrice') or 0
        
        # Get quantity - for PO, we should use poQuantity or quantity (not pendingTotalQuantity for received items)
        # Since this is for PO display, we should show what was ordered, not what's pending
        quantity = item.get('poQuantity') or item.get('quantity') or 0
        
        taxable_value = unit_price * quantity
        total_taxable_value += taxable_value
        
        tax_percentage = item.get('taxPercentage', 0)
        tax_type = item.get('taxType', 'cgst_sgst')  # Default to cgst_sgst if not specified
        
        # Determine GST slab
        if tax_percentage == 0:
            slab = '0%'
        elif tax_percentage == 5:
            slab = '5%'
        elif tax_percentage == 12:
            slab = '12%'
        elif tax_percentage == 18:
            slab = '18%'
        elif tax_percentage == 28:
            slab = '28%'
        else:
            # For custom percentages, use the nearest standard slab
            if tax_percentage < 2.5:
                slab = '0%'
            elif tax_percentage < 8.5:
                slab = '5%'
            elif tax_percentage < 15:
                slab = '12%'
            elif tax_percentage < 23:
                slab = '18%'
            else:
                slab = '28%'
        
        # Calculate tax amounts based on taxType
        if tax_percentage > 0:
            if tax_type == 'cgst_sgst':
                # Split equally between CGST and SGST (half each)
                half_rate = tax_percentage / 2
                cgst_amount = (half_rate / 100) * taxable_value
                sgst_amount = (half_rate / 100) * taxable_value
                
                tax_data[slab]['value'] += taxable_value
                tax_data[slab]['cgst'] += cgst_amount
                tax_data[slab]['sgst'] += sgst_amount
                
                total_cgst += cgst_amount
                total_sgst += sgst_amount
                
            elif tax_type == 'igst':
                # Full percentage as IGST
                igst_amount = (tax_percentage / 100) * taxable_value
                
                tax_data[slab]['value'] += taxable_value
                tax_data[slab]['igst'] += igst_amount
                
                total_igst += igst_amount
            else:
                # For any other taxType, default to cgst_sgst
                half_rate = tax_percentage / 2
                cgst_amount = (half_rate / 100) * taxable_value
                sgst_amount = (half_rate / 100) * taxable_value
                
                tax_data[slab]['value'] += taxable_value
                tax_data[slab]['cgst'] += cgst_amount
                tax_data[slab]['sgst'] += sgst_amount
                
                total_cgst += cgst_amount
                total_sgst += sgst_amount
        else:
            # Zero tax items
            tax_data[slab]['value'] += taxable_value
    
    return {
        'tax_data': tax_data,
        'total_taxable_value': total_taxable_value,
        'total_cgst': total_cgst,
        'total_sgst': total_sgst,
        'total_igst': total_igst,
        'total_gst': total_cgst + total_sgst + total_igst
    }


def generate_terms_and_declaration_page(purchaseorder, doc):
    """Generate terms and declaration on a separate page"""
    elements = []
    styles = getSampleStyleSheet()
    
    # TERMS & CONDITIONS title
    terms_title = Paragraph('<b>Terms & Conditions</b>', ParagraphStyle(
        'TermsTitle',
        parent=styles['Normal'],
        fontSize=14,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#000080'),
        spaceAfter=12,
        alignment=TA_LEFT
    ))
    elements.append(terms_title)
    elements.append(Spacer(1, 10))
    
    # Static terms
    static_terms = [
        '1. Please quote our Purchase Order No. in your Delivery Note.',
        '2. Defective and excess quantity will not be accepted.',
        '3. Subject to Ramanathapuram Jurisdiction Only'
    ]
    
    for term in static_terms:
        elements.append(Paragraph(term, ParagraphStyle(
            'TermsText',
            parent=styles['Normal'],
            fontSize=10,
            spaceAfter=6,
            leftIndent=10,
            leading=12
        )))
    
    # Custom terms
    custom_terms = purchaseorder.get('termsandConditions', [])
    term_counter = 4
    
    if isinstance(custom_terms, list):
        for term in custom_terms:
            if term and isinstance(term, str):
                elements.append(Paragraph(f"{term_counter}. {term}", ParagraphStyle(
                    'TermsText',
                    parent=styles['Normal'],
                    fontSize=10,
                    spaceAfter=6,
                    leftIndent=10,
                    leading=12
                )))
                term_counter += 1
    elif isinstance(custom_terms, str) and custom_terms.strip():
        elements.append(Paragraph(f"{term_counter}. {custom_terms}", ParagraphStyle(
            'TermsText',
            parent=styles['Normal'],
            fontSize=10,
            spaceAfter=6,
            leftIndent=10,
            leading=12
        )))
    
    elements.append(Spacer(1, 30))
    
    # Declaration section
    declaration_title = Paragraph('<b>Declaration:</b>', ParagraphStyle(
        'DeclTitle',
        parent=styles['Normal'],
        fontSize=12,
        fontName='Helvetica-Bold',
        spaceAfter=8
    ))
    elements.append(declaration_title)
    
    declaration_text = 'We declare that this invoice shows the actual price of the described items and that all particulars are true and correct.'
    
    elements.append(Paragraph(declaration_text, ParagraphStyle(
        'DeclText',
        parent=styles['Normal'],
        fontSize=10,
        spaceAfter=40,
        leading=14
    )))
    
    # Authorized Signatory
    signature_table_data = [
        [Spacer(1, 40), Paragraph('<b>Authorized Signatory</b>', ParagraphStyle(
            'Signature',
            parent=styles['Normal'],
            fontSize=12,
            fontName='Helvetica-Bold',
            alignment=TA_RIGHT
        ))]
    ]
    
    signature_table = Table(signature_table_data, colWidths=[doc.width * 0.7, doc.width * 0.3])
    signature_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, 0), 'MIDDLE'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
    ]))
    
    elements.append(signature_table)
    
    return elements


def generate_purchase_order_pdf(purchaseorder: dict, vendor: dict, business: dict, po_images: List[str] = None) -> bytes:
    """Generate PDF matching frontend exactly with connected borders"""
   
    buffer = io.BytesIO()
   
    # Setup document - A4 size with increased bottom margin to avoid footer overlap
    footer_height = 0.5 * inch
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=10,
        leftMargin=10,
        topMargin=10,
        bottomMargin=10 + footer_height
    )
   
    elements = []
    styles = getSampleStyleSheet()
   
    # **STEP 1: PURCHASE ORDER title at the very top (centered)**
    po_title = Paragraph('<b><font size=18>PURCHASE ORDER</font></b>', ParagraphStyle(
        'TitleStyle',
        parent=styles['Heading1'],
        alignment=TA_CENTER,
        textColor=colors.HexColor('#000080'),
        spaceAfter=12
    ))
    elements.append(po_title)
    elements.append(Spacer(1, 5))  # Space after title
    
    # **STEP 2: Create table with logo on left and business details stacked one-by-one**
    
    # Load logo if available
    logo_cell = Spacer(30, 1)  # Empty spacer if no logo
    if business.get('imageUrl'):
        try:
            response = requests.get(business['imageUrl'], timeout=5)
            if response.status_code == 200:
                pil_img = PilImage.open(io.BytesIO(response.content))
                if pil_img.mode != 'RGB':
                    pil_img = pil_img.convert('RGB')
               
                img_buffer = io.BytesIO()
                pil_img.save(img_buffer, 'JPEG', quality=85)
                img_buffer.seek(0)
               
                # Create Image object with left padding
                logo_table = Table([[Image(img_buffer, width=80, height=80)]], 
                                  colWidths=[100])
                logo_table.setStyle(TableStyle([
                    ('LEFTPADDING', (0, 0), (0, 0), 20),
                    ('VALIGN', (0, 0), (0, 0), 'TOP'),
                ]))
                logo_cell = logo_table
        except Exception as e:
            print(f"Logo load error: {e}")
            empty_logo_table = Table([[Spacer(30, 1)]], colWidths=[100])
            empty_logo_table.setStyle(TableStyle([
                ('LEFTPADDING', (0, 0), (0, 0), 20),
            ]))
            logo_cell = empty_logo_table
    
    # Business details - stacked vertically
    business_lines = [
        f"<b><font size=12>{business.get('companyName', 'Best Mummy Sweet & Cakes')}</font></b>",
        f"<font size=9>{business.get('address1', 'No.72, Salai bazaar')}</font>",
        f"<font size=9>Tel.No: {business.get('phoneNo', '6385576161')}</font>",
        f"<font size=9>E-Mail: {business.get('emailId', 'purchase@bestmummy.co.in')}</font>",
        f"<font size=9>GSTIN: {business.get('gstIn', '33AATFB4124B12W')}</font>"
    ]
    
    business_detail_rows = []
    for line in business_lines:
        para = Paragraph(line, ParagraphStyle(
            'BusinessLine',
            parent=styles['Normal'],
            alignment=TA_LEFT,
            spaceAfter=0,
            leading=10
        ))
        business_detail_rows.append([para])
    
    business_detail_table = Table(business_detail_rows, colWidths=[doc.width * 0.5], rowHeights=15)
    business_detail_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    
    # Create the main header table
    header_table_data = [[
        logo_cell,
        Spacer(doc.width * 0.05, 1),
        business_detail_table
    ]]
    
    header_table = Table(header_table_data, colWidths=[doc.width * 0.25, doc.width * 0.05, doc.width * 0.7])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (0, 0), (0, 0), 'LEFT'),
        ('ALIGN', (2, 0), (2, 0), 'LEFT'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    
    elements.append(header_table)
    elements.append(Spacer(1, 10))
    
    # Vendor, Shipping, PO Details table
    col1_width = doc.width * 0.35
    col2_width = doc.width * 0.30
    col3_width = doc.width * 0.35
    
    # Format dates
    order_date = purchaseorder.get('orderDate', '')
    if isinstance(order_date, dt):
        order_date = order_date.strftime('%d-%m-%Y')
    elif isinstance(order_date, str) and order_date:
        try:
            if ' ' in order_date:
                date_part = order_date.split(' ')[0]
                order_date = dt.strptime(date_part, '%Y-%m-%d').strftime('%d-%m-%Y')
            elif 'T' in order_date:
                date_part = order_date.split('T')[0]
                order_date = dt.strptime(date_part, '%Y-%m-%d').strftime('%d-%m-%Y')
            elif '.' in order_date:
                date_part = order_date.split(' ')[0] if ' ' in order_date else order_date
                order_date = dt.strptime(date_part, '%Y-%m-%d').strftime('%d-%m-%Y')
            else:
                order_date = dt.strptime(order_date, '%Y-%m-%d').strftime('%d-%m-%Y')
        except Exception:
            order_date = '11-12-2025'
    
    due_date = purchaseorder.get('expectedDeliveryDate', '')
    if isinstance(due_date, dt):
        due_date = due_date.strftime('%d-%m-%Y')
    elif isinstance(due_date, str) and due_date:
        try:
            if ' ' in due_date:
                date_part = due_date.split(' ')[0]
                due_date = dt.strptime(date_part, '%Y-%m-%d').strftime('%d-%m-%Y')
            elif 'T' in due_date:
                date_part = due_date.split('T')[0]
                due_date = dt.strptime(date_part, '%Y-%m-%d').strftime('%d-%m-%Y')
            elif '.' in due_date:
                date_part = due_date.split(' ')[0] if ' ' in due_date else due_date
                due_date = dt.strptime(date_part, '%Y-%m-%d').strftime('%d-%m-%Y')
            else:
                due_date = dt.strptime(due_date, '%Y-%m-%d').strftime('%d-%m-%Y')
        except Exception:
            due_date = '11-12-2025'
    
    order_date = order_date or '11-12-2025'
    due_date = due_date or '11-12-2025'
    
    # Create vendor details table
    vendor_details_data = [
        [
            Paragraph('<b>Vendor Details</b>', ParagraphStyle('TableHeader', fontSize=10, fontName='Helvetica-Bold', textColor=colors.white, alignment=TA_LEFT)),
            Paragraph('<b>Shipping Address</b>', ParagraphStyle('TableHeader', fontSize=10, fontName='Helvetica-Bold', textColor=colors.white, alignment=TA_LEFT)),
            Paragraph('<b>PO Details</b>', ParagraphStyle('TableHeader', fontSize=10, fontName='Helvetica-Bold', textColor=colors.white, alignment=TA_LEFT))
        ],
        [
            Paragraph(f"""
            {vendor.get('vendorName', 'AS FRESH MART')}<br/>
            GSTIN: {vendor.get('gstNumber', 'NULL')}<br/>
            Address: {vendor.get('address', 'KARAIKUDI')}<br/>
            City: {vendor.get('city', 'Karaikudi')}<br/>
            State: {vendor.get('state', '')}<br/>
            Country: {vendor.get('country', '')}<br/>
            Email: {vendor.get('contactpersonEmail', '')}<br/>
            Phone: {vendor.get('contactpersonPhone', '')}
            """, ParagraphStyle('CellStyle', fontSize=8, leading=9, alignment=TA_LEFT)),
            
            Paragraph(f"{purchaseorder.get('shippingAddress', 'No: 95 B, GODOWN, DEVIPATTNAM, RAMANATHAPURAM')}", 
                     ParagraphStyle('CellStyle', fontSize=8, leading=9, alignment=TA_LEFT)),
            
            Paragraph(f"""
            PO No: {purchaseorder.get('randomId', 'P00009')}<br/>
            PO Date: {order_date}<br/>
            Due Date: {due_date}<br/>
            Payment Terms: {purchaseorder.get('paymentTerms', '7 days')}<br/>
            Status: {purchaseorder.get('poStatus', '')}<br/>
            Currency: INR
            """, ParagraphStyle('CellStyle', fontSize=8, leading=9, alignment=TA_LEFT))
        ]
    ]
    
    vendor_table = Table(vendor_details_data, colWidths=[col1_width, col2_width, col3_width])
    vendor_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#000080')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 4),
        ('TOPPADDING', (0, 0), (-1, 0), 4),
        ('ALIGN', (0, 0), (-1, 0), 'LEFT'),
        ('FONTSIZE', (0, 1), (-1, 1), 8),
        ('BOTTOMPADDING', (0, 1), (-1, 1), 2),
        ('TOPPADDING', (0, 1), (-1, 1), 2),
        ('LEFTPADDING', (0, 1), (-1, 1), 2),
        ('RIGHTPADDING', (0, 1), (-1, 1), 2),
        ('VALIGN', (0, 1), (-1, 1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    
    elements.append(vendor_table)
    elements.append(Spacer(1, 0))
    
    # ITEMS TABLE
    items_header = ['S No', 'Description', 'HsnCode', 'No of Packing', 'Qty', 'Po Qty', 'Unit Price', 'Tax', 'Amount']
    
    # For PO display, show ALL items (not filtering out received items)
    # This is a Purchase Order PDF, so we should show what was ordered
    filtered_items = purchaseorder.get('items', [])
    
    items_data = []
    for i, item in enumerate(filtered_items, 1):
        # For unit price - try grnPrice first, then newPrice, then existingPrice
        unit_price = item.get('newPrice') or 0
        
        # For PO quantity - use poQuantity or quantity
        quantity = item.get('pendingTotalQuantity') or 0
        
        # For display quantity (available/remaining) - use pendingQuantity or receivedQuantity or quantity
        display_qty = item.get('pendingQuantity') or 0
        
        total_amount = unit_price * quantity
        
        description = item.get('itemName', '')
        description_para = Paragraph(
            description, 
            ParagraphStyle(
                'ItemDescription',
                parent=styles['Normal'],
                fontSize=7,
                leading=8,
                alignment=TA_LEFT,
                wordWrap='CJK'
            )
        )
        
        items_data.append([
            str(i),
            description_para,
            item.get('hsnCode', ''),
            str(item.get('pendingCount', '')),  # Use count instead of pendingCount
            f"{display_qty} {item.get('uom', '')}",  # Display available/received quantity
            f"{quantity} {item.get('uom', '')}",  # PO quantity
            f"{unit_price:.2f}",
            f"{item.get('taxPercentage', 0)}%",
            f"{total_amount:.2f}"
        ])
    
    if items_data:
        total_width = doc.width
        col_widths = [
            total_width * 0.04,
            total_width * 0.27,
            total_width * 0.09,
            total_width * 0.13,
            total_width * 0.10,
            total_width * 0.10,
            total_width * 0.09,
            total_width * 0.08,
            total_width * 0.10,
        ]
        
        all_items_data = [items_header] + items_data
        
        items_table = Table(all_items_data, colWidths=col_widths, repeatRows=1)
        
        table_style = TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#000080')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 8),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 3),
            ('TOPPADDING', (0, 0), (-1, 0), 3),
            ('FONTSIZE', (0, 1), (-1, -1), 7),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 2),
            ('TOPPADDING', (0, 1), (-1, -1), 2),
            ('ALIGN', (0, 1), (-1, -1), 'CENTER'),
            ('ALIGN', (3, 1), (-1, -1), 'RIGHT'),
            ('VALIGN', (1, 1), (1, -1), 'TOP'),
            ('LEFTPADDING', (1, 1), (1, -1), 2),
            ('RIGHTPADDING', (1, 1), (1, -1), 2),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('LINEBELOW', (0, 0), (-1, 0), 1, colors.black),
        ])
        
        items_table.setStyle(table_style)
        elements.append(items_table)
        elements.append(Spacer(1, 0))
    
    # **UPDATED TAX SUMMARY WITH DETAILED BREAKDOWN**
    tax_breakdown = calculate_tax_breakdown(filtered_items)
    
    # Prepare tax summary data
    tax_summary_data = []
    
    # Calculate totals
    total_without_tax = tax_breakdown['total_taxable_value']
    total_discount = purchaseorder.get('totalDiscount', 0)
    total_freight_amount = purchaseorder.get('totalFreightAmount', 0)
    total_freight_tax_amount = purchaseorder.get('totalFreightTaxAmount', 0)
    
    # Add basic amounts
    tax_summary_data.append(['Total Amount', f"{total_without_tax:,.2f}"])
    
    if total_discount > 0:
        tax_summary_data.append(['Total Discount', f"{total_discount:,.2f}"])
    
    # Add freight amounts
    if total_freight_amount > 0:
        tax_summary_data.append(['Freight Amount', f"{total_freight_amount:,.2f}"])
    
    if total_freight_tax_amount > 0:
        tax_summary_data.append(['Freight Tax', f"{total_freight_tax_amount:,.2f}"])
    
    # CGST detailed breakdown
    cgst_parts = []
    total_cgst = 0
    gst_slabs = ['5%', '12%', '18%', '28%']
    for slab in gst_slabs:
        data = tax_breakdown['tax_data'][slab]
        if data['cgst'] > 0:
            half_rate = float(slab.replace('%', '')) / 2
            cgst_parts.append(f"@{half_rate}% : {data['cgst']:,.2f}")
            total_cgst += data['cgst']

    if cgst_parts:
        detail = " + ".join(cgst_parts)
        cgst_text = f"CGST {detail} → {total_cgst:,.2f}"
        cgst_para = Paragraph(cgst_text, ParagraphStyle('TaxDetail', fontSize=8, leading=10, alignment=TA_RIGHT))
        cgst_amt_para = Paragraph(f"{total_cgst:,.2f}", ParagraphStyle('TaxAmt', fontSize=8, alignment=TA_RIGHT))
        tax_summary_data.append([cgst_para, cgst_amt_para])

    # SGST detailed breakdown
    sgst_parts = []
    total_sgst = 0
    for slab in gst_slabs:
        data = tax_breakdown['tax_data'][slab]
        if data['sgst'] > 0:
            half_rate = float(slab.replace('%', '')) / 2
            sgst_parts.append(f"@{half_rate}% : {data['sgst']:,.2f}")
            total_sgst += data['sgst']

    if sgst_parts:
        detail = " + ".join(sgst_parts)
        sgst_text = f"SGST {detail} → {total_sgst:,.2f}"
        sgst_para = Paragraph(sgst_text, ParagraphStyle('TaxDetail', fontSize=8, leading=10, alignment=TA_RIGHT))
        sgst_amt_para = Paragraph(f"{total_sgst:,.2f}", ParagraphStyle('TaxAmt', fontSize=8, alignment=TA_RIGHT))
        tax_summary_data.append([sgst_para, sgst_amt_para])

    # IGST per slab
    for slab in gst_slabs:
        data = tax_breakdown['tax_data'][slab]
        if data['igst'] > 0:
            igst_text = f"IGST {slab}: {data['igst']:,.2f}"
            igst_para = Paragraph(igst_text, ParagraphStyle('TaxDetail', fontSize=8, leading=10, alignment=TA_RIGHT))
            igst_amt_para = Paragraph(f"{data['igst']:,.2f}", ParagraphStyle('TaxAmt', fontSize=8, alignment=TA_RIGHT))
            tax_summary_data.append([igst_para, igst_amt_para])

    # Calculate final total
    total_after_discount = total_without_tax - total_discount
    total_gst = tax_breakdown['total_gst']
    total_with_tax_and_freight = total_after_discount + total_freight_amount + total_freight_tax_amount + total_gst
    
    # Calculate rounded total
    rounded_total = round(total_with_tax_and_freight)
    round_off_amount = rounded_total - total_with_tax_and_freight
    
    # Add round off amount
    if abs(round_off_amount) > 0:
        tax_summary_data.append(['Round Off Amount', f"{round_off_amount:,.2f}"])
    
    # Add total amount in words
    try:
        from num2words import num2words
        amount_words = num2words(rounded_total, lang='en_IN').title()
        amount_words_text = f"<b>In Words:</b> {amount_words} Rupees Only [Including Tax]"
    except Exception:
        amount_words_text = f"<b>In Words:</b> {rounded_total:,} Rupees Only [Including Tax]"
    
    amount_words_para = Paragraph(
        amount_words_text,
        ParagraphStyle(
            'AmountWords',
            parent=styles['Normal'],
            fontSize=8,
            leading=10,
            alignment=TA_LEFT,
            wordWrap='CJK',
            leftIndent=5
        )
    )
    
    tax_summary_data.append([amount_words_para, f"{rounded_total:,.2f}"])
    
    # Create tax table
    tax_table = Table(tax_summary_data, colWidths=[doc.width * 0.75, doc.width * 0.25])
    
    # Apply table styles
    table_style = TableStyle([
        ('ALIGN', (0, 0), (0, -2), 'RIGHT'),
        ('ALIGN', (0, -1), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, -2), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -2), 8),
        ('FONTSIZE', (0, -1), (0, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('VALIGN', (0, -1), (0, -1), 'TOP'),
        ('BACKGROUND', (0, -1), (1, -1), colors.HexColor('#F0F0F0')),
    ])
    
    tax_table.setStyle(table_style)
    elements.append(tax_table)
    
    # **NO PageBreak() here - let terms flow naturally after tax summary**
    # Add some space before terms
    elements.append(Spacer(1, 10))
    
    # **Add terms and declaration page**
    terms_elements = generate_terms_and_declaration_page(purchaseorder, doc)
    elements.extend(terms_elements)
    
    # **PO Images (after terms/declaration, NO forced PageBreak)**
    if po_images and len(po_images) > 0:
        # Add a spacer before images
        elements.append(Spacer(1, 20))
        
        images_title = Paragraph('<b><font size=12>PO IMAGES</font></b>', ParagraphStyle(
            'ImagesTitle',
            parent=styles['Normal'],
            alignment=TA_CENTER,
            textColor=colors.HexColor('#000080'),
            spaceAfter=15
        ))
        elements.append(images_title)
        
        # Process images
        images_per_row = 2
        img_rows = [po_images[i:i + images_per_row] for i in range(0, len(po_images), images_per_row)]
        
        for img_row in img_rows:
            img_table_data = []
            img_row_cells = []
            
            for img_url in img_row:
                try:
                    response = requests.get(img_url, timeout=10)
                    if response.status_code == 200:
                        pil_img = PilImage.open(io.BytesIO(response.content))
                        if pil_img.mode != 'RGB':
                            pil_img = pil_img.convert('RGB')
                        
                        # Calculate dimensions
                        original_width, original_height = pil_img.size
                        aspect_ratio = original_height / original_width
                        
                        max_width = (doc.width / images_per_row) - 40
                        max_height = 150
                        
                        if original_width > max_width:
                            width = max_width
                            height = width * aspect_ratio
                            if height > max_height:
                                height = max_height
                                width = height / aspect_ratio
                        else:
                            width = original_width
                            height = original_height
                        
                        img_buffer = io.BytesIO()
                        pil_img.save(img_buffer, 'JPEG', quality=85)
                        img_buffer.seek(0)
                        
                        img = Image(img_buffer, width=width, height=height)
                        img_cell_content = [[img]]
                        img_cell = Table(img_cell_content, 
                                       colWidths=[width], 
                                       rowHeights=[height])
                        img_cell.setStyle(TableStyle([
                            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
                            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                        ]))
                        
                        img_row_cells.append(img_cell)
                    else:
                        error_cell = Paragraph("Image not available", 
                                            ParagraphStyle('ImageError', fontSize=7, alignment=TA_CENTER))
                        img_row_cells.append(error_cell)
                except Exception as e:
                    error_cell = Paragraph("Error loading", 
                                         ParagraphStyle('ImageError', fontSize=7, alignment=TA_CENTER))
                    img_row_cells.append(error_cell)
            
            while len(img_row_cells) < images_per_row:
                img_row_cells.append(Spacer(100, 100))
            
            img_table_data.append(img_row_cells)
            images_table = Table(img_table_data, 
                               colWidths=[doc.width/images_per_row]*images_per_row,
                               hAlign='CENTER')
            images_table.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ]))
            
            elements.append(images_table)
            elements.append(Spacer(1, 10))
    
    # Build PDF
    doc.build(elements, canvasmaker=NumberedCanvas)
    
    # Get PDF bytes
    pdf_bytes = buffer.getvalue()
    buffer.close()
    
    return pdf_bytes


@router.get("/view/{purchase_id}/{photo_index}")
async def get_photo(
    purchase_id: str,
    photo_index: int,
    request:Request
):
    tenant_id = request.state.tenant_id
    try:
        collection = get_image_collection(tenant_id)
        photo_document = collection.find_one({"_id": purchase_id})
        if not photo_document:
            raise HTTPException(status_code=404, detail="Photo document not found")
      
        photos = photo_document.get("photos", [])
        if photo_index > len(photos):
            raise HTTPException(status_code=404, detail="Photo index out of range")
      
        photo = photos[photo_index - 1]
        if photo.get("content"):
            content = photo["content"]
            media_type = "image/jpeg"
        else:
            ftp_path = photo.get("ftp_path")
            if not ftp_path:
                raise HTTPException(status_code=404, detail="No image data or URL found")
          
            response = requests.get(ftp_path, timeout=10)
            if response.status_code != 200:
                raise HTTPException(status_code=404, detail="Failed to fetch image from URL")
          
            content = response.content
            media_type = "image/webp" if ftp_path.lower().endswith('.webp') else "image/jpeg"
      
        return StreamingResponse(io.BytesIO(content), media_type=media_type)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/view/{purchase_id}")
async def get_photo_compat(purchase_id: str,request:Request):
    return await get_photo(purchase_id, 1,request)