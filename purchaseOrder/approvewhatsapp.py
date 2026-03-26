from typing import List
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.pdfgen import canvas
import io
import requests
from datetime import datetime as dt
from PIL import Image as PilImage
import os
import base64

from utils.database import get_image_collection

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
        y_position = 36
        self.setFont("Helvetica", 9)
        self.drawRightString(A4[0] - 72, y_position, f"Page {self._page_number} of {page_count}")
        self.setFont("Helvetica", 7)
        text = "This is computer generated"
        width = self.stringWidth(text, "Helvetica", 7)
        x = (A4[0] - width) / 2
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
        unit_price = item.get('newPrice') or item.get('existingPrice') or 0
        quantity = item.get('poQuantity') or item.get('quantity') or 0
        
        taxable_value = unit_price * quantity
        total_taxable_value += taxable_value
        
        tax_percentage = item.get('taxPercentage', 0)
        tax_type = item.get('taxType', 'cgst_sgst')
        
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
        
        if tax_percentage > 0:
            if tax_type == 'cgst_sgst':
                half_rate = tax_percentage / 2
                cgst_amount = (half_rate / 100) * taxable_value
                sgst_amount = (half_rate / 100) * taxable_value
                
                tax_data[slab]['value'] += taxable_value
                tax_data[slab]['cgst'] += cgst_amount
                tax_data[slab]['sgst'] += sgst_amount
                
                total_cgst += cgst_amount
                total_sgst += sgst_amount
                
            elif tax_type == 'igst':
                igst_amount = (tax_percentage / 100) * taxable_value
                
                tax_data[slab]['value'] += taxable_value
                tax_data[slab]['igst'] += igst_amount
                
                total_igst += igst_amount
            else:
                half_rate = tax_percentage / 2
                cgst_amount = (half_rate / 100) * taxable_value
                sgst_amount = (half_rate / 100) * taxable_value
                
                tax_data[slab]['value'] += taxable_value
                tax_data[slab]['cgst'] += cgst_amount
                tax_data[slab]['sgst'] += sgst_amount
                
                total_cgst += cgst_amount
                total_sgst += sgst_amount
        else:
            tax_data[slab]['value'] += taxable_value
    
    return {
        'tax_data': tax_data,
        'total_taxable_value': total_taxable_value,
        'total_cgst': total_cgst,
        'total_sgst': total_sgst,
        'total_igst': total_igst,
        'total_gst': total_cgst + total_sgst + total_igst
    }


