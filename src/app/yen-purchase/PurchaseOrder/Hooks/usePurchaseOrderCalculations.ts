// src/features/yen-purchase/PurchaseOrder/Hooks/usePurchaseOrderCalculations.ts

import { useState, useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { Item, Freight } from '../../../../Models/purchaseModel';
import { calculateTotals, calculateTaxDetails } from '../Utils/purchaseOrderHelpers';
import { setReduxTotals } from '../../../../features/yen-purchase/PurchaseOrder/purchaseOrderSlice';

interface UsePurchaseOrderCalculationsProps {
  items: Item[];
  freights: Freight[];
  overallDiscountMode: 'percentage' | 'amount';
  overallDiscountValue: number;
  roundOffValue: number;
  dispatch: any;
}

export const usePurchaseOrderCalculations = ({
  items,
  freights,
  overallDiscountMode,
  overallDiscountValue,
  roundOffValue,
  dispatch
}: UsePurchaseOrderCalculationsProps) => {
  const [calculationLoading, setCalculationLoading] = useState(false);

  // Memoize totals calculation
  const totals = useMemo(() => 
    calculateTotals(items, freights, overallDiscountMode, overallDiscountValue, roundOffValue),
    [items, freights, overallDiscountMode, overallDiscountValue, roundOffValue]
  );

  // Memoize tax details
  const taxDetails = useMemo(() => 
    calculateTaxDetails(items),
    [items]
  );

  // Update Redux when totals change
  useEffect(() => {
    dispatch(setReduxTotals({
      pendingOrderAmount: totals.roundedTotalOrderAmount,
      pendingDiscountAmount: totals.roundedTotalDiscount,
      pendingTaxAmount: totals.roundedTotalTax,
      totalFreightAmount: totals.freightAmountTotal,
      totalFreightTaxAmount: totals.freightTaxTotal,
    }));
  }, [totals, dispatch]);

  return {
    totals,
    taxDetails,
    calculationLoading,
    setCalculationLoading
  };
};