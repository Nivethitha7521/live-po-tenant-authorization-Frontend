// src/features/yen-purchase/PurchaseOrder/Hooks/usePurchaseOrderForm.ts

import { useState, useEffect } from 'react';
import { VendorSummary } from '@/Models/vendor';
import { Location } from '@/Models/storagelocation';
import { PurchaseItemSearchAdd, Item, Freight } from '../../../../Models/purchaseModel';
import { setSnackbarMessage, setSnackbarOpen } from '../../../../features/yen-purchase/PurchaseOrder/purchaseOrderSlice';

interface UsePurchaseOrderFormProps {
  isEditMode: boolean;
  purchaseOrderData: any;
  vendors: VendorSummary[];
  locations: Location[];
  dispatch: any;
}

export const usePurchaseOrderForm = ({
  isEditMode,
  purchaseOrderData,
  vendors,
  locations,
  dispatch
}: UsePurchaseOrderFormProps) => {
  // Date states
  const [orderDate, setOrderDate] = useState<Date | null>(() => {
    if (isEditMode && purchaseOrderData.orderDate) {
      return new Date(purchaseOrderData.orderDate);
    }
    return new Date();
  });
  
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<Date | null>(
    isEditMode && purchaseOrderData.expectedDeliveryDate ? new Date(purchaseOrderData.expectedDeliveryDate) : null
  );
  
  const [isOrderDateValid, setIsOrderDateValid] = useState(true);
  const [dateError, setDateError] = useState('');

  // Selection states
  const [vendorSearch, setVendorSearch] = useState<VendorSummary | null>(null);
  const [locationSearch, setLocationSearch] = useState<Location | null>(null);
  const [isLocationSelected, setIsLocationSelected] = useState(false);
  const [newItemsearch, setNewItemsearch] = useState<PurchaseItemSearchAdd | null>(null);
  const [selectedItemStock, setSelectedItemStock] = useState<number | null>(null);

  // Freight states
  const [freights, setFreights] = useState<Freight[]>([]);

  // Discount states
  const [overallDiscountValue, setOverallDiscountValue] = useState<number>(0);
  const [overallDiscountMode, setOverallDiscountMode] = useState<'percentage' | 'amount'>('percentage');
  const [roundOffValue, setRoundOffValue] = useState<number>(0);
  const [hasItemWiseDiscount, setHasItemWiseDiscount] = useState(false);

  // Input states
  const [countInput, setCountInput] = useState('');
  const [quantityInput, setQuantityInput] = useState('');
  const [newPriceInput, setNewPriceTypeInput] = useState('');

  // Form dirty state
  const [isFormDirty, setIsFormDirty] = useState(false);

  // Sync vendor and location in edit mode
  useEffect(() => {
    if (!isEditMode) return;

    // Sync vendor
    if (purchaseOrderData.vendorName && vendors.length > 0 && !vendorSearch) {
      const matchedVendor = vendors.find(v => v.vendorName === purchaseOrderData.vendorName);
      if (matchedVendor) {
        setVendorSearch(matchedVendor);
      }
    }

    // Sync location
    if (purchaseOrderData.locationName && locations.length > 0 && !locationSearch) {
      let matchedLocation = null;
      
      if (purchaseOrderData.locationId) {
        matchedLocation = locations.find(loc => loc.locationId === purchaseOrderData.locationId);
      }
      
      if (!matchedLocation && purchaseOrderData.locationName) {
        matchedLocation = locations.find(loc => loc.branchName === purchaseOrderData.locationName);
      }
      
      if (matchedLocation) {
        setLocationSearch(matchedLocation);
        setIsLocationSelected(true);
      }
    }
  }, [isEditMode, purchaseOrderData.vendorName, purchaseOrderData.locationName, 
      purchaseOrderData.locationId, vendors, locations, vendorSearch, locationSearch]);

  // Check for item-wise discount
  useEffect(() => {
    const hasDiscount = purchaseOrderData.items?.some((item: Item) =>
      (item.befTaxDiscount && item.befTaxDiscount > 0) || 
      (item.befTaxDiscountAmount && item.befTaxDiscountAmount > 0) ||
      (item.afTaxDiscount && item.afTaxDiscount > 0) || 
      (item.afTaxDiscountAmount && item.afTaxDiscountAmount > 0)
    ) || false;
    
    setHasItemWiseDiscount(hasDiscount);
    
    if (hasDiscount && overallDiscountValue > 0) {
      setOverallDiscountValue(0);
      dispatch(setSnackbarMessage('Overall discount reset due to item-wise discount'));
      dispatch(setSnackbarOpen(true));
    }
  }, [purchaseOrderData.items, overallDiscountValue, dispatch]);

  // Track form dirty state
  useEffect(() => {
    const hasChanges = 
      purchaseOrderData.vendorName !== '' ||
      purchaseOrderData.items?.length > 0 ||
      purchaseOrderData.billingAddress !== '' ||
      purchaseOrderData.shippingAddress !== '' ||
      purchaseOrderData.locationName !== '' ||
      purchaseOrderData.comments !== '' ||
      (purchaseOrderData.termsandConditions?.some((term: string) => term !== '')) ||
      overallDiscountValue !== 0 ||
      roundOffValue !== 0 ||
      freights.length > 0;
    
    setIsFormDirty(hasChanges);
  }, [purchaseOrderData, overallDiscountValue, roundOffValue, freights]);

  return {
    // Date states
    orderDate, 
    setOrderDate,
    expectedDeliveryDate, 
    setExpectedDeliveryDate,
    isOrderDateValid, 
    setIsOrderDateValid,
    dateError, 
    setDateError,
    
    // Selection states
    vendorSearch, 
    setVendorSearch,
    locationSearch, 
    setLocationSearch,
    isLocationSelected, 
    setIsLocationSelected,
    newItemsearch, 
    setNewItemsearch,
    selectedItemStock, 
    setSelectedItemStock,
    
    // Freight states
    freights, 
    setFreights,
    
    // Discount states
    overallDiscountValue, 
    setOverallDiscountValue,
    overallDiscountMode, 
    setOverallDiscountMode,
    roundOffValue, 
    setRoundOffValue,
    hasItemWiseDiscount,
    
    // Input states
    countInput, 
    setCountInput,
    quantityInput, 
    setQuantityInput,
    newPriceInput, 
    setNewPriceTypeInput,
    
    // Form state
    isFormDirty,
  };
};