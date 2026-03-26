from typing import List
from fastapi import APIRouter, HTTPException
from bson import ObjectId

from utils.database import get_expensename_collection
from .models import ExpenseName, ExpenseNamePost

router = APIRouter()

@router.post("/", response_model=str)
async def create_expensename(expensename: ExpenseNamePost):
    # Prepare data for insertion
    new_expensename_data = expensename.dict()

    # Insert into MongoDB
    result = await get_expensename_collection().insert_one(new_expensename_data)
    return str(result.inserted_id)

@router.get("/", response_model=List[ExpenseName])
async def get_all_expensename():
    expensenames = await get_expensename_collection().find().to_list(length=None)
    formatted_expensename = []
    for expensename in expensenames:
        expensename["expenseNameId"] = str(expensename["_id"])
        formatted_expensename.append(ExpenseName(**expensename))
    return formatted_expensename

@router.get("/{expenseName_id}", response_model=ExpenseName)
async def get_expensename_by_id(expenseName_id: str):
    expensename = await get_expensename_collection().find_one({"_id": ObjectId(expenseName_id)})
    if expensename:
        expensename["expenseNameId"] = str(expensename["_id"])
        return ExpenseName(**expensename)
    else:
        raise HTTPException(status_code=404, detail="Expense Name not found")

@router.put("/{expenseName_id}")
async def update_expensename(expenseName_id: str, expensename: ExpenseNamePost):
    updated_expensename = expensename.dict(exclude_unset=True)  # exclude_unset=True prevents sending None values to MongoDB
    result = await get_expensename_collection().update_one({"_id": ObjectId(expenseName_id)}, {"$set": updated_expensename})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Expense Name not found")
    return {"message": "Expense Name updated successfully"}

@router.patch("/{expenseName_id}")
async def patch_expensename(expenseName_id: str, expensename_patch: ExpenseNamePost):
    existing_expensename = await get_expensename_collection().find_one({"_id": ObjectId(expenseName_id)})
    if not existing_expensename:
        raise HTTPException(status_code=404, detail="Expense Name not found")

    updated_fields = {key: value for key, value in expensename_patch.dict(exclude_unset=True).items() if value is not None}
    if updated_fields:
        result = await get_expensename_collection().update_one({"_id": ObjectId(expenseName_id)}, {"$set": updated_fields})
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to update Expense Name")

    updated_expenseName = await get_expensename_collection().find_one({"_id": ObjectId(expenseName_id)})
    updated_expenseName["_id"] = str(updated_expenseName["_id"])
    return updated_expenseName

@router.delete("/{expenseName_id}")
async def delete_expensename(expenseName_id: str):
    result = await get_expensename_collection().delete_one({"_id": ObjectId(expenseName_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Expense Name not found")
    return {"message": "Expense Name deleted successfully"}
