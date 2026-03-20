from fastapi import APIRouter, Query
from db.collections import ItemMaster, location   # import from your connection file

router = APIRouter()

@router.get("/global-dropdowns")
async def global_dropdowns(
    page: int = Query(1),
    limit: int = Query(50)
):

    skip = (page - 1) * limit

    # -------- VARIANCE ----------
    variance_pipeline = [
        {
            "$group": {
                "_id": "$varianceName",
                "itemCode": {"$first": "$itemCode"}
            }
        },
        {
            "$project": {
                "_id": 0,
                "label": "$_id",
                "value": "$itemCode"
            }
        },
        {"$sort": {"label": 1}},
        {"$skip": skip},
        {"$limit": limit}
    ]

    variance = await ItemMaster.aggregate(variance_pipeline).to_list(length=limit)


    # -------- LOCATION ----------
    location_pipeline = [
        {"$match": {"status": "active"}},
        {
            "$project": {
                "_id": 0,
                "label": "$branchName",
                "value": "$locationId"
            }
        },
        {"$sort": {"label": 1}},
        {"$skip": skip},
        {"$limit": limit}
    ]

    locations = await location.aggregate(location_pipeline).to_list(length=limit)


    return {
        "variance": variance,
        "locations": locations
    }
    
    
    