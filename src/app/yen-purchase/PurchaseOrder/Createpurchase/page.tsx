"use client";
import React, { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, TextField, Button, Typography, Grid, Paper, TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  Autocomplete, Snackbar, IconButton, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, RadioGroup,
  FormControlLabel, Radio, CircularProgress, Tooltip, Backdrop, Switch, FormControl,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import {
  addPurchaseOrder, fetchPurchaseOrders, fetchAllVendors, selectPurchaseOrderState, setPurchaseOrderData,
  setNewItemData, addItemToPurchaseOrder, setSnackbarMessage, clearSnackbarMessage, setSnackbarOpen,
  setItemForEditing, clearItemForEditing, deleteItemFromPurchaseOrder, calculateItemTotals, setReduxTotals,
  importCsvItems, downloadCsvTemplate, clearImportResults, setImportDialogOpen, setDiscountMode,
  calculateOverallDiscountForAllItems, fetchPurchaseOrderById, updatePurchaseOrder,
} from '../../../../features/yen-purchase/PurchaseOrder/purchaseOrderSlice';
import { addShipping, fetchBusinesses, fetchShipping, selectBusinesses } from '@/features/account-setting/businessSlice';
import { fetchLocations, selectStorageLocations } from '../../../../features/yen-purchase/PurchaseMaster/StorageLocationSlice';
import { AppDispatch, RootState } from '@/redux/store';
import { useRouter, useSearchParams } from 'next/navigation';
import { Item, PurchaseItemSearchAdd } from '../../../../Models/purchaseModel';
import { ShippingAddress } from '@/Models/businessModel';
import { Location } from '@/Models/storagelocation';
import PurchaseItemAutocomplete from '../../../../components/yen-purchase/pocreationcomponent/purchaseautocomplete';
import VendorAutocomplete from '../../../../components/yen-purchase/pocreationcomponent/vendorautocomplete';
import LocationAutocomplete from '../../../../components/yen-purchase/pocreationcomponent/locationautocomplete';
import { searchPurchaseItems } from '@/features/yen-purchase/PurchaseMaster/purchaseItemSlice';
import * as Yup from 'yup';
import { useBeforeUnload } from 'react-use';
import { VendorSummary } from '@/Models/vendor';
import ClearIcon from '@mui/icons-material/Clear';
import SmartDatePicker from '@/components/SmartDatePicker';
// Validation schema
const validationSchema = Yup.object({
  vendorName: Yup.string().required('Vendor name is required'),
  billingAddress: Yup.string().required('Billing address is required'),
  shippingAddress: Yup.string().required('Shipping address is required'),
  locationName: Yup.string().required('Location is required'),
  paymentTerms: Yup.string().required('Payment terms are required'),
  creditLimit: Yup.number().required('Credit limit is required').min(0, 'Credit limit must be non-negative'),
});
// Rounding functions
const roundPrice = (price: number): number => Math.round(price * 100) / 100;
const CreatePurchasePage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams?.get('edit') ?? null;
  const isEditMode = !!editId;
  const { purchaseOrderData, newItem, importDuplicates, importErrors, importDialogOpen, importWarnings, importSuccessMessages, importUpdatedItems, searchQuery, snackbarOpen, skip, limit, snackbarMessage } = useSelector(selectPurchaseOrderState);
  const { businesses, shippingaddress } = useSelector(selectBusinesses);
  const { location: locations, loading: locationsLoading } = useSelector(selectStorageLocations);
  const discountMode = useSelector((state: RootState) => state.purchaseOrder.discountMode ?? 'percentage') as 'percentage' | 'amount';
  const [open, setDialogOpen] = useState(false);
  const [openShippingDialog, setOpenShippingDialog] = useState(false);
  const [updatedShippingRow, setUpdatedShippingRow] = useState<ShippingAddress | null>(null);
  const [totals, setTotals] = useState({
    subTotal: 0,
    roundedTotalOrderAmount: 0,
    roundedTotalDiscount: 0,
    roundedTotalTax: 0,
    overallDiscountAmount: 0,
    itemDiscountAmount: 0,
    taxAmount: 0,
    afterDiscount: 0,
  });
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [errors, setErrors] = useState({ itemName: false, pendingCount: false, pendingQuantity: false, newPrice: false });
  const [formErrors, setFormErrors] = useState({ vendorName: false, billingAddress: false, shippingAddress: false, locationName: false, paymentTerms: false, creditLimit: false });
  const [newItemsearch, setNewItemsearch] = useState<PurchaseItemSearchAdd | null>(null);
  const [vendorSearch, setVendorSearch] = useState<VendorSummary | null>(null);
  const [locationSearch, setLocationSearch] = useState<Location | null>(null);
  // Assuming this selector exists; add to purchaseOrderSlice if needed
  const { vendors } = useSelector(selectPurchaseOrderState); // ADD: vendors array from Redux
  const [showNavigationConfirm, setShowNavigationConfirm] = useState(false);
  const [hasItemWiseDiscount, setHasItemWiseDiscount] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const [isHoldOrderDialog, setIsHoldOrderDialog] = useState(false);
  const [countInput, setCountInput] = useState<string>('');
  const [quantityInput, setQuantityInput] = useState<string>('');
  const [newPriceInput, setNewPriceTypeInput] = useState<string>('');
  const [overallDiscountValue, setOverallDiscountValue] = useState<number>(0);
  const [overallDiscountMode, setOverallDiscountMode] = useState<'percentage' | 'amount'>('percentage');
  const [roundOffValue, setRoundOffValue] = useState<number>(0);
  const [orderLoading, setOrderLoading] = useState(false);
  const itemNameRef = useRef<HTMLInputElement | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // CRITICAL: Fetch purchase order data when in edit mode
  useEffect(() => {
    const fetchOrderData = async () => {
      if (isEditMode && editId) {
        setOrderLoading(true);
        try {
          console.log('Fetching purchase order data for ID:', editId);
          const result = await dispatch(fetchPurchaseOrderById(editId)).unwrap();
          console.log('Fetched order data:', result);

          if (result) {
            dispatch(setPurchaseOrderData({
              ...result,
              orderDate: result.orderDate || new Date().toISOString(),
              expectedDeliveryDate: result.expectedDeliveryDate || new Date().toISOString(),
              items: result.items || [],
              termsandConditions: result.termsandConditions || [''],
            }));
          }
        } catch (error) {
          console.error('Failed to fetch purchase order:', error);
          dispatch(setSnackbarMessage('Failed to load purchase order data'));
          dispatch(setSnackbarOpen(true));
        } finally {
          setOrderLoading(false);
        }
      }
    };
    fetchOrderData();
  }, [isEditMode, editId, dispatch]);
 useEffect(() => {
  if (isEditMode && purchaseOrderData.vendorName && vendors.length > 0) {  // vendors.length > 0 fails if not fetched
    const matchedVendor = vendors.find((vendor: VendorSummary) =>
      vendor.vendorName === purchaseOrderData.vendorName
    );
    if (matchedVendor && !vendorSearch) {
      setVendorSearch(matchedVendor);  // This never runs without vendors
    }
  }
}, [isEditMode, purchaseOrderData.vendorName, vendors, vendorSearch]);
  // NEW: Auto-select location in edit mode after data loads
  useEffect(() => {
    if (isEditMode && purchaseOrderData.locationName && locations.length > 0) {
      const matchedLocation = locations.find((loc: Location) => loc.branchName === purchaseOrderData.locationName);
      if (matchedLocation && !locationSearch) {
        setLocationSearch(matchedLocation);
      }
    }
  }, [isEditMode, purchaseOrderData.locationName, locations, locationSearch]);
  // Reset form when component mounts in create mode
  useEffect(() => {
    if (!isEditMode) {
      // Clear form for create mode
      const currentDate = new Date().toISOString();
      dispatch(setPurchaseOrderData({
        purchaseOrderId: '',
        vendorName: '',
        vendorContact: '',
        orderDate: currentDate,
        expectedDeliveryDate: currentDate,
        poStatus: '',
        items: [],
        pendingOrderAmount: 0,
        creditLimit: 0,
        paymentTerms: '',
        shippingAddress: '',
        billingAddress: '',
        locationName: '',
        comments: '',
        termsandConditions: [''],
        contactpersonEmail: '',
        address: '',
        country: '',
        state: '',
        city: '',
        postalCode: 0,
        gstNumber: '',
      }));
    }
  }, [isEditMode, dispatch]);
  // Set default shipping address
  useEffect(() => {
    if (shippingaddress.length > 0 && !purchaseOrderData.shippingAddress) {
      const defaultShippingAddress = shippingaddress[0].address ?? '';
      dispatch(setPurchaseOrderData({
        ...purchaseOrderData,
        shippingAddress: defaultShippingAddress
      }));
      setFormErrors(prev => ({ ...prev, shippingAddress: false }));
    }
  }, [shippingaddress, purchaseOrderData.shippingAddress, dispatch]);
  // Set default billing address
  useEffect(() => {
    if (businesses.length === 1 && !purchaseOrderData.billingAddress) {
      const defaultBillingAddress = `${businesses[0].address1 ?? ''} ${businesses[0].address2 ?? ''}`.trim();
      dispatch(setPurchaseOrderData({ ...purchaseOrderData, billingAddress: defaultBillingAddress }));
    }
  }, [businesses, purchaseOrderData, dispatch]);
  // Set default dates
  useEffect(() => {
    const currentDate = new Date().toISOString();
    const updatedData = { ...purchaseOrderData };
    if (!purchaseOrderData.orderDate) {
      updatedData.orderDate = currentDate;
    }
    if (!purchaseOrderData.expectedDeliveryDate) {
      updatedData.expectedDeliveryDate = currentDate;
    }
    if (!purchaseOrderData.orderDate || !purchaseOrderData.expectedDeliveryDate) {
      dispatch(setPurchaseOrderData(updatedData));
    }
  }, [dispatch, purchaseOrderData.orderDate, purchaseOrderData.expectedDeliveryDate]);
  // Track form dirty state
  useEffect(() => {
    const hasChanges =
      purchaseOrderData.vendorName !== '' ||
      purchaseOrderData.items.length > 0 ||
      purchaseOrderData.billingAddress !== '' ||
      purchaseOrderData.shippingAddress !== '' ||
      purchaseOrderData.locationName !== '' ||
      purchaseOrderData.comments !== '' ||
      purchaseOrderData.termsandConditions.some((term) => term !== '') ||
      overallDiscountValue !== 0 ||
      roundOffValue !== 0;
    setIsFormDirty(hasChanges);
  }, [purchaseOrderData, overallDiscountValue, roundOffValue]);
  useBeforeUnload(isFormDirty, 'You have unsaved changes. Are you sure you want to leave?');
  // Sync input fields with Redux state
  useEffect(() => {
    setCountInput(newItem.pendingCount === 0 ? '' : newItem.pendingCount.toString());
    setQuantityInput(newItem.pendingQuantity === 0 ? '' : newItem.pendingQuantity.toString());
    if (newItem.newPrice !== 0 && newPriceInput === '') {
      setNewPriceTypeInput(newItem.newPrice.toString());
    } else if (newItem.newPrice === 0) {
      setNewPriceTypeInput('');
    }
  }, [newItem.pendingCount, newItem.pendingQuantity, newItem.newPrice, newPriceInput]);
  // Fetch initial data
  useEffect(() => {
    dispatch(fetchPurchaseOrders());
    dispatch(searchPurchaseItems({ searchQuery, skip, limit }));
    dispatch(fetchBusinesses());
    dispatch(fetchShipping());
    dispatch(fetchLocations());
    dispatch(fetchAllVendors());  
  }, [dispatch, searchQuery, skip, limit]);
  // Check if any item has item-wise discount
  useEffect(() => {
    const hasDiscount = purchaseOrderData.items.some(item =>
      item.befTaxDiscount > 0 ||
      item.befTaxDiscountAmount > 0 ||
      item.afTaxDiscount > 0 ||
      item.afTaxDiscountAmount > 0
    );
    setHasItemWiseDiscount(hasDiscount);
    if (hasDiscount && overallDiscountValue > 0) {
      setOverallDiscountValue(0);
      dispatch(setSnackbarMessage('Overall discount disabled due to existing item-wise discounts'));
      dispatch(setSnackbarOpen(true));
    }
  }, [purchaseOrderData.items, overallDiscountValue, dispatch]);
  // Calculate totals
  const calculateTotals = useMemo(() => {
    let subTotal = 0;
    let itemDiscountAmount = 0;
    let taxAmount = 0;
    purchaseOrderData.items.forEach((item) => {
      subTotal += item.pendingTotalPrice || 0;
      itemDiscountAmount += item.pendingDiscountAmount || 0;
      taxAmount += item.pendingTaxAmount || 0;
    });
    const overallDiscountAmount = overallDiscountMode === 'percentage'
      ? subTotal * (overallDiscountValue / 100)
      : overallDiscountValue;
    const totalDiscount = itemDiscountAmount + overallDiscountAmount;
    const afterDiscount = Math.max(0, subTotal - totalDiscount);
    const finalAmount = afterDiscount + taxAmount + roundOffValue;
    return {
      subTotal: roundPrice(subTotal),
      roundedTotalOrderAmount: roundPrice(finalAmount),
      roundedTotalDiscount: roundPrice(totalDiscount),
      roundedTotalTax: roundPrice(taxAmount),
      overallDiscountAmount: roundPrice(overallDiscountAmount),
      itemDiscountAmount: roundPrice(itemDiscountAmount),
      taxAmount: roundPrice(taxAmount),
      afterDiscount: roundPrice(afterDiscount),
    };
  }, [purchaseOrderData.items, overallDiscountMode, overallDiscountValue, roundOffValue]);
  // Update totals and Redux state
  useEffect(() => {
    const newTotals = calculateTotals;
    setTotals(newTotals);
    dispatch(setReduxTotals({
      pendingOrderAmount: newTotals.roundedTotalOrderAmount,
      pendingDiscountAmount: newTotals.roundedTotalDiscount,
      pendingTaxAmount: newTotals.roundedTotalTax,
    }));
  }, [calculateTotals, dispatch]);
  // Handler functions (MOVED BEFORE EARLY RETURN TO FIX HOOK ERROR)
  const handleOrderDateChange = (date: Date | null) => {
    const finalDate = date || new Date();
    dispatch(setPurchaseOrderData({
      ...purchaseOrderData,
      orderDate: finalDate.toISOString()
    }));
  };
  const handleExpectedDeliveryDateChange = (date: Date | null) => {
    const finalDate = date || new Date();
    dispatch(setPurchaseOrderData({
      ...purchaseOrderData,
      expectedDeliveryDate: finalDate.toISOString()
    }));
  };
  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  const handleCloseImportDialog = () => {
    dispatch(setImportDialogOpen(false));
    dispatch(clearImportResults());
    dispatch(clearSnackbarMessage());
    resetFileInput();
  };
  const handleBackToPO = () => {
    if (isFormDirty) {
      setPendingNavigation(() => () => {
        handleClear();
        router.push('/yen-purchase/PurchaseOrder');
      });
      setShowNavigationConfirm(true);
    } else {
      handleClear();
      router.push('/yen-purchase/PurchaseOrder');
    }
  };
  const handleOverallDiscountChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d{0,6}(\.\d{0,2})?$/.test(value)) {
      const parsedValue = value === '' ? 0 : parseFloat(value) || 0;
      const maxDiscount = overallDiscountMode === 'percentage'
        ? 99.99
        : totals.subTotal - 0.01;
      if (parsedValue > maxDiscount) {
        dispatch(setSnackbarMessage(
          `Discount cannot be ${parsedValue}${overallDiscountMode === 'percentage' ? '%' : ''}. Maximum allowed is ${maxDiscount.toFixed(2)}`
        ));
        dispatch(setSnackbarOpen(true));
        return;
      }
      setOverallDiscountValue(parsedValue);
    }
  };
  const setOverallDiscountModeWithConversion = async (newMode: 'percentage' | 'amount') => {
    if (hasItemWiseDiscount) {
      dispatch(setSnackbarMessage('Cannot change discount mode when item-wise discounts exist'));
      dispatch(setSnackbarOpen(true));
      return;
    }
    if (newMode === overallDiscountMode) return;
    let newValue = 0;
    if (overallDiscountValue > 0 && totals.subTotal > 0) {
      newValue = overallDiscountMode === 'percentage'
        ? (overallDiscountValue / 100) * totals.subTotal
        : (overallDiscountValue / totals.subTotal) * 100;
      newValue = roundPrice(newValue);
    }
    setOverallDiscountMode(newMode);
    setOverallDiscountValue(newValue);
  };
  const setItemDiscountModeWithConversion = (newMode: 'percentage' | 'amount') => {
    if (newMode === discountMode) return;
    let newBefTaxDiscount = 0;
    let newAfTaxDiscount = 0;
    let newBefTaxDiscountAmount = 0;
    let newAfTaxDiscountAmount = 0;
    const totalPrice = newItem.pendingTotalQuantity * newItem.newPrice;
    const priceAfterBefDiscount = totalPrice - (newItem.befTaxDiscountAmount || 0);
    const priceAfterTax = priceAfterBefDiscount + (newItem.taxPercentage / 100 * priceAfterBefDiscount);
    if (totalPrice > 0) {
      if (discountMode === 'percentage') {
        newBefTaxDiscountAmount = newItem.befTaxDiscount > 0 ? (newItem.befTaxDiscount / 100) * totalPrice : 0;
        newAfTaxDiscountAmount = newItem.afTaxDiscount > 0 ? (newItem.afTaxDiscount / 100) * priceAfterTax : 0;
      } else {
        newBefTaxDiscount = newItem.befTaxDiscountAmount > 0 ? (newItem.befTaxDiscountAmount / totalPrice) * 100 : 0;
        newAfTaxDiscount = newItem.afTaxDiscountAmount > 0 ? (newItem.afTaxDiscountAmount / priceAfterTax) * 100 : 0;
      }
    }
    dispatch(setDiscountMode({ mode: newMode }));
    dispatch(setNewItemData({
      ...newItem,
      befTaxDiscount: roundPrice(newBefTaxDiscount),
      afTaxDiscount: roundPrice(newAfTaxDiscount),
      befTaxDiscountAmount: roundPrice(newBefTaxDiscountAmount),
      afTaxDiscountAmount: roundPrice(newAfTaxDiscountAmount),
      pendingAfTaxDiscountAmount: roundPrice(newAfTaxDiscountAmount),
      befTaxDiscountType: newMode,
      afTaxDiscountType: newMode,
    }));
  };
  const handleSelectAddressChange = useCallback(
    (name: string, value: string | null) => {
      const updatedData = { ...purchaseOrderData, [name]: value ?? '' };
      if (name === 'billingAddress') {
        const selectedBusiness = businesses.find((business) => `${business.address1 ?? ''} ${business.address2 ?? ''}`.trim() === value);
        updatedData.billingAddress = selectedBusiness ? `${selectedBusiness.address1 ?? ''} ${selectedBusiness.address2 ?? ''}`.trim() : value ?? '';
        if (updatedData.billingAddress && updatedData.billingAddress.trim() !== '') {
          setFormErrors((prev) => ({ ...prev, billingAddress: false }));
        }
      } else if (name === 'shippingAddress') {
        const selectedShippingAddress = shippingaddress.find((address) => address.address === value);
        updatedData.shippingAddress = selectedShippingAddress ? selectedShippingAddress.address : value ?? '';
        if (updatedData.shippingAddress && updatedData.shippingAddress.trim() !== '') {
          setFormErrors((prev) => ({ ...prev, shippingAddress: false }));
        }
      }
      dispatch(setPurchaseOrderData(updatedData));
    },
    [dispatch, purchaseOrderData, businesses, shippingaddress]
  );
  const handleLocationChange = useCallback((location: Location | null) => {
    setLocationSearch(location);
    dispatch(setPurchaseOrderData({
      ...purchaseOrderData,
      locationName: location?.branchName || ''
    }));
    setFormErrors(prev => ({ ...prev, locationName: false }));
  }, [dispatch, purchaseOrderData]);
  const handleTextFieldChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, index?: number) => {
    const { name, value } = e.target;
    if (index !== undefined) {
      dispatch(setPurchaseOrderData({
        ...purchaseOrderData,
        termsandConditions: purchaseOrderData.termsandConditions.map((term, i) => (i === index ? value : term)),
      }));
    } else {
      dispatch(setPurchaseOrderData({ ...purchaseOrderData, [name]: value }));
      setFormErrors({ ...formErrors, [name]: false });
    }
  };
  const toggleFullScreen = () => {
    setIsFullScreen((prev) => !prev);
  };
  const handleAddTerm = () => {
    if (purchaseOrderData.termsandConditions.length < 3) {
      dispatch(setPurchaseOrderData({
        ...purchaseOrderData,
        termsandConditions: [...purchaseOrderData.termsandConditions, ''],
      }));
    }
  };
  const handleRemoveTerm = (index: number) => {
    dispatch(setPurchaseOrderData({
      ...purchaseOrderData,
      termsandConditions: purchaseOrderData.termsandConditions.filter((_, i) => i !== index),
    }));
  };
  const handleRoundOffChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^-?\d*\.?\d{0,2}$/.test(value)) {
      const parsedValue = value === '' ? 0 : parseFloat(value) || 0;
      setRoundOffValue(parsedValue);
    }
  };
  const handleItemSelection = (item: PurchaseItemSearchAdd | null) => {
    if (item) {
      setNewItemsearch(item);
      dispatch(setNewItemData({
        itemId: item.purchaseitemId,
        itemName: item.itemName,
        pendingCount: 1,
        pendingQuantity: 0,
        pendingTotalQuantity: 0,
        existingPrice: item.purchasePrice,
        newPrice: item.purchasePrice,
        taxPercentage: item.purchasetaxName,
        uom: item.uom,
        priceVariance: 0,
        purchasecategoryName: item.purchasecategoryName,
        purchasesubcategoryName: item.purchasesubcategoryName,
        hsnCode: item.hsnCode,
        befTaxDiscount: 0,
        afTaxDiscount: 0,
        befTaxDiscountAmount: 0,
        afTaxDiscountAmount: 0,
        pendingTotalPrice: 0,
        taxType: 'cgst_sgst',
        befTaxDiscountType: discountMode,
        afTaxDiscountType: discountMode,
      }));
      setCountInput('1');
      setQuantityInput('');
      setNewPriceTypeInput(item.purchasePrice.toString());
    } else {
      setNewItemsearch(null);
      dispatch(setNewItemData({
        itemId: '',
        itemName: '',
        quantity: 0,
        count: 0,
        eachQuantity: 0,
        existingPrice: 0,
        newPrice: 0,
        taxPercentage: 0,
        uom: '',
        purchasecategoryName: '',
        purchasesubcategoryName: '',
        hsnCode: '',
        befTaxDiscount: 0,
        afTaxDiscount: 0,
        befTaxDiscountAmount: 0,
        afTaxDiscountAmount: 0,
        pendingTotalPrice: 0,
        taxType: 'cgst_sgst',
        befTaxDiscountType: discountMode,
        afTaxDiscountType: discountMode,
        pendingCount: 0,
        pendingQuantity: 0,
        pendingTotalQuantity: 0,
      }));
      setCountInput('');
      setQuantityInput('');
      setNewPriceTypeInput('');
    }
  };
  const handleClear = () => {
    const currentDate = new Date().toISOString();
    dispatch(setPurchaseOrderData({
      purchaseOrderId: '',
      vendorName: '',
      vendorContact: '',
      orderDate: currentDate,
      expectedDeliveryDate: currentDate,
      poStatus: '',
      items: [],
      pendingOrderAmount: 0,
      creditLimit: 0,
      paymentTerms: '',
      shippingAddress: '',
      billingAddress: '',
      locationName: '',
      comments: '',
      termsandConditions: [''],
      contactpersonEmail: '',
      address: '',
      country: '',
      state: '',
      city: '',
      postalCode: 0,
      gstNumber: '',
    }));
    dispatch(setNewItemData({
      itemId: '',
      itemName: '',
      quantity: 0,
      count: 0,
      eachQuantity: 0,
      existingPrice: 0,
      newPrice: 0,
      taxPercentage: 0,
      totalPrice: 0,
      befTaxDiscount: 0,
      afTaxDiscount: 0,
      befTaxDiscountAmount: 0,
      afTaxDiscountAmount: 0,
      uom: '',
      pendingCount: 0,
      pendingQuantity: 0,
      pendingTotalQuantity: 0,
      purchasecategoryName: '',
      purchasesubcategoryName: '',
      hsnCode: '',
      taxType: 'cgst_sgst',
      pendingTotalPrice: 0,
      befTaxDiscountType: discountMode,
      afTaxDiscountType: discountMode,
    }));
    setVendorSearch(null);
    setLocationSearch(null);
    setNewItemsearch(null);
    setCountInput('');
    setQuantityInput('');
    setNewPriceTypeInput('');
    setOverallDiscountValue(0);
    setOverallDiscountMode('percentage');
    setRoundOffValue(0);
    setIsFormDirty(false);
    setFormErrors({ vendorName: false, billingAddress: false, shippingAddress: false, locationName: false, paymentTerms: false, creditLimit: false });
    // If in edit mode, go back to list
    if (isEditMode) {
      router.push('/yen-purchase/PurchaseOrder');
    }
  };
  const enforceOneDiscount = (name: string, value: number) => {
    const updatedItem = { ...newItem, [name]: value };
    if (name === 'befTaxDiscount' || name === 'befTaxDiscountAmount') {
      updatedItem.afTaxDiscount = 0;
      updatedItem.afTaxDiscountAmount = 0;
      updatedItem.pendingAfTaxDiscountAmount = 0;
    } else if (name === 'afTaxDiscount' || name === 'afTaxDiscountAmount') {
      updatedItem.befTaxDiscount = 0;
      updatedItem.befTaxDiscountAmount = 0;
    }
    dispatch(setNewItemData(updatedItem));
  };
  const handleItemChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'pendingCount' || name === 'pendingQuantity') {
      if (value === '' || /^\d*\.?\d{0,3}$/.test(value)) {
        if (name === 'pendingCount') {
          setCountInput(value);
          const parsedValue = value === '' ? 0 : parseFloat(value) || 0;
          dispatch(setNewItemData({
            ...newItem,
            pendingCount: parsedValue,
            pendingTotalQuantity: parsedValue * newItem.pendingQuantity,
          }));
          setErrors({ ...errors, pendingCount: false });
        } else if (name === 'pendingQuantity') {
          setQuantityInput(value);
          const parsedValue = value === '' ? 0 : parseFloat(value) || 0;
          dispatch(setNewItemData({
            ...newItem,
            pendingQuantity: parsedValue,
            pendingTotalQuantity: newItem.pendingCount * parsedValue,
          }));
          setErrors({ ...errors, pendingQuantity: false });
        }
      }
    } else if (name === 'newPrice') {
      if (value === '' || /^\d{0,8}(\.\d{0,2})?$/.test(value)) {
        setNewPriceTypeInput(value);
        const parsedValue = value === '' ? 0 : parseFloat(value) || 0;
        dispatch(setNewItemData({
          ...newItem,
          newPrice: parsedValue,
          priceVariance: newItem.existingPrice - parsedValue,
        }));
        setErrors({ ...errors, newPrice: false });
      }
    } else if (['befTaxDiscount', 'afTaxDiscount', 'befTaxDiscountAmount', 'afTaxDiscountAmount'].includes(name)) {
      let validationPattern;
      if (discountMode === 'percentage' && (name === 'befTaxDiscount' || name === 'afTaxDiscount')) {
        validationPattern = /^\d{0,2}(\.\d{0,2})?$/;
      } else if (discountMode === 'amount' && (name === 'befTaxDiscountAmount' || name === 'afTaxDiscountAmount')) {
        validationPattern = /^\d{0,6}(\.\d{0,2})?$/;
      } else {
        validationPattern = /^\d*\.?\d{0,2}$/;
      }
      if (value === '' || validationPattern.test(value)) {
        const parsedValue = value === '' ? 0 : parseFloat(value) || 0;
        const maxValue = discountMode === 'percentage' && (name === 'befTaxDiscount' || name === 'afTaxDiscount') ? 99.99 : Infinity;
        let updatedValue = Math.min(parsedValue, maxValue);
        const totalPrice = newItem.pendingTotalQuantity * newItem.newPrice;
        if (totalPrice > 0) {
          let discountAmount = 0;
          if (discountMode === 'percentage') {
            if (name === 'befTaxDiscount' || name === 'afTaxDiscount') {
              discountAmount = (updatedValue / 100) * totalPrice;
            }
          } else {
            if (name === 'befTaxDiscountAmount' || name === 'afTaxDiscountAmount') {
              discountAmount = updatedValue;
            }
          }
          if (discountAmount >= totalPrice) {
            dispatch(setSnackbarMessage(`Discount cannot be ${updatedValue}${discountMode === 'percentage' ? '%' : ''} as it would make the final price negative or zero. Maximum allowed discount is ${discountMode === 'percentage' ? '99.99%' : (totalPrice - 0.01).toFixed(2)}`));
            dispatch(setSnackbarOpen(true));
            return;
          }
          if (discountMode === 'percentage' && (name === 'befTaxDiscount' || name === 'afTaxDiscount')) {
            if (updatedValue >= 100) {
              dispatch(setSnackbarMessage('Discount percentage cannot be 100% or more.'));
              dispatch(setSnackbarOpen(true));
              return;
            }
          }
        }
        enforceOneDiscount(name, updatedValue);
        setErrors({ ...errors, [name]: false });
      }
    } else {
      if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
        const parsedValue = value === '' ? 0 : parseFloat(value) || 0;
        dispatch(setNewItemData({ ...newItem, [name]: parsedValue }));
        setErrors({ ...errors, [name]: false });
      }
    }
    if (['befTaxDiscount', 'afTaxDiscount', 'befTaxDiscountAmount', 'afTaxDiscountAmount'].includes(name)) {
      if (value !== '' && parseFloat(value) > 0 && overallDiscountValue > 0) {
        setOverallDiscountValue(0);
        dispatch(setSnackbarMessage('Overall discount reset due to item-wise discount'));
        dispatch(setSnackbarOpen(true));
      }
    }
  };
  const handleVendorSelection = (vendor: VendorSummary | null) => {
    setVendorSearch(vendor);
    if (vendor) {
      dispatch(setPurchaseOrderData({
        ...purchaseOrderData,
        vendorName: vendor.vendorName,
        vendorContact: vendor.contactpersonPhone,
        contactpersonEmail: vendor.contactpersonEmail,
        address: vendor.address,
        country: vendor.country,
        paymentTerms: vendor.paymentTerms,
        creditLimit: vendor.creditLimit,
        state: vendor.state,
        city: vendor.city,
        postalCode: vendor.postalCode,
        gstNumber: vendor.gstNumber,
      }));
      setFormErrors({ ...formErrors, vendorName: false, paymentTerms: false, creditLimit: false });
    } else {
      dispatch(setPurchaseOrderData({
        ...purchaseOrderData,
        vendorName: '',
        vendorContact: '',
        creditLimit: 0,
        contactpersonEmail: '',
        address: '',
        country: '',
        paymentTerms: '',
        state: '',
        city: '',
        postalCode: 0,
        gstNumber: '',
      }));
    }
  };
  const handleTaxTypeChange = (event: ChangeEvent<HTMLInputElement>) => {
    dispatch(setNewItemData({ ...newItem, taxType: event.target.value as 'cgst_sgst' | 'igst' }));
  };
  const handleDiscountModeChange = (event: ChangeEvent<HTMLInputElement>) => {
    setItemDiscountModeWithConversion(event.target.value as 'percentage' | 'amount');
  };
  const handleDelete = (itemId: string) => {
    dispatch(deleteItemFromPurchaseOrder(itemId));
    dispatch(clearItemForEditing());
    setNewItemsearch(null);
    setTotals(calculateTotals);
  };
  const handleShippingChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, field: string) => {
    setUpdatedShippingRow({ ...updatedShippingRow!, [field]: e.target.value });
  };
  const handleEdit = (item: Item) => {
    const itemDiscountMode = (item.befTaxDiscountType || discountMode || 'percentage') as 'percentage' | 'amount';
    dispatch(setDiscountMode({ mode: itemDiscountMode }));
    const befDiscount = item.befTaxDiscount || 0;
    const afDiscount = item.afTaxDiscount || 0;
    const befDiscountAmount = item.befTaxDiscountAmount || 0;
    const afDiscountAmount = item.afTaxDiscountAmount || 0;
    let editedBef = itemDiscountMode === 'percentage' ? (befDiscount > 0 ? befDiscount : 0) : (befDiscountAmount > 0 ? befDiscountAmount : 0);
    let editedAf = itemDiscountMode === 'percentage' ? (afDiscount > 0 ? afDiscount : 0) : (afDiscountAmount > 0 ? afDiscountAmount : 0);
    if (editedBef > 0 && editedAf > 0) {
      editedAf = 0;
    }
    dispatch(setItemForEditing({
      ...item,
      befTaxDiscount: itemDiscountMode === 'percentage' ? editedBef : 0,
      afTaxDiscount: itemDiscountMode === 'percentage' ? editedAf : 0,
      befTaxDiscountAmount: itemDiscountMode === 'amount' ? editedBef : 0,
      afTaxDiscountAmount: itemDiscountMode === 'amount' ? editedAf : 0,
      befTaxDiscountType: itemDiscountMode,
      afTaxDiscountType: itemDiscountMode,
    }));
    const itemForSearch: PurchaseItemSearchAdd = {
      purchaseitemId: item.itemId,
      itemName: item.itemName,
      purchasePrice: item.newPrice,
      purchasetaxName: item.taxPercentage,
      uom: item.uom,
      purchasecategoryName: item.purchasecategoryName,
      purchasesubcategoryName: item.purchasesubcategoryName,
      hsnCode: item.hsnCode,
    };
    setNewItemsearch(itemForSearch);
    setCountInput(item.pendingCount.toString());
    setQuantityInput(item.pendingQuantity.toString());
    setNewPriceTypeInput(item.newPrice.toString());
    setTotals(calculateTotals);
  };
  const handleAddItem = useCallback(async () => {
    setErrors({
      itemName: !newItem.itemName,
      pendingCount: !newItem.pendingCount,
      pendingQuantity: !newItem.pendingQuantity,
      newPrice: !newItem.newPrice,
    });
    if (!newItem.itemName || !newItem.pendingCount || !newItem.pendingQuantity || !newItem.newPrice) {
      return;
    }
    if (newItem.pendingTotalQuantity <= 0 || newItem.newPrice <= 0) {
      dispatch(setSnackbarMessage('Quantity and price must be greater than zero.'));
      dispatch(setSnackbarOpen(true));
      return;
    }
    let finalBef = newItem.befTaxDiscount || 0;
    let finalBefAmount = newItem.befTaxDiscountAmount || 0;
    let finalAf = newItem.afTaxDiscount || 0;
    let finalAfAmount = newItem.afTaxDiscountAmount || 0;
    if (finalBef > 0 || finalBefAmount > 0) {
      finalAf = 0;
      finalAfAmount = 0;
      dispatch(setNewItemData({ ...newItem, afTaxDiscount: 0, afTaxDiscountAmount: 0 }));
    } else if (finalAf > 0 || finalAfAmount > 0) {
      finalBef = 0;
      finalBefAmount = 0;
      dispatch(setNewItemData({ ...newItem, befTaxDiscount: 0, befTaxDiscountAmount: 0 }));
    }
    setLoading(true);
    try {
      const params: {
        pendingTotalQuantity: number;
        poQuantity: number;
        newPrice: number;
        taxPercentage: number;
        taxType: 'cgst_sgst' | 'igst';
        befTaxDiscount?: number;
        befTaxDiscountAmount?: number;
        afTaxDiscount?: number;
        afTaxDiscountAmount?: number;
      } = {
        pendingTotalQuantity: newItem.pendingTotalQuantity,
        poQuantity: newItem.pendingTotalQuantity,
        newPrice: newItem.newPrice,
        taxPercentage: newItem.taxPercentage || 0,
        taxType: newItem.taxType,
      };
      if (discountMode === 'percentage') {
        if (finalBef > 0) params.befTaxDiscount = finalBef;
        if (finalAf > 0) params.afTaxDiscount = finalAf;
      } else {
        if (finalBefAmount > 0) params.befTaxDiscountAmount = finalBefAmount;
        if (finalAfAmount > 0) params.afTaxDiscountAmount = finalAfAmount;
      }
      await dispatch(calculateItemTotals(params)).unwrap();
      dispatch(addItemToPurchaseOrder());
      setNewItemsearch(null);
      dispatch(setNewItemData({
        itemId: '',
        itemName: '',
        quantity: 0,
        count: 0,
        eachQuantity: 0,
        existingPrice: 0,
        newPrice: 0,
        taxPercentage: 0,
        totalPrice: 0,
        befTaxDiscount: 0,
        afTaxDiscount: 0,
        befTaxDiscountAmount: 0,
        afTaxDiscountAmount: 0,
        uom: '',
        pendingCount: 0,
        pendingQuantity: 0,
        pendingTotalQuantity: 0,
        purchasecategoryName: '',
        purchasesubcategoryName: '',
        hsnCode: '',
        taxType: 'cgst_sgst',
        pendingTotalPrice: 0,
        befTaxDiscountType: discountMode,
        afTaxDiscountType: discountMode,
      }));
      setCountInput('');
      setQuantityInput('');
      setNewPriceTypeInput('');
      setTotals(calculateTotals);
      if (itemNameRef.current) itemNameRef.current.focus();
    } catch (error) {
      dispatch(setSnackbarMessage('Failed to add item. Please try again.'));
      dispatch(setSnackbarOpen(true));
    } finally {
      setLoading(false);
    }
    if ((newItem.befTaxDiscount > 0 || newItem.afTaxDiscount > 0 ||
      newItem.befTaxDiscountAmount > 0 || newItem.afTaxDiscountAmount > 0) &&
      overallDiscountValue > 0) {
      setOverallDiscountValue(0);
      dispatch(setSnackbarMessage('Overall discount reset - item with discount added'));
      dispatch(setSnackbarOpen(true));
    }
  }, [dispatch, newItem, calculateTotals, discountMode, overallDiscountValue]);
  const saveShippingAddress = () => {
    if (updatedShippingRow) {
      dispatch(addShipping({ ...updatedShippingRow, shippingId: '', randomId: '' }))
        .then(() => {
          setOpenShippingDialog(false);
          dispatch(fetchShipping());
        })
        .catch((error) => {
          dispatch(setSnackbarMessage('Failed to add shipping address.'));
          dispatch(setSnackbarOpen(true));
        });
    }
  };
  const handleCloseShippingDialog = () => {
    setOpenShippingDialog(false);
    setUpdatedShippingRow(null);
  };
  const handleOpenDialog = () => {
    validationSchema.validate(purchaseOrderData, { abortEarly: false })
      .then(() => {
        setFormErrors({ vendorName: false, billingAddress: false, shippingAddress: false, locationName: false, paymentTerms: false, creditLimit: false });
        setIsHoldOrderDialog(calculateTotals.roundedTotalOrderAmount > purchaseOrderData.creditLimit);
        setDialogOpen(true);
      })
      .catch((err: Yup.ValidationError) => {
        const newErrors = { vendorName: false, billingAddress: false, shippingAddress: false, locationName: false, paymentTerms: false, creditLimit: false };
        err.inner.forEach((error) => {
          if (error.path) newErrors[error.path as keyof typeof newErrors] = true;
        });
        setFormErrors(newErrors);
        dispatch(setSnackbarMessage('Please fill all required fields.'));
        dispatch(setSnackbarOpen(true));
      });
  };
  const handleApplyDiscount = async () => {
    if (hasItemWiseDiscount) {
      dispatch(setSnackbarMessage('Cannot apply overall discount when item-wise discounts exist'));
      dispatch(setSnackbarOpen(true));
      return;
    }
    if (overallDiscountValue <= 0) {
      dispatch(setSnackbarMessage('Please enter a valid discount amount'));
      dispatch(setSnackbarOpen(true));
      return;
    }
    if (purchaseOrderData.items.length === 0) {
      dispatch(setSnackbarMessage('Add items before applying discount'));
      dispatch(setSnackbarOpen(true));
      return;
    }
    setLoading(true);
    try {
      const allItems = purchaseOrderData.items.map((item) => {
        return {
          id: item.itemId,
          pendingTotalQuantity: item.pendingTotalQuantity || 0,
          poQuantity: item.pendingTotalQuantity || 0,
          newPrice: item.newPrice || 0,
          befTaxDiscount: 0,
          afTaxDiscount: 0,
          befTaxDiscountAmount: 0,
          afTaxDiscountAmount: 0,
          befTaxDiscountType: overallDiscountMode,
          afTaxDiscountType: overallDiscountMode,
          taxPercentage: item.taxPercentage || 0,
          taxType: item.taxType || 'cgst_sgst',
        };
      });
      const payload = {
        items: allItems,
        overallDiscount: overallDiscountMode === 'percentage' ? overallDiscountValue : 0,
        overallDiscountAmount: overallDiscountMode === 'amount' ? overallDiscountValue : 0,
        overallDiscountType: overallDiscountMode,
        applyOverallDiscount: true,
      };
      const result = await dispatch(calculateOverallDiscountForAllItems(payload)).unwrap();
      if (!result.success) {
        throw new Error(result.error || 'Failed to apply discount');
      }
      const updatedItems = purchaseOrderData.items.map(item => {
        const calculatedItem = result.items.find(calc => calc.id === item.itemId);
        if (calculatedItem) {
          const taxAmount = item.taxType === 'igst'
            ? calculatedItem.pendingIgst
            : (calculatedItem.pendingSgst || 0) + (calculatedItem.pendingCgst || 0);
          return {
            ...item,
            befTaxDiscount: 0,
            afTaxDiscount: calculatedItem.afTaxDiscount,
            befTaxDiscountAmount: 0,
            afTaxDiscountAmount: calculatedItem.afTaxDiscountAmount,
            pendingAfTaxDiscountAmount: calculatedItem.pendingAfTaxDiscountAmount,
            befTaxDiscountType: overallDiscountMode,
            afTaxDiscountType: overallDiscountMode,
            pendingFinalPrice: calculatedItem.pendingFinalPrice,
            pendingOrderAmount: calculatedItem.pendingOrderAmount,
            pendingTaxAmount: taxAmount,
            pendingDiscountAmount: calculatedItem.pendingDiscountAmount,
            pendingTotalPrice: calculatedItem.pendingTotalPrice,
            pendingSgst: calculatedItem.pendingSgst,
            pendingCgst: calculatedItem.pendingCgst,
            pendingIgst: calculatedItem.pendingIgst,
          };
        }
        return item;
      });
      dispatch(setPurchaseOrderData({
        ...purchaseOrderData,
        items: updatedItems,
        pendingOrderAmount: result.summary.totalFinalAmount,
        pendingDiscountAmount: result.summary.totalDiscountAmount,
        pendingTaxAmount: result.summary.totalTaxAmount,
      }));
      dispatch(setSnackbarMessage(
        `Successfully applied ${overallDiscountValue}${overallDiscountMode === 'percentage' ? '%' : ''} discount across all items`
      ));
      dispatch(setSnackbarOpen(true));
      setOverallDiscountValue(0);
    } catch (error) {
      console.error('Error applying overall discount:', error);
      dispatch(setSnackbarMessage(
        error instanceof Error ? error.message : 'Error applying overall discount. Please try again.'
      ));
      dispatch(setSnackbarOpen(true));
    } finally {
      setLoading(false);
    }
  };
  const removeOverallDiscount = async () => {
    setLoading(true);
    try {
      const allItems = purchaseOrderData.items.map(item => ({
        id: item.itemId,
        pendingTotalQuantity: item.pendingTotalQuantity || 0,
        poQuantity: item.pendingTotalQuantity || 0,
        newPrice: item.newPrice || 0,
        befTaxDiscount: 0,
        afTaxDiscount: 0,
        befTaxDiscountAmount: 0,
        afTaxDiscountAmount: 0,
        befTaxDiscountType: (item.befTaxDiscountType || 'percentage') as 'percentage' | 'amount',
        afTaxDiscountType: (item.afTaxDiscountType || 'percentage') as 'percentage' | 'amount',
        taxPercentage: item.taxPercentage || 0,
        taxType: item.taxType || 'cgst_sgst',
      }));
      const payload = {
        items: allItems,
        overallDiscount: 0,
        overallDiscountAmount: 0,
        overallDiscountType: overallDiscountMode,
        applyOverallDiscount: false,
      };
      const result = await dispatch(calculateOverallDiscountForAllItems(payload)).unwrap();
      if (!result.success) {
        throw new Error(result.error || 'Failed to remove discount');
      }
      const updatedItems = purchaseOrderData.items.map(item => {
        const calculatedItem = result.items.find(calc => calc.id === item.itemId);
        if (calculatedItem) {
          return {
            ...item,
            befTaxDiscount: 0,
            afTaxDiscount: 0,
            befTaxDiscountAmount: 0,
            afTaxDiscountAmount: 0,
            pendingFinalPrice: calculatedItem.pendingFinalPrice,
            pendingOrderAmount: calculatedItem.pendingOrderAmount,
            pendingTaxAmount: calculatedItem.pendingTaxAmount,
            pendingDiscountAmount: calculatedItem.pendingDiscountAmount,
            pendingAfTaxDiscountAmount: calculatedItem.pendingDiscountAmount,
            pendingTotalPrice: calculatedItem.pendingTotalPrice,
            pendingSgst: calculatedItem.pendingSgst,
            pendingCgst: calculatedItem.pendingCgst,
            pendingIgst: calculatedItem.pendingIgst,
          };
        }
        return item;
      });
      dispatch(setPurchaseOrderData({
        ...purchaseOrderData,
        items: updatedItems,
        pendingOrderAmount: result.summary.totalFinalAmount,
        pendingDiscountAmount: result.summary.totalDiscountAmount,
        pendingTaxAmount: result.summary.totalTaxAmount,
      }));
      setOverallDiscountValue(0);
      dispatch(setSnackbarMessage('Overall discount removed successfully'));
      dispatch(setSnackbarOpen(true));
    } catch (error) {
      console.error('Error removing overall discount:', error);
      dispatch(setSnackbarMessage('Error removing overall discount. Please try again.'));
      dispatch(setSnackbarOpen(true));
    } finally {
      setLoading(false);
    }
  };
  const handleSubmit = async () => {
    try {
      await validationSchema.validate(purchaseOrderData, { abortEarly: false });
      setFormErrors({ vendorName: false, billingAddress: false, shippingAddress: false, locationName: false, paymentTerms: false, creditLimit: false });
      const { roundedTotalOrderAmount, roundedTotalDiscount, roundedTotalTax } = calculateTotals;
      if (!purchaseOrderData.items.length) {
        dispatch(setSnackbarMessage('At least one item is required.'));
        dispatch(setSnackbarOpen(true));
        return;
      }
      const orderDate = purchaseOrderData.orderDate || new Date().toISOString();
      const expectedDeliveryDate = purchaseOrderData.expectedDeliveryDate || new Date().toISOString();
      const dataToSubmit = {
        ...purchaseOrderData,
        orderDate,
        expectedDeliveryDate,
        pendingOrderAmount: roundedTotalOrderAmount,
        pendingDiscountAmount: roundedTotalDiscount,
        pendingTaxAmount: roundedTotalTax,
        totalTax: roundedTotalTax,
        isHoldOrder: roundedTotalOrderAmount > purchaseOrderData.creditLimit,
        overallDiscountType: overallDiscountMode,
        overallDiscountValue: overallDiscountValue,
        discountPrice: roundedTotalDiscount,
        totalDiscount: roundedTotalDiscount,
        roundOffValue: roundOffValue,
        items: purchaseOrderData.items.map(item => ({
          ...item,
          befTaxDiscountType: item.befTaxDiscountType || 'percentage',
          afTaxDiscountType: item.afTaxDiscountType || 'percentage',
        })),
      };
      let result;
      setSubmitLoading(true);
      if (isEditMode && editId) {
        result = await dispatch(updatePurchaseOrder({ purchaseOrderId: editId, purchaseOrder: dataToSubmit })).unwrap();
        dispatch(setSnackbarMessage(
          `Purchase Order ${result.randomId || editId} successfully updated.`
        ));
      } else {
        result = await dispatch(addPurchaseOrder(dataToSubmit)).unwrap();
        dispatch(setSnackbarMessage(
          dataToSubmit.isHoldOrder
            ? `Purchase Order ${result.randomId || 'Unknown'} is on hold due to exceeding credit limit. Awaiting approval.`
            : `Purchase Order ${result.randomId || 'Unknown'} successfully created.`
        ));
      }
      dispatch(setSnackbarOpen(true));
      await dispatch(fetchPurchaseOrders());
      handleClear();
      setDialogOpen(false);
      router.push('/yen-purchase/PurchaseOrder');
    } catch (error) {
      if (error instanceof Yup.ValidationError) {
        const newErrors = { vendorName: false, billingAddress: false, shippingAddress: false, locationName: false, paymentTerms: false, creditLimit: false };
        error.inner.forEach((err) => {
          if (err.path) newErrors[err.path as keyof typeof newErrors] = true;
        });
        setFormErrors(newErrors);
      } else {
        dispatch(setSnackbarMessage(`Failed to ${isEditMode ? 'update' : 'create'} purchase order: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
      dispatch(setSnackbarOpen(true));
    } finally {
      setSubmitLoading(false);
    }
  };
  const calculateTaxDetails = () => {
    const taxDetails: { [key: string]: { pendingSgst: number; pendingCgst: number; pendingIgst: number; percentage: number } } = {};
    purchaseOrderData.items.forEach((item) => {
      const taxPercentage = item.taxPercentage || 0;
      if (!taxDetails[taxPercentage]) {
        taxDetails[taxPercentage] = {
          pendingSgst: 0,
          pendingCgst: 0,
          pendingIgst: 0,
          percentage: taxPercentage,
        };
      }
      if (item.taxType === 'igst') {
        taxDetails[taxPercentage].pendingIgst += item.pendingIgst || 0;
      } else {
        taxDetails[taxPercentage].pendingSgst += item.pendingSgst || 0;
        taxDetails[taxPercentage].pendingCgst += item.pendingCgst || 0;
      }
    });
    return taxDetails;
  };
  // Early return for loading (now after all handlers)
  if (orderLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh" flexDirection="column">
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading purchase order data...
        </Typography>
      </Box>
    );
  }
  const taxDetails = calculateTaxDetails();
  const variancePrice = (newItem.newPrice - newItem.existingPrice).toFixed(2);
  const isBefDiscountActive = newItem.befTaxDiscount > 0 || newItem.befTaxDiscountAmount > 0;
  const isAfDiscountActive = newItem.afTaxDiscount > 0 || newItem.afTaxDiscountAmount > 0;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#ffffff' }}>
      {/* Main Content */}
      <Box sx={{ flex: 1, p: 3, overflowY: 'auto', maxHeight: 'calc(100vh - 64px)' }}>
        <Box sx={{ maxWidth: '1200px', mx: 'auto' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography fontWeight={'bold'} sx={{ textDecoration: 'underline' }}>
              {isEditMode ? `Edit Purchase Order - ${purchaseOrderData.randomId || editId}` : 'Create New Purchase Order'}
            </Typography>
            <Button variant="contained" color="primary" onClick={handleBackToPO}>Back to PO</Button>
          </Box>
          {/* Debug info
          {process.env.NODE_ENV === 'development' && (
            <Box sx={{ p: 1, bgcolor: '#f5f5f5', mb: 2, borderRadius: 1 }}>
              <Typography variant="caption">
                Mode: {isEditMode ? 'Edit' : 'Create'} | ID: {purchaseOrderData.randomId || 'None'} | Items: {purchaseOrderData.items?.length || 0}
              </Typography>
            </Box>
          )} */}
          <Grid container spacing={2}>
            {/* Form Fields */}
            <Grid item xs={12} sm={3} md={2}>
              <TextField
                fullWidth
                disabled
                label="Purchase Order ID"
                name="purchaseOrderId"
                value={purchaseOrderData.purchaseOrderId || (isEditMode ? editId : 'New')}
                size="small"
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12} sm={3} md={2}>
              <VendorAutocomplete
                value={vendorSearch}
                onChange={handleVendorSelection}
                label="Select Vendor"
                error={formErrors.vendorName}
                helperText={formErrors.vendorName ? 'Vendor name is required' : ''}
              />
            </Grid>
            <Grid item xs={12} sm={3} md={2}>
              <TextField
                fullWidth
                disabled
                label="Vendor Contact Information"
                name="vendorContact"
                value={purchaseOrderData.vendorContact}
                onChange={handleTextFieldChange}
                size="small"
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12} sm={3} md={2}>
              <TextField
                fullWidth
                disabled
                label="Payment Terms"
                name="paymentTerms"
                value={purchaseOrderData.paymentTerms}
                onChange={handleTextFieldChange}
                size="small"
                variant="outlined"
                error={formErrors.paymentTerms}
                helperText={formErrors.paymentTerms ? 'Payment terms are required' : ''}
              />
            </Grid>
            <Grid item xs={12} sm={3} md={2}>
              <TextField
                fullWidth
                disabled
                label="Credit Limit"
                name="creditLimit"
                type="number"
                value={purchaseOrderData.creditLimit === 0 ? '' : purchaseOrderData.creditLimit}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || /^\d*\.?\d*$/.test(value)) {
                    dispatch(setPurchaseOrderData({ ...purchaseOrderData, creditLimit: value === '' ? 0 : parseFloat(value) || 0 }));
                    setFormErrors({ ...formErrors, creditLimit: false });
                  }
                }}
                inputProps={{ min: 0, step: '0.01' }}
                size="small"
                variant="outlined"
                error={formErrors.creditLimit}
                helperText={formErrors.creditLimit ? 'Credit limit is required' : ''}
              />
            </Grid>
            <Grid item xs={12} sm={3} md={2}>
              <SmartDatePicker
                label="Order Date"
                value={purchaseOrderData.orderDate ? new Date(purchaseOrderData.orderDate) : null}
                onChange={handleOrderDateChange}
                maxDate={new Date()}
              />
            </Grid>
            <Grid item xs={12} sm={3} md={2}>
              <SmartDatePicker
                label="Expected Delivery Date"
                value={purchaseOrderData.expectedDeliveryDate ? new Date(purchaseOrderData.expectedDeliveryDate) : null}
                onChange={handleExpectedDeliveryDateChange}
                minDate={new Date()}
              />
            </Grid>
          </Grid>
          {/* Add Item Section */}
          <Box sx={{
            p: 1,
            mb: 3,
            position: isFullScreen ? 'fixed' : 'relative',
            top: isFullScreen ? 0 : 'auto',
            left: isFullScreen ? 0 : 'auto',
            right: isFullScreen ? 0 : 'auto',
            bottom: isFullScreen ? 0 : 'auto',
            zIndex: isFullScreen ? 1200 : 'auto',
            bgcolor: isFullScreen ? 'rgba(255, 255, 255, 0.95)' : 'white',
            height: isFullScreen ? '100vh' : 'auto',
            width: isFullScreen ? '100vw' : 'auto',
            overflowY: isFullScreen ? 'auto' : 'visible',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}>
            <Box sx={{
              p: 1,
              mb: 3,
              position: 'sticky',
              top: 0,
              zIndex: 10,
              bgcolor: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <Typography variant="h6">Add Item</Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="outlined"
                  color="primary"
                  onClick={() => dispatch(downloadCsvTemplate())}
                  disabled={loading}
                >
                  Download CSV Template
                </Button>
                <Button
                  variant="outlined"
                  color="primary"
                  component="label"
                  disabled={loading}
                >
                  Import CSV
                  <input
                    type="file"
                    accept=".csv"
                    hidden
                    ref={fileInputRef}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        dispatch(importCsvItems(file)).then(() => {
                          resetFileInput();
                        });
                      }
                    }}
                  />
                </Button>
                <IconButton onClick={toggleFullScreen} color="primary">
                  {isFullScreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                </IconButton>
              </Box>
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4} md={2}>
                <PurchaseItemAutocomplete
                  value={newItemsearch}
                  onChange={handleItemSelection}
                  label="All Items"
                  error={errors.itemName}
                  helperText={errors.itemName ? 'Item name is required' : ''}
                  inputRef={itemNameRef}
                />
              </Grid>
              <Grid item xs={12} sm={4} md={0.8}>
                <TextField
                  fullWidth
                  autoComplete='off'
                  label="Pkt Count"
                  name="pendingCount"
                  type="text"
                  value={countInput}
                  onChange={handleItemChange}
                  size="small"
                  error={errors.pendingCount}
                  helperText={errors.pendingCount ? 'Count is required' : ''}
                />
              </Grid>
              <Grid item xs={12} sm={4} md={0.8}>
                <TextField
                  fullWidth
                  autoComplete='off'
                  label="Quantity"
                  name="pendingQuantity"
                  type="text"
                  value={quantityInput}
                  onChange={handleItemChange}
                  size="small"
                  error={errors.pendingQuantity}
                  helperText={errors.pendingQuantity ? 'Quantity is required' : ''}
                />
              </Grid>
              <Grid item xs={12} sm={4} md={1}>
                <TextField
                  disabled
                  fullWidth
                  label="Total Quantity"
                  name="pendingTotalQuantity"
                  type="number"
                  value={newItem.pendingTotalQuantity}
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={4} md={0.8}>
                <TextField
                  disabled
                  fullWidth
                  label="Existing Price"
                  name="existingPrice"
                  type="number"
                  value={newItem.existingPrice.toFixed(2)}
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={4} md={0.8}>
                <TextField
                  fullWidth
                  label="New Price"
                  name="newPrice"
                  type="text"
                  value={newPriceInput}
                  onChange={handleItemChange}
                  size="small"
                  inputProps={{ min: '0' }}
                  error={errors.newPrice}
                  helperText={errors.newPrice ? 'New price is required' : ''}
                />
              </Grid>
              <Grid item xs={12} sm={2} md={0.8}>
                <TextField
                  disabled
                  fullWidth
                  label="Price Variance"
                  name="priceVariance"
                  type="number"
                  value={newItem.priceVariance.toFixed(2)}
                  size="small"
                  sx={{ '& .MuiInputBase-input': { color: newItem.priceVariance > 0 ? 'green' : newItem.priceVariance < 0 ? 'red' : 'black' } }}
                />
              </Grid>
              <Grid item xs={12} sm={4} md={0.8}>
                <TextField
                  disabled
                  fullWidth
                  label="UOM"
                  name="uom"
                  value={newItem.uom}
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={4} md={0.8}>
                <TextField
                  disabled
                  fullWidth
                  label="Tax(%)"
                  name="taxPercentage"
                  type="number"
                  value={newItem.taxPercentage}
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={4} md={0.8}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Tooltip title={`Before Tax Discount (${discountMode === 'percentage' ? '%' : '₹'}) - Disabled if After Tax is set`}>
                    <TextField
                      fullWidth
                      autoComplete='off'
                      label={`Before Tax Discount (${discountMode === 'percentage' ? '%' : '₹'})`}
                      name={discountMode === 'percentage' ? 'befTaxDiscount' : 'befTaxDiscountAmount'}
                      type="number"
                      value={
                        discountMode === 'percentage'
                          ? (newItem.befTaxDiscount === 0 ? '' : newItem.befTaxDiscount.toString())
                          : (newItem.befTaxDiscountAmount === 0 ? '' : newItem.befTaxDiscountAmount.toString())
                      }
                      onChange={handleItemChange}
                      disabled={isAfDiscountActive}
                      inputProps={{
                        min: 0,
                        max: discountMode === 'percentage' ? 99 : undefined,
                        step: 0.01,
                      }}
                      size="small"
                      sx={{ flex: 1 }}
                    />
                  </Tooltip>
                </Box>
              </Grid>
              <Grid item xs={12} sm={4} md={0.8}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Tooltip title={`After Tax Discount (${discountMode === 'percentage' ? '%' : '₹'}) - Disabled if Before Tax is set`}>
                    <TextField
                      fullWidth
                      autoComplete='off'
                      label={`After Tax Discount (${discountMode === 'percentage' ? '%' : '₹'})`}
                      name={discountMode === 'percentage' ? 'afTaxDiscount' : 'afTaxDiscountAmount'}
                      type="number"
                      value={
                        discountMode === 'percentage'
                          ? (newItem.afTaxDiscount === 0 ? '' : newItem.afTaxDiscount.toString())
                          : (newItem.afTaxDiscountAmount === 0 ? '' : newItem.afTaxDiscountAmount.toString())
                      }
                      onChange={handleItemChange}
                      disabled={isBefDiscountActive}
                      inputProps={{
                        min: 0,
                        max: discountMode === 'percentage' ? 99 : undefined,
                        step: 0.01,
                      }}
                      size="small"
                      sx={{ flex: 1 }}
                    />
                  </Tooltip>
                </Box>
              </Grid>
              <Grid item xs={12} sm={3} md={1.5}>
                <TextField
                  fullWidth
                  disabled
                  label="Total Price"
                  name="pendingTotalPrice"
                  type="number"
                  value={newItem.pendingTotalPrice.toFixed(2)}
                  size="small"
                />
              </Grid>
              <Grid
                item
                xs={12}
                sx={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: 1,
                  flexWrap: 'wrap',
                  minHeight: '40px',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <RadioGroup
                    row
                    value={newItem.taxType}
                    onChange={handleTaxTypeChange}
                    sx={{ display: 'flex', alignItems: 'center' }}
                  >
                    <FormControlLabel value="igst" control={<Radio size="small" />} label="IGST" />
                    <FormControlLabel value="cgst_sgst" control={<Radio size="small" />} label="CGST/SGST" />
                  </RadioGroup>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                      Discount Mode:
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => {
                        setItemDiscountModeWithConversion(discountMode === 'percentage' ? 'amount' : 'percentage');
                      }}
                      sx={{
                        minWidth: 'auto',
                        px: 1,
                        py: 0.5,
                        mr: 5,
                        fontSize: '0.75rem',
                        bgcolor: discountMode === 'percentage' ? 'primary.main' : 'grey.300',
                        color: discountMode === 'percentage' ? 'white' : 'black',
                        '&:hover': {
                          bgcolor: discountMode === 'percentage' ? 'primary.dark' : 'grey.400',
                        },
                      }}
                    >
                      {discountMode === 'percentage' ? 'Percentage (%)' : 'Amount (₹)'}
                    </Button>
                  </Box>
                </Box>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleAddItem}
                  size="small"
                  disabled={loading || (newItem.befTaxDiscount > 0 && newItem.afTaxDiscount > 0) || (newItem.befTaxDiscountAmount > 0 && newItem.afTaxDiscountAmount > 0)}
                  startIcon={loading ? <CircularProgress size={20} /> : null}
                  sx={{ mr: 3.5 }}
                >
                  {loading ? 'Adding...' : 'Add Item'}
                </Button>
              </Grid>
            </Grid>
            {/* Items Table */}
            <TableContainer sx={{ maxHeight: '500px', overflowY: 'auto', marginBottom: '10px' }}>
              <Table stickyHeader>
                <TableHead
                  sx={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                    backgroundColor: 'white',
                    '& th': {
                      fontWeight: 'bold',
                      borderBottom: '2px solid rgba(0,0,0,0.12)',
                    },
                  }}
                >
                  <TableRow>
                    <TableCell className='table-number-right'>S.No</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Item Name</TableCell>
                    <TableCell className='table-number-right' sx={{ fontWeight: 'bold' }}>Quantity</TableCell>
                    <TableCell className='table-text-left' sx={{ fontWeight: 'bold' }}>UOM</TableCell>
                    <TableCell className='table-number-right' sx={{ fontWeight: 'bold' }}>Existing Price</TableCell>
                    <TableCell className='table-number-right' sx={{ fontWeight: 'bold' }}>New Price</TableCell>
                    <TableCell className='table-number-right' sx={{ fontWeight: 'bold' }}>Discount</TableCell>
                    <TableCell className='table-number-right' sx={{ fontWeight: 'bold' }}>Tax (%)</TableCell>
                    <TableCell className='table-number-right' sx={{ fontWeight: 'bold' }}>Total Price</TableCell>
                    <TableCell className='table-number-right' sx={{ fontWeight: 'bold' }}>Final Price</TableCell>
                    <TableCell className='table-number-right' sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {purchaseOrderData.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} align="center">No items added</TableCell> {/* Fixed colSpan to 10 */}
                    </TableRow>
                  ) : (
                    purchaseOrderData.items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className='table-number-right'>{index + 1}</TableCell>
                        <TableCell sx={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }} className="table-text-left">{item.itemName || 'N/A'}</TableCell>
                        <TableCell className='table-number-right'>{item.pendingTotalQuantity || 0}</TableCell>
                        <TableCell className='table-text-left'>{item.uom}</TableCell>
                        <TableCell className='table-number-right'>{(item.existingPrice || 0).toFixed(2)}</TableCell>
                        <TableCell className='table-number-right'>{(item.newPrice || 0).toFixed(2)}</TableCell>
                        <TableCell className='table-number-right'>
                          {`${(item.befTaxDiscount || item.afTaxDiscount || item.befTaxDiscountAmount || item.afTaxDiscountAmount || 0).toFixed(2)}%`}
                        </TableCell>
                        <TableCell className='table-number-right'>{item.taxPercentage}%</TableCell>
                        <TableCell className='table-number-right'>{(item.pendingTotalPrice || 0).toFixed(2)}</TableCell>
                        <TableCell className='table-number-right'>{(item.pendingFinalPrice || 0).toFixed(2)}</TableCell>
                        <TableCell className='table-number-right'>
                          <IconButton onClick={() => handleEdit(item)} size="small"><EditIcon /></IconButton>
                          <IconButton onClick={() => handleDelete(item.itemId)} size="small"><DeleteIcon /></IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                  <TableRow sx={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}>
                    <TableCell className='table-number-right' colSpan={9} align="right">
                      <strong>Sub Total:</strong>
                    </TableCell>
                    <TableCell className='table-number-right' align="right">
                      <strong>{totals.subTotal.toFixed(2)}</strong>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                  {Object.keys(taxDetails).map((taxPercentage) => {
                    const { pendingSgst, pendingCgst, pendingIgst } = taxDetails[taxPercentage];
                    const percentage = Number(taxPercentage);
                    const halfPercentage = percentage / 2;
                    return (
                      <React.Fragment key={taxPercentage}>
                        {pendingIgst > 0 && (
                          <TableRow sx={{ backgroundColor: '#f9f9f9' }}>
                            <TableCell colSpan={9} className='table-number-right'>
                              <strong>IGST ({percentage}%)</strong>
                            </TableCell>
                            <TableCell className='table-number-right'>
                              {pendingIgst.toFixed(2)}
                            </TableCell>
                            <TableCell />
                          </TableRow>
                        )}
                        {pendingSgst > 0 && (
                          <TableRow sx={{ backgroundColor: '#f9f9f9' }}>
                            <TableCell colSpan={9} className='table-number-right'>
                              <strong>SGST ({halfPercentage}%)</strong>
                            </TableCell>
                            <TableCell className='table-number-right'>
                              {pendingSgst.toFixed(2)}
                            </TableCell>
                            <TableCell />
                          </TableRow>
                        )}
                        {pendingCgst > 0 && (
                          <TableRow sx={{ backgroundColor: '#f9f9f9' }}>
                            <TableCell colSpan={9} className='table-number-right'>
                              <strong>CGST ({halfPercentage}%)</strong>
                            </TableCell>
                            <TableCell className='table-number-right'>
                              {pendingCgst.toFixed(2)}
                            </TableCell>
                            <TableCell />
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                  <TableRow sx={{ fontWeight: 'bold' }}>
                    <TableCell colSpan={9} align="right">
                      <strong>Total Tax:</strong>
                    </TableCell>
                    <TableCell className='table-number-right' align="right">
                      <strong>{totals.roundedTotalTax.toFixed(2)}</strong>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                  <TableRow sx={{ fontWeight: 'bold' }}>
                    <TableCell colSpan={9} align="right">
                      <strong>Item-wise Discount:</strong>
                    </TableCell>
                    <TableCell className='table-number-right'>
                      <strong>{totals.itemDiscountAmount.toFixed(2)}</strong>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                  <TableRow sx={{ fontWeight: 'bold' }}>
                    <TableCell colSpan={9} align="right">
                      <strong>Overall Discount:</strong>
                    </TableCell>
                    <TableCell className='table-number-right'>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TextField
                          autoComplete='off'
                          value={overallDiscountValue === 0 ? '' : overallDiscountValue.toString()}
                          onChange={handleOverallDiscountChange}
                          size="small"
                          type="number"
                          label={overallDiscountMode === 'percentage' ? '%' : '₹'}
                          inputProps={{
                            min: '0',
                            max: overallDiscountMode === 'percentage' ? '99.99' : undefined,
                            step: '0.01',
                          }}
                          sx={{ width: 10 }}
                          disabled={hasItemWiseDiscount}
                        />
                        <Button
                          variant="contained"
                          size="small"
                          onClick={handleApplyDiscount}
                          disabled={loading || overallDiscountValue <= 0 || purchaseOrderData.items.length === 0 || hasItemWiseDiscount}
                          startIcon={loading ? <CircularProgress size={16} /> : null}
                        >
                          {loading ? 'Applying...' : 'Apply'}
                        </Button>
                        <IconButton
                          onClick={removeOverallDiscount}
                          size="small"
                          color="error"
                        >
                          <ClearIcon />
                        </IconButton>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <FormControlLabel
                        control={
                          <Switch
                            checked={overallDiscountMode === 'amount'}
                            onChange={() => setOverallDiscountModeWithConversion(overallDiscountMode === 'percentage' ? 'amount' : 'percentage')}
                            size="small"
                            disabled={hasItemWiseDiscount}
                          />
                        }
                        label={overallDiscountMode === 'amount' ? '₹' : '%'}
                        labelPlacement="top"
                        sx={{ m: 0 }}
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow sx={{ fontWeight: 'bold' }}>
                    <TableCell colSpan={9} align="right">
                      <strong>Total Discount:</strong>
                    </TableCell>
                    <TableCell className='table-number-right'>
                      <strong>{totals.roundedTotalDiscount.toFixed(2)}</strong>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={9} align="right">
                      <strong>Round Off/Adjustment:</strong>
                    </TableCell>
                    <TableCell className='table-number-right'>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TextField
                          value={roundOffValue === 0 ? '' : roundOffValue.toString()}
                          onChange={handleRoundOffChange}
                          size="small"
                          sx={{ width: 80 }}
                          type="number"
                          inputProps={{ step: '0.01', min: '-999999', max: '999999' }}
                          autoComplete='off'
                        />
                        <Typography variant="body2">
                          ({roundOffValue >= 0 ? '+' : ''}{roundOffValue.toFixed(2)})
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                  <TableRow sx={{ fontSize: '1.1em' }}>
                    <TableCell colSpan={9} align="right">
                      <strong style={{ fontSize: '1.2em' }}>FINAL AMOUNT:</strong>
                    </TableCell>
                    <TableCell className='table-number-right' sx={{ fontSize: '1.2em', fontWeight: 'bold' }}>
                      <strong>{totals.roundedTotalOrderAmount.toFixed(2)}</strong>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
          {/* Additional Form Fields */}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={2} md={2}>
              <TextField
                fullWidth
                label="Sub Total"
                name="subTotal"
                value={totals.subTotal.toFixed(2)}
                size="small"
                variant="outlined"
                InputProps={{ readOnly: true }}
              />
            </Grid>
            <Grid item xs={12} sm={2} md={2}>
              <TextField
                fullWidth
                label="Total Order Amount"
                name="pendingOrderAmount"
                value={totals.roundedTotalOrderAmount.toFixed(2)}
                size="small"
                variant="outlined"
                InputProps={{ readOnly: true }}
                error={totals.roundedTotalOrderAmount > purchaseOrderData.creditLimit}
                helperText={totals.roundedTotalOrderAmount > purchaseOrderData.creditLimit ? 'Order amount exceeds credit limit' : ''}
              />
            </Grid>
            <Grid item xs={12} sm={4} md={2}>
              <Autocomplete
                fullWidth
                options={businesses.map((business) => `${business.address1 ?? ''} ${business.address2 ?? ''}`.trim())}
                value={purchaseOrderData.billingAddress || ''}
                onChange={(event, newValue) => handleSelectAddressChange('billingAddress', newValue)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Billing Address"
                    size="small"
                    variant="outlined"
                    error={formErrors.billingAddress}
                    helperText={formErrors.billingAddress ? 'Billing address is required' : ''}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={4} md={2}>
              <Grid container spacing={1} sx={{ display: 'flex', alignItems: 'center' }}>
                <Grid item xs={10}>
                  <Autocomplete
                    fullWidth
                    options={shippingaddress.map((shipping) => shipping.address ?? '')}
                    value={purchaseOrderData.shippingAddress ?? ''}
                    onChange={(event, newValue) => handleSelectAddressChange('shippingAddress', newValue)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Shipping Address"
                        size="small"
                        variant="outlined"
                        error={formErrors.shippingAddress}
                        helperText={formErrors.shippingAddress ? 'Shipping address is required' : ''}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={2} sx={{ display: 'flex', justifyContent: 'center' }}>
                  <IconButton
                    color="primary"
                    onClick={() => setOpenShippingDialog(true)}
                    sx={{ p: 0 }}
                  >
                    <AddIcon />
                  </IconButton>
                </Grid>
              </Grid>
            </Grid>
            <Grid item xs={12} sm={4} md={2}>
              <LocationAutocomplete
                value={locationSearch}
                onChange={handleLocationChange}
                label="Location"
                error={formErrors.locationName}
                helperText={formErrors.locationName ? 'Location is required' : ''}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Comments"
                name="comments"
                value={purchaseOrderData.comments}
                onChange={handleTextFieldChange}
                size="small"
                variant="outlined"
                multiline
                rows={3}
              />
            </Grid>
            {purchaseOrderData.termsandConditions.map((term, index) => (
              <Grid item xs={12} sm={4} md={2} key={index}>
                <TextField
                  fullWidth
                  autoComplete='off'
                  label={`Terms and Conditions ${index + 1}`}
                  value={term}
                  onChange={(e) => handleTextFieldChange(e, index)}
                  size="small"
                  variant="outlined"
                  InputProps={{
                    endAdornment: (
                      <IconButton onClick={() => handleRemoveTerm(index)} size="small"><RemoveIcon /></IconButton>
                    ),
                  }}
                />
              </Grid>
            ))}
            <Grid item xs={3}>
              <Button
                variant="outlined"
                color="primary"
                onClick={handleAddTerm}
                disabled={purchaseOrderData.termsandConditions.length >= 3}
                startIcon={<AddIcon />}
              >
                Add Term
              </Button>
              {purchaseOrderData.termsandConditions.length >= 3 && (
                <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                  Maximum of 3 terms reached
                </Typography>
              )}
            </Grid>
          </Grid>
        </Box>
      </Box>
      {/* Footer Actions */}
      <Box sx={{ p: 0.5, bgcolor: 'white', position: 'sticky', bottom: 0, zIndex: 10 }}>
        <Grid container spacing={2} justifyContent="flex-end">
          <Grid item>
            <Button variant="outlined" color="primary" onClick={handleClear}>
              {isEditMode ? 'Cancel Edit' : 'Clear All'}
            </Button>
          </Grid>
          <Grid item>
            <Button
              variant="contained"
              color="primary"
              onClick={handleOpenDialog}
              disabled={submitLoading || loading}
            >
              {isEditMode ? 'Update Purchase Order' : 'Submit Purchase Order'}
            </Button>
          </Grid>
        </Grid>
      </Box>
      {/* Dialogs */}
      <Dialog open={open} onClose={() => setDialogOpen(false)}>
        <DialogTitle>{isHoldOrderDialog ? 'Confirm Hold Purchase Order' : (isEditMode ? 'Confirm Update' : 'Confirm Purchase Order')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {isHoldOrderDialog
              ? `The purchase order amount (${totals.roundedTotalOrderAmount.toFixed(2)}) exceeds the vendor's credit limit (${purchaseOrderData.creditLimit.toFixed(2)}). This order will be placed on hold and sent for approval. Proceed?`
              : (isEditMode ? 'Are you sure you want to update this purchase order?' : 'Are you sure you want to submit this purchase order?')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            color="primary"
            variant="contained"
            disabled={submitLoading}
            startIcon={submitLoading ? <CircularProgress size={20} /> : null}
          >
            {submitLoading ? (isEditMode ? 'Updating...' : 'Submitting...') : (isEditMode ? 'Update' : 'Confirm')}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={openShippingDialog} onClose={handleCloseShippingDialog}>
        <DialogTitle>Add New Shipping Address</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Address"
            value={updatedShippingRow?.address || ''}
            onChange={(e) => handleShippingChange(e, 'address')}
            margin="normal"
            variant="outlined"
          />
          <TextField
            fullWidth
            label="Phone Number"
            value={updatedShippingRow?.phoneNo || ''}
            onChange={(e) => handleShippingChange(e, 'phoneNo')}
            margin="normal"
            variant="outlined"
          />
          <TextField
            fullWidth
            label="Email"
            value={updatedShippingRow?.emailId || ''}
            onChange={(e) => handleShippingChange(e, 'emailId')}
            margin="normal"
            variant="outlined"
          />
          <TextField
            fullWidth
            label="GSTIN"
            value={updatedShippingRow?.gstIn || ''}
            onChange={(e) => handleShippingChange(e, 'gstIn')}
            margin="normal"
            variant="outlined"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseShippingDialog}>Cancel</Button>
          <Button onClick={saveShippingAddress} color="primary">Save</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={showNavigationConfirm} onClose={() => setShowNavigationConfirm(false)}>
        <DialogTitle>Unsaved Changes</DialogTitle>
        <DialogContent>
          <DialogContentText>You have unsaved changes. Are you sure you want to leave this page?</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNavigationConfirm(false)}>Cancel</Button>
          <Button
            onClick={() => {
              setShowNavigationConfirm(false);
              if (pendingNavigation) pendingNavigation();
              setPendingNavigation(null);
            }}
            color="primary"
            variant="contained"
          >
            Leave Page
          </Button>
        </DialogActions>
      </Dialog>
      <Backdrop sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, color: '#fff' }} open={loading}>
        <CircularProgress color="inherit" />
      </Backdrop>
      <Dialog open={importDialogOpen} onClose={handleCloseImportDialog}>
        <DialogTitle>CSV Import Results</DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            <Typography variant="body1" sx={{ color: importErrors.length > 0 ? 'red' : 'green' }}>
              {snackbarMessage || 'No message provided.'}
            </Typography>
            {importSuccessMessages?.length > 0 && (
              <>
                <Typography variant="h6" sx={{ mt: 2, color: 'green' }}>
                  Successfully Imported Items:
                </Typography>
                <ul>
                  {importSuccessMessages.map((message, index) => (
                    <li key={index}>
                      <Typography variant="body2" sx={{ color: 'green' }}>
                        {message}
                      </Typography>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {importDuplicates?.length > 0 && (
              <>
                <Typography variant="h6" sx={{ mt: 2, color: 'orange' }}>
                  Merged Duplicates:
                </Typography>
                <ul>
                  {importDuplicates.map((duplicate, index) => (
                    <li key={index}>
                      <Typography variant="body2" sx={{ color: 'orange' }}>
                        {duplicate}
                      </Typography>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {importUpdatedItems?.length > 0 && (
              <>
                <Typography variant="h6" sx={{ mt: 2, color: 'orange' }}>
                  Updated Master Items:
                </Typography>
                <ul>
                  {importUpdatedItems.map((updatedItem, index) => (
                    <li key={index}>
                      <Typography variant="body2" sx={{ color: 'orange' }}>
                        {updatedItem}
                      </Typography>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {importWarnings?.length > 0 && (
              <>
                <Typography variant="h6" sx={{ mt: 2, color: 'orange' }}>
                  Warnings:
                </Typography>
                <ul>
                  {importWarnings.map((warning, index) => (
                    <li key={index}>
                      <Typography variant="body2" sx={{ color: 'orange' }}>
                        {warning}
                      </Typography>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {importErrors?.length > 0 && (
              <>
                <Typography variant="h6" component="h6" sx={{ mt: 2, color: 'red' }}>
                  Errors:
                </Typography>
                <ul>
                  {importErrors.map((error, index) => (
                    <li key={index}>
                      <Typography variant="body2" component="span" sx={{ color: 'red' }}>
                        {error}
                      </Typography>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {!snackbarMessage && !importDuplicates?.length && !importErrors?.length && !importWarnings?.length && !importSuccessMessages?.length && !importUpdatedItems?.length && (
              <Typography variant="body1" component="div" sx={{ color: 'red' }}>
                An unexpected error occurred during import.
              </Typography>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseImportDialog} color="primary">Close</Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => dispatch(clearSnackbarMessage())}
        message={snackbarMessage}
      />
    </Box>
  );
};
export default CreatePurchasePage;