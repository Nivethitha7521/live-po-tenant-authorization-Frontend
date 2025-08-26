'use client';
import React, { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, TextField, Button, Typography, Grid, Paper, TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  Autocomplete, Snackbar, IconButton, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, RadioGroup,
  FormControlLabel, Radio, CircularProgress, Tooltip, Backdrop,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import { formatISO } from 'date-fns';
import {
  addPurchaseOrder, fetchPurchaseOrders, fetchAllVendors, selectPurchaseOrderState, setPurchaseOrderData,
  setNewItemData, addItemToPurchaseOrder, setSnackbarMessage, clearSnackbarMessage, setSnackbarOpen,
  setItemForEditing, clearItemForEditing, deleteItemFromPurchaseOrder, calculateItemTotals, setReduxTotals,
  importCsvItems,
  downloadCsvTemplate,
  clearImportResults,
  setImportDialogOpen,
} from '../../../../features/yen-purchase/PurchaseOrder/purchaseOrderSlice';
import { addShipping, fetchBusinesses, fetchShipping, selectBusinesses } from '@/features/account-setting/businessSlice';
import { AppDispatch } from '@/redux/store';
import { useRouter } from 'next/navigation';
import { Item, PurchaseItemSearchAdd } from '../../../../Models/purchaseModel';
import { ShippingAddress } from '@/Models/businessModel';
import PurchaseItemAutocomplete from '../../../../components/yen-purchase/pocreationcomponent/purchaseautocomplete';
import VendorAutocomplete from '../../../../components/yen-purchase/pocreationcomponent/vendorautocomplete';
import { searchPurchaseItems } from '@/features/yen-purchase/PurchaseMaster/purchaseItemSlice';
import * as Yup from 'yup';
import { useBeforeUnload } from 'react-use';
import { VendorSummary } from '@/Models/vendor';

// Validation schema
const validationSchema = Yup.object({
  vendorName: Yup.string().required('Vendor name is required'),
  billingAddress: Yup.string().required('Billing address is required'),
  shippingAddress: Yup.string().required('Shipping address is required'),
  paymentTerms: Yup.string().required('Payment terms are required'),
  creditLimit: Yup.number().required('Credit limit is required').min(0, 'Credit limit must be non-negative'),
});

// Rounding functions
const roundPrice = (price: number): number => Math.round(price * 100) / 100;
const roundOff = (price: number): number => (price - Math.floor(price) >= 0.8 ? Math.ceil(price) : Math.floor(price));

const PurchaseOrder: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { purchaseOrderData, newItem, importDuplicates, importErrors, importDialogOpen, importWarnings, importSuccessMessages, importUpdatedItems, searchQuery, snackbarOpen, skip, limit, snackbarMessage } = useSelector(selectPurchaseOrderState);
  const { businesses, shippingaddress } = useSelector(selectBusinesses);
  const [open, setDialogOpen] = useState(false);
  const [openShippingDialog, setOpenShippingDialog] = useState(false);
  const [updatedShippingRow, setUpdatedShippingRow] = useState<ShippingAddress | null>(null);
  const [discountType, setDiscountType] = useState<'before' | 'after'>('before');
  const [totals, setTotals] = useState({ roundedTotalOrderAmount: 0, roundedTotalDiscount: 0, roundedTotalTax: 0 });
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ itemName: false, pendingCount: false, pendingQuantity: false, newPrice: false });
  const [formErrors, setFormErrors] = useState({ vendorName: false, billingAddress: false, shippingAddress: false, paymentTerms: false, creditLimit: false });
  const [newItemsearch, setNewItemsearch] = useState<PurchaseItemSearchAdd | null>(null);
  const [vendorSearch, setVendorSearch] = useState<VendorSummary | null>(null);
  const [showNavigationConfirm, setShowNavigationConfirm] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const [isHoldOrderDialog, setIsHoldOrderDialog] = useState(false);
  const [countInput, setCountInput] = useState<string>('');
  const [quantityInput, setQuantityInput] = useState<string>('');
  const [newPriceInput, setNewPriceTypeInput] = useState<string>('');
  const itemNameRef = useRef<HTMLInputElement | null>(null);
  const today = new Date();
  const formattedDate = today.toISOString().split('T')[0];
  const [isFullScreen, setIsFullScreen] = useState(false); // New state for full-screen mode
  const fileInputRef = useRef<HTMLInputElement | null>(null); // Add ref for file input
  // Set default billingAddress if businesses has exactly one entry
  useEffect(() => {
    if (businesses.length === 1 && !purchaseOrderData.billingAddress) {
      const defaultBillingAddress = `${businesses[0].address1 ?? ''} ${businesses[0].address2 ?? ''}`.trim();
      dispatch(setPurchaseOrderData({ ...purchaseOrderData, billingAddress: defaultBillingAddress }));
    }
  }, [businesses, purchaseOrderData, dispatch]);

  // Track form dirty state
  useEffect(() => {
    const hasChanges =
      purchaseOrderData.vendorName !== '' ||
      purchaseOrderData.items.length > 0 ||
      purchaseOrderData.billingAddress !== '' ||
      purchaseOrderData.shippingAddress !== '' ||
      purchaseOrderData.comments !== '' ||
      purchaseOrderData.termsandConditions.some((term) => term !== '');
    setIsFormDirty(hasChanges);
  }, [purchaseOrderData]);

  // Handle browser navigation and refresh
  useBeforeUnload(isFormDirty, 'You have unsaved changes. Are you sure you want to leave?');

  // Sync input fields with Redux state
  useEffect(() => {
    setCountInput(newItem.pendingCount === 0 ? '' : newItem.pendingCount.toString());
    setQuantityInput(newItem.pendingQuantity === 0 ? '' : newItem.pendingQuantity.toString());
    setNewPriceTypeInput(newItem.newPrice === 0 ? '' : newItem.newPrice.toFixed(2));
  }, [newItem.pendingCount, newItem.pendingQuantity, newItem.newPrice]);

  // Fetch data
  useEffect(() => {
    dispatch(fetchPurchaseOrders());
    dispatch(searchPurchaseItems({ searchQuery, skip, limit }));
    dispatch(fetchBusinesses());
    dispatch(fetchShipping());
  }, [dispatch, searchQuery, skip, limit]);

  // Re-validate billingAddress to clear error when a value is selected
  useEffect(() => {
    if (purchaseOrderData.billingAddress && purchaseOrderData.billingAddress.trim() !== '') {
      setFormErrors((prev) => ({ ...prev, billingAddress: false }));
    }
  }, [purchaseOrderData.billingAddress]);

  // Calculate totals
  const calculateTotals = useMemo(() => {
    let pendingOrderAmount = 0;
    let pendingDiscountAmount = 0;
    let pendingTaxAmount = 0;

    purchaseOrderData.items.forEach((item) => {
      const itemTotalPrice = item.pendingFinalPrice || 0;
      pendingOrderAmount += itemTotalPrice;
      pendingDiscountAmount += item.pendingDiscountAmount || 0;
      pendingTaxAmount += item.pendingTaxAmount || 0;
    });

    return {
      roundedTotalOrderAmount: roundOff(pendingOrderAmount),
      roundedTotalDiscount: roundPrice(pendingDiscountAmount),
      roundedTotalTax: roundPrice(pendingTaxAmount),
    };
  }, [purchaseOrderData.items]);

  // Update totals
  useEffect(() => {
    const newTotals = calculateTotals;
    setTotals(newTotals);
    dispatch(setReduxTotals({
      pendingOrderAmount: newTotals.roundedTotalOrderAmount,
      pendingDiscountAmount: newTotals.roundedTotalDiscount,
      pendingTaxAmount: newTotals.roundedTotalTax,
    }));
  }, [calculateTotals, dispatch]);
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

  // Navigation handlers
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

  // Form handlers
  const handleSelectAddressChange = useCallback(
    (name: string, value: string | null) => {
      const updatedData = { ...purchaseOrderData, [name]: value ?? '' };
      if (name === 'billingAddress') {
        const selectedBusiness = businesses.find((business) => `${business.address1 ?? ''} ${business.address2 ?? ''}`.trim() === value);
        updatedData.billingAddress = selectedBusiness ? `${selectedBusiness.address1 ?? ''} ${selectedBusiness.address2 ?? ''}`.trim() : value ?? '';
        // Clear billingAddress error if a value is selected
        if (updatedData.billingAddress && updatedData.billingAddress.trim() !== '') {
          setFormErrors((prev) => ({ ...prev, billingAddress: false }));
        }
      } else if (name === 'shippingAddress') {
        const selectedShippingAddress = shippingaddress.find((address) => address.address === value);
        updatedData.shippingAddress = selectedShippingAddress ? selectedShippingAddress.address : value ?? '';
        // Clear shippingAddress error if a value is selected
        if (updatedData.shippingAddress && updatedData.shippingAddress.trim() !== '') {
          setFormErrors((prev) => ({ ...prev, shippingAddress: false }));
        }
      }
      dispatch(setPurchaseOrderData(updatedData));
    },
    [dispatch, purchaseOrderData, businesses, shippingaddress]
  );

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

  const handleItemSelection = (item: PurchaseItemSearchAdd | null) => {
    if (item) {
      setNewItemsearch(item);
      let updatedData = { ...purchaseOrderData, itemName: item.itemName };
      dispatch(setPurchaseOrderData(updatedData));
      dispatch(setNewItemData({
        itemId: item.purchaseitemId,
        itemName: item.itemName,
        pendingCount: 0,
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
        pendingTotalPrice: 0,
        taxType: 'cgst_sgst',
      }));
      setCountInput('');
      setQuantityInput('');
      setNewPriceTypeInput(item.purchasePrice.toFixed(2)); // Initialize to 2 decimal places
    } else {
      setNewItemsearch(null);
      let updatedData = { ...purchaseOrderData, itemName: '' };
      dispatch(setPurchaseOrderData(updatedData));
      dispatch(setNewItemData({
        itemId: '',
        itemName: '',
        pendingCount: 0,
        pendingQuantity: 0,
        pendingTotalQuantity: 0,
        existingPrice: 0,
        newPrice: 0,
        taxPercentage: 0,
        uom: '',
        purchasecategoryName: '',
        purchasesubcategoryName: '',
        hsnCode: '',
        befTaxDiscount: 0,
        afTaxDiscount: 0,
        pendingTotalPrice: 0,
        taxType: 'cgst_sgst',
      }));
      setCountInput('');
      setQuantityInput('');
      setNewPriceTypeInput('');
    }
  };

  const handleClear = () => {
    dispatch(setPurchaseOrderData({
      purchaseOrderId: '',
      vendorName: '',
      vendorContact: '',
      orderDate: null,
      expectedDeliveryDate: null,
      poStatus: '',
      items: [],
      pendingOrderAmount: 0,
      creditLimit: 0,
      paymentTerms: '',
      shippingAddress: '',
      billingAddress: '',
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
      uom: '',
      pendingCount: 0,
      pendingQuantity: 0,
      pendingTotalQuantity: 0,
      purchasecategoryName: '',
      purchasesubcategoryName: '',
      hsnCode: '',
      taxType: 'cgst_sgst',
      pendingTotalPrice: 0,
    }));
    setVendorSearch(null);
    setNewItemsearch(null);
    setCountInput('');
    setQuantityInput('');
    setNewPriceTypeInput('');
    setIsFormDirty(false);
    setFormErrors({ vendorName: false, billingAddress: false, shippingAddress: false, paymentTerms: false, creditLimit: false });
  };

  const handleItemChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    // Allow empty input or numbers with up to 2 decimal places
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
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
      } else if (name === 'newPrice') {
        setNewPriceTypeInput(value);
        const parsedValue = value === '' ? 0 : parseFloat(value) || 0;
        const roundedValue = Math.round(parsedValue * 100) / 100; // Round to 2 decimal places
        dispatch(setNewItemData({
          ...newItem,
          newPrice: roundedValue,
          priceVariance: newItem.existingPrice - roundedValue,
        }));
        setErrors({ ...errors, newPrice: false });
      } else {
        const parsedValue = value === '' ? 0 : parseFloat(value) || 0;
        const updatedValue = Math.min(parsedValue, 99); // Cap discounts at 99%
        dispatch(setNewItemData({ ...newItem, [name]: updatedValue }));
        setErrors({ ...errors, [name]: false });
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
    dispatch(setItemForEditing(item));
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
    setNewPriceTypeInput(item.newPrice.toFixed(2)); // Format to 2 decimal places
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
    setLoading(true);
    try {
      await dispatch(calculateItemTotals({
        pendingTotalQuantity: newItem.pendingTotalQuantity,
        poQuantity: newItem.pendingTotalQuantity,
        newPrice: newItem.newPrice,
        befTaxDiscount: newItem.befTaxDiscount || 0,
        afTaxDiscount: newItem.afTaxDiscount || 0,
        taxPercentage: newItem.taxPercentage || 0,
        taxType: newItem.taxType,
      })).unwrap();
      dispatch(addItemToPurchaseOrder());
      setNewItemsearch(null);
      if (itemNameRef.current) itemNameRef.current.focus();
      setTotals(calculateTotals);
    } catch (error) {
      dispatch(setSnackbarMessage('Failed to add item. Please try again.'));
      dispatch(setSnackbarOpen(true));
    } finally {
      setLoading(false);
    }
  }, [dispatch, newItem, calculateTotals]);

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
    // Re-check billingAddress before validation to avoid incorrect error
    if (purchaseOrderData.billingAddress && purchaseOrderData.billingAddress.trim() !== '') {
      setFormErrors((prev) => ({ ...prev, billingAddress: false }));
    }

    validationSchema.validate(purchaseOrderData, { abortEarly: false })
      .then(() => {
        setFormErrors({ vendorName: false, billingAddress: false, shippingAddress: false, paymentTerms: false, creditLimit: false });
        setIsHoldOrderDialog(calculateTotals.roundedTotalOrderAmount > purchaseOrderData.creditLimit);
        setDialogOpen(true);
      })
      .catch((err: Yup.ValidationError) => {
        const newErrors = { vendorName: false, billingAddress: false, shippingAddress: false, paymentTerms: false, creditLimit: false };
        err.inner.forEach((error) => {
          if (error.path) newErrors[error.path as keyof typeof newErrors] = true;
        });
        setFormErrors(newErrors);
        dispatch(setSnackbarMessage('Please fill all required fields.'));
        dispatch(setSnackbarOpen(true));
      });
  };

  const handleSubmit = async () => {
    setLoading(true);
    const { roundedTotalOrderAmount, roundedTotalDiscount, roundedTotalTax } = calculateTotals;
    if (!purchaseOrderData.items.length) {
      dispatch(setSnackbarMessage('At least one item is required.'));
      dispatch(setSnackbarOpen(true));
      setLoading(false);
      return;
    }
    const dataToSubmit = {
      ...purchaseOrderData,
      orderDate: purchaseOrderData.orderDate ? new Date(purchaseOrderData.orderDate) : null, // Convert string to Date or null
      expectedDeliveryDate: purchaseOrderData.expectedDeliveryDate ? new Date(purchaseOrderData.expectedDeliveryDate) : null,
      pendingOrderAmount: roundedTotalOrderAmount,
      pendingDiscountAmount: roundedTotalDiscount,
      pendingTaxAmount: roundedTotalTax,
      isHoldOrder: roundedTotalOrderAmount > purchaseOrderData.creditLimit,
    };
    try {
      const result = await dispatch(addPurchaseOrder(dataToSubmit)).unwrap();
      dispatch(setSnackbarMessage(
        dataToSubmit.isHoldOrder
          ? `Purchase Order ${result.randomId || 'Unknown'} is on hold due to exceeding credit limit. Awaiting approval.`
          : `Purchase Order ${result.randomId || 'Unknown'} successfully created.`
      ));
      dispatch(setSnackbarOpen(true));
      handleClear();
      dispatch(fetchPurchaseOrders());
      setDialogOpen(false);
      router.push('/yen-purchase/PurchaseOrder');
    } catch (error) {
      dispatch(setSnackbarMessage('Failed to create purchase order. Please try again.'));
      dispatch(setSnackbarOpen(true));
    } finally {
      setLoading(false);
    }
  };

  // const calculateTaxDetails = () => {
  //   const taxDetails: { [key: string]: { pendingSgst: number; pendingCgst: number; pendingIgst: number; percentage: number } } = {};
  //   purchaseOrderData.items.forEach((item) => {
  //     const itemTotal = (item.pendingTotalQuantity || 0) * (item.newPrice || 0);
  //     const discountAmount = itemTotal * (item.befTaxDiscount || 0) / 100;
  //     let finalPrice = discountType === 'before' ? itemTotal - discountAmount : itemTotal;
  //     if (discountType === 'after') {
  //       const taxAmount = (item.taxPercentage || 0) / 100 * itemTotal;
  //       finalPrice += taxAmount;
  //       finalPrice -= finalPrice * (item.afTaxDiscount || 0) / 100;
  //     }
  //     const taxAmount = finalPrice * (item.taxPercentage || 0) / 100;
  //     if (!taxDetails[item.taxPercentage]) {
  //       taxDetails[item.taxPercentage] = { pendingSgst: 0, pendingCgst: 0, pendingIgst: 0, percentage: item.taxPercentage || 0 };
  //     }
  //     if (item.taxType === 'igst') {
  //       taxDetails[item.taxPercentage].pendingIgst += roundPrice(taxAmount);
  //     } else {
  //       const halfTaxAmount = roundPrice(taxAmount / 2);
  //       taxDetails[item.taxPercentage].pendingSgst += halfTaxAmount;
  //       taxDetails[item.taxPercentage].pendingCgst += halfTaxAmount;
  //     }
  //   });
  //   return taxDetails;
  // };
  const calculateTaxDetails = () => {
    const taxDetails: { [key: string]: { pendingSgst: number; pendingCgst: number; pendingIgst: number; percentage: number } } = {};
    purchaseOrderData.items.forEach((item) => {
      const taxPercentage = item.taxPercentage || 0;
      if (!taxDetails[taxPercentage]) {
        taxDetails[taxPercentage] = {
          pendingSgst: 0,
          pendingCgst: 0,
          pendingIgst: 0,
          percentage: taxPercentage, // Store the full tax percentage (e.g., 12 for cgst_sgst)
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
  const taxDetails = calculateTaxDetails();
  const variancePrice = (newItem.newPrice - newItem.existingPrice).toFixed(2);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#ffffff' }}>
      {/* Main Content */}
      <Box sx={{ flex: 1, p: 3, overflowY: 'auto', maxHeight: 'calc(100vh - 64px)' }}>
        <Box sx={{ maxWidth: '1200px', mx: 'auto' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography fontWeight={'bold'} sx={{ textDecoration: 'underline' }}>Purchase Order</Typography>
            <Button variant="contained" color="primary" onClick={handleBackToPO}>Back to PO</Button>
          </Box>

          <Grid container spacing={2}>
            {/* Form Fields */}
            <Grid item xs={12} sm={3} md={2}>
              <TextField
                fullWidth
                disabled
                label="Purchase Order ID"
                name="purchaseOrderId"
                value={purchaseOrderData.purchaseOrderId}
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
              <TextField
                fullWidth
                label="Order Date"
                name="orderDate"
                type="date"
                value={purchaseOrderData.orderDate || ''}
                onChange={handleTextFieldChange}
                InputLabelProps={{ shrink: true }}
                inputProps={{ max: formattedDate }} // Restrict to today or earlier
                size="small"
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12} sm={3} md={2}>
              <TextField
                fullWidth
                label="Expected Delivery Date"
                name="expectedDeliveryDate"
                type="date"
                value={purchaseOrderData.expectedDeliveryDate || ''}
                onChange={handleTextFieldChange}
                InputLabelProps={{ shrink: true }}
                inputProps={{ min: formattedDate }}
                size="small"
                variant="outlined"
              />
            </Grid>
          </Grid>
          <Box sx={{
            p: 1,
            mb: 3,
            // Remove sticky/fixed positioning for normal mode; apply fixed positioning only in full-screen
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
            {/* Add Item Section */}
            <Box sx={{ p: 1, mb: 3, position: 'sticky', top: 0, zIndex: 10, bgcolor: 'white' }}>
              {/* Add Item Section */}
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
                <Typography variant="h2">Add Item</Typography>
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
                    label="Count"
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
                    type="number"
                    value={newPriceInput}
                    onChange={handleItemChange}
                    size="small"
                    inputProps={{ step: '00000.01', min: '0' }}
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
                  <Tooltip title="Before Tax Discount (%)">
                    <TextField
                      fullWidth
                      autoComplete='off'
                      label="Before Tax Discount (%)"
                      name="befTaxDiscount"
                      type="number"
                      value={newItem.befTaxDiscount || ''}
                      onChange={handleItemChange}
                      inputProps={{ min: 0, max: 99 }}
                      size="small"
                    />
                  </Tooltip>
                </Grid>
                <Grid item xs={12} sm={4} md={0.8}>
                  <Tooltip title="After Tax Discount (%)">
                    <TextField
                      fullWidth
                      autoComplete='off'
                      label="After Tax Discount (%)"
                      name="afTaxDiscount"
                      type="number"
                      value={newItem.afTaxDiscount || ''}
                      onChange={handleItemChange}
                      inputProps={{ min: 0, max: 99 }}
                      size="small"
                    />
                  </Tooltip>
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
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 2,
                    flexWrap: 'wrap', // Allows wrapping on smaller screens
                  }}
                >
                  <RadioGroup
                    row
                    value={newItem.taxType}
                    onChange={handleTaxTypeChange}
                    sx={{ display: 'flex', alignItems: 'center' }}
                  >
                    <FormControlLabel value="igst" control={<Radio size="small" />} label="IGST" />
                    <FormControlLabel value="cgst_sgst" control={<Radio size="small" />} label="CGST/SGST" />
                  </RadioGroup>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleAddItem}
                    size="small"
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={20} /> : null}
                  >
                    {loading ? 'Adding...' : 'Add Item'}
                  </Button>
                </Grid>
              </Grid>

            </Box>

            {/* Items Table */}
            <TableContainer sx={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '10px' }}>
              <Table stickyHeader>
                <TableHead
                  sx={{
                    // Enforce sticky positioning
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                    backgroundColor: 'white', // Ensure header is visible over scrolling body
                    '& th': {
                      fontWeight: 'bold',
                      borderBottom: '2px solid rgba(0,0,0,0.12)', // Match MUI style
                    },
                  }}
                >
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Item Name</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Quantity</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>UOM</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Existing Price</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>New Price</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Bef Dis</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Af Dis</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Tax (%)</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total Price</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {purchaseOrderData.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center">No items added</TableCell>
                    </TableRow>
                  ) : (
                    purchaseOrderData.items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell sx={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.itemName || 'N/A'}</TableCell>
                        <TableCell align="right">{item.pendingTotalQuantity || 0}</TableCell>
                        <TableCell align="right">{item.uom}</TableCell>
                        <TableCell align="right">{(item.existingPrice || 0).toFixed(2)}</TableCell>
                        <TableCell align="right">{(item.newPrice || 0).toFixed(2)}</TableCell>
                        <TableCell align="right">{item.befTaxDiscount || 0}%</TableCell>
                        <TableCell align="right">{item.afTaxDiscount || 0}%</TableCell>
                        <TableCell align="right">{item.taxPercentage}%</TableCell>
                        <TableCell align="right">{(item.pendingTotalPrice || 0).toFixed(2)}</TableCell>
                        <TableCell align="right">
                          <IconButton onClick={() => handleEdit(item)} size="small"><EditIcon /></IconButton>
                          <IconButton onClick={() => handleDelete(item.itemId)} size="small"><DeleteIcon /></IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                  <TableRow>
                    <TableCell colSpan={8} />
                    <TableCell align="right"><strong>Discount:</strong></TableCell>
                    <TableCell align="right"><strong>{totals.roundedTotalDiscount.toFixed(2)}</strong></TableCell>
                    <TableCell />
                  </TableRow>
                  {Object.keys(taxDetails).map((taxPercentage) => {
                    const { pendingSgst, pendingCgst, pendingIgst } = taxDetails[taxPercentage];
                    const percentage = Number(taxPercentage);
                    const halfPercentage = percentage / 2;

                    return (
                      <React.Fragment key={taxPercentage}>
                        {pendingIgst > 0 && (
                          <TableRow>
                            <TableCell colSpan={8} />
                            <TableCell align="right"><strong>IGST ({percentage}%)</strong></TableCell>
                            <TableCell align="right">{pendingIgst.toFixed(2)}</TableCell>
                            <TableCell />
                          </TableRow>
                        )}
                        {pendingSgst > 0 && (
                          <TableRow>
                            <TableCell colSpan={8} />
                            <TableCell align="right"><strong>SGST ({halfPercentage}%)</strong></TableCell>
                            <TableCell align="right">{pendingSgst.toFixed(2)}</TableCell>
                            <TableCell />
                          </TableRow>
                        )}
                        {pendingCgst > 0 && (
                          <TableRow>
                            <TableCell colSpan={8} />
                            <TableCell align="right"><strong>CGST ({halfPercentage}%)</strong></TableCell>
                            <TableCell align="right">{pendingCgst.toFixed(2)}</TableCell>
                            <TableCell />
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                  <TableRow>
                    <TableCell colSpan={8} />
                    <TableCell align="right"><strong>Rounded Amount:</strong></TableCell>
                    <TableCell align="right"><strong>{totals.roundedTotalOrderAmount.toFixed(2)}</strong></TableCell>
                    <TableCell />
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={8} />
                    <TableCell align="right"><strong>Final Amount:</strong></TableCell>
                    <TableCell align="right"><strong>{totals.roundedTotalOrderAmount.toFixed(2)}</strong></TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
          {/* Additional Fields */}
          <Grid container spacing={2}>
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
                value={purchaseOrderData.billingAddress || ''} // Removed default fallback
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
            {/* Updated Shipping Address Section */}
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

      {/* Footer with Buttons */}
      <Box sx={{ p: 0.5, bgcolor: 'white', position: 'sticky', bottom: 0, zIndex: 10 }}>
        <Grid container spacing={2} justifyContent="flex-end">
          <Grid item>
            <Button variant="outlined" color="primary" onClick={handleClear}>Clear All</Button>
          </Grid>
          <Grid item>
            <Button variant="contained" color="primary" onClick={handleOpenDialog} disabled={loading}>
              Submit Purchase Order
            </Button>
          </Grid>
        </Grid>
      </Box>

      {/* Dialogs */}
      <Dialog open={open} onClose={() => setDialogOpen(false)}>
        <DialogTitle>{isHoldOrderDialog ? 'Confirm Hold Purchase Order' : 'Confirm Purchase Order'}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {isHoldOrderDialog
              ? `The purchase order amount (${totals.roundedTotalOrderAmount.toFixed(2)}) exceeds the vendor's credit limit (${purchaseOrderData.creditLimit.toFixed(2)}). This order will be placed on hold and sent for approval. Proceed?`
              : 'Are you sure you want to submit this purchase order?'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            color="primary"
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? 'Submitting...' : 'Confirm'}
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

      {/* Loading Overlay */}
      <Backdrop sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, color: '#fff' }} open={loading}>
        <CircularProgress color="inherit" />
      </Backdrop>
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

      {/* Loading Overlay */}
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
      {/* Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => dispatch(clearSnackbarMessage())}
        message={snackbarMessage}
      />
    </Box>
  );
};

export default PurchaseOrder;