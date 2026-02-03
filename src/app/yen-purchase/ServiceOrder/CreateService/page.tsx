"use client";
import React, { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, TextField, Button, Typography, Grid, TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  Autocomplete, Snackbar, IconButton, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, RadioGroup,
  FormControlLabel, Radio, CircularProgress, Tooltip, Backdrop, Switch, FormControl, Select, MenuItem,
  Checkbox, // ADDED
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
import { usePermissions } from "@/hooks/usePermissions";
import Alert from "@mui/material/Alert";

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

// Helper function to convert flat arrays to descriptions - UPDATED WITH include_tax
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
    serviceData.include_tax?.length || 0, // NEW
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
      include_tax: serviceData.include_tax?.[i] !== undefined ? serviceData.include_tax[i] : true, // NEW
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
  const { hasPermission } = usePermissions();
const canAdd = hasPermission(
  "yenerp",
  "serviceorders_pending",
  "add"
);

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

  // Memoized selectors - UPDATED
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

  const [overallDiscountValue, setOverallDiscountValue] = useState<number>(0);
  const [appliedOverallDiscount, setAppliedOverallDiscount] = useState<number>(0);
  const [overallDiscountMode, setOverallDiscountMode] = useState<'percentage' | 'amount'>('percentage');
  const [appliedOverallDiscountMode, setAppliedOverallDiscountMode] = useState<'percentage' | 'amount'>('percentage');
  const [overallDiscountAppliedOn, setOverallDiscountAppliedOn] = useState<'before_tax' | 'after_tax'>('after_tax');
  const [appliedOverallDiscountAppliedOn, setAppliedOverallDiscountAppliedOn] = useState<'before_tax' | 'after_tax'>('after_tax');
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
  }, [serviceData.fees, appliedOverallDiscount, appliedOverallDiscountMode]);

  // UPDATED refreshTotals function with include_tax
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
      // Use APPLIED values for calculations
      const discountToUse = appliedOverallDiscount;
      const discountModeToUse = appliedOverallDiscountMode;
      const discountAppliedOnToUse = appliedOverallDiscountAppliedOn;

      // Call backend for complex calculations WITH APPLIED DISCOUNT VALUES AND include_tax
      const request: ServiceTotalsRequest = {
        descriptions: descriptions.map(desc => ({
          ...desc,
          fee: desc.fee,
          discount_percentage: desc.discount_percentage || 0,
          discount_amount: desc.discountAmount || 0,
          include_tax: desc.include_tax !== undefined ? desc.include_tax : true, // NEW
        })),
        overall_discount_value: discountToUse,
        overall_discount_type: discountModeToUse,
        overall_discount_applied_on: discountAppliedOnToUse,
        round_off: roundOffValue,
        fees_are_total_including_tax: true, // This is now deprecated, but kept for backward compatibility
        total_freight_amount: freightSubTotal,
        total_freight_tax: freightTaxTotal,
      };

      const result = await dispatch(calculateServiceTotals(request)).unwrap();

      // Update service data with calculated values
      const updates = {
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
        // Preserve include_tax array
        include_tax: serviceData.include_tax || descriptions.map(d => d.include_tax !== undefined ? d.include_tax : true),
      };

      dispatch(setServiceData(updates));

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
    appliedOverallDiscount,
    appliedOverallDiscountMode,
    appliedOverallDiscountAppliedOn,
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

    timeoutId = setTimeout(refreshIfNeeded, 300);

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [needsTotalsRefresh, refreshTotals]);

  // Load service data in edit mode - UPDATED
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
          parsedData.include_tax = parsedData.include_tax || []; // NEW

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

  // Initial data fetch - UPDATED
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
          include_tax: [], // NEW
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

  // Track form dirty state - UPDATED
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

  // Description change handlers - UPDATED with include_tax
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

  // NEW: Handle include_tax checkbox change
  const handleIncludeTaxChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    dispatch(setNewDescriptionData({
      ...newDescription,
      include_tax: checked
    }));
  }, [dispatch, newDescription]);

  // UPDATED: handleAddDescription with include_tax
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
        include_tax: newDescription.include_tax !== undefined ? newDescription.include_tax : true, // NEW
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
        include_tax: newDescription.include_tax !== undefined ? newDescription.include_tax : true, // NEW
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
        base_amount: newDescription.base_amount || 0,
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
        include_tax: true, // Default to true
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

    // SET THE APPLIED VALUES HERE
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

  // UPDATED: handleClear with include_tax
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
      include_tax: [], // NEW
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
      include_tax: true, // Default to true
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

  // UPDATED: handleSubmit with include_tax
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
        descriptions: descriptions.map(desc => desc.description),
        include_tax: descriptions.map(desc => desc.include_tax !== undefined ? desc.include_tax : true), // NEW
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
        desc_individual_discount_amounts: serviceData.desc_individual_discount_amounts || [],
        desc_individual_discount_percentages: serviceData.desc_individual_discount_percentages || [],
        desc_total_discount_amounts: serviceData.desc_total_discount_amounts || [],
        desc_total_discount_percentages: serviceData.desc_total_discount_percentages || [],
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

  // Calculate include_tax percentages
  const includeTaxCount = useMemo(() => 
    descriptions.filter(desc => desc.include_tax).length, [descriptions]
  );
  
  const excludeTaxCount = useMemo(() => 
    descriptions.filter(desc => !desc.include_tax).length, [descriptions]
  );

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