def generate_purchase_order_pdf(purchaseorder: dict, vendor: dict, business: dict, po_images: List[str] = None) -> bytes:
    """Generate PDF with proper logo, spacing and images"""
   
    buffer = io.BytesIO()
   
    margin = 0.5 * inch
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=margin,
        leftMargin=margin,
        topMargin=margin,
        bottomMargin=margin + 0.3 * inch
    )
   
    elements = []
    styles = getSampleStyleSheet()
   
    # PURCHASE ORDER title
    po_title = Paragraph('<b><font size=18>PURCHASE ORDER</font></b>', ParagraphStyle(
        'TitleStyle',
        parent=styles['Heading1'],
        alignment=TA_CENTER,
        textColor=colors.HexColor('#000080'),
        spaceAfter=0
    ))
    elements.append(po_title)
   
    # LOGO SECTION - FIXED: Better logo loading
    logo_cell = Spacer(80, 80)  # Default spacer
    
    # Debug print to see what's in business
    print(f"Business data received: {business}")
    print(f"Image URL: {business.get('imageUrl')}")
    
    # Try multiple ways to get logo
    image_url = None
    
    # Check various possible field names
    if business.get('imageUrl'):
        image_url = business['imageUrl']
    elif business.get('logo'):
        image_url = business['logo']
    elif business.get('logoUrl'):
        image_url = business['logoUrl']
    elif business.get('companyLogo'):
        image_url = business['companyLogo']
    
    if image_url:
        try:
            print(f"Attempting to load logo from: {image_url}")
            
            # Handle base64 encoded images
            if image_url.startswith('data:image'):
                # Extract base64 data
                header, encoded = image_url.split(',', 1)
                image_data = base64.b64decode(encoded)
                pil_img = PilImage.open(io.BytesIO(image_data))
            
            # Handle local file path
            elif os.path.exists(image_url):
                pil_img = PilImage.open(image_url)
            
            # Handle URL
            else:
                headers = {'User-Agent': 'Mozilla/5.0'}
                response = requests.get(image_url, timeout=15, headers=headers)
                
                if response.status_code == 200:
                    pil_img = PilImage.open(io.BytesIO(response.content))
                else:
                    print(f"Failed to fetch logo: {response.status_code}")
                    pil_img = None
            
            if pil_img:
                # Convert to RGB
                if pil_img.mode in ('RGBA', 'LA', 'P'):
                    bg = PilImage.new('RGB', pil_img.size, (255, 255, 255))
                    if pil_img.mode == 'P':
                        pil_img = pil_img.convert('RGBA')
                    bg.paste(pil_img, mask=pil_img.split()[-1] if pil_img.mode in ('RGBA', 'LA') else None)
                    pil_img = bg
                elif pil_img.mode != 'RGB':
                    pil_img = pil_img.convert('RGB')
                
                # Resize to fit nicely (max 80x80)
                pil_img.thumbnail((80, 80), PilImage.Resampling.LANCZOS)
                
                img_buffer = io.BytesIO()
                pil_img.save(img_buffer, 'JPEG', quality=95)
                img_buffer.seek(0)
                
                logo_img = Image(img_buffer, width=pil_img.width, height=pil_img.height)
                logo_cell = logo_img
                print("Logo loaded successfully")
                
        except Exception as e:
            print(f"Logo loading error: {e}")
            import traceback
            traceback.print_exc()
    
    # Business details
    business_lines = [
        f"<b><font size=12>{business.get('companyName', '')}</font></b>",
        f"<font size=9>{business.get('address1', '')}</font>",
        f"<font size=9>Tel.No: {business.get('phoneNo', '')}</font>",
        f"<font size=9>E-Mail: {business.get('emailId', '')}</font>",
        f"<font size=9>GSTIN: {business.get('gstIn', '')}</font>"
    ]
    
    business_detail_rows = []
    for line in business_lines:
        para = Paragraph(line, ParagraphStyle(
            'BusinessLine',
            parent=styles['Normal'],
            alignment=TA_LEFT,
            spaceAfter=0,
            leading=18
        ))
        business_detail_rows.append([para])
    
    business_detail_table = Table(business_detail_rows, colWidths=[doc.width * 0.6])
    business_detail_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    
    # Header table
    header_table_data = [[logo_cell, business_detail_table]]
    
    header_table = Table(header_table_data, colWidths=[doc.width * 0.25, doc.width * 0.75])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (0, 0), (0, 0), 'CENTER'),
        ('ALIGN', (1, 0), (1, 0), 'LEFT'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    
    elements.append(header_table)
    # ADD THIS SPACER - creates space after logo/header before vendor table
    elements.append(Spacer(1, 15))  # 15 points of space (adjust this value as needed)

    # Format dates
    order_date = purchaseorder.get('orderDate', '')
    if isinstance(order_date, dt):
        order_date = order_date.strftime('%d-%m-%Y')
    elif isinstance(order_date, str) and order_date:
        try:
            if 'T' in order_date:
                date_part = order_date.split('T')[0]
                order_date = dt.strptime(date_part, '%Y-%m-%d').strftime('%d-%m-%Y')
            else:
                order_date = dt.strptime(order_date[:10], '%Y-%m-%d').strftime('%d-%m-%Y')
        except:
            order_date = '15-03-2026'
    
    due_date = purchaseorder.get('expectedDeliveryDate', '')
    if isinstance(due_date, dt):
        due_date = due_date.strftime('%d-%m-%Y')
    elif isinstance(due_date, str) and due_date:
        try:
            if 'T' in due_date:
                date_part = due_date.split('T')[0]
                due_date = dt.strptime(date_part, '%Y-%m-%d').strftime('%d-%m-%Y')
            else:
                due_date = dt.strptime(due_date[:10], '%Y-%m-%d').strftime('%d-%m-%Y')
        except:
            due_date = '17-03-2026'
    
    # VENDOR DETAILS TABLE
    col_width = doc.width / 3
    
    vendor_name = vendor.get('vendorName', 'test')
    
    vendor_content = f"""
    <b>{vendor_name}</b><br/>
    GSTIN: {vendor.get('gstNumber', '')}<br/>
    Address: {vendor.get('address', '')}<br/>
    City: {vendor.get('city', '')}<br/>
    State: {vendor.get('state', '')}<br/>
    Country: {vendor.get('country', '')}<br/>
    Email: {vendor.get('contactpersonEmail', '')}<br/>
    Phone: {vendor.get('contactpersonPhone', '')}
    """
    
    shipping_content = purchaseorder.get('shippingAddress', '')
    
    po_content = f"""
    PO No: {purchaseorder.get('randomId', '')}<br/>
    PO Date: {order_date}<br/>
    Due Date: {due_date}<br/>
    Payment Terms: {purchaseorder.get('paymentTerms', '')}<br/>
    Status: {purchaseorder.get('poStatus', '')}<br/>
    Currency: INR
    """
    
    vendor_details_data = [
        [
            Paragraph('<b>Vendor Details</b>', ParagraphStyle('Header', fontSize=10, fontName='Helvetica-Bold', textColor=colors.white, alignment=TA_LEFT)),
            Paragraph('<b>Shipping Address</b>', ParagraphStyle('Header', fontSize=10, fontName='Helvetica-Bold', textColor=colors.white, alignment=TA_LEFT)),
            Paragraph('<b>PO Details</b>', ParagraphStyle('Header', fontSize=10, fontName='Helvetica-Bold', textColor=colors.white, alignment=TA_LEFT))
        ],
        [
            Paragraph(vendor_content, ParagraphStyle('Cell', fontSize=8, leading=10, alignment=TA_LEFT)),
            Paragraph(shipping_content, ParagraphStyle('Cell', fontSize=8, leading=10, alignment=TA_LEFT)),
            Paragraph(po_content, ParagraphStyle('Cell', fontSize=8, leading=10, alignment=TA_LEFT))
        ]
    ]
    
    vendor_table = Table(vendor_details_data, colWidths=[col_width, col_width, col_width])
    vendor_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#000080')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('ALIGN', (0, 0), (-1, 0), 'LEFT'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 2),
        ('TOPPADDING', (0, 0), (-1, 0), 2),
        ('FONTSIZE', (0, 1), (-1, 1), 8),
        ('ALIGN', (0, 1), (-1, 1), 'LEFT'),
        ('VALIGN', (0, 1), (-1, 1), 'TOP'),
        ('BOTTOMPADDING', (0, 1), (-1, 1), 2),
        ('TOPPADDING', (0, 1), (-1, 1), 2),
        ('LEFTPADDING', (0, 1), (-1, 1), 2),
        ('RIGHTPADDING', (0, 1), (-1, 1), 2),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
    ]))
    
    elements.append(vendor_table)
    
    # ITEMS TABLE
    items_header = ['S No', 'Description', 'HsnCode', 'No of Packing', 'Qty', 'Po Qty', 'Unit Price', 'Tax', 'Amount']
    
    filtered_items = purchaseorder.get('items', [])
    
    items_data = []
    for i, item in enumerate(filtered_items, 1):
        unit_price = item.get('newPrice') or item.get('existingPrice') or 0
        quantity = item.get('poQuantity') or item.get('quantity') or 0
        display_qty = item.get('pendingQuantity') or quantity
        total_amount = unit_price * quantity
        
        description = item.get('itemName', 'Cauliflower')
        description_para = Paragraph(
            description, 
            ParagraphStyle(
                'ItemDescription',
                parent=styles['Normal'],
                fontSize=7,
                leading=9,
                alignment=TA_LEFT
            )
        )
        
        items_data.append([
            str(i),
            description_para,
            item.get('hsnCode', ''),
            f"{item.get('pendingCount', '0')}",
            f"{display_qty} {item.get('uom', '')}",
            f"{quantity} {item.get('uom', '')}",
            f"{unit_price:.2f}",
            f"{item.get('taxPercentage',0)}%",
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
        
        items_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#000080')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 8),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 2),
            ('TOPPADDING', (0, 0), (-1, 0), 2),
            ('FONTSIZE', (0, 1), (-1, -1), 7),
            ('ALIGN', (0, 1), (0, -1), 'CENTER'),
            ('ALIGN', (1, 1), (1, -1), 'LEFT'),
            ('ALIGN', (2, 1), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 2),
            ('TOPPADDING', (0, 1), (-1, -1), 2),
            ('LEFTPADDING', (0, 0), (-1, -1), 1),
            ('RIGHTPADDING', (0, 0), (-1, -1), 1),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
        ]))
        
        elements.append(items_table)
    
    # TAX SUMMARY TABLE
    tax_breakdown = calculate_tax_breakdown(filtered_items)
    
    tax_summary_data = []
    
    total_without_tax = tax_breakdown['total_taxable_value']
    
    # Total Amount
    tax_summary_data.append(['Total Amount', f"{total_without_tax:,.2f}"])
    
    # CGST
    total_cgst = 0
    gst_slabs = ['5%', '12%', '18%', '28%']
    cgst_rows = []
    
    for slab in gst_slabs:
        data = tax_breakdown['tax_data'][slab]
        if data['cgst'] > 0:
            half_rate = float(slab.replace('%', '')) / 2
            total_cgst += data['cgst']
            cgst_rows.append(f"@{half_rate}% : {data['cgst']:.2f}")
    
    if cgst_rows:
        detail = " + ".join(cgst_rows)
        cgst_text = f"CGST {detail} → {total_cgst:.2f}"
        cgst_para = Paragraph(cgst_text, ParagraphStyle('TaxDetail', fontSize=8, leading=10, alignment=TA_RIGHT))
        tax_summary_data.append([cgst_para, f"{total_cgst:.2f}"])
    
    # SGST
    total_sgst = 0
    sgst_rows = []
    
    for slab in gst_slabs:
        data = tax_breakdown['tax_data'][slab]
        if data['sgst'] > 0:
            half_rate = float(slab.replace('%', '')) / 2
            total_sgst += data['sgst']
            sgst_rows.append(f"@{half_rate}% : {data['sgst']:.2f}")
    
    if sgst_rows:
        detail = " + ".join(sgst_rows)
        sgst_text = f"SGST {detail} → {total_sgst:.2f}"
        sgst_para = Paragraph(sgst_text, ParagraphStyle('TaxDetail', fontSize=8, leading=10, alignment=TA_RIGHT))
        tax_summary_data.append([sgst_para, f"{total_sgst:.2f}"])
    
    # Calculate grand total
    total_gst = tax_breakdown['total_gst']
    grand_total = total_without_tax + total_gst
    rounded_total = round(grand_total)
    
    # Amount in words
    try:
        from num2words import num2words
        amount_words = num2words(rounded_total, lang='en_IN').title()
        amount_words_text = f"In Words: {amount_words} Rupees Only [Including Tax]"
    except:
        amount_words_text = f"In Words: {rounded_total:,} Rupees Only [Including Tax]"
    
    amount_words_para = Paragraph(
        f"<b>{amount_words_text}</b>",
        ParagraphStyle(
            'AmountWords',
            parent=styles['Normal'],
            fontSize=8,
            leading=10,
            alignment=TA_LEFT
        )
    )
    
    tax_summary_data.append([amount_words_para, f"{rounded_total:,.2f}"])
    
    # Create tax table
    tax_table = Table(tax_summary_data, colWidths=[doc.width * 0.75, doc.width * 0.25])
    
    tax_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (0, -2), 'RIGHT'),
        ('ALIGN', (0, -1), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, -2), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -2), 8),
        ('FONTSIZE', (0, -1), (0, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('LEFTPADDING', (0, 0), (-1, -1), 2),
        ('RIGHTPADDING', (0, 0), (-1, -1), 2),
        ('VALIGN', (0, -1), (0, -1), 'TOP'),
        ('BACKGROUND', (0, -1), (1, -1), colors.HexColor('#F0F0F0')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
    ]))
    
    elements.append(tax_table)
    
    # TERMS AND CONDITIONS - FIXED: Reduced spacing
    elements.append(Spacer(1, 5))  # Small spacer only
    
    terms_title = Paragraph('<b>Terms & Conditions</b>', ParagraphStyle(
        'TermsTitle',
        parent=styles['Normal'],
        fontSize=14,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#000080'),
        spaceAfter=4,
        alignment=TA_LEFT
    ))
    elements.append(terms_title)
    
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
            spaceAfter=2,
            leftIndent=10,
            leading=12
        )))
    
    elements.append(Spacer(1, 10))
    
    # DECLARATION
    declaration_title = Paragraph('<b>Declaration:</b>', ParagraphStyle(
        'DeclTitle',
        parent=styles['Normal'],
        fontSize=12,
        fontName='Helvetica-Bold',
        spaceAfter=2
    ))
    elements.append(declaration_title)
    
    declaration_text = 'We declare that this invoice shows the actual price of the described items and that all particulars are true and correct.'
    
    elements.append(Paragraph(declaration_text, ParagraphStyle(
        'DeclText',
        parent=styles['Normal'],
        fontSize=10,
        spaceAfter=15,
        leading=14
    )))
    
    # SIGNATURE
    signature_table_data = [
        [Spacer(1, 10), Paragraph('<b>Authorized Signatory</b>', ParagraphStyle(
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
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    
    elements.append(signature_table)
    
    # IMAGES SECTION - FIXED: One image per row with good size
    if po_images and len(po_images) > 0:
        elements.append(PageBreak())
        
        images_title = Paragraph('<b><font size=14>REFERENCE IMAGES</font></b>', ParagraphStyle(
            'ImagesTitle',
            parent=styles['Normal'],
            alignment=TA_CENTER,
            textColor=colors.HexColor('#000080'),
            spaceAfter=20
        ))
        elements.append(images_title)
        
        # Display each image in its own row with good size
        for img_url in po_images:
            try:
                response = requests.get(img_url, timeout=15)
                if response.status_code == 200:
                    pil_img = PilImage.open(io.BytesIO(response.content))
                    
                    # Convert to RGB
                    if pil_img.mode in ('RGBA', 'LA', 'P'):
                        bg = PilImage.new('RGB', pil_img.size, (255, 255, 255))
                        if pil_img.mode == 'P':
                            pil_img = pil_img.convert('RGBA')
                        bg.paste(pil_img, mask=pil_img.split()[-1] if pil_img.mode in ('RGBA', 'LA') else None)
                        pil_img = bg
                    elif pil_img.mode != 'RGB':
                        pil_img = pil_img.convert('RGB')
                    
                    # Calculate good size - fit within page width with margin
                    max_width = doc.width - 50  # Leave margin on both sides
                    max_height = 250  # Good height for viewing
                    
                    # Calculate aspect ratio
                    original_width, original_height = pil_img.size
                    aspect = original_height / original_width
                    
                    if original_width > max_width:
                        width = max_width
                        height = width * aspect
                    else:
                        width = original_width
                        height = original_height
                    
                    if height > max_height:
                        height = max_height
                        width = height / aspect
                    
                    # Resize image
                    pil_img.thumbnail((width, height), PilImage.Resampling.LANCZOS)
                    
                    img_buffer = io.BytesIO()
                    pil_img.save(img_buffer, 'JPEG', quality=90)
                    img_buffer.seek(0)
                    
                    img = Image(img_buffer, width=pil_img.width, height=pil_img.height)
                    
                    # Center the image
                    img_table = Table([[img]], colWidths=[doc.width])
                    img_table.setStyle(TableStyle([
                        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ]))
                    
                    elements.append(img_table)
                    elements.append(Spacer(1, 15))  # Space between images
                    
            except Exception as e:
                print(f"Error loading image {img_url}: {e}")
                error_text = Paragraph(f"Error loading image", ParagraphStyle('Error', fontSize=10, alignment=TA_CENTER))
                elements.append(error_text)
                elements.append(Spacer(1, 10))
    
    # Build PDF
    doc.build(elements, canvasmaker=NumberedCanvas)
    
    pdf_bytes = buffer.getvalue()
    buffer.close()
    
    return pdf_bytes


@router.get("/view/{purchase_id}/{photo_index}")
async def get_photo(
    purchase_id: str,
    photo_index: int,
):
    try:
        photo_document = get_image_collection().find_one({"_id": purchase_id})
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
async def get_photo_compat(purchase_id: str):
    return await get_photo(purchase_id, 1)