import csv
import time
from datetime import datetime, timedelta
from io import StringIO
import io
from fastapi import Request

import logging
from typing import List
from fastapi import APIRouter, File, HTTPException, UploadFile,Depends
from bson import ObjectId
from fastapi.responses import StreamingResponse
from pymongo import UpdateOne, InsertOne
import pytz
from dependencies.auth import validate_token
from middlewares.permission_middleware import check_permission

from purchasesubcategory.routes import generate_sequential_subcategoryid
from utils.database import get_purchasesubcategory_collection
from .models import PurchaseCategory, PurchaseCategoryPost, RemoveSubcategoryRequest
from utils.database import get_purchasecategory_collection
from pymongo.errors import BulkWriteError
from middlewares.permission_middleware import check_permission
# Common header mapping for import and export
header_mapping = {
    'Category ID': 'randomId',
    'Category Name': 'purchasecategoryName',
    'Subcategories': 'subcategories',
    'Status': 'status',
    'Created Date': 'createdDate',
    'Updated Date': 'lastUpdatedDate'
}

router = APIRouter()
def get_localized_datetime():
    """Get current UTC datetime adjusted from IST."""
    ist = pytz.timezone("Asia/Kolkata")
    localized_now = datetime.now(ist)
    adjusted_time = localized_now + timedelta(hours=5, minutes=30)
    return adjusted_time.astimezone(pytz.UTC)

async def set_counter_value(tenant_id: str,value: int, counter_id: str = "purchasecategoryId"):
    """Set the counter value in the database."""
    counter_collection = get_purchasecategory_collection(tenant_id).database["counters"]
    await counter_collection.update_one(
        {"_id": counter_id},
        {"$set": {"sequence_value": value}},
        upsert=True
    )

async def get_next_counter_value(tenant_id: str,counter_id: str = "purchasecategoryId"):
    """Get and increment the counter value in the database."""
    counter_collection = get_purchasecategory_collection(tenant_id).database["counters"]
    counter = await counter_collection.find_one_and_update(
        {"_id": counter_id},
        {"$inc": {"sequence_value": 1}},
        upsert=True,
        return_document=True
    )
    return counter["sequence_value"]

async def reset_counter(tenant_id: str):
    """Reset the counter to 0."""
    await set_counter_value(tenant_id,0)

async def get_current_counter_value(tenant_id: str,counter_id: str = "purchasecategoryId"):
    """Get the current counter value from the database."""
    counter_collection = get_purchasecategory_collection(tenant_id).database["counters"]
    counter = await counter_collection.find_one({"_id": counter_id})
    return counter["sequence_value"] if counter else 0

async def sync_counter_with_database(tenant_id: str):
    """Sync counter with the highest existing category ID."""
    collection = get_purchasecategory_collection(tenant_id)
    highest_category = await collection.find_one(
        {"randomId": {"$regex": "^PC\\d+$"}},
        sort=[("randomId", -1)]
    )
    if highest_category:
        last_number = int(highest_category["randomId"][2:])
        await set_counter_value(tenant_id,last_number)

async def generate_sequential_id(tenant_id: str):
    collection = get_purchasecategory_collection(tenant_id)
    counter_collection = collection.database["counters"]
    """Generate a PCxxx ID, filling gaps in the sequence."""
    
    counter = await counter_collection.find_one({"_id": "purchasecategoryId"})
    current_counter = counter["sequence_value"] if counter else 0
    
    existing_ids = await collection.find(
        {"randomId": {"$regex": "^PC\\d+$"}},
        {"randomId": 1}
    ).sort("randomId", 1).to_list(None)
    
    id_numbers = []
    for item in existing_ids:
        try:
            num = int(item["randomId"][2:])
            id_numbers.append(num)
        except (ValueError, KeyError):
            continue
    
    next_number = 1
    if id_numbers:
        expected = 1
        for num in sorted(id_numbers):
            if num > expected:
                next_number = expected
                break
            expected = num + 1
        else:
            next_number = expected
    
    next_number = max(next_number, current_counter + 1)
    
    await counter_collection.update_one(
        {"_id": "purchasecategoryId"},
        {"$set": {"sequence_value": next_number}},
        upsert=True
    )
    
    return f"PC{next_number:03d}"

