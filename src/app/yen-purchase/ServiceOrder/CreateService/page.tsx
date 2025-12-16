"use client";
import React, { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, TextField, Button, Typography, Grid, Paper, TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  Autocomplete, Snackbar, IconButton, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, RadioGroup,
  FormControlLabel, Radio, CircularProgress, Tooltip, Backdrop, Switch, FormControl,
  Select,
  MenuItem,
  Chip,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import ClearIcon from '@mui/icons-material/Clear';
import {
  addService, fetchServices, selectServiceState, setServiceData,
  setNewDescriptionData, addDescriptionToService, setSnackbarMessage, clearSnackbarMessage, setSnackbarOpen,
  setDescriptionForEditing, clearDescriptionForEditing, deleteDescriptionFromService, calculateDescriptionTotals,
  setReduxTotals, setDiscountMode, fetchServiceById, updateService, calculateServiceTotals,
  updateDescription,
} from '../Features/servicepo';
import { fetchBusinesses, fetchShipping, selectBusinesses } from '@/features/account-setting/businessSlice';
import { AppDispatch, RootState } from '@/redux/store';
import { useRouter, useSearchParams } from 'next/navigation';
import { ServiceData, ServiceDescription, ServiceTotalsRequest } from '../Models/servicepo';
import { ShippingAddress } from '@/Models/businessModel';
import VendorAutocomplete from '../../../../components/yen-purchase/pocreationcomponent/vendorautocomplete';
import * as Yup from 'yup';
import { useBeforeUnload } from 'react-use';
import SmartDatePicker from '@/components/SmartDatePicker';
import LocationAutocomplete from '../../../../components/yen-purchase/pocreationcomponent/locationautocomplete';
import { Location } from '@/Models/storagelocation';
import { fetchLocations, selectStorageLocations } from '../../../../features/yen-purchase/PurchaseMaster/StorageLocationSlice';
import { VendorSummary } from '@/Models/vendor';
import { selectPurchaseOrderState } from '@/features/yen-purchase/PurchaseOrder/purchaseOrderSlice';
import { ServiceSummary } from '../../PurchaseMaster/Service/Models/Service';
import ServiceAutocomplete from '../../PurchaseMaster/Service/Components/ServiceAutocomplete';
import { fetchPurchaseTaxes } from '@/features/yen-purchase/PurchaseMaster/purchaseTaxSlice';
import FreightSelectionDialog from '../../PurchaseOrder/Component/freightSelectionDialog';
// Helper functions for date handling
const formatDate = (date: Date | null): string => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const parseDate = (dateStr: string | null): Date | null => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
};
// Validation schema (date-only)
const validationSchema = Yup.object({
  vendorName: Yup.string().required('Vendor name is required'),
  billingAddress: Yup.string().required('Billing address is required'),
  shippingAddress: Yup.string().required('Shipping address is required'),
  locationName: Yup.string().required('Location is required'),
  paymentTerms: Yup.string().required('Payment terms are required'),
  creditLimit: Yup.number().required('Credit limit is required').min(0, 'Credit limit must be non-negative'),
  workOrderDate: Yup.string().required('Work order date is required'),
});
// Update the helper function to include discount_percentage and discount_amount

const getDescriptionsFromFlatArrays = (serviceData: ServiceData): ServiceDescription[] => {
  const descriptions: ServiceDescription[] = [];
  const maxLen = Math.max(
    serviceData.sacCode.length,
    serviceData.desc_ids.length,
    serviceData.desc_descriptions.length,
    serviceData.from_dates.length,
    serviceData.to_dates.length,
    serviceData.fees.length,
    serviceData.quantity?.length || 0,
    serviceData.remarks?.length || 0,
    serviceData.desc_tax_types.length,
    serviceData.desc_tax_pers.length,
    serviceData.desc_sgst.length,
    serviceData.desc_cgst.length,
    serviceData.desc_igst.length,
    serviceData.desc_tax_amounts.length,
    serviceData.desc_totals.length,
    serviceData.desc_total_fees.length,
    serviceData.desc_discount_amounts.length,
    serviceData.desc_discount_percentages?.length || 0  // ADDED
  );
  
  for (let i = 0; i < maxLen; i++) {
    descriptions.push({
      id: serviceData.desc_ids[i] || '',
      sacCode: serviceData.sacCode[i] || '',
      description: serviceData.desc_descriptions[i] || '',
      from_date: serviceData.from_dates[i] || null,
      to_date: serviceData.to_dates[i] || null,
      fee: serviceData.fees[i] || 0,
      quantity: serviceData.quantity?.[i] || 1,
      tax_type: serviceData.desc_tax_types[i] as 'cgst_sgst' | 'igst' || 'cgst_sgst',
      tax_per: serviceData.desc_tax_pers[i] || 0,
      sgst: serviceData.desc_sgst[i] || 0,
      cgst: serviceData.desc_cgst[i] || 0,
      igst: serviceData.desc_igst[i] || 0,
      total: serviceData.desc_totals[i] || 0,
      taxAmount: serviceData.desc_tax_amounts[i] || 0,
      totalFee: serviceData.desc_total_fees[i] || 0,
      finalFee: serviceData.desc_total_fees[i] || 0,
      discountAmount: serviceData.desc_discount_amounts[i] || 0,
      discount_percentage: serviceData.desc_discount_percentages?.[i] || 0, // ADDED
      discount_amount: serviceData.desc_discount_amounts[i] || 0,          // ADDED
      remarks: serviceData.remarks?.[i] || '',
    });
  }
  
  return descriptions;
};
// Simple unique ID generator
const generateUniqueId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};
const CreateServicePage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams?.get('edit') ?? null;
  const isEditMode = !!editId;
  const { serviceData, newDescription, snackbarOpen, snackbarMessage, serviceTotalsLoading: totalsLoading } = useSelector(selectServiceState);
  const { businesses, shippingaddress } = useSelector(selectBusinesses);
  const { location: locations, loading: locationsLoading } = useSelector(selectStorageLocations);
  const { items: taxItems } = useSelector((state: RootState) => state.purchaseTax);
  const { vendors } = useSelector(selectPurchaseOrderState); // ADD: vendors array from Redux
  const [open, setDialogOpen] = useState(false);
  const [openShippingDialog, setOpenShippingDialog] = useState(false);
  const [updatedShippingRow, setUpdatedShippingRow] = useState<ShippingAddress | null>(null);
  const [totals, setTotals] = useState({
    subTotal: 0,
    roundedTotalOrderAmount: 0,
    roundedTotalDiscount: 0,
    roundedTotalTax: 0,
    overallDiscountAmount: 0,
    descriptionDiscountAmount: 0,
    taxAmount: 0,
    afterDiscount: 0,
  });
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [errors, setErrors] = useState({ description: false, fromDate: false, toDate: false, fee: false, taxPer: false, quantity: false, remarks: false });
  const [formErrors, setFormErrors] = useState({
    vendorName: false,
    billingAddress: false,
    shippingAddress: false,
    locationName: false,
    paymentTerms: false,
    creditLimit: false
  });
const isEditing = (newDescription as any).index !== undefined && (newDescription as any).index >= 0;
  const [selectedService, setSelectedService] = useState<ServiceSummary | null>(null);
  const [vendorSearch, setVendorSearch] = useState<VendorSummary | null>(null);
  const [locationSearch, setLocationSearch] = useState<Location | null>(null);
  const [showNavigationConfirm, setShowNavigationConfirm] = useState(false);
  const [hasDescriptionWiseDiscount, setHasDescriptionWiseDiscount] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const [isHoldOrderDialog, setIsHoldOrderDialog] = useState(false);
  const [overallDiscountValue, setOverallDiscountValue] = useState<number>(0);
  const [overallDiscountMode, setOverallDiscountMode] = useState<'percentage' | 'amount'>('percentage');
  const [overallDiscountAppliedOn, setOverallDiscountAppliedOn] = useState<'before_tax' | 'after_tax'>('after_tax');
  const [roundOffValue, setRoundOffValue] = useState<number>(0);
  const [orderLoading, setOrderLoading] = useState(false);
  const descriptionRef = useRef<HTMLInputElement | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [servicesList, setServicesList] = useState<ServiceSummary[]>([]);
