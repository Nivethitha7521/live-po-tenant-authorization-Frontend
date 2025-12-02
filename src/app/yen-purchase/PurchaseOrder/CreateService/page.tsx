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
import ClearIcon from '@mui/icons-material/Clear';
import {
  addService, fetchServices, selectServiceState, setServiceData,
  setNewDescriptionData, addDescriptionToService, setSnackbarMessage, clearSnackbarMessage, setSnackbarOpen,
  setDescriptionForEditing, clearDescriptionForEditing, deleteDescriptionFromService, calculateDescriptionTotals, setReduxTotals,
  setDiscountMode, calculateOverallDiscountForAllDescriptions, fetchServiceById, updateService,
  calculateServiceTotals,
} from '../Features/servicepo'; // Assumed Redux slice path; adapt as needed
import { fetchBusinesses, fetchShipping, selectBusinesses } from '@/features/account-setting/businessSlice';
import { AppDispatch, RootState } from '@/redux/store';
import { useRouter, useSearchParams } from 'next/navigation';
import { ServiceData, ServiceDescription } from '../Models/servicepo'; // Updated import to match nested models
import { ShippingAddress } from '@/Models/businessModel';
import VendorAutocomplete from '../../../../components/yen-purchase/pocreationcomponent/vendorautocomplete'; // Reuse or adapt
import * as Yup from 'yup';
import { useBeforeUnload } from 'react-use';
import SmartDatePicker from '@/components/SmartDatePicker';
import LocationAutocomplete from '../../../../components/yen-purchase/pocreationcomponent/locationautocomplete'; // Assumed reuse
import { Location } from '@/Models/storagelocation';
import { fetchLocations, selectStorageLocations } from '../../../../features/yen-purchase/PurchaseMaster/StorageLocationSlice';
import { OverallDiscountServiceRequest, OverallDiscountServiceResponse } from '../Models/Itemcalculation'; // Use service-specific types
import { VendorSummary } from '@/Models/vendor';
// Validation schema (adapted for service)
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
const CreateServicePage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams?.get('edit') ?? null;
  const isEditMode = !!editId;
  const serviceTypeParam = searchParams?.get('type') || 'workorder';
  const serviceType = serviceTypeParam as 'workorder' | 'ap'; // Cast to union type
  const { serviceData, newDescription, snackbarOpen, snackbarMessage, vendors } = useSelector(selectServiceState); // Updated selector
  const { businesses, shippingaddress } = useSelector(selectBusinesses);
  const { location: locations, loading: locationsLoading } = useSelector(selectStorageLocations);
  const discountMode = useSelector((state: RootState) => state.serviceOrder.discountMode ?? 'percentage') as 'percentage' | 'amount'; // Assumed
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
  const [errors, setErrors] = useState({ description: false, fromDate: false, toDate: false, fee: false, taxPer: false });
  const [formErrors, setFormErrors] = useState({ vendorName: false, billingAddress: false, shippingAddress: false, locationName: false, paymentTerms: false, creditLimit: false });
  const [vendorSearch, setVendorSearch] = useState<VendorSummary | null>(null);
  const [locationSearch, setLocationSearch] = useState<Location | null>(null);
  const [showNavigationConfirm, setShowNavigationConfirm] = useState(false);
  const [hasDescriptionWiseDiscount, setHasDescriptionWiseDiscount] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const [isHoldOrderDialog, setIsHoldOrderDialog] = useState(false);
  const [overallDiscountValue, setOverallDiscountValue] = useState<number>(0);
  const [overallDiscountMode, setOverallDiscountMode] = useState<'percentage' | 'amount'>('percentage');
  const [roundOffValue, setRoundOffValue] = useState<number>(0);
  const [orderLoading, setOrderLoading] = useState(false);
  const descriptionRef = useRef<HTMLInputElement | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  // Load specific service data in edit mode
  useEffect(() => {
    if (isEditMode && editId) {
      setOrderLoading(true);
      dispatch(fetchServiceById(editId))
        .unwrap()
        .then((data) => {
          dispatch(setServiceData(data));
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
  // Calculate totals (adapted for services, no freight)
  useEffect(() => {
    const calculateAndUpdateTotals = async () => {
      if (serviceData.descriptions.length > 0) {
        try {
          const result = await dispatch(calculateServiceTotals({
            descriptions: serviceData.descriptions,
          })).unwrap();
          setTotals({
            subTotal: result.totalFees,
            roundedTotalOrderAmount: result.totalAmount,
            roundedTotalDiscount: result.totalDiscount || 0, // Assumed
            roundedTotalTax: result.totalTax,
            overallDiscountAmount: 0,
            descriptionDiscountAmount: result.totalDiscount || 0,
            taxAmount: result.totalTax,
            afterDiscount: result.amountAfterDiscount || 0,
          });
          dispatch(setReduxTotals({
            totalFees: result.totalFees,
            totalAmount: result.totalAmount,
            totalDiscount: result.totalDiscount || 0,
            totalTax: result.totalTax,
          }));
        } catch (error) {
          console.error('Failed to calculate service totals:', error);
          const newTotals = calculateTotals;
          setTotals(newTotals);
          dispatch(setReduxTotals({
            totalFees: newTotals.subTotal,
            totalAmount: newTotals.roundedTotalOrderAmount,
            totalDiscount: newTotals.roundedTotalDiscount,
            totalTax: newTotals.roundedTotalTax,
          }));
        }
      } else {
        const newTotals = calculateTotals;
        setTotals(newTotals);
        dispatch(setReduxTotals({
          totalFees: newTotals.subTotal,
          totalAmount: newTotals.roundedTotalOrderAmount,
          totalDiscount: newTotals.roundedTotalDiscount,
          totalTax: newTotals.roundedTotalTax,
        }));
      }
    };
    calculateAndUpdateTotals();
  }, [serviceData.descriptions, dispatch]);
  // Auto-select vendor and location in edit mode
  useEffect(() => {
    if (isEditMode && serviceData.vendorName && vendors.length > 0) {
      const matchedVendor = vendors.find((vendor: VendorSummary) => vendor.vendorName === serviceData.vendorName);
      if (matchedVendor && !vendorSearch) {
        setVendorSearch({ vendorName: matchedVendor.vendorName, contactpersonPhone: matchedVendor.contactpersonPhone, contactpersonEmail: matchedVendor.contactpersonEmail, address: matchedVendor.address, country: matchedVendor.country, paymentTerms: matchedVendor.paymentTerms, creditLimit: matchedVendor.creditLimit, state: matchedVendor.state, city: matchedVendor.city } as VendorSummary);
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
      const currentDate = new Date().toISOString();
      dispatch(setServiceData({
        serviceId: '',
        vendorName: '',
        vendorContact: '',
        orderDate: currentDate,
        expectedDeliveryDate: currentDate,
        status: 'Pending',
        descriptions: [],
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
        serviceType,
        workOrderNumber: '',
        overallDiscountValue: 0,
        roundOffValue: 0,
        totalTax: 0,
        randomId: '',
      }));
    }
  }, [isEditMode, dispatch, serviceType]);
  // Set default addresses and dates (similar to PO)
  useEffect(() => {
    if (shippingaddress.length > 0 && !serviceData.shippingAddress) {
      const defaultShippingAddress = shippingaddress[2].address ?? '';
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
  useEffect(() => {
    const currentDate = new Date().toISOString();
    const updatedData = { ...serviceData };
    if (!serviceData.orderDate) {
      updatedData.orderDate = currentDate;
    }
    if (!serviceData.expectedDeliveryDate) {
      updatedData.expectedDeliveryDate = currentDate;
    }
    if (!serviceData.orderDate || !serviceData.expectedDeliveryDate) {
      dispatch(setServiceData(updatedData));
    }
  }, [dispatch, serviceData.orderDate, serviceData.expectedDeliveryDate]);
  // Track dirty state
  useEffect(() => {
    const hasChanges =
      serviceData.vendorName !== '' ||
      serviceData.descriptions.length > 0 ||
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
  
  // Calculate totals memo (adapted, no freight)
  const calculateTotals = useMemo(() => {
    let subTotal = 0;
    let descriptionDiscountAmount = 0;
    let taxAmount = 0;
    serviceData.descriptions.forEach((desc) => {
      subTotal += desc.fee || 0;
      descriptionDiscountAmount += desc.discountAmount || 0;
      taxAmount += (desc.sgst || 0) + (desc.cgst || 0) + (desc.igst || 0);
    });
    const overallDiscountAmount = overallDiscountMode === 'percentage'
      ? subTotal * (overallDiscountValue / 100)
      : overallDiscountValue;
    const totalDiscount = descriptionDiscountAmount + overallDiscountAmount;
    const afterDiscount = Math.max(0, subTotal - totalDiscount);
    const finalAmount = afterDiscount + taxAmount + roundOffValue;
    const totalTax = taxAmount;
    return {
      subTotal: roundPrice(subTotal),
      roundedTotalOrderAmount: roundPrice(finalAmount),
      roundedTotalDiscount: roundPrice(totalDiscount),
      roundedTotalTax: roundPrice(totalTax),
      overallDiscountAmount: roundPrice(overallDiscountAmount),
      descriptionDiscountAmount: roundPrice(descriptionDiscountAmount),
      taxAmount: roundPrice(taxAmount),
      afterDiscount: roundPrice(afterDiscount),
    };
  }, [serviceData.descriptions, overallDiscountMode, overallDiscountValue, roundOffValue]);
  useEffect(() => {
    const newTotals = calculateTotals;
    setTotals(newTotals);
    dispatch(setReduxTotals({
      totalFees: newTotals.subTotal,
      totalAmount: newTotals.roundedTotalOrderAmount,
      totalDiscount: newTotals.roundedTotalDiscount,
      totalTax: newTotals.roundedTotalTax,
    }));
  }, [calculateTotals, dispatch]);
  // Service-specific handlers
  const handleOrderDateChange = (date: Date | null) => {
    const finalDate = date || new Date();
    dispatch(setServiceData({
      ...serviceData,
      orderDate: finalDate.toISOString()
    }));
  };
  const handleExpectedDeliveryDateChange = (date: Date | null) => {
    const finalDate = date || new Date();
    dispatch(setServiceData({
      ...serviceData,
      expectedDeliveryDate: finalDate.toISOString()
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
  // Description addition handlers (updated field names)
  const handleDescriptionChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'description') {
      if (value === '' || value.length <= 500) { // Reasonable limit
        dispatch(setNewDescriptionData({ ...newDescription, description: value }));
        setErrors({ ...errors, description: false });
      }
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
    const finalDate = date || new Date();
    dispatch(setNewDescriptionData({
      ...newDescription,
      [name]: finalDate.toISOString(),
    }));
    setErrors({ ...errors, [name]: false });
  };
  const handleDescriptionTaxTypeChange = (event: ChangeEvent<HTMLInputElement>) => {
    dispatch(setNewDescriptionData({ ...newDescription, tax_type: event.target.value as 'cgst_sgst' | 'igst' }));
  };
  const handleAddDescription = useCallback(async () => {
    setErrors({
      description: !newDescription.description,
      fromDate: !newDescription.from_date,
      toDate: !newDescription.to_date,
      fee: !newDescription.fee || newDescription.fee <= 0,
      taxPer: false,
    });
    if (!newDescription.description || !newDescription.from_date || !newDescription.to_date || !newDescription.fee || newDescription.fee <= 0) {
      dispatch(setSnackbarMessage('Description, dates, and fee are required. Fee must be greater than zero.'));
      dispatch(setSnackbarOpen(true));
      return;
    }
    // Handle null dates - convert to current date if null
    const fromDate = newDescription.from_date || new Date();
    const toDate = newDescription.to_date || new Date();
    if (new Date(fromDate) > new Date(toDate)) {
      dispatch(setSnackbarMessage('From date cannot be after to date.'));
      dispatch(setSnackbarOpen(true));
      return;
    }
    setLoading(true);
    try {
      const params = {
        description: newDescription.description,
        fromDate: typeof fromDate === 'string' ? fromDate : fromDate.toISOString(),
        toDate: typeof toDate === 'string' ? toDate : toDate.toISOString(),
        fee: newDescription.fee,
        taxType: newDescription.tax_type,
        taxPer: newDescription.tax_per || 0,
      };
      await dispatch(calculateDescriptionTotals(params)).unwrap();
      dispatch(addDescriptionToService());
      // Reset form
      dispatch(setNewDescriptionData({
        id: '',
        description: '',
        from_date: undefined,
        to_date: undefined,
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
      }));
      setTimeout(() => {
        if (descriptionRef.current) {
          descriptionRef.current.focus();
        }
      }, 0);
    } catch (error) {
      console.error('Failed to add description:', error);
      dispatch(setSnackbarMessage(`Failed to add description: ${error instanceof Error ? error.message : 'Please try again.'}`));
      dispatch(setSnackbarOpen(true));
    } finally {
      setLoading(false);
    }
  }, [dispatch, newDescription]);
  const handleEditDescription = (desc: ServiceDescription) => {
    dispatch(setDescriptionForEditing(desc));
  };
  const handleDeleteDescription = (descId: string) => {
    dispatch(deleteDescriptionFromService(descId));
    dispatch(clearDescriptionForEditing());
  };
  // Overall discount handlers (adapted)
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
      newValue = roundPrice(newValue);
    }
    setOverallDiscountMode(newMode);
    setOverallDiscountValue(newValue);
  };
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
    if (serviceData.descriptions.length === 0) {
      dispatch(setSnackbarMessage('Add descriptions before applying discount'));
      dispatch(setSnackbarOpen(true));
      return;
    }
    setLoading(true);
    try {
      const allDescriptions = serviceData.descriptions.map((desc) => ({
        id: desc.id || '',
        description: desc.description,
        from_date: desc.from_date || '',
        to_date: desc.to_date || '',
        fee: desc.fee || 0,
        taxType: desc.tax_type || 'cgst_sgst',
        taxPer: desc.tax_per || 0,
      }));
      const payload: OverallDiscountServiceRequest = {
        descriptions: allDescriptions,
        overallDiscount: overallDiscountMode === 'percentage' ? overallDiscountValue : 0,
        overallDiscountAmount: overallDiscountMode === 'amount' ? overallDiscountValue : 0,
        overallDiscountType: overallDiscountMode,
        applyOverallDiscount: true,
      };
      const result = await dispatch(calculateOverallDiscountForAllDescriptions(payload)).unwrap();
      if (!result.success) {
        throw new Error(result.error || 'Failed to apply discount');
      }
      // Update descriptions with calculated values (similar to items in PO)
      const updatedDescriptions = serviceData.descriptions.map(desc => {
        const calculatedDesc = result.descriptions.find(calc => calc.id === (desc.id || ''));
        if (calculatedDesc) {
          return {
            ...desc,
            // Update with calculated discount, tax, total fields
            discountAmount: calculatedDesc.discountAmount,
            sgst: calculatedDesc.sgst,
            cgst: calculatedDesc.cgst,
            igst: calculatedDesc.igst,
            total: calculatedDesc.total,
          };
        }
        return desc;
      });
      dispatch(setServiceData({
        ...serviceData,
        descriptions: updatedDescriptions,
        totalAmount: result.summary.totalFinalAmount,
      }));
      dispatch(setSnackbarMessage(
        `Successfully applied ${overallDiscountValue}${overallDiscountMode === 'percentage' ? '%' : ''} discount across all descriptions`
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
    const currentDate = new Date().toISOString();
    dispatch(setServiceData({
      serviceId: '',
      vendorName: '',
      vendorContact: '',
      orderDate: currentDate,
      expectedDeliveryDate: currentDate,
      status: 'Pending',
      descriptions: [],
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
      serviceType,
      workOrderNumber: '',
      overallDiscountValue: 0,
      roundOffValue: 0,
      totalTax: 0,
      randomId: '',
    }));
    dispatch(setNewDescriptionData({
      id: '',
      description: '',
      from_date: undefined,
      to_date: undefined,
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
    }));
    setVendorSearch(null);
    setLocationSearch(null);
    setOverallDiscountValue(0);
    setOverallDiscountMode('percentage');
    setRoundOffValue(0);
    setIsFormDirty(false);
    setFormErrors({ vendorName: false, billingAddress: false, shippingAddress: false, locationName: false, paymentTerms: false, creditLimit: false });
    if (isEditMode) {
      router.push('/yen-purchase/PurchaseOrder/ServiceList');
    }
  };
  const handleBackToService = () => {
    if (isFormDirty) {
      setPendingNavigation(() => () => {
        handleClear();
        router.push('/yen-purchase/PurchaseOrder/ServiceList');
      });
      setShowNavigationConfirm(true);
    } else {
      handleClear();
      router.push('/yen-purchase/PurchaseOrder/ServiceList');
    }
  };
  // Submit handler (adapted, no freight)
  const handleSubmit = async () => {
    try {
      await validationSchema.validate(serviceData, { abortEarly: false });
      setFormErrors({ vendorName: false, billingAddress: false, shippingAddress: false, locationName: false, paymentTerms: false, creditLimit: false });
      if (!serviceData.descriptions.length) {
        dispatch(setSnackbarMessage('At least one description is required.'));
        dispatch(setSnackbarOpen(true));
        return;
      }
      const orderDate = serviceData.orderDate || new Date().toISOString();
      const expectedDeliveryDate = serviceData.expectedDeliveryDate || new Date().toISOString();
      const finalAmount = totals.roundedTotalOrderAmount;
      const totalDiscount = totals.roundedTotalDiscount;
      const totalTax = totals.roundedTotalTax;
      const dataToSubmit = {
        ...serviceData,
        serviceType,
        orderDate,
        expectedDeliveryDate,
        totalAmount: finalAmount,
        totalTax: totalTax,
        overallDiscountType: overallDiscountMode,
        overallDiscountValue,
        totalDiscount,
        roundOffValue,
        descriptions: serviceData.descriptions.map(desc => ({
          id: desc.id,
          description: desc.description,
          from_date: desc.from_date || '',
          to_date: desc.to_date || '',
          fee: desc.fee,
          tax_type: desc.tax_type,
          tax_per: desc.tax_per,
          sgst: desc.sgst,
          cgst: desc.cgst,
          igst: desc.igst,
          total: desc.total,
          taxAmount: desc.taxAmount || 0,
          totalFee: desc.totalFee || 0,
          finalFee: desc.finalFee || 0,
        })),
      } as Omit<ServiceData, "serviceId"> & { serviceType: "workorder" | "ap" };
      let result;
      setSubmitLoading(true);
      if (isEditMode && editId) {
        result = await dispatch(updateService({ serviceId: editId, service: dataToSubmit })).unwrap();
        dispatch(setSnackbarMessage(`Service Order ${result.serviceId || editId} successfully updated.`));
      } else {
        result = await dispatch(addService(dataToSubmit)).unwrap(); // Pass typed data
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
      if (error instanceof Yup.ValidationError) {
        const newErrors = { vendorName: false, billingAddress: false, shippingAddress: false, locationName: false, paymentTerms: false, creditLimit: false };
        error.inner.forEach((err) => {
          if (err.path) newErrors[err.path as keyof typeof newErrors] = true;
        });
        setFormErrors(newErrors);
      } else {
        dispatch(setSnackbarMessage(`Failed to ${isEditMode ? 'update' : 'create'} service order: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
      dispatch(setSnackbarOpen(true));
    } finally {
      setSubmitLoading(false);
    }
  };
  const handleOpenDialog = () => {
    validationSchema.validate(serviceData, { abortEarly: false })
      .then(() => {
        setFormErrors({ vendorName: false, billingAddress: false, shippingAddress: false, locationName: false, paymentTerms: false, creditLimit: false });
        setIsHoldOrderDialog(totals.roundedTotalOrderAmount > serviceData.creditLimit);
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
  // Check for description-wise discounts
  useEffect(() => {
    const hasDiscount = serviceData.descriptions.some(desc =>
      (desc.discountAmount || 0) > 0 // Assumed field
    );
    setHasDescriptionWiseDiscount(hasDiscount);
    if (hasDiscount && overallDiscountValue > 0) {
      setOverallDiscountValue(0);
      dispatch(setSnackbarMessage('Overall discount disabled due to existing description-wise discounts'));
      dispatch(setSnackbarOpen(true));
    }
  }, [serviceData.descriptions, overallDiscountValue, dispatch]);
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
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#ffffff' }}>
      <Box sx={{ flex: 1, p: 3, overflowY: 'auto', maxHeight: 'calc(100vh - 64px)' }}>
        <Box sx={{ maxWidth: '1200px', mx: 'auto' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography fontWeight={'bold'} sx={{ textDecoration: 'underline' }}>
              {isEditMode ? `Edit ${serviceType} Service Order - ${serviceData.serviceId || editId}` : `Create New ${serviceType} Service Order`}
            </Typography>
            <Button variant="contained" color="primary" onClick={handleBackToService}>Back to Service Orders</Button>
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
              <SmartDatePicker
                label="Order Date"
                value={serviceData.orderDate ? new Date(serviceData.orderDate) : null}
                onChange={handleOrderDateChange}
                maxDate={new Date()}
              />
            </Grid>
            <Grid item xs={12} sm={3} md={2}>
              <SmartDatePicker
                label="Expected Delivery Date"
                value={serviceData.expectedDeliveryDate ? new Date(serviceData.expectedDeliveryDate) : null}
                onChange={handleExpectedDeliveryDateChange}
                minDate={new Date()}
              />
            </Grid>
          </Grid>
          {/* Add Description Section (adapted from Add Item) */}
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
              <Grid item xs={12} sm={6}>
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
              <Grid item xs={12} sm={2}>
                <SmartDatePicker
                  label="From Date"
                  value={newDescription.from_date ? new Date(newDescription.from_date) : null}
                  onChange={(date) => handleDescriptionDateChange('from_date', date)}
                />
              </Grid>
              <Grid item xs={12} sm={2}>
                <SmartDatePicker
                  label="To Date"
                  value={newDescription.to_date ? new Date(newDescription.to_date) : null}
                  onChange={(date) => handleDescriptionDateChange('to_date', date)}
                  minDate={newDescription.from_date ? new Date(newDescription.from_date) : undefined}
                />
              </Grid>
              <Grid item xs={12} sm={2}>
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
              <Grid item xs={12} sm={2}>
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
              <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleAddDescription}
                  size="small"
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} /> : null}
                >
                  {loading ? 'Adding...' : 'Add Description'}
                </Button>
              </Grid>
            </Grid>
            {/* Descriptions Table (adapted from Items Table, no freight) */}
            <TableContainer sx={{ maxHeight: '500px', overflowY: 'auto', marginBottom: '10px' }}>
              <Table stickyHeader>
                <TableHead sx={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: 'white', '& th': { fontWeight: 'bold', borderBottom: '2px solid rgba(0,0,0,0.12)' } }}>
                  <TableRow>
                    <TableCell>S.No</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>From Date</TableCell>
                    <TableCell>To Date</TableCell>
                    <TableCell align="right">Fee (₹)</TableCell>
                    <TableCell align="center">Tax Type</TableCell>
                    <TableCell align="right">Tax %</TableCell>
                    <TableCell align="right">SGST (₹)</TableCell>
                    <TableCell align="right">CGST (₹)</TableCell>
                    <TableCell align="right">IGST (₹)</TableCell>
                    <TableCell align="right">Total (₹)</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {serviceData.descriptions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} align="center">No descriptions added</TableCell>
                    </TableRow>
                  ) : (
                    serviceData.descriptions.map((desc, index) => (
                      <TableRow key={desc.id || index}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell sx={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{desc.description}</TableCell>
                        <TableCell>{desc.from_date ? new Date(desc.from_date).toLocaleDateString() : 'N/A'}</TableCell>
                        <TableCell>{desc.to_date ? new Date(desc.to_date).toLocaleDateString() : 'N/A'}</TableCell>
                        <TableCell align="right">{desc.fee?.toFixed(2)}</TableCell>
                        <TableCell align="center">{desc.tax_type === 'cgst_sgst' ? 'CGST/SGST' : 'IGST'}</TableCell>
                        <TableCell align="right">{desc.tax_per?.toFixed(2)}%</TableCell>
                        <TableCell align="right">{desc.sgst?.toFixed(2)}</TableCell>
                        <TableCell align="right">{desc.cgst?.toFixed(2)}</TableCell>
                        <TableCell align="right">{desc.igst?.toFixed(2)}</TableCell>
                        <TableCell align="right">{desc.total?.toFixed(2)}</TableCell>
                        <TableCell align="right">
                          <IconButton onClick={() => handleEditDescription(desc)} size="small"><EditIcon /></IconButton>
                          <IconButton onClick={() => handleDeleteDescription(desc.id || '')} size="small"><DeleteIcon /></IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                  {/* Totals rows (similar to PO, but for descriptions only) */}
                  <TableRow sx={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}>
                    <TableCell colSpan={4} align="right">
                      <strong>Sub Total:</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>{totals.subTotal.toFixed(2)}</strong>
                    </TableCell>
                    <TableCell colSpan={7} />
                  </TableRow>
                  {/* Add tax breakdown rows if needed */}
                  <TableRow sx={{ fontWeight: 'bold' }}>
                    <TableCell colSpan={4} align="right">
                      <strong>Total Description Tax:</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>{totals.taxAmount.toFixed(2)}</strong>
                    </TableCell>
                    <TableCell colSpan={7} />
                  </TableRow>
                  <TableRow sx={{ fontWeight: 'bold' }}>
                    <TableCell colSpan={4} align="right">
                      <strong>Total Tax:</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>{totals.roundedTotalTax.toFixed(2)}</strong>
                    </TableCell>
                    <TableCell colSpan={7} />
                  </TableRow>
                  <TableRow sx={{ fontWeight: 'bold' }}>
                    <TableCell colSpan={4} align="right">
                      <strong>Description-wise Discount:</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>{totals.descriptionDiscountAmount.toFixed(2)}</strong>
                    </TableCell>
                    <TableCell colSpan={7} />
                  </TableRow>
                  <TableRow sx={{ fontWeight: 'bold' }}>
                    <TableCell colSpan={4} align="right">
                      <strong>Overall Discount:</strong>
                    </TableCell>
                    <TableCell align="right">
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
                          disabled={hasDescriptionWiseDiscount}
                        />
                        <Button
                          variant="contained"
                          size="small"
                          onClick={handleApplyDiscount}
                          disabled={loading || overallDiscountValue <= 0 || serviceData.descriptions.length === 0 || hasDescriptionWiseDiscount}
                          startIcon={loading ? <CircularProgress size={16} /> : null}
                        >
                          {loading ? 'Applying...' : 'Apply'}
                        </Button>
                        <IconButton
                          onClick={() => {/* Implement remove overall discount similar to PO */ }}
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
                            disabled={hasDescriptionWiseDiscount}
                          />
                        }
                        label={overallDiscountMode === 'amount' ? '₹' : '%'}
                        labelPlacement="top"
                        sx={{ m: 0 }}
                      />
                    </TableCell>
                    <TableCell colSpan={6} />
                  </TableRow>
                  <TableRow sx={{ fontWeight: 'bold' }}>
                    <TableCell colSpan={4} align="right">
                      <strong>Total Discount:</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>{totals.roundedTotalDiscount.toFixed(2)}</strong>
                    </TableCell>
                    <TableCell colSpan={7} />
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={4} align="right">
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
                        />
                        <Typography variant="body2">
                          ({roundOffValue >= 0 ? '+' : ''}{roundOffValue.toFixed(2)})
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell colSpan={7} />
                  </TableRow>
                  <TableRow sx={{ fontSize: '1.1em' }}>
                    <TableCell colSpan={4} align="right">
                      <strong style={{ fontSize: '1.2em' }}>FINAL AMOUNT:</strong>
                    </TableCell>
                    <TableCell sx={{ fontSize: '1.2em', fontWeight: 'bold' }} align="right">
                      <strong>{totals.roundedTotalOrderAmount.toFixed(2)}</strong>
                    </TableCell>
                    <TableCell colSpan={7} />
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
          {/* Additional Form Fields (similar to PO, no freight) */}
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
              disabled={submitLoading || loading}
            >
              {isEditMode ? 'Update Service Order' : 'Submit Service Order'}
            </Button>
          </Grid>
        </Grid>
      </Box>
      {/* Dialogs (reuse from PO, adapt messages) */}
      <Dialog open={open} onClose={() => setDialogOpen(false)}>
        <DialogTitle>{isHoldOrderDialog ? 'Confirm Hold Service Order' : (isEditMode ? 'Confirm Update' : 'Confirm Service Order')}</DialogTitle>
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
            disabled={submitLoading}
            startIcon={submitLoading ? <CircularProgress size={20} /> : null}
          >
            {submitLoading ? (isEditMode ? 'Updating...' : 'Submitting...') : (isEditMode ? 'Update' : 'Confirm')}
          </Button>
        </DialogActions>
      </Dialog>
      {/* Shipping Dialog (reuse) */}
      <Dialog open={openShippingDialog} onClose={() => { setOpenShippingDialog(false); setUpdatedShippingRow(null); }}>
        <DialogTitle>Add New Shipping Address</DialogTitle>
        <DialogContent>
          {/* Fields same as PO */}
          <TextField fullWidth label="Address" value={updatedShippingRow?.address || ''} onChange={(e) => setUpdatedShippingRow({ ...updatedShippingRow!, address: e.target.value })} margin="normal" variant="outlined" autoComplete="off" />
          {/* Add other fields similarly */}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setOpenShippingDialog(false); setUpdatedShippingRow(null); }}>Cancel</Button>
          <Button onClick={() => {/* Implement save */ }}>Save</Button>
        </DialogActions>
      </Dialog>
      {/* Navigation Confirm Dialog (reuse) */}
      <Dialog open={showNavigationConfirm} onClose={() => setShowNavigationConfirm(false)}>
        <DialogTitle>Unsaved Changes</DialogTitle>
        <DialogContent>
          <DialogContentText>You have unsaved changes. Are you sure you want to leave this page?</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNavigationConfirm(false)}>Cancel</Button>
          <Button onClick={() => { setShowNavigationConfirm(false); if (pendingNavigation) pendingNavigation(); setPendingNavigation(null); }} color="primary" variant="contained">
            Leave Page
          </Button>
        </DialogActions>
      </Dialog>
      <Backdrop sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, color: '#fff' }} open={loading}>
        <CircularProgress color="inherit" />
      </Backdrop>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => dispatch(clearSnackbarMessage())}
        message={snackbarMessage}
      />
    </Box>
  );
};
export default CreateServicePage;