if (!canAdd) {
  return (
    <Alert severity="error">
       ❌ You don&apos;t have permission to create Service Orders

    </Alert>
  );
}


  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#ffffff' }}>
      {/* Main Content */}
      <Box sx={{ flex: 1, p: 3, overflowY: 'auto', maxHeight: 'calc(100vh - 64px)' }}>
        <Box sx={{
          width: '100%',
          maxWidth: {
            xs: '100%',
            sm: '100%',
            md: '1200px',
            lg: '1400px',
            xl: '1600px',
          },
          mx: 'auto',
          px: { xs: 2, sm: 3, md: 4 },
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

          {/* Tax Mode Summary */}
          <Box sx={{ mt: 2, mb: 2, p: 1.5, bgcolor: '#f8f9fa', borderRadius: 1, border: '1px solid #e0e0e0' }}>
            <Typography variant="subtitle2" fontWeight="bold" color="primary" gutterBottom>
              Tax Mode Summary
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Box sx={{ width: 12, height: 12, bgcolor: 'success.main', borderRadius: '50%', mr: 1 }} />
                  <Typography variant="body2">
                    Includes Tax: <strong>{includeTaxCount}</strong> descriptions
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Box sx={{ width: 12, height: 12, bgcolor: 'warning.main', borderRadius: '50%', mr: 1 }} />
                  <Typography variant="body2">
                    Excludes Tax: <strong>{excludeTaxCount}</strong> descriptions
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Note: &quot;Include Tax&quot; means the entered fee includes tax. &quot;Exclude Tax&quot; means tax will be calculated on top of the entered fee.

                </Typography>
              </Grid>
            </Grid>
          </Box>

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
              <Grid item xs={12} sm={1.8}>
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
              <Grid item xs={12} sm={2}>
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
              <Grid item xs={12} sm={1.8}>
                <TextField
                  fullWidth
                  label="Remarks"
                  name="remarks"
                  value={newDescription.remarks || ''}
                  onChange={handleDescriptionChange}
                  size="small"
                  autoComplete="off"
                  placeholder="Optional"
                />
              </Grid>

              {/* Quantity */}
              <Grid item xs={12} sm={1.2}>
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
              <Grid item xs={12} sm={1.5}>
                <SmartDatePicker
                  label="From Date"
                  value={newDescription.from_date ? parseDate(newDescription.from_date) : null}
                  onChange={(date) => handleDescriptionDateChange('from_date', date)}
                  minDate={serviceData.workOrderDate ? parseDate(serviceData.workOrderDate) : null}
                />
              </Grid>

              {/* To Date */}
              <Grid item xs={12} sm={1.5}>
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

              {/* Include Tax Checkbox - NEW */}
              <Grid item xs={12} sm={1.2}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={newDescription.include_tax !== undefined ? newDescription.include_tax : true}
                      onChange={handleIncludeTaxChange}
                      name="include_tax"
                      size="small"
                      sx={{ p: 0, '& .MuiSvgIcon-root': { fontSize: 20 } }}
                    />
                  }
                  label={
                    <Typography variant="caption" sx={{ fontSize: '0.75rem', lineHeight: 1.2 }}>
                      Fee includes tax
                    </Typography>
                  }
                  sx={{ m: 0, height: '100%', display: 'flex', alignItems: 'center' }}
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
                      label="Tax %"
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
              <Grid item xs={12} sm={1.8}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, height: '100%' }}>
                  <RadioGroup
                    row
                    value={newDescription.tax_type}
                    onChange={handleDescriptionTaxTypeChange}
                    sx={{ display: 'flex', alignItems: 'center', height: '100%' }}
                  >
                    <FormControlLabel 
                      value="igst" 
                      control={<Radio size="small" />} 
                      label={
                        <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                          IGST
                        </Typography>
                      } 
                    />
                    <FormControlLabel 
                      value="cgst_sgst" 
                      control={<Radio size="small" />} 
                      label={
                        <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                          CGST/SGST
                        </Typography>
                      } 
                    />
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
                        <Typography variant="body2">Fee (₹)</Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Tax inclusion mode">
                        <Typography variant="body2">Tax Mode</Typography>
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
                      <TableCell colSpan={20} align="center">No descriptions added</TableCell>
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

                      // Calculate amount after quantity
                      const amountAfterQuantity = desc.fee * desc.quantity;

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
                            <Tooltip title={`${desc.include_tax ? 'Includes tax' : 'Excludes tax'} | Quantity: ${desc.quantity}`}>
                              <Box>
                                <Typography variant="body2">
                                  ₹{desc.fee.toFixed(2)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" display="block">
                                  × {desc.quantity} = ₹{amountAfterQuantity.toFixed(2)}
                                </Typography>
                              </Box>
                            </Tooltip>
                          </TableCell>

                          {/* TAX MODE - NEW */}
                          <TableCell align="center">
                            <Tooltip title={desc.include_tax ? "Fee includes tax" : "Fee excludes tax"}>
                              <Box>
                                <Typography 
                                  variant="caption" 
                                  color={desc.include_tax ? "success.main" : "warning.main"} 
                                  fontWeight="bold"
                                >
                                  {desc.include_tax ? '✓ Includes' : '✗ Excludes'}
                                </Typography>
                              </Box>
                            </Tooltip>
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
                              <Tooltip title={`${individualDiscountPercentage.toFixed(2)}% discount`}>
                                <Box>
                                  <Typography variant="body2" color="error">
                                    -₹{individualDiscountAmount.toFixed(2)}
                                  </Typography>
                                  <Typography variant="caption" color="error">
                                    ({individualDiscountPercentage.toFixed(2)}%)
                                  </Typography>
                                </Box>
                              </Tooltip>
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                No discount
                              </Typography>
                            )}
                          </TableCell>

                          {/* OVERALL DISCOUNT */}
                          <TableCell align="right">
                            {overallDiscountAmount > 0 ? (
                              <Tooltip title="Overall distributed discount">
                                <Box>
                                  <Typography variant="body2" color="secondary">
                                    -₹{overallDiscountAmount.toFixed(2)}
                                  </Typography>
                                  <Typography variant="caption" color="secondary">
                                    ({overallDiscountPercentage.toFixed(2)}%)
                                  </Typography>
                                </Box>
                              </Tooltip>
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                No discount
                              </Typography>
                            )}
                          </TableCell>

                          {/* TOTAL DISCOUNT */}
                          <TableCell align="right">
                            {totalDiscountAmount > 0 ? (
                              <Tooltip title={`Individual + Overall discount = ${totalDiscountPercentage.toFixed(2)}%`}>
                                <Box>
                                  <Typography variant="body2" color="error" fontWeight="bold">
                                    -₹{totalDiscountAmount.toFixed(2)}
                                  </Typography>
                                  <Typography variant="caption" color="error">
                                    ({totalDiscountPercentage.toFixed(2)}%)
                                  </Typography>
                                </Box>
                              </Tooltip>
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                No discount
                              </Typography>
                            )}
                          </TableCell>

                          {/* FINAL AMOUNT */}
                          <TableCell align="right">
                            <Tooltip title="Final amount after all discounts and taxes">
                              <Box>
                                <Typography variant="body2" fontWeight="bold" color="primary">
                                  ₹{finalAmount.toFixed(2)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" display="block">
                                  {originalAmount > 0 ? 
                                    `${((finalAmount / originalAmount) * 100).toFixed(1)}% of original` : 
                                    'N/A'
                                  }
                                </Typography>
                              </Box>
                            </Tooltip>
                          </TableCell>

                          <TableCell align="right">
                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                              <Tooltip title="Edit description">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => handleEditDescription(index)}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete description">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleDeleteDescription(index)}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Exit Full Screen Button */}
            {isFullScreen && (
              <Box sx={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1000 }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={toggleFullScreen}
                  startIcon={<FullscreenExitIcon />}
                >
                  Exit Full Screen
                </Button>
              </Box>
            )}
          </Box>

          {/* Overall Discount Section */}
          <Box sx={{ mb: 3, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
            <Typography variant="h6" gutterBottom>
              Overall Discount
            </Typography>
            
            {hasDescriptionWiseDiscount && (
              <Box sx={{ mb: 2, p: 1.5, bgcolor: '#fff3e0', borderRadius: 1, border: '1px solid #ffb74d' }}>
                <Typography variant="body2" color="warning.dark">
                  ⚠️ Overall discount is disabled because some descriptions already have individual discounts. 
                  Please remove individual discounts first to apply an overall discount.
                </Typography>
              </Box>
            )}

            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={2}>
                <FormControl fullWidth size="small">
                  <Select
                    value={overallDiscountMode}
                    onChange={(e) => setOverallDiscountMode(e.target.value as 'percentage' | 'amount')}
                    disabled={hasDescriptionWiseDiscount || loadingStates.totals}
                  >
                    <MenuItem value="percentage">Percentage (%)</MenuItem>
                    <MenuItem value="amount">Amount (₹)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={2}>
                <TextField
                  fullWidth
                  label={`Discount ${overallDiscountMode === 'percentage' ? '%' : 'Amount (₹)'}`}
                  type="number"
                  value={overallDiscountValue === 0 ? '' : overallDiscountValue}
                  onChange={handleOverallDiscountChange}
                  size="small"
                  disabled={hasDescriptionWiseDiscount || loadingStates.totals}
                  inputProps={{
                    min: 0,
                    max: overallDiscountMode === 'percentage' ? 99.99 : totals.subTotal,
                    step: overallDiscountMode === 'percentage' ? 0.01 : 1,
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={3}>
                <FormControl fullWidth size="small">
                  <RadioGroup
                    row
                    value={overallDiscountAppliedOn}
                    onChange={(e) => setOverallDiscountAppliedOn(e.target.value as 'before_tax' | 'after_tax')}
                  >
                    <FormControlLabel
                      value="before_tax"
                      control={<Radio size="small" />}
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography variant="body2">Before Tax</Typography>
                          <Tooltip title="Discount applied on amount before tax calculation">
                            <InfoIcon fontSize="small" color="action" />
                          </Tooltip>
                        </Box>
                      }
                    />
                    <FormControlLabel
                      value="after_tax"
                      control={<Radio size="small" />}
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography variant="body2">After Tax</Typography>
                          <Tooltip title="Discount applied on amount after tax calculation">
                            <InfoIcon fontSize="small" color="action" />
                          </Tooltip>
                        </Box>
                      }
                    />
                  </RadioGroup>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={5}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleApplyDiscount}
                    disabled={
                      hasDescriptionWiseDiscount || 
                      overallDiscountValue <= 0 || 
                      descriptions.length === 0 ||
                      loadingStates.totals
                    }
                    startIcon={loadingStates.totals ? <CircularProgress size={16} /> : null}
                  >
                    {loadingStates.totals ? 'Calculating...' : 'Apply Discount'}
                  </Button>

                  <Button
                    variant="outlined"
                    color="error"
                    onClick={handleClearOverallDiscount}
                    disabled={appliedOverallDiscount <= 0 || loadingStates.totals}
                  >
                    Clear Discount
                  </Button>

                  {appliedOverallDiscount > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', ml: 2 }}>
                      <Typography variant="body2" color="success.main" fontWeight="bold">
                        Applied: {appliedOverallDiscount}
                        {appliedOverallDiscountMode === 'percentage' ? '%' : '₹'}
                        {' '}on {appliedOverallDiscountAppliedOn === 'before_tax' ? 'Before Tax' : 'After Tax'}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Grid>
            </Grid>
          </Box>

          {/* Freight Section */}
          <Box sx={{ mb: 3, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Freight Details</Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setOpenFreightDialog(true)}
              >
                Add Freight
              </Button>
            </Box>

            {freights.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Freight Name</TableCell>
                      <TableCell align="right">Amount (₹)</TableCell>
                      <TableCell align="center">Tax Type</TableCell>
                      <TableCell align="right">Tax %</TableCell>
                      <TableCell align="right">Tax Amount (₹)</TableCell>
                      <TableCell align="right">Total Amount (₹)</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {freights.map((freight, index) => (
                      <TableRow key={freight.id || index}>
                        <TableCell>{freight.name}</TableCell>
                        <TableCell align="right">₹{freight.amt?.toFixed(2)}</TableCell>
                        <TableCell align="center">
                          {freight.taxType === 'cgst_sgst' ? 'CGST/SGST' : 'IGST'}
                        </TableCell>
                        <TableCell align="right">{freight.taxPercentage}%</TableCell>
                        <TableCell align="right">₹{freight.tAmt?.toFixed(2)}</TableCell>
                        <TableCell align="right">₹{freight.totalAmt?.toFixed(2)}</TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteFreight(index)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                      <TableCell colSpan={5} align="right">
                        <Typography fontWeight="bold">Freight Totals:</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold">₹{freightGrandTotal.toFixed(2)}</Typography>
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary" align="center" py={2}>
                No freight added
              </Typography>
            )}
          </Box>

          {/* Round Off and Totals Section */}
          <Box sx={{ mb: 3, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                    Round Off
                  </Typography>
                  <TextField
                    fullWidth
                    label="Round Off Amount (₹)"
                    type="number"
                    value={roundOffValue === 0 ? '' : roundOffValue}
                    onChange={handleRoundOffChange}
                    size="small"
                    helperText="Positive value adds to total, negative value subtracts"
                    sx={{ maxWidth: 300 }}
                  />
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box sx={{ p: 2, bgcolor: '#f8f9fa', borderRadius: 1 }}>
                  <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                    Order Summary
                  </Typography>
                  
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Subtotal:</Typography>
                      <Typography variant="body2">₹{totals.subTotal.toFixed(2)}</Typography>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Total Freight:</Typography>
                      <Typography variant="body2">₹{freightGrandTotal.toFixed(2)}</Typography>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Total Tax:</Typography>
                      <Typography variant="body2">₹{totals.roundedTotalTax.toFixed(2)}</Typography>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="error">
                        Total Discount:
                      </Typography>
                      <Typography variant="body2" color="error">
                        -₹{totals.roundedTotalDiscount.toFixed(2)}
                      </Typography>
                    </Box>

                    {roundOffValue !== 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color={roundOffValue > 0 ? "success.main" : "error"}>
                          Round Off:
                        </Typography>
                        <Typography variant="body2" color={roundOffValue > 0 ? "success.main" : "error"}>
                          {roundOffValue > 0 ? '+' : ''}₹{roundOffValue.toFixed(2)}
                        </Typography>
                      </Box>
                    )}

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, pt: 1, borderTop: '1px solid #e0e0e0' }}>
                      <Typography variant="body1" fontWeight="bold">
                        Grand Total:
                      </Typography>
                      <Typography variant="body1" fontWeight="bold" color="primary">
                        ₹{totals.roundedTotalOrderAmount.toFixed(2)}
                      </Typography>
                    </Box>

                    {totals.roundedTotalOrderAmount > serviceData.creditLimit && (
                      <Box sx={{ mt: 1, p: 1, bgcolor: '#ffebee', borderRadius: 1, border: '1px solid #f44336' }}>
                        <Typography variant="caption" color="error" fontWeight="bold">
                          ⚠️ Order amount exceeds credit limit of ₹{serviceData.creditLimit}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Box>

          {/* Additional Details Section */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>Additional Details</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Shipping Address"
                  name="shippingAddress"
                  value={serviceData.shippingAddress}
                  onChange={handleTextFieldChange}
                  size="small"
                  error={formErrors.shippingAddress}
                  helperText={formErrors.shippingAddress ? 'Shipping address is required' : ''}
                  multiline
                  rows={2}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Billing Address"
                  name="billingAddress"
                  value={serviceData.billingAddress}
                  onChange={handleTextFieldChange}
                  size="small"
                  error={formErrors.billingAddress}
                  helperText={formErrors.billingAddress ? 'Billing address is required' : ''}
                  multiline
                  rows={2}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <LocationAutocomplete
                  value={locationSearch}
                  onChange={handleLocationChange}
                  label="Location *"
                  error={formErrors.locationName}
                  helperText={formErrors.locationName ? 'Location is required' : ''}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Comments"
                  name="comments"
                  value={serviceData.comments || ''}
                  onChange={handleTextFieldChange}
                  size="small"
                  multiline
                  rows={2}
                  placeholder="Any additional comments or notes"
                />
              </Grid>
            </Grid>
          </Box>

          {/* Terms and Conditions Section */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Terms and Conditions</Typography>
              {serviceData.termsandConditions.length < 3 && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={handleAddTerm}
                >
                  Add Term
                </Button>
              )}
            </Box>

            {serviceData.termsandConditions.map((term, index) => (
              <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <TextField
                  fullWidth
                  label={`Term ${index + 1}`}
                  value={term}
                  onChange={(e) => handleTextFieldChange(e, index)}
                  size="small"
                  multiline
                  rows={1}
                  placeholder="Enter a term or condition"
                />
                {index > 0 && (
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleRemoveTerm(index)}
                  >
                    <RemoveIcon />
                  </IconButton>
                )}
              </Box>
            ))}
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3, pt: 2, borderTop: '1px solid #e0e0e0' }}>
            <Box>
              <Button
                variant="outlined"
                color="error"
                onClick={handleClear}
                disabled={loadingStates.submit}
              >
                Clear All
              </Button>
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleOpenDialog}
                disabled={descriptions.length === 0 || loadingStates.submit}
                startIcon={loadingStates.submit ? <CircularProgress size={20} /> : null}
              >
                {loadingStates.submit ? 'Processing...' : (isEditMode ? 'Update Service Order' : 'Create Service Order')}
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Freight Selection Dialog */}
          <FreightSelectionDialog
        open={openFreightDialog}
        onClose={() => setOpenFreightDialog(false)}
        onAddFreights={handleAddFreights}
        existingFreights={freights}
      />


      {/* Confirmation Dialog */}
      <Dialog
        open={open}
        onClose={() => setDialogOpen(false)}
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <DialogTitle id="confirm-dialog-title">
          {isHoldOrderDialog ? 'Credit Limit Exceeded' : 'Confirm Service Order'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="confirm-dialog-description">
            {isHoldOrderDialog ? (
              <>
                The order amount of <strong>₹{totals.roundedTotalOrderAmount.toFixed(2)}</strong> exceeds the vendor&apos;s credit limit of <strong>₹{serviceData.creditLimit}</strong>.
                <br /><br />
                This order will be marked as <strong>HOLD</strong> and will require approval before processing.
              </>
            ) : (
              `Are you sure you want to ${isEditMode ? 'update' : 'create'} this service order?`
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} color="primary">
            Cancel
          </Button>
          <Button onClick={handleSubmit} color="primary" variant="contained" autoFocus>
            {isHoldOrderDialog ? 'Create Hold Order' : (isEditMode ? 'Update' : 'Create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Navigation Confirmation Dialog */}
      <Dialog
        open={showNavigationConfirm}
        onClose={() => setShowNavigationConfirm(false)}
      >
        <DialogTitle>Unsaved Changes</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You have unsaved changes. Are you sure you want to leave?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNavigationConfirm(false)}>
            Stay
          </Button>
          <Button onClick={() => {
            if (pendingNavigation) {
              pendingNavigation();
            }
            setShowNavigationConfirm(false);
          }} color="error" autoFocus>
            Leave
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => dispatch(setSnackbarOpen(false))}
        message={snackbarMessage}
        action={
          <IconButton
            size="small"
            color="inherit"
            onClick={() => dispatch(setSnackbarOpen(false))}
          >
            <ClearIcon fontSize="small" />
          </IconButton>
        }
      />

      {/* Loading Backdrop */}
      <Backdrop
        open={loadingStates.submit}
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <CircularProgress color="inherit" />
      </Backdrop>
    </Box>
  );
};

export default CreateServicePage;