// Add ONLY these 2 states for freight:
  const [freights, setFreights] = useState<any[]>([]);
  const [openFreightDialog, setOpenFreightDialog] = useState(false);
  // FIXED: Load specific service data in edit mode (proper date parsing without time)
  useEffect(() => {
    if (isEditMode && editId) {
      setOrderLoading(true);
      dispatch(fetchServiceById(editId))
        .unwrap()
        .then((data) => {
          // FIXED: Parse dates to date-only strings if they include time
          const parsedData = { ...data };
          if (parsedData.workOrderDate) {
            const dateOnly = formatDate(new Date(parsedData.workOrderDate));
            parsedData.workOrderDate = dateOnly;
          }
          // FIXED: Parse description dates to date-only, handle null
          if (parsedData.from_dates && parsedData.from_dates.length > 0) {
            parsedData.from_dates = parsedData.from_dates.map((dt: string | null) => dt ? formatDate(new Date(dt)) : null);
          }
          if (parsedData.to_dates && parsedData.to_dates.length > 0) {
            parsedData.to_dates = parsedData.to_dates.map((dt: string | null) => dt ? formatDate(new Date(dt)) : null);
          }
          // ADDED: Handle quantities array from backend (assume backend returns it as flat array)
          if (parsedData.quantity) {
            parsedData.quantity = parsedData.quantity.map((q: string | number) => parseInt(String(q)) || 1);
          } else {
            parsedData.quantity = []; // Ensure it exists
          }
          // ADDED: Handle remarks array from backend
          if (parsedData.remarks) {
            parsedData.remarks = parsedData.remarks.map((r: string) => r || '');
          } else {
            parsedData.remarks = []; // Ensure it exists
          }
          dispatch(setServiceData(parsedData));
          if (data.overallDiscountValue !== undefined) {
            setOverallDiscountValue(data.overallDiscountValue);
          }
          if (data.roundOffValue !== undefined) {
            setRoundOffValue(data.roundOffValue);
          }
          setOrderLoading(false);
        })
        .catch((error) => {
          console.error('Failed to load service order for edit:', error);
          dispatch(setSnackbarMessage('Failed to load service order data.'));
          dispatch(setSnackbarOpen(true));
          setOrderLoading(false);
          router.push('/yen-purchase/ServiceOrder');
        });
    }
  }, [isEditMode, editId, dispatch, router]);
    // Add freight totals calculation (simple)
  const freightSubTotal = freights.reduce((sum, f) => sum + (f.amt || 0), 0);
  const freightTaxTotal = freights.reduce((sum, f) => sum + (f.tAmt || 0), 0);
  const freightGrandTotal = freights.reduce((sum, f) => sum + (f.totalAmt || 0), 0);

  // Add freight handler (simple)
  const handleAddFreights = (newFreights: any[]) => {
    setFreights(newFreights);
    // You can call refreshTotals here if needed
  };