async def initialize_counter_if_needed(tenant_id: str,counter_id: str = "purchasecategoryId"):
    """Initialize counter to the highest existing ID number (PCxxx or PSxxx)."""
    if counter_id == "purchasecategoryId":
        collection = get_purchasecategory_collection(tenant_id)
        id_prefix = "PC"
    elif counter_id == "purchasesubcategoryId":
        collection = get_purchasesubcategory_collection(tenant_id)
        id_prefix = "PS"
    else:
        raise ValueError(f"Invalid counter_id: {counter_id}")

    counter_collection = collection.database["counters"]
    
    highest_item = await collection.find_one(
        {"randomId": {"$regex": f"^{id_prefix}\\d+$"}},
        sort=[("randomId", -1)]
    )
    
    if highest_item:
        try:
            last_number = int(highest_item["randomId"][2:])
        except (ValueError, TypeError):
            last_number = 0
            logging.warning(f"Malformed randomId found: {highest_item['randomId']}")
        await counter_collection.update_one(
            {"_id": counter_id},
            {"$set": {"sequence_value": last_number}},
            upsert=True
        )
    else:
        await counter_collection.update_one(
            {"_id": counter_id},
            {"$set": {"sequence_value": 0}},
            upsert=True
        )

async def generate_sequential_id_subcategory(tenant_id: str):
    collection = get_purchasesubcategory_collection(tenant_id)
    """Generate a PSxxx ID, filling gaps in the sequence."""
  
    counter_collection = collection.database["counters"]
    
    counter = await counter_collection.find_one({"_id": "purchasesubcategoryId"})
    current_counter = counter["sequence_value"] if counter else 0
    
    existing_ids = await collection.find(
        {"randomId": {"$regex": "^PS\\d+$"}},
        {"randomId": 1}
    ).sort("randomId", 1).to_list(None)
    
    id_numbers = []
    for item in existing_ids:
        try:
            num = int(item["randomId"][2:])
            id_numbers.append(num)
        except (ValueError, KeyError):
            continue
    
    next_number = 1
    if id_numbers:
        expected = 1
        for num in sorted(id_numbers):
            if num > expected:
                next_number = expected
                break
            expected = num + 1
        else:
            next_number = expected
    
    next_number = max(next_number, current_counter + 1)
    
    await counter_collection.update_one(
        {"_id": "purchasesubcategoryId"},
        {"$set": {"sequence_value": next_number}},
        upsert=True
    )
    
    return f"PS{next_number:03d}"

@router.post("/reset-counter")
async def reset_sequence(request: Request):
    tenant_id = request.state.tenant_id
    """Reset the counter to 0. Next ID will be PC001."""
    await reset_counter(tenant_id)
    return {"message": "Counter reset successfully. Next ID will be PC001"}

@router.post("/", response_model=str)
async def create_purchasecategory(purchasecategory: PurchaseCategoryPost,request: Request,
                                   user = Depends(validate_token),permissions: dict = Depends(check_permission("yenerp", "purchasecategory", "add"))):
    tenant_id = request.state.tenant_id
    collection = get_purchasecategory_collection(tenant_id)
    """Create a new purchase category with a sequential ID."""
    current_datetime = get_localized_datetime()
    
    await initialize_counter_if_needed(tenant_id)
    sequential_id = await generate_sequential_id(tenant_id)

    new_purchasecategory_data = purchasecategory.dict()
    new_purchasecategory_data.update({
        'randomId': sequential_id,
        'createdDate': current_datetime,
        'lastUpdatedDate': current_datetime
    })

    if isinstance(new_purchasecategory_data.get('subcategories'), str):
        new_purchasecategory_data['subcategories'] = [new_purchasecategory_data['subcategories']]

    # Check and create subcategories
    subcategory_collection = get_purchasesubcategory_collection(tenant_id)
    existing_subcategories = {sub['purchasesubcategoryName'].lower(): sub 
    for sub in await subcategory_collection.find({}).to_list(None)
    }
    for subcategory in new_purchasecategory_data.get('subcategories', []):
        if subcategory.lower() not in existing_subcategories:
            subcategory_id = await generate_sequential_id_subcategory(tenant_id)
            await subcategory_collection.insert_one({
                'purchasesubcategoryName': subcategory,
                'randomId': subcategory_id,
                'status': 'active',
                'createdDate': current_datetime,
                'createdTime': current_datetime,
                'lastUpdatedDate': current_datetime,
                'lastUpdatedTime': current_datetime
            })

    result = await collection.insert_one(new_purchasecategory_data)
    return str(result.inserted_id)

