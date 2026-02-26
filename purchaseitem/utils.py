from datetime import datetime, timedelta
import logging
import re
import csv
from typing import Any, Dict, Optional
from fastapi import File, Form, HTTPException, UploadFile
from pymongo import MongoClient
import pytz
from utils.database import get_counter_collection, get_purchaseitem_collection


def get_localized_datetime():
    """Get current UTC datetime adjusted from IST."""
    ist = pytz.timezone("Asia/Kolkata")
    localized_now = datetime.now(ist)
    adjusted_time = localized_now + timedelta(hours=5, minutes=30)
    return adjusted_time.astimezone(pytz.UTC)

def get_current_date_and_time():
    current_datetime = get_localized_datetime()
    return {"datetime": current_datetime}



def initialize_counter_if_needed(tenant_id: str):
    counter_collection = get_counter_collection(tenant_id)
    counter = counter_collection.find_one({"_id": "purchaseitemId"})
    if not counter:
        max_id = find_max_random_id(tenant_id)
        initial_value = max_id + 1 if max_id > 0 else 1
        set_counter_value(tenant_id,initial_value)

def find_max_random_id(tenant_id: str) -> int:
    collection = get_purchaseitem_collection(tenant_id)
    pipeline = [
        {"$match": {"randomId": {"$regex": r"^PI\d+$"}}},
        {"$project": {"numericPart": {"$toInt": {"$substr": ["$randomId", 2, -1]}}}},
        {"$group": {"_id": None, "maxId": {"$max": "$numericPart"}}}
    ]
    result = list(collection.aggregate(pipeline))
    return result[0]['maxId'] if result else 0

def get_current_counter_value(tenant_id: str) -> int:
    counter_collection = get_counter_collection(tenant_id)
    counter = counter_collection.find_one({"_id": "purchaseitemId"})
    return counter["sequence_value"] if counter else 0

def set_counter_value(tenant_id: str,value: int):
    counter_collection = get_counter_collection(tenant_id)
    counter_collection.update_one(
        {"_id": "purchaseitemId"},
        {"$set": {"sequence_value": value}},
        upsert=True
    )

def get_next_counter_value(tenant_id: str) -> int:
    counter_collection = get_counter_collection(tenant_id)
    counter = counter_collection.find_one_and_update(
        {"_id": "purchaseitemId"},
        {"$inc": {"sequence_value": 1}},
        upsert=True,
        return_document=True
    )
    return counter["sequence_value"]

def generate_random_id(tenant_id: str) -> str:
    return f"PI{get_next_counter_value():03d}"

def reset_counter(tenant_id: str,value: int = 1):
    set_counter_value(value)
class CSVImportValidator:
    def __init__(self):
        self.errors = {}
    
    def validate_row(self, row):
        """Validate a single row from CSV import"""
        errors = {}
        
        # Validate purchasePrice
        price = row.get('purchasePrice', '').strip()
        if price:
            try:
                price_val = float(price)
                if price_val < 0:
                    errors['purchasePrice'] = 'Purchase price cannot be negative'
                elif price_val > 999999999:
                    errors['purchasePrice'] = 'Purchase price is too large'
            except ValueError:
                errors['purchasePrice'] = f'Invalid price format: {price}'
        
        # Validate stockQuantity
        stock = row.get('stockQuantity', '').strip()
        if stock:
            try:
                stock_val = float(stock)
                if stock_val < 0:
                    errors['stockQuantity'] = 'Stock quantity cannot be negative'
            except ValueError:
                errors['stockQuantity'] = f'Invalid stock quantity format: {stock}'
        
        # Validate reorderLevel
        reorder = row.get('reorderLevel', '').strip()
        if reorder:
            try:
                reorder_val = float(reorder)
                if reorder_val < 0:
                    errors['reorderLevel'] = 'Reorder level cannot be negative'
            except ValueError:
                errors['reorderLevel'] = f'Invalid reorder level format: {reorder}'
        
        # Validate shelfLife
        shelf_life = row.get('shelfLife', '').strip()
        if shelf_life:
            try:
                shelf_val = int(shelf_life)
                if shelf_val < 0:
                    errors['shelfLife'] = 'Shelf life cannot be negative'
                elif shelf_val > 36500:  # 100 years in days
                    errors['shelfLife'] = 'Shelf life is too large'
            except ValueError:
                errors['shelfLife'] = f'Invalid shelf life format: {shelf_life}'
        
        # Validate hsnCode
        hsn = row.get('hsnCode', '').strip()
        if hsn:
            # HSN code should be numeric and typically 4, 6, or 8 digits
            if not hsn.isdigit():
                errors['hsnCode'] = 'HSN code must be numeric'
            elif len(hsn) not in [4, 6, 8]:
                errors['hsnCode'] = 'HSN code must be 4, 6, or 8 digits'
        
        # Validate itemName
        item_name = row.get('itemName', '').strip()
        if len(item_name) > 255:
            errors['itemName'] = 'Item name is too long (max 255 characters)'
        
        # Validate itemCode
        item_code = row.get('itemCode', '').strip()
        if item_code and len(item_code) > 50:
            errors['itemCode'] = 'Item code is too long (max 50 characters)'
        
        # Validate description
        description = row.get('description', '').strip()
        if description and len(description) > 1000:
            errors['description'] = 'Description is too long (max 1000 characters)'
        
        # Validate supplier
        supplier = row.get('supplier', '').strip()
        if supplier and len(supplier) > 255:
            errors['supplier'] = 'Supplier name is too long (max 255 characters)'
        
        # Validate barcode
        barcode = row.get('barcode', '').strip()
        if barcode:
            if len(barcode) > 50:
                errors['barcode'] = 'Barcode is too long (max 50 characters)'
            # Basic barcode format validation (alphanumeric)
            if not re.match(r'^[A-Za-z0-9]+$', barcode):
                errors['barcode'] = 'Barcode must contain only alphanumeric characters'
        
        return errors

