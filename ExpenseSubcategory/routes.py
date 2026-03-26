from typing import List
from fastapi import APIRouter, HTTPException
from bson import ObjectId

from utils.database import get_expensesubcategory_collection
from .models import ExpenseSubcategory, ExpenseSubcategoryPost

router = APIRouter()

@router.post("/", response_model=str)
async def create_expensesubcategory(expensesubcategory: ExpenseSubcategoryPost):
    # Prepare data for insertion
    new_expensesubcategory_data = expensesubcategory.dict()

    # Insert into MongoDB
    result = await get_expensesubcategory_collection().insert_one(new_expensesubcategory_data)
    return str(result.inserted_id)

@router.get("/", response_model=List[ExpenseSubcategory])
async def get_all_expensesubcategory():
    expensesubcategorys = await get_expensesubcategory_collection().find().to_list(length=None)
    formatted_expensesubcategory = []
    for expensesubcategory in expensesubcategorys:
        expensesubcategory["expenseSubcategoryId"] = str(expensesubcategory["_id"])
        formatted_expensesubcategory.append(ExpenseSubcategory(**expensesubcategory))
    return formatted_expensesubcategory

@router.get("/{expenseSubcategory_id}", response_model=ExpenseSubcategory)
async def get_expensesubcategoryby_id(expenseSubcategory_id: str):
    expensesubcategory = await get_expensesubcategory_collection().find_one({"_id": ObjectId(expenseSubcategory_id)})
    if expensesubcategory:
        expensesubcategory["expenseSubcategoryId"] = str(expensesubcategory["_id"])
        return ExpenseSubcategory(**expensesubcategory)
    else:
        raise HTTPException(status_code=404, detail="Expense Subcategory not found")

@router.put("/{expenseSubcategory_id}")
async def update_expensesubcategory(expenseSubcategory_id: str, expensesubcategory: ExpenseSubcategoryPost):
    updated_expensesubcategory = expensesubcategory.dict(exclude_unset=True)  # exclude_unset=True prevents sending None values to MongoDB
    result = await get_expensesubcategory_collection().update_one({"_id": ObjectId(expenseSubcategory_id)}, {"$set": updated_expensesubcategory})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Expense SubCategory not found")
    return {"message": "Expense SubCategory updated successfully"}

@router.patch("/{expenseSubcategory_id}")
async def patch_expensesubcategory(expenseSubcategory_id: str, expensesubcategory_patch: ExpenseSubcategoryPost):
    existing_expensesubcategory = await get_expensesubcategory_collection().find_one({"_id": ObjectId(expenseSubcategory_id)})
    if not existing_expensesubcategory:
        raise HTTPException(status_code=404, detail="Expense Subcategory not found")

    updated_fields = {key: value for key, value in expensesubcategory_patch.dict(exclude_unset=True).items() if value is not None}
    if updated_fields:
        result = await get_expensesubcategory_collection().update_one({"_id": ObjectId(expenseSubcategory_id)}, {"$set": updated_fields})
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to update Expense SubCategory")

    updated_expenseSubcategory = await get_expensesubcategory_collection().find_one({"_id": ObjectId(expenseSubcategory_id)})
    updated_expenseSubcategory["_id"] = str(updated_expenseSubcategory["_id"])
    return updated_expenseSubcategory

@router.delete("/{expenseSubcategory_id}")
async def delete_expensesubcategory(expenseSubcategory_id: str):
    result = await get_expensesubcategory_collection().delete_one({"_id": ObjectId(expenseSubcategory_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Expense Subcategory not found")
    return {"message": "Expense subcattegory deleted successfully"}