@router.post("/import_csv")
async def import_purchase_categories_from_csv(request: Request,file: UploadFile = File(...),user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "purchasecategory", "add"))):
    """Import purchase categories from CSV, consolidating unlimited subcategories with optimized performance."""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload a CSV file.")

    try:
        tenant_id = request.state.tenant_id
        category_collection = get_purchasecategory_collection(tenant_id)
        subcategory_collection = get_purchasesubcategory_collection(tenant_id)
        current_datetime = get_localized_datetime()

        # Read CSV file efficiently
        content = await file.read()
        try:
            decoded = content.decode('utf-8-sig', errors='replace')
            csv_reader = csv.DictReader(io.StringIO(decoded), delimiter=',')
            csv_data = list(csv_reader)
            if not csv_data:
                return {
                    "message": "CSV file is empty or contains no valid rows",
                    "inserted_count": 0,
                    "updated_count": 0,
                    "successful": [],
                    "updated": [],
                    "failed": [],
                    "errorCount": 0,
                }
        except Exception as e:
            logging.error(f"CSV parsing error: {str(e)}", exc_info=True)
            return {
                "message": f"Invalid CSV file: {str(e)}",
                "inserted_count": 0,
                "updated_count": 0,
                "successful": [],
                "updated": [],
                "failed": [],
                "errorCount": 0,
            }

        # Validate headers
        original_headers = [header.strip() for header in csv_reader.fieldnames or []]
        logging.info(f"Original CSV headers: {original_headers}")
        valid_headers = ["Category Name", "purchasecategoryName"]
        found_header = next((header for header in valid_headers if header in original_headers), None)

        if not found_header:
            return {
                "message": "Missing required CSV header",
                "detail": {
                    "message": "Required header 'Category Name' or 'purchasecategoryName' not found",
                    "missing": ["Category Name or purchasecategoryName"],
                    "detected_headers": original_headers
                },
                "inserted_count": 0,
                "updated_count": 0,
                "successful": [],
                "updated": [],
                "failed": [],
                "errorCount": 0,
            }

        # Initialize counters
        await initialize_counter_if_needed(tenant_id)
        await initialize_counter_if_needed(tenant_id,"purchasesubcategoryId")

        # Cache existing categories and subcategories
        start_time = time.time()
        existing_categories = {cat['purchasecategoryName'].lower().strip(): cat for cat in await category_collection.find({}, {'purchasecategoryName': 1, 'randomId': 1, 'subcategories': 1, '_id': 1}).to_list(None)}
        existing_subcategories = {sub['purchasesubcategoryName'].lower(): sub for sub in await subcategory_collection.find({}, {'purchasesubcategoryName': 1, 'randomId': 1}).to_list(None)}
        logging.info(f"Loaded existing categories and subcategories in {time.time() - start_time:.2f} seconds")

        operations = []
        subcategory_operations = []
        new_count = 0
        updated_count = 0
        successful = []
        updated = []
        failed = []
        seen_names = {}  # Track categories and their subcategories in CSV

        # Process CSV rows
        for row_idx, row in enumerate(csv_data, start=2):
            try:
                # Convert all values to strings and strip whitespace
                row = {k: str(v).strip() if v is not None else "" for k, v in row.items()}
                logging.debug(f"Processing row {row_idx}: {row}")

                # Get category name
                category_name = row.get(found_header, '').strip()
                normalized_name = category_name.lower().strip()

                # Validate category name
                if not category_name or len(category_name) < 3:
                    failed.append({
                        "row": row_idx - 1,
                        "data": {
                            "Category Name": category_name,
                            "Subcategories": row.get("Subcategories", "")
                        },
                        "error": "Category name is empty or too short (e.g., 'Raw M', 'ials')"
                    })
                    continue

                # Process subcategories
                subcategories_raw = row.get('Subcategories', '').replace(';', ',').strip()
                subcategories = {sub.strip().title() for sub in subcategories_raw.split(',') if sub.strip()}
                subcategories_list = sorted(subcategories)
                logging.debug(f"Subcategories for {category_name} in row {row_idx}: {subcategories_list}")

                # Track subcategories in seen_names
                if normalized_name in seen_names:
                    seen_names[normalized_name]['subcategories'].update(subcategories_list)
                else:
                    seen_names[normalized_name] = {
                        'category_name': category_name,
                        'subcategories': set(subcategories_list),
                        'row_idx': row_idx
                    }

                # Allow empty subcategories with a warning
                if not subcategories_raw:
                    logging.warning(f"Empty subcategories for category '{category_name}' in row {row_idx}")

            except Exception as e:
                logging.error(f"Error processing row {row_idx}: {str(e)}", exc_info=True)
                failed.append({
                    "row": row_idx - 1,
                    "data": {
                        "Category Name": category_name,
                        "Subcategories": row.get("Subcategories", "")
                    },
                    "error": f"Processing error: {str(e)}"
                })
                continue

        # Process consolidated categories
        start_time = time.time()
        for normalized_name, data in seen_names.items():
            try:
                category_name = data['category_name']
                subcategories_list = sorted(data['subcategories'])
                existing_category = existing_categories.get(normalized_name)

                if existing_category:
                    # Update existing category
                    existing_subcats = existing_category.get('subcategories', [])
                    new_subcats = list(set(existing_subcats + subcategories_list))
                    logging.debug(f"Merging subcategories for {category_name}: existing={existing_subcats}, new={subcategories_list}, result={new_subcats}")
                    operations.append(UpdateOne(
                        {"randomId": existing_category['randomId']},
                        {"$set": {
                            "purchasecategoryName": category_name,
                            "subcategories": new_subcats,
                            "status": "active",
                            "lastUpdatedDate": current_datetime
                        }}
                    ))
                    updated_count += 1
                    updated.append({
                        "row": data['row_idx'] - 1,
                        "data": {
                            "Category ID": existing_category['randomId'],
                            "Category Name": category_name,
                            "Subcategories": ", ".join(subcategories_list)
                        },
                        "Reason": "Duplicate category updated with new subcategories"
                    })
                    if not any(item["data"]["Category ID"] == existing_category['randomId'] for item in successful):
                        successful.append({
                            "row": data['row_idx'] - 1,
                            "data": {
                                "Category ID": existing_category['randomId'],
                                "Category Name": category_name,
                                "Subcategories": ", ".join(subcategories_list)
                            }
                        })
                    category_id = existing_category['randomId']
                else:
                    # Insert new category
                    sequential_id = await generate_sequential_id(tenant_id)
                    operations.append(InsertOne({
                        "purchasecategoryName": category_name,
                        "randomId": sequential_id,
                        "subcategories": subcategories_list,
                        "status": "active",
                        "createdDate": current_datetime,
                        "lastUpdatedDate": current_datetime
                    }))
                    new_count += 1
                    successful.append({
                        "row": data['row_idx'] - 1,
                        "data": {
                            "Category ID": sequential_id,
                            "Category Name": category_name,
                            "Subcategories": ", ".join(subcategories_list)
                        }
                    })
                    existing_categories[normalized_name] = {
                        "randomId": sequential_id,
                        "subcategories": subcategories_list
                    }
                    category_id = sequential_id

                # Process subcategories
                for subcategory in subcategories_list:
                    subcategory_key = subcategory.lower()
                    if subcategory_key not in existing_subcategories:
                        subcategory_id = await generate_sequential_id_subcategory(tenant_id)
                        subcategory_operations.append(InsertOne({
                            'purchasesubcategoryName': subcategory,
                            'randomId': subcategory_id,
                            'status': "active",
                            'createdDate': current_datetime,
                            'createdTime': current_datetime,
                            'lastUpdatedDate': current_datetime,
                            'lastUpdatedTime': current_datetime,
                            'categoryId': category_id
                        }))
                        existing_subcategories[subcategory_key] = {"randomId": subcategory_id}
                        logging.debug(f"Created new subcategory: {subcategory} with ID {subcategory_id} for category {category_name}")

            except Exception as e:
                logging.error(f"Error processing category {category_name}: {str(e)}", exc_info=True)
                failed.append({
                    "row": data['row_idx'] - 1,
                    "data": {
                        "Category Name": category_name,
                        "Subcategories": ", ".join(subcategories_list)
                    },
                    "error": f"Processing error: {str(e)}"
                })

        # Execute database operations in batches
        batch_size = 1000
        for i in range(0, len(operations), batch_size):
            try:
                result = await category_collection.bulk_write(operations[i:i + batch_size], ordered=False)
                logging.info(f"Category bulk write batch {i//batch_size + 1}: {result.bulk_api_result}")
            except BulkWriteError as bwe:
                logging.error(f"Category bulk write error: {bwe.details}")
                failed.append({
                    "row": 0,
                    "data": {},
                    "error": f"Bulk write error: {bwe.details}"
                })

        for i in range(0, len(subcategory_operations), batch_size):
            try:
                result = await subcategory_collection.bulk_write(subcategory_operations[i:i + batch_size], ordered=False)
                logging.info(f"Subcategory bulk write batch {i//batch_size + 1}: {result.bulk_api_result}")
            except BulkWriteError as bwe:
                logging.error(f"Subcategory bulk write error: {bwe.details}")
                failed.append({
                    "row": 0,
                    "data": {},
                    "error": f"Subcategory bulk write error: {bwe.details}"
                })

        logging.info(f"Import completed in {time.time() - start_time:.2f} seconds")
        return {
            "message": f"Import completed: {new_count} inserted, {updated_count} updated, {len(failed)} errors",
            "inserted_count": new_count,
            "updated_count": updated_count,
            "successful": successful,
            "updated": updated,
            "failed": failed,
            "errorCount": len(failed),
        }

    except Exception as e:
        logging.error(f"Import error: {str(e)}", exc_info=True)
        return {
            "message": "Import failed",
            "detail": {"message": f"Server error: {str(e)}"},
            "inserted_count": 0,
            "updated_count": 0,
            "successful": [],
            "updated": [],
            "failed": [],
            "errorCount": 1,
        }