def process_row(row, current_datetime, random_id):
    """Process a single row from CSV import"""
    try:
        # Helper function to safely convert values
        def safe_float(value, default=0.0):
            if not value or str(value).strip() in ['', 'nan', 'null', 'none']:
                return default
            try:
                return float(value)
            except (ValueError, TypeError):
                return default
        
        def safe_int(value, default=0):
            if not value or str(value).strip() in ['', 'nan', 'null', 'none']:
                return default
            try:
                return int(float(value))  # Convert through float first to handle decimals
            except (ValueError, TypeError):
                return default
        
        def safe_string(value, default=""):
            if not value or str(value).strip() in ['nan', 'null', 'none']:
                return default
            return str(value).strip()
        
        def process_vendor_tags(value):
            if not value or str(value).strip() in ['', 'nan', 'null', 'none']:
                return []
            
            # Handle both string and list inputs
            if isinstance(value, list):
                return [str(tag).strip() for tag in value if str(tag).strip()]
            
            # Split by comma and clean up
            tags = str(value).split(',')
            return [tag.strip() for tag in tags if tag.strip() and tag.strip().lower() not in ['nan', 'null', 'none']]
        
        # Process the row data
        processed_data = {
            'randomId': random_id,
            'itemCode': safe_string(row.get('itemCode')),
            'itemName': safe_string(row.get('itemName')),
            'purchasecategoryName': safe_string(row.get('purchasecategoryName')),
            'purchasesubcategoryName': safe_string(row.get('purchasesubcategoryName')),
            'itemgroupName': safe_string(row.get('itemgroupName')),
            'uom': safe_string(row.get('uom')),
            'stockQuantity': safe_float(row.get('stockQuantity')),
            'supplier': safe_string(row.get('supplier')),
            'purchasePrice': safe_float(row.get('purchasePrice')),
            'purchasetaxName': safe_float(row.get('purchasetaxName')),  # Tax percentage as float
            'reorderLevel': safe_float(row.get('reorderLevel')),
            'itemType': safe_string(row.get('itemType')),
            'hsnCode': safe_string(row.get('hsnCode')),
            'shelfLife': safe_string(row.get('shelfLife')),
            'vendorTag': process_vendor_tags(row.get('vendorTag')),
            'locationName': safe_string(row.get('locationName')),
            'barcode': safe_string(row.get('barcode')),
            'description': safe_string(row.get('description')),
            'createdDate': current_datetime,
            'lastUpdatedDate': current_datetime,
            'status': 'active'
        }
        
        return processed_data
        
    except Exception as e:
        logging.error(f"Error processing row: {e}")
        logging.error(f"Row data: {row}")
        return None