const refreshTotals = useCallback(async () => {
  if (serviceData.desc_descriptions.length === 0) {
    setTotals({
      subTotal: 0, 
      roundedTotalOrderAmount: 0, 
      roundedTotalDiscount: 0, 
      roundedTotalTax: 0,
      overallDiscountAmount: 0, 
      descriptionDiscountAmount: 0, 
      taxAmount: 0, 
      afterDiscount: 0,
    });
    return;
  }
  
  try {
    // Create proper description objects
    const descriptions: ServiceDescription[] = serviceData.desc_descriptions.map((desc, index) => ({
      id: serviceData.desc_ids[index] || `desc_${Date.now()}_${index}`,
      sacCode: serviceData.sacCode[index] || '',
      description: desc,
      from_date: serviceData.from_dates[index] || null,
      to_date: serviceData.to_dates[index] || null,
      fee: serviceData.fees[index] || 0,
      quantity: serviceData.quantity?.[index] || 1,
      remarks: serviceData.remarks?.[index] || '',
      tax_type: serviceData.desc_tax_types[index] as 'cgst_sgst' | 'igst' || 'cgst_sgst',
      tax_per: serviceData.desc_tax_pers[index] || 0,
      sgst: serviceData.desc_sgst?.[index] || 0,
      cgst: serviceData.desc_cgst?.[index] || 0,
      igst: serviceData.desc_igst?.[index] || 0,
      total: serviceData.desc_totals?.[index] || 0,
      taxAmount: serviceData.desc_tax_amounts?.[index] || 0,
      totalFee: serviceData.desc_total_fees?.[index] || serviceData.fees[index] || 0,
      finalFee: serviceData.desc_total_fees?.[index] || serviceData.fees[index] || 0,
      discountAmount: serviceData.desc_discount_amounts?.[index] || 0,
      discount_percentage: serviceData.desc_discount_percentages?.[index] || 0,
      discount_amount: serviceData.desc_discount_amounts?.[index] || 0,
    }));
    
    const request: ServiceTotalsRequest = {
      descriptions,
      overall_discount_value: overallDiscountValue,
      overall_discount_type: overallDiscountMode,
      overall_discount_applied_on: overallDiscountAppliedOn, // This is now valid
      round_off: roundOffValue,
    };
    
    console.log('Sending calculate request:', request);
    
    const result = await dispatch(calculateServiceTotals(request)).unwrap();
    
    console.log('Received totals result:', result);
    
    // Update state with backend-calculated values
    const updatedServiceData = { ...serviceData };
    
    if (result.desc_sgst && result.desc_sgst.length > 0) {
      updatedServiceData.desc_sgst = result.desc_sgst;
      updatedServiceData.desc_cgst = result.desc_cgst;
      updatedServiceData.desc_igst = result.desc_igst;
      updatedServiceData.desc_tax_amounts = result.desc_tax_amounts || [];
      updatedServiceData.desc_totals = result.desc_totals || [];
      updatedServiceData.desc_total_fees = result.desc_total_fees || [];
      updatedServiceData.desc_discount_amounts = result.desc_discount_amounts || [];
      updatedServiceData.desc_overall_discounts = result.desc_overall_discounts || [];
      
      updatedServiceData.desc_discount_percentages = serviceData.desc_discount_percentages || Array(result.desc_sgst.length).fill(0);
      updatedServiceData.desc_discount_amounts = serviceData.desc_discount_amounts || Array(result.desc_sgst.length).fill(0);
      
      // Store the applied on method if returned
      if (result.overall_discount_applied_on) {
        setOverallDiscountAppliedOn(result.overall_discount_applied_on);
      }
    }
    
    dispatch(setServiceData(updatedServiceData));
    
    // Calculate final total INCLUDING FREIGHT
    const serviceTotal = result.totalAmount || 0;
    const finalTotal = serviceTotal + freightGrandTotal;
    
    setTotals({
      subTotal: result.totalFees || 0,
      roundedTotalOrderAmount: finalTotal, // Include freight in final amount
      roundedTotalDiscount: result.totalDiscount || 0,
      roundedTotalTax: result.totalTax || 0,
      overallDiscountAmount: result.totalOverallDiscount || 0,
      descriptionDiscountAmount: result.totalIndividualDiscount || 0,
      taxAmount: result.totalTax || 0,
      afterDiscount: result.totalFees || 0,
    });
    
  } catch (error) {
    console.error('Error refreshing totals:', error);
    dispatch(setSnackbarMessage('Failed to calculate totals. Please check the data.'));
    dispatch(setSnackbarOpen(true));
  }
}, [serviceData, overallDiscountValue, overallDiscountMode, overallDiscountAppliedOn, roundOffValue, dispatch, freightGrandTotal]);
  useEffect(() => {
  if (open) {
    dispatch(fetchPurchaseTaxes());
  }
}, [open, dispatch]);

  useEffect(() => {
    refreshTotals();
  }, [serviceData.desc_descriptions.length, overallDiscountValue, overallDiscountMode, roundOffValue]); // REMOVED: refreshTotals from deps
  // Auto-select vendor and location in edit mode
  useEffect(() => {
    if (isEditMode && serviceData.vendorName && vendors.length > 0) {
      const matchedVendor = vendors.find((vendor: VendorSummary) => vendor.vendorName === serviceData.vendorName);
      if (matchedVendor && !vendorSearch) {
        setVendorSearch({
          vendorName: matchedVendor.vendorName,
          contactpersonPhone: matchedVendor.contactpersonPhone,
          contactpersonEmail: matchedVendor.contactpersonEmail,
          address: matchedVendor.address,
          country: matchedVendor.country,
          paymentTerms: matchedVendor.paymentTerms,
          creditLimit: matchedVendor.creditLimit,
          state: matchedVendor.state,
          city: matchedVendor.city
        } as VendorSummary);
      }
    }
  }, [isEditMode, serviceData.vendorName, vendors, vendorSearch]);
  useEffect(() => {
    if (isEditMode && serviceData.locationName && locations.length > 0) {
      const matchedLocation = locations.find((loc: Location) => loc.branchName === serviceData.locationName);
      if (matchedLocation && !locationSearch) {
        setLocationSearch(matchedLocation);
      }
    }
  }, [isEditMode, serviceData.locationName, locations, locationSearch]);
  // Reset form for create mode
  useEffect(() => {
    if (!isEditMode) {
      const currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);
      dispatch(setServiceData({
        serviceId: '',
        vendorName: '',
        vendorContact: '',
        workOrderDate: formatDate(currentDate), // Date-only
        status: 'Pending',
        // Flat arrays initialization
        sacCode: [],
        desc_ids: [],
        desc_descriptions: [],
        from_dates: [],
        to_dates: [],
        quantity: [], // ADDED: Initialize quantity array
        remarks: [], // ADDED: Initialize remarks array
        fees: [],
        desc_tax_types: [],
        desc_tax_pers: [],
        desc_sgst: [],
        desc_cgst: [],
        desc_igst: [],
        desc_tax_amounts: [],
        desc_totals: [],
        desc_total_fees: [],
        desc_discount_amounts: [],
        desc_overall_discounts: [], // NEW
        // Other fields
        totalAmount: 0,
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
        creditLimit: 0,
        overallDiscountValue: 0,
        roundOffValue: 0,
        totalTax: 0,
        vendorId: '',
      }));
    }
  }, [isEditMode, dispatch]);
  // Set default addresses and dates
  useEffect(() => {
    if (shippingaddress.length > 0 && !serviceData.shippingAddress) {
      const defaultShippingAddress = shippingaddress[2]?.address ?? '';
      dispatch(setServiceData({
        ...serviceData,
        shippingAddress: defaultShippingAddress
      }));
      setFormErrors(prev => ({ ...prev, shippingAddress: false }));
    }
  }, [shippingaddress, serviceData.shippingAddress, dispatch]);
  useEffect(() => {
    if (businesses.length === 1 && !serviceData.billingAddress) {
      const defaultBillingAddress = `${businesses[0].address1 ?? ''} ${businesses[0].address2 ?? ''}`.trim();
      dispatch(setServiceData({ ...serviceData, billingAddress: defaultBillingAddress }));
    }
  }, [businesses, serviceData, dispatch]);
  // FIXED: workOrderDate handling - always default to today in create mode if missing
  useEffect(() => {
    if (!isEditMode && (!serviceData.workOrderDate || serviceData.workOrderDate === '')) {
      const currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);
      dispatch(setServiceData({
        ...serviceData,
        workOrderDate: formatDate(currentDate) // Date-only
      }));
    }
  }, [dispatch, serviceData.workOrderDate, isEditMode]);
  // Track dirty state
  useEffect(() => {
    const descriptions = getDescriptionsFromFlatArrays(serviceData);
    const hasChanges =
      serviceData.vendorName !== '' ||
      descriptions.length > 0 ||
      serviceData.billingAddress !== '' ||
      serviceData.shippingAddress !== '' ||
      serviceData.locationName !== '' ||
      serviceData.comments !== '' ||
      serviceData.termsandConditions.some((term) => term !== '') ||
      overallDiscountValue !== 0 ||
      roundOffValue !== 0;
    setIsFormDirty(hasChanges);
  }, [serviceData, overallDiscountValue, roundOffValue]);
  useBeforeUnload(isFormDirty, 'You have unsaved changes. Are you sure you want to leave?');
  // Fetch initial data
  useEffect(() => {
    dispatch(fetchServices());
    dispatch(fetchBusinesses());
    dispatch(fetchShipping());
    dispatch(fetchLocations());
  }, [dispatch]);
  // Check for description-wise discounts
  useEffect(() => {
    const descriptions = getDescriptionsFromFlatArrays(serviceData);
    const hasDiscount = descriptions.some(desc => (desc.discountAmount || 0) > 0);
    setHasDescriptionWiseDiscount(hasDiscount);
    if (hasDiscount && overallDiscountValue > 0) {
      setOverallDiscountValue(0);
      dispatch(setSnackbarMessage('Overall discount disabled due to existing description-wise discounts'));
      dispatch(setSnackbarOpen(true));
    }
  }, [serviceData, overallDiscountValue, dispatch]);
  // FIXED: Service-specific handlers with date-only
  const handleWorkOrderDateChange = (date: Date | null) => {
    const finalDateStr = formatDate(date);
    dispatch(setServiceData({
      ...serviceData,
      workOrderDate: finalDateStr
    }));
  };
  const handleSelectAddressChange = useCallback(
    (name: string, value: string | null) => {
      const updatedData = { ...serviceData, [name]: value ?? '' };
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
      dispatch(setServiceData(updatedData));
    },
    [dispatch, serviceData, businesses, shippingaddress]
  );
  const handleLocationChange = useCallback((location: Location | null) => {
    setLocationSearch(location);
    dispatch(setServiceData({
      ...serviceData,
      locationName: location?.branchName || ''
    }));
    setFormErrors(prev => ({ ...prev, locationName: false }));
  }, [dispatch, serviceData]);
  const handleTextFieldChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, index?: number) => {
    const { name, value } = e.target;
    if (index !== undefined) {
      dispatch(setServiceData({
        ...serviceData,
        termsandConditions: serviceData.termsandConditions.map((term, i) => (i === index ? value : term)),
      }));
    } else {
      dispatch(setServiceData({ ...serviceData, [name]: value }));
      setFormErrors({ ...formErrors, [name]: false });
    }
  };
  const toggleFullScreen = () => {
    setIsFullScreen((prev) => !prev);
  };
  const handleAddTerm = () => {
    if (serviceData.termsandConditions.length < 3) {
      dispatch(setServiceData({
        ...serviceData,
        termsandConditions: [...serviceData.termsandConditions, ''],
      }));
    }
  };
  const handleRemoveTerm = (index: number) => {
    dispatch(setServiceData({
      ...serviceData,
      termsandConditions: serviceData.termsandConditions.filter((_, i) => i !== index),
    }));
  };
  const handleRoundOffChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^-?\d*\.?\d{0,2}$/.test(value)) {
      const parsedValue = value === '' ? 0 : parseFloat(value) || 0;
      setRoundOffValue(parsedValue);
    }
  };
  const handleDescriptionChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'sacCode') {
      dispatch(setNewDescriptionData({ ...newDescription, sacCode: value }));
    } else if (name === 'description') {
      if (value === '' || value.length <= 500) {
        dispatch(setNewDescriptionData({ ...newDescription, description: value }));
        setErrors({ ...errors, description: false });
      }
    } else if (name === 'quantity') {
      // FIXED: Handle quantity input - allow clear (sets to 1) and type new value
      if (value === '' || /^\d+$/.test(value)) {
        const parsedValue = value === '' ? 1 : parseInt(value) || 1;
        if (parsedValue < 1) {
          dispatch(setSnackbarMessage('Quantity must be at least 1'));
          dispatch(setSnackbarOpen(true));
          return;
        }
        dispatch(setNewDescriptionData({
          ...newDescription,
          quantity: parsedValue,
        }));
        setErrors({ ...errors, quantity: false });
      }
    } else if (name === 'remarks') {
      // FIXED: Handle remarks input
      dispatch(setNewDescriptionData({ ...newDescription, remarks: value }));
      setErrors({ ...errors, remarks: false });
    } else if (name === 'fee') {
      if (value === '' || /^\d{0,8}(\.\d{0,2})?$/.test(value)) {
        const parsedValue = value === '' ? 0 : parseFloat(value) || 0;
        dispatch(setNewDescriptionData({
          ...newDescription,
          fee: parsedValue,
        }));
        setErrors({ ...errors, fee: false });
      }
    } else if (name === 'taxPer') {
      if (value === '' || /^\d{0,2}(\.\d{0,2})?$/.test(value)) {
        const parsedValue = value === '' ? 0 : parseFloat(value) || 0;
        if (parsedValue > 99.99) {
          dispatch(setSnackbarMessage('Tax percentage cannot exceed 99.99%'));
          dispatch(setSnackbarOpen(true));
          return;
        }
        dispatch(setNewDescriptionData({
          ...newDescription,
          tax_per: parsedValue,
        }));
        setErrors({ ...errors, taxPer: false });
      }
    }
  };
  const handleDescriptionDateChange = (name: 'from_date' | 'to_date', date: Date | null) => {
    const finalDateStr = formatDate(date);
    dispatch(setNewDescriptionData({
      ...newDescription,
      [name]: finalDateStr,
    }));
    setErrors({ ...errors, [name === 'from_date' ? 'fromDate' : 'toDate']: false });
  };
  const handleDescriptionTaxTypeChange = (event: ChangeEvent<HTMLInputElement>) => {
    dispatch(setNewDescriptionData({ ...newDescription, tax_type: event.target.value as 'cgst_sgst' | 'igst' }));
  };