@router.get("/", response_model=List[PurchaseCategory])
async def get_all_purchasecategory(request: Request,user = Depends(validate_token), permissions: dict = Depends(check_permission("yenerp", "purchasecategory", "read"))):
    tenant_id = request.state.tenant_id
    collection = get_purchasecategory_collection(tenant_id)
    """Get all purchase categories."""
    purchasecategories = await collection.find().to_list(None)
    formatted_purchasecategories = [
        {**pc, "purchasecategoryId": str(pc["_id"])} for pc in purchasecategories
    ]
    return [PurchaseCategory(**pc) for pc in formatted_purchasecategories]

@router.get("/{purchasecategory_id}", response_model=PurchaseCategory)
async def get_purchasecategory_by_id(request: Request,purchasecategory_id: str,user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "purchasecategory", "read"))):
    tenant_id = request.state.tenant_id
    collection = get_purchasecategory_collection(tenant_id)
    """Get a specific purchase category by ID."""
    purchasecategory = await collection.find_one({"_id": ObjectId(purchasecategory_id)})
    if purchasecategory:
        purchasecategory["purchasecategoryId"] = str(purchasecategory["_id"])
        return PurchaseCategory(**purchasecategory)
    raise HTTPException(status_code=404, detail="PurchaseCategory not found")

