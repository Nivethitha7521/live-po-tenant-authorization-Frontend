from typing import List
from fastapi import APIRouter, HTTPException
from bson import ObjectId
from utils.database import get_expensecategory_collection
from .models import ExpenseCategory, ExpenseCategoryPost

router = APIRouter()

@router.post("/", response_model=str)
async def create_expensecategory(expensecategory: ExpenseCategoryPost):
    # Prepare data for insertion
    new_expensecategory_data = expensecategory.dict()

    # Insert into MongoDB
    result = await get_expensecategory_collection().insert_one(new_expensecategory_data)
    return str(result.inserted_id)

@router.get("/", response_model=List[ExpenseCategory])
async def get_all_expensecategory():
    expensecategorys = await get_expensecategory_collection().find().to_list(length=None)
    formatted_expensecategory = []
    for expensecategory in expensecategorys:
        expensecategory["expenseCategoryId"] = str(expensecategory["_id"])
        formatted_expensecategory.append(ExpenseCategory(**expensecategory))
    return formatted_expensecategory

@router.get("/{expenseCategory_id}", response_model=ExpenseCategory)
async def get_expensecategory_by_id(expenseCategory_id: str):
    expensecategory = await get_expensecategory_collection().find_one({"_id": ObjectId(expenseCategory_id)})
    if expensecategory:
        expensecategory["expenseCategoryId"] = str(expensecategory["_id"])
        return ExpenseCategory(**expensecategory)
    else:
        raise HTTPException(status_code=404, detail="Expense Category not found")

@router.put("/{expenseCategory_id}")
async def update_expensecategory(expenseCategory_id: str, expensecategory: ExpenseCategoryPost):
    updated_expensecategory = expensecategory.dict(exclude_unset=True)  # exclude_unset=True prevents sending None values to MongoDB
    result = await get_expensecategory_collection().update_one({"_id": ObjectId(expenseCategory_id)}, {"$set": updated_expensecategory})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Expense Category not found")
    return {"message": "Expense Category updated successfully"}

@router.patch("/{expenseCategory_id}")
async def patch_expensecategory(expenseCategory_id: str, expensecategory_patch: ExpenseCategoryPost):
    existing_expensecategory = await get_expensecategory_collection().find_one({"_id": ObjectId(expenseCategory_id)})
    if not existing_expensecategory:
        raise HTTPException(status_code=404, detail="Expense Category not found")

    updated_fields = {key: value for key, value in expensecategory_patch.dict(exclude_unset=True).items() if value is not None}
    if updated_fields:
        result = await get_expensecategory_collection().update_one({"_id": ObjectId(expenseCategory_id)}, {"$set": updated_fields})
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to update Expense Category")

    updated_expenseCategory = await get_expensecategory_collection().find_one({"_id": ObjectId(expenseCategory_id)})
    updated_expenseCategory["_id"] = str(updated_expenseCategory["_id"])
    return updated_expenseCategory

@router.delete("/{expenseCategory_id}")
async def delete_expensecategory(expenseCategory_id: str):
    result = await get_expensecategory_collection().delete_one({"_id": ObjectId(expenseCategory_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Expense Category not found")
    return {"message": "Expense Category deleted successfully"}
