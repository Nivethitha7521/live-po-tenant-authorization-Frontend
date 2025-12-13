// hooks/useServiceOrderForm.ts - Custom Hook for Logic Separation
import { useState, useEffect, useCallback, useMemo } from 'react';
import { AppDispatch } from '@/redux/store';
import { useRouter } from 'next/navigation';
import { ServiceData, ServiceDescription } from '../../ServiceOrder/Models/servicepo';
import { 
  addService,
  addDescriptionToService, 
  calculateDescriptionTotals, 
  clearDescriptionForEditing, 
  deleteDescriptionFromService, 
  setDescriptionForEditing, 
  updateService 
} from '../../ServiceOrder/Features/servicepo';
import * as Yup from 'yup';

interface UseServiceOrderFormProps {
  isEditMode: boolean;
  editId: string | null;
  serviceType: 'workorder' | 'ap';
  validationSchema: any;
  dispatch: AppDispatch;
  router: ReturnType<typeof useRouter>;
}

// Local roundPrice function if utils not available
const roundPrice = (price: number): number => Math.round(price * 100) / 100;

// Helper function to safely convert to ISO string
const toSafeISOString = (date: Date | string | null): string => {
  if (!date) return new Date().toISOString();
  if (date instanceof Date) return date.toISOString();
  if (typeof date === 'string') {
    try {
      const parsed = new Date(date);
      return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
    } catch {
      return new Date().toISOString();
    }
  }
  return new Date().toISOString();
};