@router.put("/{purchasecategory_id}")
async def update_purchasecategory(request: Request,purchasecategory_id: str, purchasecategory: PurchaseCategoryPost,user = Depends(validate_token),permissions: dict = Depends(check_permission("yenerp", "purchasecategory", "edit"))):
    tenant_id = request.state.tenant_id
    collection = get_purchasecategory_collection(tenant_id)
    """Replace an existing purchase category."""
    updated_purchasecategory = purchasecategory.dict(exclude_unset=True)
    current_datetime = get_localized_datetime()

    if isinstance(updated_purchasecategory.get('subcategories'), str):
        updated_purchasecategory['subcategories'] = [updated_purchasecategory['subcategories']]
    
    # Check and create subcategories
    subcategory_collection = get_purchasesubcategory_collection(tenant_id)
    existing_subcategories = {sub['purchasesubcategoryName'].lower(): sub for sub in await subcategory_collection.find({}).to_list(None)}
    for subcategory in updated_purchasecategory.get('subcategories', []):
        if subcategory.lower() not in existing_subcategories:
            subcategory_id = await generate_sequential_id_subcategory(tenant_id)
            await subcategory_collection.insert_one({
                'purchasesubcategoryName': subcategory,
                'randomId': subcategory_id,
                'status': 'active',
                'createdDate': current_datetime,
                'createdTime': current_datetime,
                'lastUpdatedDate': current_datetime,
                'lastUpdatedTime': current_datetime
            })

    updated_purchasecategory['lastUpdatedDate'] = current_datetime
    
    result = await collection.update_one(
        {"_id": ObjectId(purchasecategory_id)},
        {"$set": updated_purchasecategory}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="PurchaseCategory not found")
    return {"message": "PurchaseCategory updated successfully"}

