# freight_calculation.py
import re
from fastapi import APIRouter, HTTPException, Query,Request
from typing import Dict, Optional, Literal
from pydantic import BaseModel, Field

router = APIRouter()

class FreightCalculationRequest(BaseModel):
    amt: float
    tCode: str
    taxType: Literal["cgst_sgst", "igst"]

class FreightCalculationResponse(BaseModel):
    amt: float
    tAmt: float
    totalAmt: float
    sgst: float
    cgst: float
    igst: float
    taxPercentage: float

# Purchase Order Totals Calculation
class PurchaseOrderTotalsRequest(BaseModel):
    items: list
    freights: list

class PurchaseOrderTotalsResponse(BaseModel):
    subTotal: float
    totalDiscount: float
    totalTax: float
    totalFreightAmount: float
    totalFreightTaxAmount: float
    finalAmount: float
    itemTaxAmount: float
    freightTaxAmount: float
    amountAfterDiscount: float

class Freight(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None
    tCode: Optional[str] = None
    amt: Optional[float] = None
    tAmt: Optional[float] = None
    totalAmt: Optional[float] = None
    sgst: Optional[float] = Field(None, ge=0, description="SGST amount")
    cgst: Optional[float] = Field(None, ge=0, description="CGST amount")
    igst: Optional[float] = Field(None, ge=0, description="IGST amount")
    taxType: Optional[Literal["cgst_sgst", "igst"]] = None

def extract_tax_percentage(tax_code: str) -> float:
    """
    Extract tax percentage from various tax code formats
    Examples: "Tax @ 5", "GST-18%", "18%", "5", "IGST-12%", "0", "0%", "Tax @ 0"
    """
    try:
        # Remove common prefixes and suffixes
        clean_code = tax_code.upper()
        
        # Remove common prefixes
        prefixes = ['TAX @', 'GST-', 'IGST-', 'CGST-', 'SGST-', 'TAX']
        for prefix in prefixes:
            clean_code = clean_code.replace(prefix, '')
        
        # Remove percentage signs and any non-numeric characters except decimal point
        clean_code = re.sub(r'[^\d.]', '', clean_code)
        
        # Extract the first number found
        if clean_code:
            tax_percentage = float(clean_code)
            return tax_percentage
        else:
            raise ValueError("No numeric value found in tax code")
            
    except Exception as e:
        raise ValueError(f"Invalid tax code format: {tax_code}")

@router.get("/freight/totals", response_model=FreightCalculationResponse)
async def calculate_freight_totals(request:Request,
    amt: float = Query(..., gt=0, description="Freight amount"),
    tCode: str = Query(..., description="Tax code (e.g., 'Tax @ 5', 'GST-18%', '18', '0')"),
    taxType: Literal["cgst_sgst", "igst"] = Query("cgst_sgst", description="Tax type")
):
    tenant_id = request.state.tenant_id 
    """
    Calculate freight totals with tax breakdown
    """
    try:
        # Extract tax percentage from tax code
        tax_percentage = extract_tax_percentage(tCode)
        
        if tax_percentage < 0 or tax_percentage > 100:
            raise HTTPException(status_code=400, detail="Invalid tax percentage. Must be between 0 and 100.")
        
        print(f"Calculating freight: Amount={amt}, Tax%={tax_percentage}, Type={taxType}")
        
        # Calculate tax amounts based on tax type
        sgst = cgst = igst = 0
        tAmt = 0
        
        # If tax percentage is 0, all tax amounts should be 0 regardless of freight amount
        if tax_percentage == 0:
            sgst = cgst = igst = tAmt = 0
        elif taxType == "cgst_sgst":
            # Split equally for CGST/SGST
            sgst = round(amt * (tax_percentage / 2 / 100), 2)
            cgst = round(amt * (tax_percentage / 2 / 100), 2)
            tAmt = round(sgst + cgst, 2)
        else:
            # IGST
            igst = round(amt * (tax_percentage / 100), 2)
            tAmt = round(igst, 2)
        
        totalAmt = round(amt + tAmt, 2)
        
        response = FreightCalculationResponse(
            amt=round(amt, 2),
            tAmt=tAmt,
            totalAmt=totalAmt,
            sgst=sgst,
            cgst=cgst,
            igst=igst,
            taxPercentage=round(tax_percentage, 2)
        )
        
        print(f"Calculation result: {response}")
        return response
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to calculate freight totals: {str(e)}")

@router.post("/calculate-totals", response_model=PurchaseOrderTotalsResponse)
async def calculate_purchase_order_totals(request:Request,payload: PurchaseOrderTotalsRequest):
    """
    Calculate comprehensive purchase order totals including items and freights
    """
    tenant_id = request.state.tenant_id
    try:
        # Calculate item totals
        item_subtotal = sum(item.get('pendingTotalPrice', 0) for item in payload.items)
        item_tax_total = sum(item.get('pendingTaxAmount', 0) for item in payload.items)
        item_discount_total = sum(item.get('pendingDiscountAmount', 0) for item in payload.items)
        
        # Calculate freight totals
        freight_amount_total = sum(freight.get('amt', 0) for freight in payload.freights)
        freight_tax_total = sum(freight.get('tAmt', 0) for freight in payload.freights)
        
        # Calculate final amounts
        amount_after_discount = item_subtotal - item_discount_total
        final_amount = amount_after_discount + item_tax_total + freight_amount_total + freight_tax_total
        
        return PurchaseOrderTotalsResponse(
            subTotal=round(item_subtotal, 2),
            totalDiscount=round(item_discount_total, 2),
            totalTax=round(item_tax_total + freight_tax_total, 2),
            totalFreightAmount=round(freight_amount_total, 2),
            totalFreightTaxAmount=round(freight_tax_total, 2),
            finalAmount=round(final_amount, 2),
            itemTaxAmount=round(item_tax_total, 2),
            freightTaxAmount=round(freight_tax_total, 2),
            amountAfterDiscount=round(amount_after_discount, 2)
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to calculate purchase order totals: {str(e)}")