const useServiceOrderForm = ({
  isEditMode,
  editId,
  serviceType,
  validationSchema,
  dispatch,
  router
}: UseServiceOrderFormProps) => {
  const [serviceData, setServiceData] = useState<ServiceData>({
    serviceId: '',
    vendorName: '',
    vendorContact: '',
    orderDate: null,
    approvedDate: null,
    rejectedDate: null,
    invoiceDate: null,
    invoiceNo: '',
    expectedDeliveryDate: null,
    status: '',
    descriptions: [],
    totalAmount: 0,
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
    creditLimit: 0,
    locationName: '',
    freights: [],
    totalFreightAmount: 0,
    totalFreightTaxAmount: 0,
    serviceType,
    workOrderNumber: '',
    overallDiscountValue: 0,
    roundOffValue: 0,
    totalTax: 0,
    randomId: '',
    // Flat arrays
    desc_ids: [],
    from_dates: [],
    to_dates: [],
    fees: [],
    desc_tax_types: [],
    desc_tax_pers: [],
    desc_sgst: [],
    desc_cgst: [],
    desc_igst: [],
  });

  const [newDescription, setNewDescription] = useState<ServiceDescription>({
    id: '',
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
  });

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
  const [errors, setErrors] = useState({ 
    description: false, 
    fromDate: false, 
    toDate: false, 
    fee: false, 
    taxPer: false 
  });
  
  const [formErrors, setFormErrors] = useState({ 
    vendorName: false, 
    billingAddress: false, 
    shippingAddress: false, 
    locationName: false, 
    paymentTerms: false, 
    creditLimit: false 
  });
  
  const [loading, setLoading] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [overallDiscountValue, setOverallDiscountValue] = useState<number>(0);
  const [overallDiscountMode, setOverallDiscountMode] = useState<'percentage' | 'amount'>('percentage');
  const [roundOffValue, setRoundOffValue] = useState<number>(0);
  const [vendorSearch, setVendorSearch] = useState<any>(null);
  const [locationSearch, setLocationSearch] = useState<any>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);
  const [showNavigationConfirm, setShowNavigationConfirm] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [isHoldOrderDialog, setIsHoldOrderDialog] = useState(false);

  // Calculate totals memo
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

  // Update totals when dependencies change
  useEffect(() => {
    const newTotals = calculateTotals;
    setTotals(newTotals);
  }, [calculateTotals]);

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

  // Handle description addition
  const handleAddDescription = useCallback(async () => {
    setErrors({
      description: !newDescription.description,
      fromDate: !newDescription.from_date,
      toDate: !newDescription.to_date,
      fee: !newDescription.fee || newDescription.fee <= 0,
      taxPer: false,
    });
    
    if (!newDescription.description || !newDescription.from_date || !newDescription.to_date || 
        !newDescription.fee || newDescription.fee <= 0) {
      setSnackbarMessage('Description, dates, and fee are required. Fee must be greater than zero.');
      setSnackbarOpen(true);
      return;
    }
    
    setLoading(true);
    try {
      const params = {
        description: newDescription.description,
        fromDate: toSafeISOString(newDescription.from_date),
        toDate: toSafeISOString(newDescription.to_date),
        fee: newDescription.fee,
        taxType: newDescription.tax_type,
        taxPer: newDescription.tax_per || 0,
      };
      
      await dispatch(calculateDescriptionTotals(params)).unwrap();
      dispatch(addDescriptionToService());
      
      // Reset description form
      setNewDescription({
        id: '',
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
      });
      
    } catch (error) {
      setSnackbarMessage(`Failed to add description: ${error instanceof Error ? error.message : 'Please try again.'}`);
      setSnackbarOpen(true);
    } finally {
      setLoading(false);
    }
  }, [dispatch, newDescription]);

  // Handle form submission
  const handleSubmit = useCallback(async () => {
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
      
      if (!serviceData.descriptions.length) {
        setSnackbarMessage('At least one description is required.');
        setSnackbarOpen(true);
        return;
      }
      
      setLoading(true);
      
      // Prepare data for submission
      const dataToSubmit = {
        ...serviceData,
        serviceType,
        totalAmount: totals.roundedTotalOrderAmount,
        totalTax: totals.roundedTotalTax,
        overallDiscountValue,
        roundOffValue,
      };
      
      let result;
      if (isEditMode && editId) {
        result = await dispatch(updateService({ 
          serviceId: editId, 
          service: dataToSubmit 
        })).unwrap();
        setSnackbarMessage(`Service Order ${result.serviceId || editId} successfully updated.`);
      } else {
        result = await dispatch(addService(dataToSubmit)).unwrap();
        setSnackbarMessage(`Service Order ${result.serviceId || 'Unknown'} successfully created.`);
      }
      
      setSnackbarOpen(true);
      handleClear();
      setOpenDialog(false);
      router.push('/yen-purchase/ServiceOrder');
      
    } catch (error: any) {
      if (error instanceof Yup.ValidationError) {
        const newErrors = { 
          vendorName: false, 
          billingAddress: false, 
          shippingAddress: false, 
          locationName: false, 
          paymentTerms: false, 
          creditLimit: false 
        };
        error.inner.forEach((err) => {
          if (err.path) newErrors[err.path as keyof typeof newErrors] = true;
        });
        setFormErrors(newErrors);
      } else {
        setSnackbarMessage(`Failed to ${isEditMode ? 'update' : 'create'} service order: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      setSnackbarOpen(true);
    } finally {
      setLoading(false);
    }
  }, [serviceData, totals, overallDiscountValue, roundOffValue, isEditMode, editId, validationSchema, dispatch, router, serviceType]);

  // Clear form
  const handleClear = useCallback(() => {
    const currentDate = new Date().toISOString();
    setServiceData({
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
      freights: [],
      totalFreightAmount: 0,
      totalFreightTaxAmount: 0,
      serviceType,
      workOrderNumber: '',
      overallDiscountValue: 0,
      roundOffValue: 0,
      totalTax: 0,
      randomId: '',
      desc_ids: [],
      from_dates: [],
      to_dates: [],
      fees: [],
      desc_tax_types: [],
      desc_tax_pers: [],
      desc_sgst: [],
      desc_cgst: [],
      desc_igst: [],
    });
    
    setNewDescription({
      id: '',
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
    });
    
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
  }, [isEditMode, router, serviceType]);

  // Handle back to service with navigation confirmation
  const handleBackToService = useCallback(() => {
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
  }, [isFormDirty, handleClear, router]);

  // Handle open dialog
  const handleOpenDialog = useCallback(() => {
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
        setOpenDialog(true);
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
          if (error.path) newErrors[error.path as keyof typeof newErrors] = true;
        });
        setFormErrors(newErrors);
        setSnackbarMessage('Please fill all required fields.');
        setSnackbarOpen(true);
      });
  }, [validationSchema, serviceData, totals.roundedTotalOrderAmount, serviceData.creditLimit]);

  // Clear snackbar message
  const clearSnackbarMessage = useCallback(() => {
    setSnackbarMessage('');
    setSnackbarOpen(false);
  }, []);

  // Handle order date change
  const handleOrderDateChange = useCallback((date: Date | null) => {
    const finalDate = date || new Date();
    setServiceData(prev => ({
      ...prev,
      orderDate: finalDate.toISOString()
    }));
  }, []);

  // Handle expected delivery date change
  const handleExpectedDeliveryDateChange = useCallback((date: Date | null) => {
    const finalDate = date || new Date();
    setServiceData(prev => ({
      ...prev,
      expectedDeliveryDate: finalDate.toISOString()
    }));
  }, []);

  // Handle select address change
  const handleSelectAddressChange = useCallback((name: string, value: string | null) => {
    setServiceData(prev => ({ 
      ...prev, 
      [name]: value ?? '' 
    }));
    setFormErrors(prev => ({ ...prev, [name]: false }));
  }, []);

  // Handle location change
  const handleLocationChange = useCallback((location: any | null) => {
    setLocationSearch(location);
    setServiceData(prev => ({
      ...prev,
      locationName: location?.branchName || ''
    }));
    setFormErrors(prev => ({ ...prev, locationName: false }));
  }, []);

  // Handle text field change
  const handleTextFieldChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, index?: number) => {
    const { name, value } = e.target;
    if (index !== undefined) {
      setServiceData(prev => ({
        ...prev,
        termsandConditions: prev.termsandConditions.map((term, i) => 
          i === index ? value : term
        ),
      }));
    } else {
      setServiceData(prev => ({ ...prev, [name]: value }));
      setFormErrors(prev => ({ ...prev, [name]: false }));
    }
  }, []);

  // Toggle full screen
  const toggleFullScreen = useCallback(() => {
    setIsFullScreen(prev => !prev);
  }, []);

  // Handle add term
  const handleAddTerm = useCallback(() => {
    if (serviceData.termsandConditions.length < 3) {
      setServiceData(prev => ({
        ...prev,
        termsandConditions: [...prev.termsandConditions, '']
      }));
    }
  }, [serviceData.termsandConditions.length]);

  // Handle remove term
  const handleRemoveTerm = useCallback((index: number) => {
    setServiceData(prev => ({
      ...prev,
      termsandConditions: prev.termsandConditions.filter((_, i) => i !== index)
    }));
  }, []);

  // Handle round off change
  const handleRoundOffChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^-?\d*\.?\d{0,2}$/.test(value)) {
      const parsedValue = value === '' ? 0 : parseFloat(value) || 0;
      setRoundOffValue(parsedValue);
    }
  }, []);

  // Handle description change
  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'description') {
      if (value === '' || value.length <= 500) {
        setNewDescription(prev => ({ ...prev, description: value }));
        setErrors(prev => ({ ...prev, description: false }));
      }
    } else if (name === 'fee') {
      if (value === '' || /^\d{0,8}(\.\d{0,2})?$/.test(value)) {
        const parsedValue = value === '' ? 0 : parseFloat(value) || 0;
        setNewDescription(prev => ({ ...prev, fee: parsedValue }));
        setErrors(prev => ({ ...prev, fee: false }));
      }
    } else if (name === 'taxPer') {
      if (value === '' || /^\d{0,2}(\.\d{0,2})?$/.test(value)) {
        const parsedValue = value === '' ? 0 : parseFloat(value) || 0;
        if (parsedValue > 99.99) {
          setSnackbarMessage('Tax percentage cannot exceed 99.99%');
          setSnackbarOpen(true);
          return;
        }
        setNewDescription(prev => ({ ...prev, tax_per: parsedValue }));
        setErrors(prev => ({ ...prev, taxPer: false }));
      }
    }
  }, []);

  // Handle description date change
  const handleDescriptionDateChange = useCallback((name: 'from_date' | 'to_date', date: Date | null) => {
    const finalDate = date || new Date();
    setNewDescription(prev => ({ ...prev, [name]: finalDate.toISOString() }));
    setErrors(prev => ({ ...prev, [name]: false }));
  }, []);

  // Handle description tax type change
  const handleDescriptionTaxTypeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setNewDescription(prev => ({ 
      ...prev, 
      tax_type: event.target.value as 'cgst_sgst' | 'igst' 
    }));
  }, []);

  // Handle edit description
  const handleEditDescription = useCallback((desc: ServiceDescription) => {
    dispatch(setDescriptionForEditing(desc));
    setNewDescription(desc);
  }, [dispatch]);

  // Handle delete description
  const handleDeleteDescription = useCallback((descId: string) => {
    dispatch(deleteDescriptionFromService(descId));
    dispatch(clearDescriptionForEditing());
  }, [dispatch]);

  // Handle overall discount change
  const handleOverallDiscountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d{0,6}(\.\d{0,2})?$/.test(value)) {
      const parsedValue = value === '' ? 0 : parseFloat(value) || 0;
      const maxDiscount = overallDiscountMode === 'percentage'
        ? 99.99
        : totals.subTotal - 0.01;
      if (parsedValue > maxDiscount) {
        setSnackbarMessage(
          `Discount cannot be ${parsedValue}${overallDiscountMode === 'percentage' ? '%' : ''}. Maximum allowed is ${maxDiscount.toFixed(2)}`
        );
        setSnackbarOpen(true);
        return;
      }
      setOverallDiscountValue(parsedValue);
    }
  }, [overallDiscountMode, totals.subTotal]);

  // Set overall discount mode with conversion
  const setOverallDiscountModeWithConversion = useCallback((newMode: 'percentage' | 'amount') => {
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
  }, [overallDiscountMode, overallDiscountValue, totals.subTotal]);

  // Handle apply discount
  const handleApplyDiscount = useCallback(async () => {
    if (overallDiscountValue <= 0) {
      setSnackbarMessage('Please enter a valid discount amount');
      setSnackbarOpen(true);
      return;
    }
    if (serviceData.descriptions.length === 0) {
      setSnackbarMessage('Add descriptions before applying discount');
      setSnackbarOpen(true);
      return;
    }
    // Discount application logic here
    setLoading(true);
    try {
      // Add discount calculation logic
      setSnackbarMessage('Discount applied successfully');
      setSnackbarOpen(true);
    } catch (error) {
      setSnackbarMessage('Failed to apply discount');
      setSnackbarOpen(true);
    } finally {
      setLoading(false);
    }
  }, [overallDiscountValue, serviceData.descriptions.length]);

  // Handle vendor selection
  const handleVendorSelection = useCallback((vendor: any | null) => {
    setVendorSearch(vendor);
    if (vendor) {
      setServiceData(prev => ({
        ...prev,
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
      setFormErrors(prev => ({ 
        ...prev, 
        vendorName: false, 
        paymentTerms: false, 
        creditLimit: false 
      }));
    } else {
      setServiceData(prev => ({
        ...prev,
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
  }, []);

  // Return all state and functions
  return {
    serviceData,
    newDescription,
    totals,
    isFormDirty,
    errors,
    formErrors,
    loading,
    snackbarOpen,
    snackbarMessage,
    overallDiscountValue,
    overallDiscountMode,
    roundOffValue,
    vendorSearch,
    locationSearch,
    isFullScreen,
    orderLoading,
    showNavigationConfirm,
    pendingNavigation,
    openDialog,
    isHoldOrderDialog,
    
    // Setters
    setServiceData,
    setNewDescription,
    setSnackbarOpen,
    setSnackbarMessage,
    setOverallDiscountValue,
    setOverallDiscountMode,
    setRoundOffValue,
    setVendorSearch,
    setLocationSearch,
    setIsFullScreen,
    setShowNavigationConfirm,
    setPendingNavigation,
    setOpenDialog,
    setIsHoldOrderDialog,
    
    // Functions
    handleOrderDateChange,
    handleExpectedDeliveryDateChange,
    handleSelectAddressChange,
    handleLocationChange,
    handleTextFieldChange,
    toggleFullScreen,
    handleAddTerm,
    handleRemoveTerm,
    handleRoundOffChange,
    handleDescriptionChange,
    handleDescriptionDateChange,
    handleDescriptionTaxTypeChange,
    handleAddDescription,
    handleEditDescription,
    handleDeleteDescription,
    handleOverallDiscountChange,
    setOverallDiscountModeWithConversion,
    handleApplyDiscount,
    handleVendorSelection,
    handleClear,
    handleBackToService,
    handleSubmit,
    handleOpenDialog,
    clearSnackbarMessage,
  };
};

export default useServiceOrderForm;