@router.patch("/{purchasecategory_id}")
async def patch_purchasecategory(request: Request,purchasecategory_id: str, purchasecategory_patch: PurchaseCategoryPost,user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "purchasecategory", "edit"))):
    tenant_id = request.state.tenant_id
    collection = get_purchasecategory_collection(tenant_id)
    """Update specific fields of an existing purchase category."""
    current_datetime = get_localized_datetime()
    existing_purchasecategory = await collection.find_one({"_id": ObjectId(purchasecategory_id)})
    if not existing_purchasecategory:
        raise HTTPException(status_code=404, detail="PurchaseCategory not found")

    updated_fields = {key: value for key, value in purchasecategory_patch.dict(exclude_unset=True).items() if value is not None}

    if 'subcategories' in updated_fields and isinstance(updated_fields['subcategories'], str):
        updated_fields['subcategories'] = [updated_fields['subcategories']]
    
    # Check and create subcategories
    subcategory_collection = get_purchasesubcategory_collection(tenant_id)
    existing_subcategories = {sub['purchasesubcategoryName'].lower(): sub for sub in await subcategory_collection.find({}).to_list(None)}
    for subcategory in updated_fields.get('subcategories', []):
        if subcategory.lower() not in existing_subcategories:
            subcategory_id = await generate_sequential_id_subcategory(tenant_id)
            await subcategory_collection.insert_one({
                'purchasesubcategoryName': subcategory,
                'randomId': subcategory_id,
                'status': 'active',
                'createdDate': current_datetime,
                'createdTime': current_datetime,
                'lastUpdatedDate': current_datetime,
                'lastUpdatedTime': current_datetime
            })

    updated_fields['lastUpdatedDate'] = current_datetime
    
    if updated_fields:
        result = await collection.update_one(
            {"_id": ObjectId(purchasecategory_id)},
            {"$set": updated_fields}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to update PurchaseCategory")

    updated_purchasecategory = await collection.find_one({"_id": ObjectId(purchasecategory_id)})
    updated_purchasecategory["purchasecategoryId"] = str(updated_purchasecategory["_id"])
    return PurchaseCategory(**updated_purchasecategory)

@router.patch("/{purchasecategory_id}/subcategories/remove", response_model=PurchaseCategory)
async def remove_subcategory(request: Request,purchasecategory_id: str, body: RemoveSubcategoryRequest,user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "purchasecategory", "edit"))):
    tenant_id = request.state.tenant_id
    collection = get_purchasecategory_collection(tenant_id)
    """Remove a subcategory from a purchase category."""
    
    try:
        ObjectId(purchasecategory_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid purchasecategoryId format")

    existing_purchasecategory = await collection.find_one({"_id": ObjectId(purchasecategory_id)})
    if not existing_purchasecategory:
        raise HTTPException(status_code=404, detail="PurchaseCategory not found")

    current_subcategories = existing_purchasecategory.get('subcategories', [])
    
    if body.subcategoryToRemove not in current_subcategories:
        raise HTTPException(status_code=400, detail="Subcategory not found in this category")

    updated_subcategories = [sub for sub in current_subcategories if sub != body.subcategoryToRemove]

    current_datetime = get_localized_datetime()
    update_data = {
        "subcategories": updated_subcategories,
        "lastUpdatedDate": current_datetime
    }

    result = await collection.update_one(
        {"_id": ObjectId(purchasecategory_id)},
        {"$set": update_data}
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=500, detail="Failed to update subcategory list")

    updated_purchasecategory = await collection.find_one({"_id": ObjectId(purchasecategory_id)})
    updated_purchasecategory["purchasecategoryId"] = str(updated_purchasecategory["_id"])
    del updated_purchasecategory["_id"]
    return PurchaseCategory(**updated_purchasecategory)

@router.get("/exportcategory/export_csv")
async def export_purchase_categories_to_csv(request: Request):
    tenant_id = request.state.tenant_id
    collection = get_purchasecategory_collection(tenant_id)
    """Export purchase categories and subcategories to a CSV file."""
    try:
        categories = await collection.find().to_list(None)
        if not categories:
            raise HTTPException(status_code=404, detail="No purchase categories found")

        # Prepare CSV output
        output = StringIO()
        writer = csv.DictWriter(
            output,
            fieldnames=list(header_mapping.keys()),
            lineterminator='\n'
        )
        writer.writeheader()

        # Iterate through categories and their subcategories
        for category in categories:
            category_name = category.get('purchasecategoryName', '')
            random_id = category.get('randomId', '')
            status = category.get('status', 'active')
            created_date = category.get('createdDate', '')
            last_updated_date = category.get('lastUpdatedDate', '')
            
            # Format dates if they exist
            if created_date:
                created_date = created_date.strftime('%d-%m-%Y') if isinstance(created_date, datetime) else created_date
            if last_updated_date:
                last_updated_date = last_updated_date.strftime('%d-%m-%Y') if isinstance(last_updated_date, datetime) else last_updated_date

            # Get subcategories (default to empty list if none)
            subcategories = category.get('subcategories', [])
            
            # If no subcategories, write a single row with empty subcategory
            if not subcategories:
                writer.writerow({
                    'Category ID': random_id,
                    'Category Name': category_name,
                    'Subcategories': '',
                    'Status': status,
                    'Created Date': created_date,
                    'Updated Date': last_updated_date
                })
            else:
                # Write one row per subcategory
                for subcategory in subcategories:
                    writer.writerow({
                        'Category ID': random_id,
                        'Category Name': category_name,
                        'Subcategories': subcategory,
                        'Status': status,
                        'Created Date': created_date,
                        'Updated Date': last_updated_date
                    })

        # Prepare the response
        output.seek(0)
        response = StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="purchase_categories_export.csv"'}
        )
        return response

    except Exception as e:
        logging.error(f"Export error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}") 
    


