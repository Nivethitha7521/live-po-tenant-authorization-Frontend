"use client";
import React, { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, TextField, Button, Typography, Grid, TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  Autocomplete, Snackbar, IconButton, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, RadioGroup,
  FormControlLabel, Radio, CircularProgress, Tooltip, Backdrop, Switch, FormControl, Select, MenuItem,
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
  setReduxTotals, fetchServiceById, updateService, calculateServiceTotals,
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
import FreightSelectionDialog, { FreightData } from '../../PurchaseOrder/Component/freightSelectionDialog';
import InfoIcon from '@mui/icons-material/Info';

// Helper functions for date handling
const formatDate = (date: Date | null): string => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateForBackend = (date: Date | null): string => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}T00:00:00.000Z`;
};

const parseDate = (dateStr: string | null): Date | null => {
  if (!dateStr) return null;
  const datePart = dateStr.split('T')[0];
  if (!datePart) return null;
  const [year, month, day] = datePart.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
};

const formatDateForDisplay = (dateStr: string | null | undefined): string => {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      timeZone: 'UTC',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return 'N/A';
  }
};
// Simple unique ID generator
const generateUniqueId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Helper function to convert flat arrays to descriptions
const getDescriptionsFromFlatArrays = (serviceData: ServiceData): ServiceDescription[] => {
  const descriptions: ServiceDescription[] = [];
  const maxLen = Math.max(
    serviceData.sacCode?.length || 0,
    serviceData.desc_ids?.length || 0,
    serviceData.descriptions?.length || 0,
    serviceData.from_dates?.length || 0,
    serviceData.to_dates?.length || 0,
    serviceData.fees?.length || 0,
    serviceData.quantity?.length || 0,
    serviceData.remarks?.length || 0,
    serviceData.desc_tax_types?.length || 0,
    serviceData.desc_tax_pers?.length || 0,
    serviceData.desc_sgst?.length || 0,
    serviceData.desc_cgst?.length || 0,
    serviceData.desc_igst?.length || 0,
    serviceData.desc_tax_amounts?.length || 0,
    serviceData.desc_totals?.length || 0,
    serviceData.desc_total_fees?.length || 0,
    serviceData.desc_discount_amounts?.length || 0,
  );

  for (let i = 0; i < maxLen; i++) {
    descriptions.push({
      id: serviceData.desc_ids?.[i] || '',
      sacCode: serviceData.sacCode?.[i] || '',
      description: serviceData.descriptions?.[i] || '',
      from_date: serviceData.from_dates?.[i] || null,
      to_date: serviceData.to_dates?.[i] || null,
      fee: serviceData.fees?.[i] || 0,
      quantity: serviceData.quantity?.[i] || 1,
      tax_type: serviceData.desc_tax_types?.[i] as 'cgst_sgst' | 'igst' || 'cgst_sgst',
      tax_per: serviceData.desc_tax_pers?.[i] || 0,
      sgst: serviceData.desc_sgst?.[i] || 0,
      cgst: serviceData.desc_cgst?.[i] || 0,
      igst: serviceData.desc_igst?.[i] || 0,
      total: serviceData.desc_totals?.[i] || 0,
      taxAmount: serviceData.desc_tax_amounts?.[i] || 0,
      totalFee: serviceData.desc_total_fees?.[i] || 0,
      finalFee: serviceData.desc_total_fees?.[i] || 0,
      discountAmount: serviceData.desc_discount_amounts?.[i] || 0,
      discount_percentage: serviceData.desc_discount_percentages?.[i] || 0,
      discount_amount: serviceData.desc_discount_amounts?.[i] || 0,
      remarks: serviceData.remarks?.[i] || '',
      base_amount: serviceData.base_amounts?.[i] || 0,
    });
  }
  return descriptions;
};

// Validation schema
const validationSchema = Yup.object({
  vendorName: Yup.string().required('Vendor name is required'),
  billingAddress: Yup.string().required('Billing address is required'),
  shippingAddress: Yup.string().required('Shipping address is required'),
  locationName: Yup.string().required('Location is required'),
  paymentTerms: Yup.string().required('Payment terms are required'),
  creditLimit: Yup.number().required('Credit limit is required').min(0, 'Credit limit must be non-negative'),
  workOrderDate: Yup.string().required('Work order date is required'),
});

const CreateServicePage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams?.get('edit');
  const isEditMode = !!editId;

  // Redux selectors
  const { serviceData, newDescription, snackbarOpen, snackbarMessage, serviceTotalsLoading: totalsLoading } = useSelector(selectServiceState);
  const { businesses, shippingaddress } = useSelector(selectBusinesses);
  const { location: locations } = useSelector(selectStorageLocations);
  const { items: taxItems } = useSelector((state: RootState) => state.purchaseTax);
  const { vendors } = useSelector(selectPurchaseOrderState);

  // Memoized selectors
  const descriptions = useMemo(() =>
    getDescriptionsFromFlatArrays(serviceData),
    [serviceData]
  );

  // Main state declarations
  const [open, setDialogOpen] = useState(false);
  const [openShippingDialog, setOpenShippingDialog] = useState(false);
  const [updatedShippingRow, setUpdatedShippingRow] = useState<ShippingAddress | null>(null);
  const [totals, setTotals] = useState({
    subTotal: 0,
    freightAmountTotal: 0,
    freightTaxTotal: 0,
    roundedTotalOrderAmount: 0,
    roundedTotalDiscount: 0,
    roundedTotalTax: 0,
    overallDiscountAmount: 0,
    taxAmount: 0,
    afterDiscount: 0,
  });

  // Loading states
  const [loadingStates, setLoadingStates] = useState({
    totals: false,
    submit: false,
    description: false,
    initial: false,
  });

  const [isFormDirty, setIsFormDirty] = useState(false);
  const [needsTotalsRefresh, setNeedsTotalsRefresh] = useState(false);

  // Error states
  const [errors, setErrors] = useState({
    description: false,
    fromDate: false,
    toDate: false,
    fee: false,
    taxPer: false,
    quantity: false,
    remarks: false
  });

  const [formErrors, setFormErrors] = useState({
    vendorName: false,
    billingAddress: false,
    shippingAddress: false,
    locationName: false,
    paymentTerms: false,
    creditLimit: false
  });

  const isEditing = (newDescription as any).index !== undefined && (newDescription as any).index >= 0;

  // Selection states
  const [selectedService, setSelectedService] = useState<ServiceSummary | null>(null);
  const [vendorSearch, setVendorSearch] = useState<VendorSummary | null>(null);
  const [locationSearch, setLocationSearch] = useState<Location | null>(null);

  // Navigation states
  const [showNavigationConfirm, setShowNavigationConfirm] = useState(false);
  const [hasDescriptionWiseDiscount, setHasDescriptionWiseDiscount] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const [isHoldOrderDialog, setIsHoldOrderDialog] = useState(false);

  const [overallDiscountValue, setOverallDiscountValue] = useState<number>(0); // Pending/input value
  const [appliedOverallDiscount, setAppliedOverallDiscount] = useState<number>(0); // Applied value
  const [overallDiscountMode, setOverallDiscountMode] = useState<'percentage' | 'amount'>('percentage');
  const [appliedOverallDiscountMode, setAppliedOverallDiscountMode] = useState<'percentage' | 'amount'>('percentage'); // Applied mode
  const [overallDiscountAppliedOn, setOverallDiscountAppliedOn] = useState<'before_tax' | 'after_tax'>('after_tax');
  const [appliedOverallDiscountAppliedOn, setAppliedOverallDiscountAppliedOn] = useState<'before_tax' | 'after_tax'>('after_tax'); // Applied type
  const [roundOffValue, setRoundOffValue] = useState<number>(0);

  // UI states
  const descriptionRef = useRef<HTMLInputElement | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [servicesList] = useState<ServiceSummary[]>([]);

  // Freight states
  const [freights, setFreights] = useState<FreightData[]>([]);
  const [openFreightDialog, setOpenFreightDialog] = useState(false);

  // Memoized calculations
  const freightSubTotal = useMemo(() =>
    freights.reduce((sum, f) => sum + (f.amt || 0), 0), [freights]
  );

  const freightTaxTotal = useMemo(() =>
    freights.reduce((sum, f) => sum + (f.tAmt || 0), 0), [freights]
  );

  const freightGrandTotal = useMemo(() =>
    freightSubTotal + freightTaxTotal, [freightSubTotal, freightTaxTotal]
  );
  // Update calculateDistributedDiscounts to use APPLIED values
  const calculateDistributedDiscounts = useCallback(() => {
    if (!serviceData.fees || serviceData.fees.length === 0) return [];

    const totalFees = serviceData.fees.reduce((sum, fee) => sum + (fee || 0), 0);
    if (totalFees === 0) return [];

    let discountPercentage = 0;

    // Calculate overall discount percentage USING APPLIED VALUES
    if (appliedOverallDiscountMode === 'percentage') {
      discountPercentage = appliedOverallDiscount;
    } else {
      // Calculate percentage from amount
      discountPercentage = (appliedOverallDiscount / totalFees) * 100;
    }

    // Apply same percentage to each description
    return serviceData.fees.map(fee => {
      const discountAmount = (fee * discountPercentage) / 100;
      return {
        amount: discountAmount,
        percentage: discountPercentage
      };
    });
  }, [serviceData.fees, appliedOverallDiscount, appliedOverallDiscountMode]); // Use APPLIED values
  const refreshTotals = useCallback(async (isMounted: boolean = true) => {
    if (!isMounted || loadingStates.totals) return;
    setLoadingStates(prev => ({ ...prev, totals: true }));

    if (descriptions.length === 0 && freights.length === 0) {
      setTotals({
        subTotal: 0,
        freightAmountTotal: 0,
        freightTaxTotal: 0,
        roundedTotalOrderAmount: 0,
        roundedTotalDiscount: 0,
        roundedTotalTax: 0,
        overallDiscountAmount: 0,
        taxAmount: 0,
        afterDiscount: 0,
      });
      setLoadingStates(prev => ({ ...prev, totals: false }));
      return;
    }

    try {
      // Use APPLIED values for calculations, not pending values
      const discountToUse = appliedOverallDiscount;
      const discountModeToUse = appliedOverallDiscountMode;
      const discountAppliedOnToUse = appliedOverallDiscountAppliedOn;

      // Call backend for complex calculations WITH APPLIED DISCOUNT VALUES
      const request: ServiceTotalsRequest = {
        descriptions: descriptions.map(desc => ({
          ...desc,
          fee: desc.fee,
          discount_percentage: desc.discount_percentage || 0,
          discount_amount: desc.discountAmount || 0,
        })),
        overall_discount_value: discountToUse, // USE APPLIED VALUE
        overall_discount_type: discountModeToUse, // USE APPLIED MODE
        overall_discount_applied_on: discountAppliedOnToUse, // USE APPLIED TYPE
        round_off: roundOffValue,
        fees_are_total_including_tax: true,
        total_freight_amount: freightSubTotal,
        total_freight_tax: freightTaxTotal,
      };

      const result = await dispatch(calculateServiceTotals(request)).unwrap();

      // Update service data with calculated values
      dispatch(setServiceData({
        ...serviceData,
        desc_sgst: result.desc_sgst || [],
        desc_cgst: result.desc_cgst || [],
        desc_igst: result.desc_igst || [],
        desc_tax_amounts: result.desc_tax_amounts || [],
        base_amounts: result.base_amounts || [],
        desc_totals: result.desc_totals || [],
        desc_discount_amounts: result.desc_discount_amounts || [],
        desc_discount_percentages: result.desc_discount_percentages || [],
        desc_overall_discounts: result.desc_overall_discounts || [],
      }));

      // Update totals with backend calculations
      setTotals(prev => ({
        ...prev,
        subTotal: result.totalFees || 0,
        taxAmount: result.totalTax || 0,
        overallDiscountAmount: result.totalOverallDiscount || 0,
        roundedTotalOrderAmount: result.totalAmount || 0,
        roundedTotalTax: result.totalTax || 0,
        roundedTotalDiscount: result.totalDiscount || 0,
      }));

    } catch (error) {
      console.error('Error refreshing totals:', error);
      if (isMounted) {
        dispatch(setSnackbarMessage('Failed to calculate totals. Please check the data.'));
        dispatch(setSnackbarOpen(true));
      }
    } finally {
      if (isMounted) {
        setLoadingStates(prev => ({ ...prev, totals: false }));
        setNeedsTotalsRefresh(false);
      }
    }
  }, [
    descriptions,
    appliedOverallDiscount, // USE APPLIED VALUE
    appliedOverallDiscountMode, // USE APPLIED MODE
    appliedOverallDiscountAppliedOn, // USE APPLIED TYPE
    roundOffValue,
    dispatch,
    freightGrandTotal,
    freightSubTotal,
    freightTaxTotal,
    serviceData,
    loadingStates.totals
  ]);
  // Manual refresh totals function for external calls
  const manualRefreshTotals = useCallback(() => {
    setNeedsTotalsRefresh(true);
  }, []);

  // Effect to refresh totals only when needed
  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const refreshIfNeeded = () => {
      if (!isMounted || !needsTotalsRefresh) return;
      refreshTotals(isMounted);
    };

    // Debounce the refresh to avoid rapid consecutive calls
    timeoutId = setTimeout(refreshIfNeeded, 300);

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [needsTotalsRefresh, refreshTotals]);

  // // Trigger totals refresh when descriptions change (add/edit/delete)
  // useEffect(() => {
  //   manualRefreshTotals();
  // }, [descriptions.length]);

  // // Trigger totals refresh when freights change
  // useEffect(() => {
  //   manualRefreshTotals();
  // }, [freights.length]);

  // // Trigger totals refresh when discount/roundoff changes
  // useEffect(() => {
  //   manualRefreshTotals();
  // }, [overallDiscountValue, roundOffValue]);

  // Load service data in edit mode
  useEffect(() => {
    if (isEditMode && editId) {
      setLoadingStates(prev => ({ ...prev, initial: true }));

      const loadService = async () => {
        try {
          const data = await dispatch(fetchServiceById(editId)).unwrap();
          const parsedData = { ...data };

          // Parse dates
          if (parsedData.workOrderDate) {
            parsedData.workOrderDate = formatDate(new Date(parsedData.workOrderDate));
          }

          if (parsedData.from_dates) {
            parsedData.from_dates = parsedData.from_dates.map((dt: string | null) =>
              dt ? formatDate(new Date(dt)) : null
            );
          }

          if (parsedData.to_dates) {
            parsedData.to_dates = parsedData.to_dates.map((dt: string | null) =>
              dt ? formatDate(new Date(dt)) : null
            );
          }

          parsedData.quantity = parsedData.quantity || [];
          parsedData.remarks = parsedData.remarks || [];

          dispatch(setServiceData(parsedData));
          setFreights(data.freights || []);

          if (data.overallDiscountValue !== undefined) {
            setOverallDiscountValue(data.overallDiscountValue);
          }

          if (data.roundOffValue !== undefined) {
            setRoundOffValue(data.roundOffValue);
          }

          // Refresh totals after loading data
          setNeedsTotalsRefresh(true);
        } catch (error) {
          console.error('Failed to load service order for edit:', error);
          dispatch(setSnackbarMessage('Failed to load service order data.'));
          dispatch(setSnackbarOpen(true));
          router.push('/yen-purchase/ServiceOrder');
        } finally {
          setLoadingStates(prev => ({ ...prev, initial: false }));
        }
      };

      loadService();
    }
  }, [isEditMode, editId, dispatch, router]);

  // Fetch purchase taxes
  useEffect(() => {
    let isMounted = true;

    const fetchTaxes = async () => {
      if (!isMounted) return;

      try {
        await dispatch(fetchPurchaseTaxes());
      } catch (error) {
        console.error('Failed to fetch purchase taxes:', error);
      }
    };

    fetchTaxes();

    return () => {
      isMounted = false;
    };
  }, [dispatch]);

  // Initial data fetch
  useEffect(() => {
    let isMounted = true;

    const initializeData = async () => {
      try {
        await Promise.all([
          dispatch(fetchBusinesses()),
          dispatch(fetchShipping()),
          dispatch(fetchLocations())
        ]);

        if (!isMounted || isEditMode) return;

        // Set defaults for create mode
        const currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);

        const updates: Partial<ServiceData> = {
          serviceId: '',
          vendorName: '',
          vendorContact: '',
          workOrderDate: formatDate(currentDate),
          status: 'Pending',
          sacCode: [],
          desc_ids: [],
          descriptions: [],
          from_dates: [],
          to_dates: [],
          quantity: [],
          remarks: [],
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
          desc_overall_discounts: [],
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
          freights: [],
        };

        // Set default addresses if available
        if (shippingaddress.length > 0) {
          updates.shippingAddress = shippingaddress[2]?.address ?? '';
        }

        if (businesses.length === 1) {
          updates.billingAddress = `${businesses[0].address1 ?? ''} ${businesses[0].address2 ?? ''}`.trim();
        }

        dispatch(setServiceData(updates as ServiceData));
        setFreights([]);
      } catch (error) {
        console.error('Error initializing data:', error);
      }
    };

    initializeData();

    return () => {
      isMounted = false;
    };
  }, [dispatch, isEditMode]);

  // Track form dirty state
  useEffect(() => {
    const trackFormState = () => {
      const hasDescriptionWiseDiscountValue = descriptions.some(desc => (desc.discountAmount || 0) > 0);
      setHasDescriptionWiseDiscount(hasDescriptionWiseDiscountValue);

      if (hasDescriptionWiseDiscountValue && overallDiscountValue > 0) {
        setOverallDiscountValue(0);
        dispatch(setSnackbarMessage('Overall discount disabled due to existing description-wise discounts'));
        dispatch(setSnackbarOpen(true));
      }

      const hasChanges =
        serviceData.vendorName !== '' ||
        descriptions.length > 0 ||
        serviceData.billingAddress !== '' ||
        serviceData.shippingAddress !== '' ||
        serviceData.locationName !== '' ||
        serviceData.comments !== '' ||
        serviceData.termsandConditions.some((term) => term !== '') ||
        overallDiscountValue !== 0 ||
        roundOffValue !== 0 ||
        freights.length > 0;

      setIsFormDirty(hasChanges);
    };

    trackFormState();
  }, [serviceData, descriptions, overallDiscountValue, roundOffValue, freights, dispatch]);

  useBeforeUnload(isFormDirty, 'You have unsaved changes. Are you sure you want to leave?');

  // Date handlers
  const handleWorkOrderDateChange = useCallback((date: Date | null) => {
    dispatch(setServiceData({
      ...serviceData,
      workOrderDate: formatDateForBackend(date)
    }));
  }, [dispatch, serviceData]);

  const handleSelectAddressChange = useCallback(
    (name: string, value: string | null) => {
      const updatedData = { ...serviceData, [name]: value ?? '' };

      if (name === 'billingAddress') {
        const selectedBusiness = businesses.find((business) =>
          `${business.address1 ?? ''} ${business.address2 ?? ''}`.trim() === value
        );
        updatedData.billingAddress = selectedBusiness
          ? `${selectedBusiness.address1 ?? ''} ${selectedBusiness.address2 ?? ''}`.trim()
          : value ?? '';

        if (updatedData.billingAddress.trim()) {
          setFormErrors(prev => ({ ...prev, billingAddress: false }));
        }
      } else if (name === 'shippingAddress') {
        const selectedShippingAddress = shippingaddress.find((address) => address.address === value);
        updatedData.shippingAddress = selectedShippingAddress ? selectedShippingAddress.address : value ?? '';

        if (updatedData.shippingAddress.trim()) {
          setFormErrors(prev => ({ ...prev, shippingAddress: false }));
        }
      }

      dispatch(setServiceData(updatedData));
    },
    [dispatch, serviceData, businesses, shippingaddress, setFormErrors]
  );

  const handleLocationChange = useCallback((location: Location | null) => {
    setLocationSearch(location);
    dispatch(setServiceData({
      ...serviceData,
      locationName: location?.branchName || ''
    }));
    setFormErrors(prev => ({ ...prev, locationName: false }));
  }, [dispatch, serviceData, setFormErrors]);

  // Text field change handlers
  const handleTextFieldChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, index?: number) => {
    const { name, value } = e.target;

    if (index !== undefined) {
      dispatch(setServiceData({
        ...serviceData,
        termsandConditions: serviceData.termsandConditions.map((term, i) =>
          i === index ? value : term
        ),
      }));
    } else {
      dispatch(setServiceData({ ...serviceData, [name]: value }));
      setFormErrors(prev => ({ ...prev, [name]: false }));
    }
  }, [dispatch, serviceData, setFormErrors]);

  // Description change handlers
  const handleDescriptionChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    switch (name) {
      case 'sacCode':
        dispatch(setNewDescriptionData({ ...newDescription, sacCode: value }));
        break;
      case 'description':
        if (value.length <= 500) {
          dispatch(setNewDescriptionData({ ...newDescription, description: value }));
          setErrors(prev => ({ ...prev, description: false }));
        }
        break;
      case 'quantity':
        if (value === '' || /^\d+$/.test(value)) {
          const parsedValue = value === '' ? 1 : parseInt(value) || 1;
          if (parsedValue < 1) {
            dispatch(setSnackbarMessage('Quantity must be at least 1'));
            dispatch(setSnackbarOpen(true));
            return;
          }
          dispatch(setNewDescriptionData({ ...newDescription, quantity: parsedValue }));
          setErrors(prev => ({ ...prev, quantity: false }));
        }
        break;
      case 'remarks':
        dispatch(setNewDescriptionData({ ...newDescription, remarks: value }));
        setErrors(prev => ({ ...prev, remarks: false }));
        break;
      case 'fee':
        if (/^\d{0,8}(\.\d{0,2})?$/.test(value) || value === '') {
          const parsedValue = value === '' ? 0 : parseFloat(value) || 0;
          dispatch(setNewDescriptionData({ ...newDescription, fee: parsedValue }));
          setErrors(prev => ({ ...prev, fee: false }));
        }
        break;
      case 'taxPer':
        if (/^\d{0,2}(\.\d{0,2})?$/.test(value) || value === '') {
          const parsedValue = value === '' ? 0 : parseFloat(value) || 0;
          if (parsedValue > 99.99) {
            dispatch(setSnackbarMessage('Tax percentage cannot exceed 99.99%'));
            dispatch(setSnackbarOpen(true));
            return;
          }
          dispatch(setNewDescriptionData({ ...newDescription, tax_per: parsedValue }));
          setErrors(prev => ({ ...prev, taxPer: false }));
        }
        break;
    }
  }, [dispatch, newDescription]);

  const handleDescriptionDateChange = useCallback((name: 'from_date' | 'to_date', date: Date | null) => {
    dispatch(setNewDescriptionData({
      ...newDescription,
      [name]: formatDateForBackend(date),
    }));
    setErrors(prev => ({ ...prev, [name === 'from_date' ? 'fromDate' : 'toDate']: false }));
  }, [dispatch, newDescription]);

  const handleDescriptionTaxTypeChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    dispatch(setNewDescriptionData({
      ...newDescription,
      tax_type: event.target.value as 'cgst_sgst' | 'igst'
    }));
  }, [dispatch, newDescription]);

  const handleAddDescription = useCallback(async () => {
    const editingIndex = (newDescription as any).index;
    const isCurrentlyEditing = editingIndex !== undefined && editingIndex >= 0;

    // Validation
    const validationErrors = {
      description: !newDescription.description?.trim(),
      fee: !newDescription.fee || newDescription.fee <= 0,
      quantity: !newDescription.quantity || newDescription.quantity < 1,
    };

    setErrors(prev => ({ ...prev, ...validationErrors }));

    if (validationErrors.description || validationErrors.fee || validationErrors.quantity) {
      dispatch(setSnackbarMessage('Description, fee (>0), and quantity (≥1) are required.'));
      dispatch(setSnackbarOpen(true));
      return;
    }

    setLoadingStates(prev => ({ ...prev, description: true }));

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

      const newDescWithId: ServiceDescription = {
        id: isCurrentlyEditing ? newDescription.id : generateUniqueId(),
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
        totalFee: calcResult.fee || 0,
        finalFee: calcResult.fee || 0,
        discountAmount: 0,
        discount_percentage: 0,
        discount_amount: 0,
        remarks: newDescription.remarks || '',
        base_amount: newDescription.base_amount,
      };

      if (isCurrentlyEditing && editingIndex !== undefined) {
        dispatch(updateDescription({
          index: editingIndex,
          desc: newDescWithId
        }));
        dispatch(setSnackbarMessage('Description updated successfully'));
      } else {
        dispatch(addDescriptionToService(newDescWithId));
        dispatch(setSnackbarMessage('Description added successfully'));
      }

      // Reset form
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
        discount_percentage: 0,
        discount_amount: 0,
        quantity: 1,
        remarks: '',
        index: undefined,
      } as any));

      setSelectedService(null);
      setErrors({
        description: false,
        fromDate: false,
        toDate: false,
        fee: false,
        taxPer: false,
        quantity: false,
        remarks: false
      });

      // Trigger totals refresh after adding/editing description
      setNeedsTotalsRefresh(true);

      setTimeout(() => descriptionRef.current?.focus(), 100);
    } catch (error) {
      console.error('Add/Update desc error:', error);
      dispatch(setSnackbarMessage('Failed to save description. Please try again.'));
      dispatch(setSnackbarOpen(true));
    } finally {
      setLoadingStates(prev => ({ ...prev, description: false }));
    }
  }, [dispatch, newDescription]);

  // Freight handlers
  const handleAddFreights = useCallback((newFreights: FreightData[]) => {
    setFreights(newFreights);
    setNeedsTotalsRefresh(true);
  }, []);

  const handleDeleteFreight = useCallback((index: number) => {
    setFreights(prev => prev.filter((_, i) => i !== index));
    setNeedsTotalsRefresh(true);
  }, []);

  // Description actions
  const handleEditDescription = useCallback((index: number) => {
    const desc = descriptions[index];
    if (desc) {
      if (desc.sacCode && servicesList.length > 0) {
        const service = servicesList.find(s => s.saccode.toString() === desc.sacCode);
        setSelectedService(service || null);
      }
      dispatch(setDescriptionForEditing({
        ...desc,
        index: index
      }));
      document.getElementById('description-form')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [descriptions, servicesList, dispatch]);

  const handleDeleteDescription = useCallback((index: number) => {
    dispatch(deleteDescriptionFromService(index));
    dispatch(clearDescriptionForEditing());
    setNeedsTotalsRefresh(true);
  }, [dispatch]);
  const handleOverallDiscountChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
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
      // ONLY UPDATE THE PENDING VALUE, DON'T TRIGGER CALCULATIONS
      setOverallDiscountValue(parsedValue);
    }
  }, [overallDiscountMode, totals.subTotal, dispatch]);
  const handleApplyDiscount = useCallback(async () => {
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

    if (descriptions.length === 0) {
      dispatch(setSnackbarMessage('Add descriptions before applying discount'));
      dispatch(setSnackbarOpen(true));
      return;
    }

    // SET THE APPLIED VALUES HERE (only when Apply button is clicked)
    setAppliedOverallDiscount(overallDiscountValue);
    setAppliedOverallDiscountMode(overallDiscountMode);
    setAppliedOverallDiscountAppliedOn(overallDiscountAppliedOn);

    // Trigger totals refresh after applying discount
    setNeedsTotalsRefresh(true);

    const totalOriginal = serviceData.fees?.reduce((a, b) => a + b, 0) || 0;
    const calculatedPercentage = overallDiscountMode === 'percentage'
      ? overallDiscountValue
      : (overallDiscountValue / totalOriginal * 100);

    dispatch(setSnackbarMessage(
      `Successfully applied ${overallDiscountValue}${overallDiscountMode === 'percentage' ? '%' : '₹'} discount (${calculatedPercentage.toFixed(2)}% to each description)`
    ));
    dispatch(setSnackbarOpen(true));
  }, [
    hasDescriptionWiseDiscount,
    overallDiscountValue,
    overallDiscountMode,
    overallDiscountAppliedOn,
    descriptions.length,
    dispatch,
    serviceData.fees
  ]);
  const handleClearOverallDiscount = useCallback(async () => {
    if (loadingStates.totals) return;

    // Clear both pending and applied values
    setOverallDiscountValue(0);
    setAppliedOverallDiscount(0);
    setNeedsTotalsRefresh(true);

    dispatch(setSnackbarMessage('Overall discount removed'));
    dispatch(setSnackbarOpen(true));
  }, [loadingStates.totals, dispatch]);

  const handleVendorSelection = useCallback((vendor: VendorSummary | null) => {
    setVendorSearch(vendor);

    if (vendor) {
      dispatch(setServiceData({
        ...serviceData,
        vendorName: vendor.vendorName,
        vendorId: vendor.vendorId,
        vendorContact: vendor.contactpersonPhone,
        contactpersonEmail: vendor.contactpersonEmail,
        address: vendor.address,
        country: vendor.country,
        paymentTerms: vendor.paymentTerms,
        creditLimit: vendor.creditLimit,
        state: vendor.state,
        city: vendor.city,
      }));

      setFormErrors({
        ...formErrors,
        vendorName: false,
        paymentTerms: false,
        creditLimit: false
      });

      setTimeout(() => descriptionRef.current?.focus(), 0);
    } else {
      dispatch(setServiceData({
        ...serviceData,
        vendorName: '',
        vendorId: '',
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
  }, [dispatch, serviceData, formErrors]);
  const handleClear = useCallback(() => {
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    dispatch(setServiceData({
      serviceId: '',
      vendorName: '',
      vendorContact: '',
      workOrderDate: formatDate(currentDate),
      status: 'Pending',
      sacCode: [],
      desc_ids: [],
      descriptions: [],
      from_dates: [],
      to_dates: [],
      quantity: [],
      remarks: [],
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
      desc_overall_discounts: [],
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
      freights: [],
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
    setSelectedService(null);

    // Clear all discount states
    setOverallDiscountValue(0);
    setAppliedOverallDiscount(0);
    setOverallDiscountMode('percentage');
    setAppliedOverallDiscountMode('percentage');
    setOverallDiscountAppliedOn('after_tax');
    setAppliedOverallDiscountAppliedOn('after_tax');

    setRoundOffValue(0);
    setFreights([]);
    setIsFormDirty(false);
    setFormErrors({
      vendorName: false,
      billingAddress: false,
      shippingAddress: false,
      locationName: false,
      paymentTerms: false,
      creditLimit: false
    });
    setNeedsTotalsRefresh(true);
    if (isEditMode) {
      router.push('/yen-purchase/ServiceOrder');
    }
  }, [dispatch, isEditMode, router]);

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

      if (descriptions.length === 0) {
        dispatch(setSnackbarMessage('At least one description is required.'));
        dispatch(setSnackbarOpen(true));
        return;
      }

      setLoadingStates(prev => ({ ...prev, submit: true }));

      const finalAmount = totals.roundedTotalOrderAmount;

      // Prepare freight data
      const freightData = freights.map(freight => ({
        id: freight.id || generateUniqueId(),
        name: freight.name || '',
        tCode: freight.tCode || '',
        amt: freight.amt || 0,
        tAmt: freight.tAmt || 0,
        totalAmt: freight.totalAmt || 0,
        taxType: freight.taxType || 'cgst_sgst',
        sgst: freight.sgst || 0,
        cgst: freight.cgst || 0,
        igst: freight.igst || 0,
        taxPercentage: freight.taxPercentage || 0
      }));

      // Prepare data for submission
      const dataToSubmit = {
        ...serviceData,
        freights: freightData,
        totalFreightAmount: freightSubTotal,
        totalFreightTaxAmount: freightTaxTotal,
        workOrderDate: serviceData.workOrderDate ? formatDateForBackend(parseDate(serviceData.workOrderDate)) : null,
        totalAmount: finalAmount,
        totalTax: totals.roundedTotalTax,
        overallDiscountType: overallDiscountMode,
        overallDiscountAppliedOn: overallDiscountAppliedOn,
        overallDiscountValue: overallDiscountValue,
        totalDiscount: totals.roundedTotalDiscount,
        roundOffValue,
        quantity: descriptions.map(desc => desc.quantity),
        remarks: descriptions.map(desc => desc.remarks || ''),
        sacCode: descriptions.map(desc => desc.sacCode || ''),
        desc_ids: descriptions.map(desc => desc.id || ''),
        desc_descriptions: descriptions.map(desc => desc.description),
        from_dates: descriptions.map(desc =>
          desc.from_date ? formatDateForBackend(parseDate(desc.from_date)) : null
        ),
        to_dates: descriptions.map(desc =>
          desc.to_date ? formatDateForBackend(parseDate(desc.to_date)) : null
        ),
        fees: descriptions.map(desc => desc.fee),
        desc_tax_types: descriptions.map(desc => desc.tax_type),
        desc_tax_pers: descriptions.map(desc => desc.tax_per || 0),
        desc_sgst: serviceData.desc_sgst || [],
        desc_cgst: serviceData.desc_cgst || [],
        desc_igst: serviceData.desc_igst || [],
        desc_tax_amounts: serviceData.desc_tax_amounts || [],
        desc_totals: serviceData.desc_totals || [],
        desc_total_fees: serviceData.desc_total_fees || [],
        desc_overall_discounts: serviceData.desc_overall_discounts || [],
        termsandConditions: serviceData.termsandConditions || [''],
      } as ServiceData;

      let result;

      if (isEditMode && editId) {
        result = await dispatch(updateService({ mongoId: editId, service: dataToSubmit })).unwrap();
        dispatch(setSnackbarMessage(`Service Order ${result.serviceId || editId} successfully updated.`));
      } else {
        result = await dispatch(addService(dataToSubmit)).unwrap();
        dispatch(setSnackbarMessage(
          `Service Order ${result.serviceId} successfully created.`
        ));
      }

      dispatch(setSnackbarOpen(true));
      handleClear();
      setDialogOpen(false);
      router.push('/yen-purchase/ServiceOrder');
    } catch (error) {
      console.error('Submit error:', error);

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
          if (err.path && err.path in newErrors) {
            newErrors[err.path as keyof typeof newErrors] = true;
          }
        });

        setFormErrors(newErrors);
      }

      dispatch(setSnackbarMessage('Failed to submit service order. Please check the data.'));
      dispatch(setSnackbarOpen(true));
    } finally {
      setLoadingStates(prev => ({ ...prev, submit: false }));
    }
  }, [
    serviceData, descriptions, totals, freights, freightSubTotal, freightTaxTotal,
    overallDiscountMode, overallDiscountAppliedOn, overallDiscountValue, roundOffValue,
    dispatch, isEditMode, editId, handleClear, router
  ]);

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
  }, [serviceData, totals.roundedTotalOrderAmount, serviceData.creditLimit, dispatch]);

  // UI Helper functions
  const toggleFullScreen = useCallback(() => {
    setIsFullScreen(prev => !prev);
  }, []);

  const handleAddTerm = useCallback(() => {
    if (serviceData.termsandConditions.length < 3) {
      dispatch(setServiceData({
        ...serviceData,
        termsandConditions: [...serviceData.termsandConditions, ''],
      }));
    }
  }, [dispatch, serviceData]);

  const handleRemoveTerm = useCallback((index: number) => {
    dispatch(setServiceData({
      ...serviceData,
      termsandConditions: serviceData.termsandConditions.filter((_, i) => i !== index),
    }));
  }, [dispatch, serviceData]);

  const handleRoundOffChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^-?\d*\.?\d{0,2}$/.test(value)) {
      const parsedValue = value === '' ? 0 : parseFloat(value) || 0;
      setRoundOffValue(parsedValue);
    }
  }, []);

  // ========== RENDER ==========

  if (loadingStates.initial) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh" flexDirection="column">
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading service order data...
        </Typography>
      </Box>
    );
  }

  const distributedDiscounts = calculateDistributedDiscounts();
  const totalOriginalAmount = serviceData.fees?.reduce((a, b) => a + b, 0) || 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#ffffff' }}>
      {/* Main Content */}
      <Box sx={{ flex: 1, p: 3, overflowY: 'auto', maxHeight: 'calc(100vh - 64px)' }}>
        <Box sx={{
          width: '100%',
          maxWidth: {
            xs: '100%',      // Mobile: full
            sm: '100%',      // Tablets: full with padding
            md: '1200px',    // Laptops (1366-1600px): comfortable fixed width
            lg: '1400px',    // Large monitors: more space
            xl: '1600px',    // XXL monitors (1920px+): max readable width
          },
          mx: 'auto',        // Centered
          px: { xs: 2, sm: 3, md: 4 },  // Generous side padding on big screens
          py: 3,
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Button variant="contained" color="primary" onClick={handleBackToService}>
              Back to Service Orders
            </Button>
          </Box>

          {/* Header Form Fields */}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={3} md={2}>
              <TextField
                fullWidth
                disabled
                label="Service ID"
                name="serviceId"
                value={serviceData.mongoId || (isEditMode ? editId : 'New')}
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
                label="Workorder Date"
                value={serviceData.workOrderDate ? parseDate(serviceData.workOrderDate) : null}
                onChange={handleWorkOrderDateChange}
                maxDate={new Date()}
              />
            </Grid>
          </Grid>

          {/* Add Description Section */}
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

            <Grid container spacing={2} id="description-form">
              {/* SAC Code */}
              <Grid item xs={12} sm={2}>
                <ServiceAutocomplete
                  value={selectedService}
                  onChange={(service: ServiceSummary | null) => {
                    setSelectedService(service);
                    if (service) {
                      dispatch(setNewDescriptionData({
                        ...newDescription,
                        sacCode: service.saccode.toString(),
                      }));
                      setTimeout(() => {
                        descriptionRef.current?.focus();
                      }, 100);
                    } else {
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

              {/* Remarks */}
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

              {/* Quantity */}
              <Grid item xs={12} sm={1.5}>
                <TextField
                  fullWidth
                  label="Quantity"
                  name="quantity"
                  type="number"
                  value={newDescription.quantity}
                  onChange={handleDescriptionChange}
                  size="small"
                  error={errors.quantity}
                  helperText={errors.quantity ? 'Quantity is required (≥1)' : ''}
                  inputProps={{
                    min: 1,
                    step: 1,
                    onKeyDown: (e) => {
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

              {/* Tax Percentage */}
              <Grid item xs={12} sm={1.5}>
                <Autocomplete
                  fullWidth
                  options={taxItems || []}
                  getOptionLabel={(option) => `${option.purchasetaxName}`}
                  value={taxItems?.find(tax => tax.purchasetaxPercentage === newDescription.tax_per) || null}
                  onChange={(event, value) => {
                    if (value) {
                      dispatch(setNewDescriptionData({
                        ...newDescription,
                        tax_per: value.purchasetaxPercentage,
                      }));
                    } else {
                      dispatch(setNewDescriptionData({
                        ...newDescription,
                        tax_per: 0,
                      }));
                    }
                    setErrors(prev => ({ ...prev, taxPer: false }));
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Tax"
                      size="small"
                      variant="outlined"
                      error={errors.taxPer}
                      helperText={errors.taxPer ? 'Tax is required' : ''}
                      autoComplete="off"
                      placeholder="Select Tax"
                    />
                  )}
                  renderOption={(props, option) => (
                    <li {...props} key={option.purchasetaxId}>
                      {option.purchasetaxName}
                    </li>
                  )}
                  isOptionEqualToValue={(option, value) =>
                    option.purchasetaxPercentage === value?.purchasetaxPercentage
                  }
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

              {/* Action Buttons */}
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
                  disabled={loadingStates.description}
                  startIcon={loadingStates.description ? <CircularProgress size={20} /> : null}
                >
                  {loadingStates.description ? 'Processing...' : (isEditing ? 'Update Description' : 'Add Description')}
                </Button>
              </Grid>
            </Grid>

            {/* Descriptions Table */}
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
                    <TableCell align="right">
                      <Tooltip title="Original amount before discount">
                        <Typography variant="body2">Original Amt (₹)</Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="center">Tax Type</TableCell>
                    <TableCell align="right">Tax %</TableCell>
                    <TableCell align="right">SGST (₹)</TableCell>
                    <TableCell align="right">CGST (₹)</TableCell>
                    <TableCell align="right">IGST (₹)</TableCell>

                    {/* INDIVIDUAL DISCOUNT */}
                    <TableCell align="right">
                      <Tooltip title="Individual discount applied to this description">
                        <Typography variant="body2">Ind. Disc</Typography>
                      </Tooltip>
                    </TableCell>

                    {/* OVERALL DISCOUNT */}
                    <TableCell align="right">
                      <Box>
                        <Typography variant="body2">Overall Disc</Typography>
                        {overallDiscountValue > 0 && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {overallDiscountMode === 'percentage' ?
                              `${overallDiscountValue}%` :
                              `₹${overallDiscountValue}`
                            }
                          </Typography>
                        )}
                      </Box>
                    </TableCell>

                    {/* TOTAL DISCOUNT */}
                    <TableCell align="right">
                      <Tooltip title="Total discount (Individual + Overall)">
                        <Typography variant="body2">Total Disc</Typography>
                      </Tooltip>
                    </TableCell>

                    {/* FINAL AMOUNT */}
                    <TableCell align="right">
                      <Tooltip title="Final amount after all discounts">
                        <Typography variant="body2">Final Amt (₹)</Typography>
                      </Tooltip>
                    </TableCell>

                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {descriptions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={19} align="center">No descriptions added</TableCell>
                    </TableRow>
                  ) : (
                    descriptions.map((desc, index) => {
                      const originalAmount = serviceData.fees?.[index] || 0;
                      const finalAmount = serviceData.desc_totals?.[index] || 0;

                      // Get individual discount
                      const individualDiscountAmount = serviceData.desc_discount_amounts?.[index] || 0;
                      const individualDiscountPercentage = serviceData.desc_discount_percentages?.[index] || 0;

                      // Get overall discount (distributed)
                      const overallDiscountAmount = serviceData.desc_overall_discounts?.[index] || distributedDiscounts[index]?.amount || 0;
                      const overallDiscountPercentage = serviceData.desc_discount_percentages?.[index] || distributedDiscounts[index]?.percentage || 0;

                      // Calculate total discount
                      const totalDiscountAmount = individualDiscountAmount + overallDiscountAmount;
                      const totalDiscountPercentage = originalAmount > 0 ?
                        (totalDiscountAmount / originalAmount * 100) : 0;

                      return (
                        <TableRow key={desc.id || index} hover>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>{desc.sacCode || 'N/A'}</TableCell>
                          <TableCell sx={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {desc.description}
                          </TableCell>
                          <TableCell sx={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {desc.remarks || 'N/A'}
                          </TableCell>
                          <TableCell>{desc.quantity}</TableCell>
                          <TableCell>
                            {formatDateForDisplay(desc.from_date)}
                          </TableCell>
                          <TableCell>
                            {formatDateForDisplay(desc.to_date)}
                          </TableCell>

                          {/* ORIGINAL AMOUNT */}
                          <TableCell align="right">
                            <Typography variant="body2">
                              ₹{originalAmount.toFixed(2)}
                            </Typography>
                          </TableCell>

                          <TableCell align="center">
                            {desc.tax_type === 'cgst_sgst' ? 'CGST/SGST' : 'IGST'}
                          </TableCell>
                          <TableCell align="right">{desc.tax_per?.toFixed(2)}%</TableCell>
                          <TableCell align="right">{desc.sgst?.toFixed(2)}</TableCell>
                          <TableCell align="right">{desc.cgst?.toFixed(2)}</TableCell>
                          <TableCell align="right">{desc.igst?.toFixed(2)}</TableCell>

                          {/* INDIVIDUAL DISCOUNT */}
                          <TableCell align="right">
                            {individualDiscountAmount > 0 ? (
                              <Box>
                                <Typography variant="body2">
                                  ₹{individualDiscountAmount.toFixed(2)}
                                </Typography>
                                {individualDiscountPercentage > 0 && (
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    ({individualDiscountPercentage.toFixed(2)}%)
                                  </Typography>
                                )}
                              </Box>
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                -
                              </Typography>
                            )}
                          </TableCell>

                          {/* OVERALL DISCOUNT (Distributed) */}
                          <TableCell align="right">
                            {overallDiscountAmount > 0 ? (
                              <Box>
                                <Typography variant="body2">
                                  ₹{overallDiscountAmount.toFixed(2)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" display="block">
                                  ({overallDiscountPercentage.toFixed(2)}%)
                                </Typography>
                                <Typography variant="caption" color="primary" display="block" fontSize="0.7rem">
                                  {overallDiscountAppliedOn === 'before_tax' ? 'Before Tax' : 'On Total'}
                                </Typography>
                              </Box>
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                -
                              </Typography>
                            )}
                          </TableCell>

                          {/* TOTAL DISCOUNT */}
                          <TableCell align="right">
                            <Box>
                              <Typography variant="body2" fontWeight="bold">
                                ₹{totalDiscountAmount.toFixed(2)}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" display="block">
                                ({totalDiscountPercentage.toFixed(2)}%)
                              </Typography>
                            </Box>
                          </TableCell>

                          {/* FINAL AMOUNT */}
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight="bold" color="success.main">
                              ₹{finalAmount.toFixed(2)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block">
                              {totalDiscountPercentage > 0 ? `-${totalDiscountPercentage.toFixed(2)}%` : ''}
                            </Typography>
                          </TableCell>

                          <TableCell align="right">
                            <IconButton onClick={() => handleEditDescription(index)} size="small">
                              <EditIcon />
                            </IconButton>
                            <IconButton onClick={() => handleDeleteDescription(index)} size="small">
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}

                  {/* TOTALS SECTION */}
                  <TableRow sx={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}>
                    <TableCell colSpan={7} align="right">
                      <strong>Totals:</strong>
                    </TableCell>

                    {/* Original Amount Total */}
                    <TableCell align="right">
                      <strong>₹{totalOriginalAmount.toFixed(2)}</strong>
                    </TableCell>

                    <TableCell colSpan={4} />

                    {/* Individual Discount Total */}
                    <TableCell align="right">
                      <Box>
                        <Typography variant="body2" fontWeight="bold">
                          ₹{(serviceData.desc_discount_amounts?.reduce((a, b) => a + b, 0) || 0).toFixed(2)}
                        </Typography>
                      </Box>
                    </TableCell>

                    {/* Overall Discount Total */}
                    <TableCell align="right">
                      <Box>
                        <Typography variant="body2" fontWeight="bold">
                          ₹{overallDiscountValue.toFixed(2)}
                        </Typography>
                        {overallDiscountValue > 0 && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {overallDiscountMode === 'percentage' ?
                              `${overallDiscountValue}%` :
                              `${((overallDiscountValue / totalOriginalAmount) * 100 || 0).toFixed(2)}%`
                            }
                          </Typography>
                        )}
                      </Box>
                    </TableCell>

                    {/* Total Discount */}
                    <TableCell align="right">
                      <Box>
                        <Typography variant="body2" fontWeight="bold" color="error.main">
                          ₹{totals.roundedTotalDiscount.toFixed(2)}
                        </Typography>
                      </Box>
                    </TableCell>

                    {/* Final Amount */}
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="bold" color="success.main">
                        ₹{totals.roundedTotalOrderAmount.toFixed(2)}
                      </Typography>
                    </TableCell>

                    <TableCell />
                  </TableRow>

                  {/* Service Totals Section */}
                  <TableRow sx={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}>
                    <TableCell colSpan={15} align="right">
                      <strong>Sub Total (Service):</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>{totals.subTotal.toFixed(2)}</strong>
                    </TableCell>
                    <TableCell />
                  </TableRow>

                  <TableRow sx={{ fontWeight: 'bold' }}>
                    <TableCell colSpan={15} align="right">
                      <strong>Total Service Tax:</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>{totals.taxAmount.toFixed(2)}</strong>
                    </TableCell>
                    <TableCell />
                  </TableRow>

                  {/* Overall Discount Control */}
                  <TableRow sx={{ fontWeight: 'bold' }}>
                    <TableCell colSpan={15} align="right">
                      <strong>Overall Discount:</strong>
                    </TableCell>
                    <TableCell align="right" colSpan={2}>
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
                          disabled={hasDescriptionWiseDiscount || loadingStates.totals}
                        />

                        <FormControl size="small" sx={{ minWidth: 100 }}>
                          <Select
                            value={overallDiscountMode}
                            onChange={(e) => setOverallDiscountMode(e.target.value as 'percentage' | 'amount')}
                            disabled={hasDescriptionWiseDiscount || loadingStates.totals}
                          >
                            <MenuItem value="percentage">Percentage</MenuItem>
                            <MenuItem value="amount">Amount</MenuItem>
                          </Select>
                        </FormControl>

                        <FormControl size="small" sx={{ minWidth: 100 }}>
                          <Select
                            value={overallDiscountAppliedOn}
                            onChange={(e) => {
                              setOverallDiscountAppliedOn(e.target.value as 'before_tax' | 'after_tax');
                            }}
                            disabled={hasDescriptionWiseDiscount || loadingStates.totals}
                          >
                            <MenuItem value="after_tax">On Total</MenuItem>
                            <MenuItem value="before_tax">Before Tax</MenuItem>
                          </Select>
                        </FormControl>

                        <Button
                          variant="contained"
                          size="small"
                          onClick={handleApplyDiscount}
                          disabled={loadingStates.description || overallDiscountValue <= 0 || descriptions.length === 0 || hasDescriptionWiseDiscount || loadingStates.totals}
                          startIcon={loadingStates.description ? <CircularProgress size={16} /> : null}
                        >
                          {loadingStates.description ? 'Applying...' : 'Apply'}
                        </Button>

                        <IconButton
                          onClick={handleClearOverallDiscount}
                          size="small"
                          color="error"
                          disabled={appliedOverallDiscount === 0 || loadingStates.totals} // Check APPLIED value
                          title="Clear overall discount"
                        >
                          <ClearIcon />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>

                  <TableRow sx={{ fontWeight: 'bold' }}>
                    <TableCell colSpan={15} align="right">
                      <strong>Total Service Discount:</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>{totals.overallDiscountAmount.toFixed(2)}</strong>
                    </TableCell>
                    <TableCell />
                  </TableRow>

                  {/* Freight Totals Section */}
                  <TableRow sx={{ backgroundColor: '#fff3e0', fontWeight: 'bold' }}>
                    <TableCell colSpan={15} align="right">
                      <strong>Freight Amount:</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>{freightSubTotal.toFixed(2)}</strong>
                    </TableCell>
                    <TableCell />
                  </TableRow>

                  <TableRow sx={{ backgroundColor: '#fff3e0', fontWeight: 'bold' }}>
                    <TableCell colSpan={15} align="right">
                      <strong>Freight Tax:</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>{freightTaxTotal.toFixed(2)}</strong>
                    </TableCell>
                    <TableCell />
                  </TableRow>

                  <TableRow sx={{ fontWeight: 'bold' }}>
                    <TableCell colSpan={15} align="right">
                      <strong>Total Tax (Service + Freight):</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>{totals.roundedTotalTax.toFixed(2)}</strong>
                    </TableCell>
                    <TableCell />
                  </TableRow>

                  <TableRow sx={{ fontWeight: 'bold' }}>
                    <TableCell colSpan={15} align="right">
                      <strong>Total Discount:</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>{totals.roundedTotalDiscount.toFixed(2)}</strong>
                    </TableCell>
                    <TableCell />
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
                          disabled={loadingStates.totals}
                        />
                        <Typography variant="body2">
                          ({roundOffValue >= 0 ? '+' : ''}{roundOffValue.toFixed(2)})
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell />
                  </TableRow>

                  <TableRow sx={{ bgcolor: '#e8f5e8' }}>
                    <TableCell colSpan={15} align="right">
                      <Typography variant="h6" fontWeight="bold">
                        FINAL AMOUNT:
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
                    <TableCell colSpan={14} />
                  </TableRow>

                  {/* Verification Row */}
                  {overallDiscountValue > 0 && (
                    <TableRow sx={{ backgroundColor: '#f0f8ff' }}>
                      <TableCell colSpan={8} align="center">
                        <Typography variant="caption" color="primary">
                          <InfoIcon fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                          Discount Distribution
                        </Typography>
                      </TableCell>
                      <TableCell colSpan={9} align="left">
                        <Box>
                          <Typography variant="caption">
                            Overall Discount Applied: ₹{overallDiscountValue} ({overallDiscountMode === 'percentage' ? '%' : 'amount'})
                          </Typography>
                          <br />
                          <Typography variant="caption">
                            Applied as: {overallDiscountMode === 'amount' ?
                              `${((overallDiscountValue / totalOriginalAmount) * 100 || 0).toFixed(2)}%` :
                              `${overallDiscountValue}%`} to each description
                          </Typography>
                          <br />
                          <Typography variant="caption">
                            Sum of distributed discounts: ₹{(serviceData.desc_overall_discounts?.reduce((a, b) => a + b, 0) || 0).toFixed(2)}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>

          {/* Freight Section */}
          <Box sx={{ mt: 3, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Freight Charges
                {loadingStates.totals && <CircularProgress size={16} sx={{ ml: 1 }} />}
              </Typography>
              <Button
                variant="outlined"
                color="primary"
                onClick={() => setOpenFreightDialog(true)}
                startIcon={<AddIcon />}
                disabled={loadingStates.totals}
              >
                Add Freight
              </Button>
            </Box>

            {freights.length > 0 ? (
              <TableContainer sx={{ maxHeight: 300, overflowY: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Freight Name</TableCell>
                      <TableCell align="right">Amount (₹)</TableCell>
                      <TableCell align="center">Tax Code</TableCell>
                      <TableCell align="center">Tax Type</TableCell>
                      <TableCell align="right">Tax (₹)</TableCell>
                      <TableCell align="right">Total (₹)</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {freights.map((freight: FreightData, index: number) => (
                      <TableRow key={index}>
                        <TableCell>{freight.name}</TableCell>
                        <TableCell align="right">{freight.amt.toFixed(2)}</TableCell>
                        <TableCell align="center">{freight.tCode}</TableCell>
                        <TableCell align="center">
                          {freight.taxType === 'cgst_sgst' ? 'CGST/SGST' : 'IGST'}
                        </TableCell>
                        <TableCell align="right">{freight.tAmt.toFixed(2)}</TableCell>
                        <TableCell align="right">{freight.totalAmt.toFixed(2)}</TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            onClick={() => setOpenFreightDialog(true)}
                            title="Edit Freight"
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteFreight(index)}
                            disabled={loadingStates.totals}
                            title="Delete Freight"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Freight Totals Row */}
                    <TableRow sx={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}>
                      <TableCell><strong>Freight Totals:</strong></TableCell>
                      <TableCell align="right"><strong>{freightSubTotal.toFixed(2)}</strong></TableCell>
                      <TableCell colSpan={2} />
                      <TableCell align="right"><strong>{freightTaxTotal.toFixed(2)}</strong></TableCell>
                      <TableCell align="right"><strong>{freightGrandTotal.toFixed(2)}</strong></TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No freight charges added.
              </Typography>
            )}
          </Box>

          {/* Additional Form Fields */}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={2} md={2}>
              <TextField
                fullWidth
                label="Sub Total (Service)"
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

            {/* Terms and Conditions */}
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
              disabled={loadingStates.submit || loadingStates.description || loadingStates.totals}
            >
              {isEditMode ? 'Update Service Order' : 'Submit Service Order'}
            </Button>
          </Grid>
        </Grid>
      </Box>

      {/* Dialogs */}
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
            disabled={loadingStates.submit || loadingStates.totals}
            startIcon={loadingStates.submit ? <CircularProgress size={20} /> : null}
          >
            {loadingStates.submit ? (isEditMode ? 'Updating...' : 'Submitting...') : (isEditMode ? 'Update' : 'Confirm')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openShippingDialog} onClose={() => {
        setOpenShippingDialog(false);
        setUpdatedShippingRow(null);
      }}>
        <DialogTitle>Add New Shipping Address</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Address"
            value={updatedShippingRow?.address || ''}
            onChange={(e) => setUpdatedShippingRow({
              ...updatedShippingRow!,
              address: e.target.value
            })}
            margin="normal"
            variant="outlined"
            autoComplete="off"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setOpenShippingDialog(false);
            setUpdatedShippingRow(null);
          }}>Cancel</Button>
          <Button onClick={() => {
            /* Implement save logic */
            setOpenShippingDialog(false);
            setUpdatedShippingRow(null);
          }} color="primary">
            Save
          </Button>
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

      <Backdrop sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, color: '#fff' }} open={loadingStates.description || loadingStates.totals || loadingStates.submit}>
        <CircularProgress color="inherit" />
      </Backdrop>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => dispatch(clearSnackbarMessage())}
        message={snackbarMessage}
      />

      {/* Freight Dialog */}
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