const handleAddDescription = useCallback(async () => {
  const isEditing = (newDescription as any).index !== undefined && (newDescription as any).index >= 0;
  const editingIndex = (newDescription as any).index;
  
  // Validation
  setErrors({
    description: !newDescription.description?.trim(),
    fromDate: false,
    toDate: false,
    fee: !newDescription.fee || newDescription.fee <= 0,
    taxPer: false,
    quantity: !newDescription.quantity || newDescription.quantity < 1,
    remarks: false,
  });
 
  // Description, fee, and quantity are required
  if (!newDescription.description?.trim() ||
      !newDescription.fee ||
      newDescription.fee <= 0 ||
      !newDescription.quantity ||
      newDescription.quantity < 1) {
    dispatch(setSnackbarMessage('Description, fee (>0), and quantity (≥1) are required.'));
    dispatch(setSnackbarOpen(true));
    return;
  }
 
  setLoading(true);
  try {
    const params = {
      description: newDescription.description.trim(),
      fromDate: newDescription.from_date || null,
      toDate: newDescription.to_date || null,
      fee: newDescription.fee,
      taxType: newDescription.tax_type,
      taxPer: newDescription.tax_per || 0,
      sacCode: newDescription.sacCode || '',
      discount: 0,
      quantity: newDescription.quantity || 1,
      remarks: newDescription.remarks || '',
    };
   
    const calcResult = await dispatch(calculateDescriptionTotals(params)).unwrap();
   
    // Create the new description with calculated values
    const newDescWithId: ServiceDescription = {
      id: isEditing ? newDescription.id : generateUniqueId(),
      sacCode: newDescription.sacCode || '',
      description: newDescription.description.trim(),
      from_date: newDescription.from_date || null,
      to_date: newDescription.to_date || null,
      fee: newDescription.fee,
      quantity: newDescription.quantity || 1,
      tax_type: newDescription.tax_type,
      tax_per: newDescription.tax_per || 0,
      sgst: calcResult.sgst || 0,
      cgst: calcResult.cgst || 0,
      igst: calcResult.igst || 0,
      total: calcResult.total || 0,
      taxAmount: calcResult.totalTax || 0,
      totalFee: calcResult.totalFee || 0,
      finalFee: calcResult.totalFee || 0,
      discountAmount: 0,
      discount_percentage: 0,  // ADDED
      discount_amount: 0,      // ADDED
      remarks: newDescription.remarks || '',
    };
   
    if (isEditing && editingIndex !== undefined) {
      // UPDATE existing description
      dispatch(updateDescription({
        index: editingIndex,
        desc: newDescWithId
      }));
      dispatch(setSnackbarMessage('Description updated successfully'));
    } else {
      // ADD new description
      dispatch(addDescriptionToService(newDescWithId));
      dispatch(setSnackbarMessage('Description added successfully'));
    }
   
    // Reset form - include index property
    dispatch(setNewDescriptionData({
      id: '',
      sacCode: '',
      description: '',
      from_date: null,
      to_date: null,
      fee: 0,
      tax_type: 'cgst_sgst',
      tax_per: 0,
      sgst: 0,
      cgst: 0,
      igst: 0,
      total: 0,
      taxAmount: 0,
      totalFee: 0,
      finalFee: 0,
      discountAmount: 0,
      discount_percentage: 0,  // ADDED
      discount_amount: 0,      // ADDED
      quantity: 1,
      remarks: '',
      index: undefined,
    } as any));
   
    setSelectedService(null);
    setErrors({ description: false, fromDate: false, toDate: false, fee: false, taxPer: false, quantity: false, remarks: false });
   
    setTimeout(() => descriptionRef.current?.focus(), 100);
   
  } catch (error) {
    console.error('Add/Update desc error:', error);
    dispatch(setSnackbarMessage(`Failed: ${error instanceof Error ? error.message : 'Try again'}`));
    dispatch(setSnackbarOpen(true));
  } finally {
    setLoading(false);
  }
}, [dispatch, newDescription, serviceData]);
// Update handleEditDescription to use servicesList
const handleEditDescription = (index: number) => {
  const descriptions = getDescriptionsFromFlatArrays(serviceData);
  const desc = descriptions[index];
  if (desc) {
    // Find the selected service by SAC code to populate dropdown
    if (desc.sacCode && servicesList.length > 0) {
      const service = servicesList.find(s => s.saccode.toString() === desc.sacCode);
      setSelectedService(service || null);
    }
    
    dispatch(setDescriptionForEditing({ 
      ...desc, 
      index: index
    }));
    
    // Scroll to description form
    document.getElementById('description-form')?.scrollIntoView({ behavior: 'smooth' });
  }
};
  const handleDeleteDescription = (index: number) => {
    dispatch(deleteDescriptionFromService(index));
    dispatch(clearDescriptionForEditing());
  };
  // UPDATED: Overall discount handlers (use backend calculateServiceTotals)
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
    if (hasDescriptionWiseDiscount) {
      dispatch(setSnackbarMessage('Cannot change discount mode when description-wise discounts exist'));
      dispatch(setSnackbarOpen(true));
      return;
    }
    if (newMode === overallDiscountMode) return;
    let newValue = 0;
    if (overallDiscountValue > 0 && totals.subTotal > 0) {
      newValue = overallDiscountMode === 'percentage'
        ? (overallDiscountValue / 100) * totals.subTotal
        : (overallDiscountValue / totals.subTotal) * 100;
      newValue = Math.round(newValue * 100) / 100;
    }
    setOverallDiscountMode(newMode);
    setOverallDiscountValue(newValue);
  };
  // UPDATED: Apply overall discount via backend calculateServiceTotals
  const handleApplyDiscount = async () => {
    if (hasDescriptionWiseDiscount) {
      dispatch(setSnackbarMessage('Cannot apply overall discount when description-wise discounts exist'));
      dispatch(setSnackbarOpen(true));
      return;
    }
    if (overallDiscountValue <= 0) {
      dispatch(setSnackbarMessage('Please enter a valid discount amount'));
      dispatch(setSnackbarOpen(true));
      return;
    }
    if (serviceData.desc_descriptions.length === 0) {
      dispatch(setSnackbarMessage('Add descriptions before applying discount'));
      dispatch(setSnackbarOpen(true));
      return;
    }
    setLoading(true);
    try {
      await refreshTotals(); // This will apply the discount via backend and update flat arrays
      dispatch(setSnackbarMessage(
        `Successfully applied ${overallDiscountValue}${overallDiscountMode === 'percentage' ? '%' : ''} discount across all descriptions`
      ));
      dispatch(setSnackbarOpen(true));
      setOverallDiscountValue(0); // Reset input
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
  const handleVendorSelection = (vendor: VendorSummary | null) => {
    setVendorSearch(vendor);
    if (vendor) {
      dispatch(setServiceData({
        ...serviceData,
        vendorName: vendor.vendorName,
        vendorContact: vendor.contactpersonPhone,
        contactpersonEmail: vendor.contactpersonEmail,
        address: vendor.address,
        country: vendor.country,
        paymentTerms: vendor.paymentTerms,
        creditLimit: vendor.creditLimit,
        state: vendor.state,
        city: vendor.city,
      }));
      setFormErrors({ ...formErrors, vendorName: false, paymentTerms: false, creditLimit: false });
      setTimeout(() => {
        if (descriptionRef.current) {
          descriptionRef.current.focus();
        }
      }, 0);
    } else {
      dispatch(setServiceData({
        ...serviceData,
        vendorName: '',
        vendorContact: '',
        creditLimit: 0,
        contactpersonEmail: '',
        address: '',
        country: '',
        paymentTerms: '',
        state: '',
        city: '',
      }));
    }
  };
  const handleClear = () => {
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    dispatch(setServiceData({
      serviceId: '',
      vendorName: '',
      vendorContact: '',
      workOrderDate: formatDate(currentDate), // Date-only
      status: 'Pending',
      // Flat arrays
      sacCode: [],
      desc_ids: [],
      desc_descriptions: [],
      from_dates: [],
      to_dates: [],
      quantity: [], // ADDED
      remarks: [], // ADDED
      fees: [],
      desc_tax_types: [],
      desc_tax_pers: [],
      desc_sgst: [],
      desc_cgst: [],
      desc_igst: [],
      desc_tax_amounts: [],
      desc_totals: [],
      desc_total_fees: [],
      desc_discount_amounts: [],
      desc_overall_discounts: [], // NEW
      // Other fields
      totalAmount: 0,
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
      creditLimit: 0,
      overallDiscountValue: 0,
      roundOffValue: 0,
      totalTax: 0,
      vendorId: '',
    }));
    dispatch(setNewDescriptionData({
      id: '',
      sacCode: '',
      description: '',
      from_date: '',
      to_date: '',
      fee: 0,
      tax_type: 'cgst_sgst',
      tax_per: 0,
      sgst: 0,
      cgst: 0,
      igst: 0,
      total: 0,
      taxAmount: 0,
      totalFee: 0,
      finalFee: 0,
      discountAmount: 0,
      quantity: 1,
      remarks: '',
    }));
    setVendorSearch(null);
    setLocationSearch(null);
    setOverallDiscountValue(0);
    setOverallDiscountMode('percentage');
    setRoundOffValue(0);
    setIsFormDirty(false);
    setFormErrors({
      vendorName: false,
      billingAddress: false,
      shippingAddress: false,
      locationName: false,
      paymentTerms: false,
      creditLimit: false
    });
    if (isEditMode) {
      router.push('/yen-purchase/ServiceOrder');
    }
  };
  const handleBackToService = () => {
    if (isFormDirty) {
      setPendingNavigation(() => () => {
        handleClear();
        router.push('/yen-purchase/ServiceOrder');
      });
      setShowNavigationConfirm(true);
    } else {
      handleClear();
      router.push('/yen-purchase/ServiceOrder');
    }
  };
 const handleSubmit = async () => {
  try {
    await validationSchema.validate(serviceData, { abortEarly: false });
    setFormErrors({
      vendorName: false,
      billingAddress: false,
      shippingAddress: false,
      locationName: false,
      paymentTerms: false,
      creditLimit: false
    });
    if (serviceData.desc_descriptions.length === 0) {
      dispatch(setSnackbarMessage('At least one description is required.'));
      dispatch(setSnackbarOpen(true));
      return;
    }
    
    await refreshTotals();
    
    const workOrderDate = serviceData.workOrderDate || formatDate(new Date());
    const finalAmount = totals.roundedTotalOrderAmount;
    const totalDiscount = totals.roundedTotalDiscount;
    const totalTax = totals.roundedTotalTax;
    
    // Prepare freight data
    const freightData = {
      freights: freights,
      totalFreightAmount: freightSubTotal,
      totalFreightTaxAmount: freightTaxTotal,
    };
    
    const dataToSubmit = {
      ...serviceData,
      ...freightData,
      workOrderDate,
      totalAmount: finalAmount,
      totalTax: totalTax,
      overallDiscountType: overallDiscountMode,
      overallDiscountAppliedOn: overallDiscountAppliedOn,
      overallDiscountValue,
      totalDiscount,
      roundOffValue,
      quantity: serviceData.quantity || [],
      remarks: serviceData.remarks || [],
      sacCode: serviceData.sacCode || [],
      desc_ids: serviceData.desc_ids || [],
      desc_descriptions: serviceData.desc_descriptions || [],
      from_dates: serviceData.from_dates || [],
      to_dates: serviceData.to_dates || [],
      fees: serviceData.fees || [],
      desc_tax_types: serviceData.desc_tax_types || [],
      desc_tax_pers: serviceData.desc_tax_pers || [],
      desc_sgst: serviceData.desc_sgst || [],
      desc_cgst: serviceData.desc_cgst || [],
      desc_igst: serviceData.desc_igst || [],
      desc_tax_amounts: serviceData.desc_tax_amounts || [],
      desc_totals: serviceData.desc_totals || [],
      desc_total_fees: serviceData.desc_total_fees || [],
      desc_discount_amounts: serviceData.desc_discount_amounts || [],
      desc_overall_discounts: serviceData.desc_overall_discounts || [],
      termsandConditions: serviceData.termsandConditions || [''],
    } as ServiceData;
    
    let result;
    setSubmitLoading(true);
    if (isEditMode && editId) {
      result = await dispatch(updateService({ serviceId: editId, service: dataToSubmit })).unwrap();
      dispatch(setSnackbarMessage(`Service Order ${result.serviceId || editId} successfully updated.`));
    } else {
      result = await dispatch(addService(dataToSubmit)).unwrap();
      dispatch(setSnackbarMessage(
        `Service Order ${result.serviceId || 'Unknown'} successfully created.`
      ));
    }
    dispatch(setSnackbarOpen(true));
    await dispatch(fetchServices());
    handleClear();
    setDialogOpen(false);
    router.push('/yen-purchase/ServiceOrder');
  } catch (error) {
    console.error('Submit error:', error);
    dispatch(setSnackbarMessage('Failed to submit service order. Please check the data.'));
    dispatch(setSnackbarOpen(true));
  } finally {
    setSubmitLoading(false);
  }
};
  const handleOpenDialog = () => {
    validationSchema.validate(serviceData, { abortEarly: false })
      .then(() => {
        setFormErrors({
          vendorName: false,
          billingAddress: false,
          shippingAddress: false,
          locationName: false,
          paymentTerms: false,
          creditLimit: false
        });
        setIsHoldOrderDialog(totals.roundedTotalOrderAmount > serviceData.creditLimit);
        setDialogOpen(true);
      })
      .catch((err: Yup.ValidationError) => {
        const newErrors = {
          vendorName: false,
          billingAddress: false,
          shippingAddress: false,
          locationName: false,
          paymentTerms: false,
          creditLimit: false
        };
        err.inner.forEach((error) => {
          if (error.path && error.path in newErrors) {
            newErrors[error.path as keyof typeof newErrors] = true;
          }
        });
        setFormErrors(newErrors);
        dispatch(setSnackbarMessage('Please fill all required fields.'));
        dispatch(setSnackbarOpen(true));
      });
  };
  if (orderLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh" flexDirection="column">
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading service order data...
        </Typography>
      </Box>
    );
  }
  const descriptions = getDescriptionsFromFlatArrays(serviceData);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#ffffff' }}>
      <Box sx={{ flex: 1, p: 3, overflowY: 'auto', maxHeight: 'calc(100vh - 64px)' }}>
        <Box sx={{ maxWidth: '1200px', mx: 'auto' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography fontWeight={'bold'} sx={{ textDecoration: 'underline' }}>
              {isEditMode ? `Edit Workorder Service Order - ${serviceData.serviceId || editId}` : `Create New Workorder Service Order`}
            </Typography>
            <Button variant="contained" color="primary" onClick={handleBackToService}>
              Back to Service Orders
            </Button>
          </Box>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={3} md={2}>
              <TextField
                fullWidth
                disabled
                label="Service ID"
                name="serviceId"
                value={serviceData.serviceId || (isEditMode ? editId : 'New')}
                size="small"
                variant="outlined"
                autoComplete="off"
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
                value={serviceData.vendorContact}
                size="small"
                variant="outlined"
                autoComplete="off"
              />
            </Grid>
            <Grid item xs={12} sm={3} md={2}>
              <TextField
                fullWidth
                disabled
                label="Payment Terms"
                name="paymentTerms"
                value={serviceData.paymentTerms}
                size="small"
                variant="outlined"
                error={formErrors.paymentTerms}
                helperText={formErrors.paymentTerms ? 'Payment terms are required' : ''}
                autoComplete="off"
              />
            </Grid>
            <Grid item xs={12} sm={3} md={2}>
              <TextField
                fullWidth
                disabled
                label="Credit Limit"
                name="creditLimit"
                type="number"
                value={serviceData.creditLimit === 0 ? '' : serviceData.creditLimit}
                size="small"
                variant="outlined"
                error={formErrors.creditLimit}
                helperText={formErrors.creditLimit ? 'Credit limit is required' : ''}
                autoComplete="off"
              />
            </Grid>
            <Grid item xs={12} sm={3} md={2}>
              <Grid container spacing={1}>
                <Grid item xs={8}>
                  <SmartDatePicker
                    label="Order Date"
                    value={serviceData.workOrderDate ? parseDate(serviceData.workOrderDate) : null}
                    onChange={handleWorkOrderDateChange}
                    maxDate={new Date()}
                  />
                </Grid>
              </Grid>
            </Grid>
          </Grid>
          {/* Add Description Section with Quantity and Remarks */}
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
              <Typography variant="h6">Add Service Description</Typography>
              <IconButton onClick={toggleFullScreen} color="primary">
                {isFullScreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
              </IconButton>
            </Box>
            <Grid container spacing={2}>
              {/* SAC Code - Service Autocomplete Dropdown */}
         {/* SAC Code - Service Autocomplete Dropdown (SAC Code only) */}
<Grid item xs={12} sm={2}>
  <ServiceAutocomplete
    value={selectedService}
    onChange={(service: ServiceSummary | null) => {
      setSelectedService(service);
      if (service) {
        // Only fill SAC code, NOT the description
        dispatch(setNewDescriptionData({
          ...newDescription,
          sacCode: service.saccode.toString(), // Only set SAC code
          // DO NOT set description here - let user type it separately
        }));
        // Auto-focus to description field after selecting SAC code
        setTimeout(() => {
          descriptionRef.current?.focus();
        }, 100);
      } else {
        // Clear SAC code when service is cleared
        dispatch(setNewDescriptionData({
          ...newDescription,
          sacCode: '',
        }));
      }
    }}
    label="SAC Code"
    status="active"
    required={false}
  />
</Grid>
              {/* Description */}
              <Grid item xs={12} sm={3}>
                <TextField
                  inputRef={descriptionRef}
                  fullWidth
                  label="Description"
                  name="description"
                  value={newDescription.description}
                  onChange={handleDescriptionChange}
                  size="small"
                  error={errors.description}
                  helperText={errors.description ? 'Description is required' : ''}
                  autoComplete="off"
                />
              </Grid>
              {/* Remarks - Placed near Description */}
              <Grid item xs={12} sm={2.5}>
                <TextField
                  fullWidth
                  label="Remarks"
                  name="remarks"
                  value={newDescription.remarks || ''}
                  onChange={handleDescriptionChange}
                  size="small"
                  autoComplete="off"
                  placeholder="Optional"
                  error={errors.remarks}
                  helperText={errors.remarks ? 'Remarks is required' : ''}
                />
              </Grid>
              {/* Quantity - FIXED: Always show value (even if 1), allow clear/type */}
              <Grid item xs={12} sm={1.5}>
                <TextField
                  fullWidth
                  label="Quantity"
                  name="quantity"
                  type="number"
                  value={newDescription.quantity} // FIXED: Always show the value (e.g., "1" instead of empty)
                  onChange={handleDescriptionChange}
                  size="small"
                  error={errors.quantity}
                  helperText={errors.quantity ? 'Quantity is required (≥1)' : ''}
                  inputProps={{
                    min: 1,
                    step: 1,
                    onKeyDown: (e) => {
                      // Prevent negative sign and decimal
                      if (e.key === '-' || e.key === '.') {
                        e.preventDefault();
                      }
                    }
                  }}
                  autoComplete="off"
                />
              </Grid>
              {/* From Date */}
              <Grid item xs={12} sm={2}>
                <SmartDatePicker
                  label="From Date"
                  value={newDescription.from_date ? parseDate(newDescription.from_date) : null}
                  onChange={(date) => handleDescriptionDateChange('from_date', date)}
                  minDate={serviceData.workOrderDate ? parseDate(serviceData.workOrderDate) : null}
                />
              </Grid>
              {/* To Date */}
              <Grid item xs={12} sm={2}>
                <SmartDatePicker
                  label="To Date"
                  value={newDescription.to_date ? parseDate(newDescription.to_date) : null}
                  onChange={(date) => handleDescriptionDateChange('to_date', date)}
                  minDate={newDescription.from_date ? parseDate(newDescription.from_date) : null}
                />
              </Grid>
              {/* Fee */}
              <Grid item xs={12} sm={1.5}>
                <TextField
                  fullWidth
                  label="Fee (₹)"
                  name="fee"
                  type="text"
                  value={newDescription.fee === 0 ? '' : newDescription.fee.toString()}
                  onChange={handleDescriptionChange}
                  size="small"
                  error={errors.fee}
                  helperText={errors.fee ? 'Fee is required and must be > 0' : ''}
                  inputProps={{ min: 0, step: '0.01' }}
                  autoComplete="off"
                />
              </Grid>
              {/* Tax % */}
              <Grid item xs={12} sm={1.5}>
                <TextField
                  fullWidth
                  label="Tax %"
                  name="taxPer"
                  type="text"
                  value={newDescription.tax_per === 0 ? '' : newDescription.tax_per.toString()}
                  onChange={handleDescriptionChange}
                  size="small"
                  inputProps={{ min: 0, max: 99.99, step: '0.01' }}
                  autoComplete="off"
                />
              </Grid>
              {/* Tax Type */}
              <Grid item xs={12} sm={2}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <RadioGroup
                    row
                    value={newDescription.tax_type}
                    onChange={handleDescriptionTaxTypeChange}
                    sx={{ display: 'flex', alignItems: 'center' }}
                  >
                    <FormControlLabel value="igst" control={<Radio size="small" />} label="IGST" />
                    <FormControlLabel value="cgst_sgst" control={<Radio size="small" />} label="CGST/SGST" />
                  </RadioGroup>
                </Box>
              </Grid>
<Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
  {isEditing && (
    <Button
      variant="outlined"
      color="error"
      onClick={() => {
        dispatch(clearDescriptionForEditing());
        setSelectedService(null);
      }}
      size="small"
    >
      Cancel Edit
    </Button>
  )}
  <Button
    variant="contained"
    color={isEditing ? "secondary" : "primary"}
    onClick={handleAddDescription}
    size="small"
    disabled={loading}
    startIcon={loading ? <CircularProgress size={20} /> : null}
  >
    {loading ? 'Processing...' : (isEditing ? 'Update Description' : 'Add Description')}
  </Button>
</Grid>

            </Grid>
            {/* Descriptions Table - UPDATED with Quantity and Remarks */}
            <TableContainer sx={{ maxHeight: '500px', overflowY: 'auto', marginBottom: '10px' }}>
              <Table stickyHeader>
                <TableHead sx={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 1,
                  backgroundColor: 'white',
                  '& th': {
                    fontWeight: 'bold',
                    borderBottom: '2px solid rgba(0,0,0,0.12)'
                  }
                }}>
                  <TableRow>
                    <TableCell>S.No</TableCell>
                    <TableCell>SAC Code</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Remarks</TableCell>
                    <TableCell>Quantity</TableCell>
                    <TableCell>From Date</TableCell>
                    <TableCell>To Date</TableCell>
                    <TableCell align="right">Fee (₹)</TableCell>
                    <TableCell align="center">Tax Type</TableCell>
                    <TableCell align="right">Tax %</TableCell>
                    <TableCell align="right">SGST (₹)</TableCell>
                    <TableCell align="right">CGST (₹)</TableCell>
                    <TableCell align="right">IGST (₹)</TableCell>
                    <TableCell align="right">Overall Disc (₹)</TableCell>
                    <TableCell align="right">Total (₹)</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {descriptions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={17} align="center">No descriptions added</TableCell>
                    </TableRow>
                  ) : (
                   descriptions.map((desc, index) => (
  <TableRow key={desc.id || index}>
    <TableCell>{index + 1}</TableCell>
    <TableCell>{desc.sacCode || 'N/A'}</TableCell>
    <TableCell sx={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {desc.description}
    </TableCell>
    <TableCell sx={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {desc.remarks || 'N/A'}
    </TableCell>
    <TableCell>{desc.quantity || 1}</TableCell>
    <TableCell>{desc.from_date ? new Date(desc.from_date).toLocaleDateString() : 'N/A'}</TableCell>
    <TableCell>{desc.to_date ? new Date(desc.to_date).toLocaleDateString() : 'N/A'}</TableCell>
    <TableCell align="right">{desc.fee?.toFixed(2)}</TableCell>
    <TableCell align="center">{desc.tax_type === 'cgst_sgst' ? 'CGST/SGST' : 'IGST'}</TableCell>
    <TableCell align="right">{desc.tax_per?.toFixed(2)}%</TableCell>
    <TableCell align="right">{desc.sgst?.toFixed(2)}</TableCell>
    <TableCell align="right">{desc.cgst?.toFixed(2)}</TableCell>
    <TableCell align="right">{desc.igst?.toFixed(2)}</TableCell>
    {/* Show overall discount share for this item */}
<TableCell align="right">
  {(serviceData.desc_overall_discounts?.[index] || 0)?.toFixed(2)}
  <Typography variant="caption" color="text.secondary" display="block">
    {serviceData.desc_overall_discounts?.[index] && totals.overallDiscountAmount > 0 
      ? `(${((serviceData.desc_overall_discounts[index] / totals.overallDiscountAmount) * 100).toFixed(1)}%)`
      : ''
    }
  </Typography>
</TableCell>
    <TableCell align="right">{desc.total?.toFixed(2)}</TableCell>
    <TableCell align="right">
      <IconButton onClick={() => handleEditDescription(index)} size="small">
        <EditIcon />
      </IconButton>
      <IconButton onClick={() => handleDeleteDescription(index)} size="small">
        <DeleteIcon />
      </IconButton>
    </TableCell>
  </TableRow>
))
                  )}
                  {/* Totals rows - FIXED colspan to 17 columns (label colSpan=15, value=1, empty=1) */}
                  <TableRow sx={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}>
                    <TableCell colSpan={15} align="right">
                      <strong>Sub Total:</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>{totals.subTotal.toFixed(2)}</strong>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                  <TableRow sx={{ fontWeight: 'bold' }}>
                    <TableCell colSpan={15} align="right">
                      <strong>Total Description Tax:</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>{totals.taxAmount.toFixed(2)}</strong>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                  <TableRow sx={{ fontWeight: 'bold' }}>
                    <TableCell colSpan={15} align="right">
                      <strong>Total Tax:</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>{totals.roundedTotalTax.toFixed(2)}</strong>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                  <TableRow sx={{ fontWeight: 'bold' }}>
                    <TableCell colSpan={15} align="right">
                      <strong>Description-wise Discount:</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>{totals.descriptionDiscountAmount.toFixed(2)}</strong>
                    </TableCell>
                    <TableCell />
                  </TableRow>
<TableRow sx={{ fontWeight: 'bold' }}>
  <TableCell colSpan={9} align="right">
    <strong>Overall Discount:</strong>
  </TableCell>
  <TableCell align="right" colSpan={6}>
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
        sx={{ width: 80 }}
        disabled={hasDescriptionWiseDiscount || totalsLoading}
      />
      
      {/* Apply on selector */}
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <Select
          value={overallDiscountAppliedOn}
          onChange={(e) => setOverallDiscountAppliedOn(e.target.value as 'before_tax' | 'after_tax')}
          disabled={hasDescriptionWiseDiscount || totalsLoading}
        >
          <MenuItem value="after_tax">On Total</MenuItem>
          <MenuItem value="before_tax">Before Tax</MenuItem>
        </Select>
      </FormControl>
      
      <Button
        variant="contained"
        size="small"
        onClick={handleApplyDiscount}
        disabled={loading || overallDiscountValue <= 0 || descriptions.length === 0 || hasDescriptionWiseDiscount || totalsLoading}
        startIcon={loading ? <CircularProgress size={16} /> : null}
      >
        {loading ? 'Applying...' : 'Apply'}
      </Button>
      
      <IconButton
        onClick={() => {
          setOverallDiscountValue(0);
          dispatch(setSnackbarMessage('Overall discount removed'));
          dispatch(setSnackbarOpen(true));
        }}
        size="small"
        color="error"
        disabled={totalsLoading}
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
          disabled={hasDescriptionWiseDiscount || totalsLoading}
        />
      }
      label={overallDiscountMode === 'amount' ? '₹' : '%'}
      labelPlacement="top"
      sx={{ m: 0 }}
    />
  </TableCell>
  <TableCell colSpan={1} />
</TableRow>
                  <TableRow>
                    <TableCell colSpan={15} align="right">
                      <strong>Round Off/Adjustment:</strong>
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TextField
                          value={roundOffValue === 0 ? '' : roundOffValue.toString()}
                          onChange={handleRoundOffChange}
                          size="small"
                          sx={{ width: 80 }}
                          type="number"
                          inputProps={{ step: '0.01', min: '-999999', max: '999999' }}
                          autoComplete='off'
                          disabled={totalsLoading}
                        />
                        <Typography variant="body2">
                          ({roundOffValue >= 0 ? '+' : ''}{roundOffValue.toFixed(2)})
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell />
                  </TableRow>
<TableRow sx={{ bgcolor: '#e8f5e8' }}>
  <TableCell colSpan={2} align="right">
    <Typography variant="h6" fontWeight="bold">
      FINAL AMOUNT (Service + Freight):
    </Typography>
  </TableCell>
  <TableCell align="right">
    <Typography variant="h6" fontWeight="bold" color="success.main">
      ₹{totals.roundedTotalOrderAmount?.toFixed(2)}
    </Typography>
    {freightGrandTotal > 0 && (
      <Typography variant="caption" color="text.secondary">
        (Service: ₹{(totals.roundedTotalOrderAmount - freightGrandTotal).toFixed(2)} + Freight: ₹{freightGrandTotal.toFixed(2)})
      </Typography>
    )}
  </TableCell>
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
                autoComplete="off"
              />
            </Grid>
            <Grid item xs={12} sm={2} md={2}>
              <TextField
                fullWidth
                label="Total Order Amount"
                name="totalAmount"
                value={totals.roundedTotalOrderAmount.toFixed(2)}
                size="small"
                variant="outlined"
                InputProps={{ readOnly: true }}
                error={totals.roundedTotalOrderAmount > serviceData.creditLimit}
                helperText={totals.roundedTotalOrderAmount > serviceData.creditLimit ? 'Order amount exceeds credit limit' : ''}
                autoComplete="off"
              />
            </Grid>
            <Grid item xs={12} sm={4} md={2}>
              <Autocomplete
                fullWidth
                options={businesses.map((business) => `${business.address1 ?? ''} ${business.address2 ?? ''}`.trim())}
                value={serviceData.billingAddress || ''}
                onChange={(event, newValue) => handleSelectAddressChange('billingAddress', newValue)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Billing Address"
                    size="small"
                    variant="outlined"
                    error={formErrors.billingAddress}
                    helperText={formErrors.billingAddress ? 'Billing address is required' : ''}
                    autoComplete="off"
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
                    value={serviceData.shippingAddress ?? ''}
                    onChange={(event, newValue) => handleSelectAddressChange('shippingAddress', newValue)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Shipping Address"
                        size="small"
                        variant="outlined"
                        error={formErrors.shippingAddress}
                        helperText={formErrors.shippingAddress ? 'Shipping address is required' : ''}
                        autoComplete="off"
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
                value={serviceData.comments}
                onChange={handleTextFieldChange}
                size="small"
                variant="outlined"
                multiline
                rows={3}
                autoComplete="off"
              />
            </Grid>
            {serviceData.termsandConditions.map((term, index) => (
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
                      <IconButton onClick={() => handleRemoveTerm(index)} size="small">
                        <RemoveIcon />
                      </IconButton>
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
                disabled={serviceData.termsandConditions.length >= 3}
                startIcon={<AddIcon />}
              >
                Add Term
              </Button>
              {serviceData.termsandConditions.length >= 3 && (
                <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                  Maximum of 3 terms reached
                </Typography>
              )}
            </Grid>
          </Grid>
        </Box>
         <Box sx={{ mt: 2, mb: 2, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Freight Charges
              </Typography>
              <Button
                variant="outlined"
                color="primary"
                onClick={() => setOpenFreightDialog(true)}
                startIcon={<AddIcon />}
              >
                Add Freight
              </Button>
            </Box>
            
            {freights.length > 0 ? (
              <Box>
                {/* Simple Freight Summary */}
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={4}>
                    <Typography variant="body2">Freight Amount: <strong>₹{freightSubTotal.toFixed(2)}</strong></Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2">Freight Tax: <strong>₹{freightTaxTotal.toFixed(2)}</strong></Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2">Freight Total: <strong>₹{freightGrandTotal.toFixed(2)}</strong></Typography>
                  </Grid>
                </Grid>
                
                {/* Simple List */}
                {freights.map((freight, index) => (
                  <Chip
                    key={index}
                    label={`${freight.name}: ₹${freight.totalAmt.toFixed(2)}`}
                    onDelete={() => {
                      setFreights(prev => prev.filter((_, i) => i !== index));
                    }}
                    sx={{ m: 0.5 }}
                  />
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No freight charges added
              </Typography>
            )}
          </Box>
      </Box>
      {/* Footer */}
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
              disabled={submitLoading || loading || totalsLoading}
            >
              {isEditMode ? 'Update Service Order' : 'Submit Service Order'}
            </Button>
          </Grid>
        </Grid>
      </Box>
      {/* Dialogs - unchanged */}
      <Dialog open={open} onClose={() => setDialogOpen(false)}>
        <DialogTitle>
          {isHoldOrderDialog ? 'Confirm Hold Service Order' : (isEditMode ? 'Confirm Update' : 'Confirm Service Order')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {isHoldOrderDialog
              ? `The service order amount (${totals.roundedTotalOrderAmount.toFixed(2)}) exceeds the vendor's credit limit (${serviceData.creditLimit.toFixed(2)}). This order will be placed on hold and sent for approval. Proceed?`
              : (isEditMode ? 'Are you sure you want to update this service order?' : 'Are you sure you want to submit this service order?')
            }
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            color="primary"
            variant="contained"
            disabled={submitLoading || totalsLoading}
            startIcon={submitLoading ? <CircularProgress size={20} /> : null}
          >
            {submitLoading ? (isEditMode ? 'Updating...' : 'Submitting...') : (isEditMode ? 'Update' : 'Confirm')}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={openShippingDialog} onClose={() => { setOpenShippingDialog(false); setUpdatedShippingRow(null); }}>
        <DialogTitle>Add New Shipping Address</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Address"
            value={updatedShippingRow?.address || ''}
            onChange={(e) => setUpdatedShippingRow({ ...updatedShippingRow!, address: e.target.value })}
            margin="normal"
            variant="outlined"
            autoComplete="off"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setOpenShippingDialog(false); setUpdatedShippingRow(null); }}>Cancel</Button>
          <Button onClick={() => { /* Implement save */ }}>Save</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={showNavigationConfirm} onClose={() => setShowNavigationConfirm(false)}>
        <DialogTitle>Unsaved Changes</DialogTitle>
        <DialogContent>
          <DialogContentText>You have unsaved changes. Are you sure you want to leave this page?</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNavigationConfirm(false)}>Cancel</Button>
          <Button onClick={() => {
            setShowNavigationConfirm(false);
            if (pendingNavigation) {
              pendingNavigation();
              setPendingNavigation(null);
            }
          }} color="primary" variant="contained">
            Leave Page
          </Button>
        </DialogActions>
      </Dialog>
      <Backdrop sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, color: '#fff' }} open={loading || totalsLoading}>
        <CircularProgress color="inherit" />
      </Backdrop>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => dispatch(clearSnackbarMessage())}
        message={snackbarMessage}
      />
            {/* === FREIGHT DIALOG === */}
      <FreightSelectionDialog
        open={openFreightDialog}
        onClose={() => setOpenFreightDialog(false)}
        onAddFreights={handleAddFreights}
        existingFreights={freights}
      />

    </Box>
  );
};
export default CreateServicePage;