@router.delete("/{purchasecategory_id}")
async def delete_purchasecategory(request: Request,
    purchasecategory_id: str, user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "purchasecategory", "delete"))
):
    tenant_id = request.state.tenant_id
    collection = get_purchasecategory_collection(tenant_id)
    """Soft delete a purchase category (change status to deactivated)."""
    current_datetime = get_localized_datetime()
    
    result = await collection.update_one(
        {"_id": ObjectId(purchasecategory_id)},
        {"$set": {
            'status': 'deactivated',
            'lastUpdatedDate': current_datetime
        }}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="PurchaseCategory not found")
    return {"message": "PurchaseCategory deactivated successfully"}
@router.patch("/{purchasecategory_id}/activate")
async def activate_purchasecategory(request: Request,
    purchasecategory_id: str, user = Depends(validate_token),
    permissions: dict = Depends(check_permission("yenerp", "purchasecategory", "delete"))
):
    tenant_id = request.state.tenant_id
    collection = get_purchasecategory_collection(tenant_id)
    """Activate a purchase category (change status to active)."""
    current_datetime = get_localized_datetime()
    
    result = await collection.update_one(
        {"_id": ObjectId(purchasecategory_id)},
        {"$set": {
            'status': 'active',
            'lastUpdatedDate': current_datetime
        }}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="PurchaseCategory not found")
    
    # Return the updated category
    updated_category = await collection.find_one({"_id": ObjectId(purchasecategory_id)})
    if updated_category:
        updated_category["purchasecategoryId"] = str(updated_category["_id"])
        del updated_category["_id"]
        return PurchaseCategory(**updated_category)
    
    raise HTTPException(status_code=404, detail="PurchaseCategory not found after update")

