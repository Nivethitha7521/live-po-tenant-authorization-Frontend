'use client';
import React, { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, TextField, Button, Typography, Grid, TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  Autocomplete, Snackbar, IconButton, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, RadioGroup,
  FormControlLabel, Radio, CircularProgress, Tooltip, Backdrop, Switch, FormControl, Select, MenuItem,
  Alert
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import ClearIcon from '@mui/icons-material/Clear';
import InfoIcon from '@mui/icons-material/Info';
import {
  addService, fetchServices, selectServiceState, setServiceData,
  setNewDescriptionData, addDescriptionToService, setSnackbarMessage, clearSnackbarMessage, setSnackbarOpen,
  setDescriptionForEditing, clearDescriptionForEditing, deleteDescriptionFromService,
  setReduxTotals, fetchServiceById, updateService, calculateServiceTotals,
  updateDescription, clearCalculatedTotals
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

// Helper functions
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

const generateUniqueId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

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
      totalFee: serviceData.desc_totals?.[i] || 0,
      finalFee: serviceData.base_amounts?.[i] || 0,
      discountAmount: serviceData.desc_discount_amounts?.[i] || 0,
      discount_percentage: serviceData.desc_discount_percentages?.[i] || 0,
      discount_amount: serviceData.desc_discount_amounts?.[i] || 0,
      remarks: serviceData.remarks?.[i] || '',
      base_amount: serviceData.base_amounts?.[i] || 0,
      include_tax: serviceData.include_tax?.[i] ?? true,
      fee_with_tax: serviceData.fees?.[i] || 0,
    });
  }
  return descriptions;
};

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

  const { serviceData, newDescription, snackbarOpen, snackbarMessage, serviceTotalsLoading } = useSelector(selectServiceState);
  const { businesses, shippingaddress } = useSelector(selectBusinesses);
  const { location: locations } = useSelector(selectStorageLocations);
  const { items: taxItems } = useSelector((state: RootState) => state.purchaseTax);
  const { vendors } = useSelector(selectPurchaseOrderState);

  const descriptions = useMemo(() =>
    getDescriptionsFromFlatArrays(serviceData),
    [serviceData]
  );

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

  const [loadingStates, setLoadingStates] = useState({
    totals: false,
    submit: false,
    description: false,
    initial: false,
  });

  const [isFormDirty, setIsFormDirty] = useState(false);
  const [needsTotalsRefresh, setNeedsTotalsRefresh] = useState(false);
  const refreshScheduled = useRef(false);

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

  const [selectedService, setSelectedService] = useState<ServiceSummary | null>(null);
  const [vendorSearch, setVendorSearch] = useState<VendorSummary | null>(null);
  const [locationSearch, setLocationSearch] = useState<Location | null>(null);

  const [showNavigationConfirm, setShowNavigationConfirm] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const [isHoldOrderDialog, setIsHoldOrderDialog] = useState(false);

  // ===== DISCOUNT STATE =====
  const [overallDiscountValue, setOverallDiscountValue] = useState<number>(0);
  const [overallDiscountMode, setOverallDiscountMode] = useState<'percentage' | 'amount'>('percentage');
  const [overallDiscountAppliedOn, setOverallDiscountAppliedOn] = useState<'before_tax' | 'after_tax'>('after_tax');
  const [roundOffValue, setRoundOffValue] = useState<number>(0);
  
  // Temporary state for round off input (to avoid applying on every keystroke)
  const [roundOffInputValue, setRoundOffInputValue] = useState<string>('0');

  const descriptionRef = useRef<HTMLInputElement | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [servicesList] = useState<ServiceSummary[]>([]);

  const [freights, setFreights] = useState<FreightData[]>([]);
  const [openFreightDialog, setOpenFreightDialog] = useState(false);

  // INCLUDE TAX STATE
  const [includeTax, setIncludeTax] = useState(true);
  const [baseAmount, setBaseAmount] = useState(0);
  const [feeWithTax, setFeeWithTax] = useState(0);

  // ===== CHECK IF INDIVIDUAL DISCOUNTS EXIST =====
  const hasIndividualDiscounts = useMemo(() => {
    return descriptions.some(desc => (desc.discountAmount || 0) > 0);
  }, [descriptions]);

  // ===== WARNING MESSAGE WHEN BOTH DISCOUNTS EXIST =====
  const showDiscountConflictWarning = useMemo(() => {
    return hasIndividualDiscounts && overallDiscountValue > 0;
  }, [hasIndividualDiscounts, overallDiscountValue]);

  const freightSubTotal = useMemo(() =>
    freights.reduce((sum, f) => sum + (f.amt || 0), 0), [freights]
  );

  const freightTaxTotal = useMemo(() =>
    freights.reduce((sum, f) => sum + (f.tAmt || 0), 0), [freights]
  );

  const freightGrandTotal = useMemo(() =>
    freightSubTotal + freightTaxTotal, [freightSubTotal, freightTaxTotal]
  );

  // ===== REFRESH TOTALS FUNCTION =====
  const refreshTotals = useCallback(async (isMounted: boolean = true) => {
    if (!isMounted) return;

    if (descriptions.length === 0) {
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
      setNeedsTotalsRefresh(false);
      return;
    }

    refreshScheduled.current = false;
    setLoadingStates(prev => ({ ...prev, totals: true }));

    try {
      // Even if individual discounts exist, we still send the overall discount value
      // The backend should handle ignoring it if needed
      const effectiveOverallDiscount = overallDiscountValue;

      const request: ServiceTotalsRequest = {
        descriptions: descriptions.map(desc => ({
          id: desc.id || '',
          sacCode: desc.sacCode || '',
          description: desc.description,
          from_date: desc.from_date || null,
          to_date: desc.to_date || null,
          remarks: desc.remarks || '',
          quantity: desc.quantity || 1,
          fee: desc.fee,
          fee_with_tax: desc.fee,
          base_amount: desc.base_amount,
          include_tax: desc.include_tax ?? true,
          tax_type: desc.tax_type,
          tax_per: desc.tax_per || 0,
          sgst: desc.sgst || 0,
          cgst: desc.cgst || 0,
          igst: desc.igst || 0,
          total: desc.total || 0,
          taxAmount: desc.taxAmount || 0,
          totalFee: desc.totalFee || 0,
          finalFee: desc.finalFee || 0,
          discountAmount: desc.discountAmount || 0,
          discount_percentage: desc.discount_percentage || 0,
          discount_amount: desc.discount_amount || 0,
        })),
        overall_discount_value: effectiveOverallDiscount,
        overall_discount_type: overallDiscountMode,
        overall_discount_applied_on: overallDiscountAppliedOn,
        round_off: roundOffValue,
        fees_are_total_including_tax: true,
        total_freight_amount: freightSubTotal,
        total_freight_tax: freightTaxTotal,
      };

      const result = await dispatch(calculateServiceTotals(request)).unwrap();

      setTotals({
        subTotal: result.totalFees || 0,
        taxAmount: result.totalTax || 0,
        overallDiscountAmount: result.totalDiscount || 0,
        roundedTotalOrderAmount: result.totalAmount || 0,
        roundedTotalTax: result.totalTax || 0,
        roundedTotalDiscount: result.totalDiscount || 0,
        freightAmountTotal: result.totalFreightAmount || 0,
        freightTaxTotal: result.totalFreightTaxAmount || 0,
        afterDiscount: (result.totalFees || 0) - (result.totalDiscount || 0),
      });

      const updatedServiceData = {
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
        totalFees: result.totalFees || 0,
        totalTax: result.totalTax || 0,
        totalDiscount: result.totalDiscount || 0,
        totalAmount: result.totalAmount || 0,
      };

      dispatch(setServiceData(updatedServiceData));

    } catch (error) {
      console.error('❌ Error refreshing totals:', error);
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
  }, [descriptions, overallDiscountValue, overallDiscountMode, overallDiscountAppliedOn,
      roundOffValue, dispatch, freightSubTotal, freightTaxTotal, serviceData]);

  // ===== EFFECTS =====
  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout | null = null;

    const refreshIfNeeded = () => {
      if (!isMounted || !needsTotalsRefresh) return;
      refreshTotals(isMounted);
    };

    if (needsTotalsRefresh) {
      timeoutId = setTimeout(refreshIfNeeded, 300);
    }

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      refreshScheduled.current = false;
    };
  }, [needsTotalsRefresh, refreshTotals]);

  useEffect(() => {
    if (descriptions.length > 0 || freights.length > 0) {
      if (!refreshScheduled.current) {
        refreshScheduled.current = true;
        setNeedsTotalsRefresh(true);
      }
    }
  }, [descriptions.length, freights.length]);

  useEffect(() => {
    if (isEditMode && editId) {
      setLoadingStates(prev => ({ ...prev, initial: true }));
      const loadService = async () => {
        try {
          const data = await dispatch(fetchServiceById(editId)).unwrap();
          dispatch(setServiceData(data));
          setFreights(data.freights || []);

          if (data.overallDiscountValue !== undefined)
            setOverallDiscountValue(data.overallDiscountValue);
          if (data.roundOffValue !== undefined) {
            setRoundOffValue(data.roundOffValue);
            setRoundOffInputValue(data.roundOffValue.toString());
          }

          setTotals({
            subTotal: data.totalFees || 0,
            taxAmount: data.totalTax || 0,
            overallDiscountAmount: data.totalDiscount || 0,
            afterDiscount: (data.totalFees || 0) - (data.totalDiscount || 0),
            freightAmountTotal: data.totalFreightAmount || 0,
            freightTaxTotal: data.totalFreightTaxAmount || 0,
            roundedTotalTax: (data.totalTax || 0) + (data.totalFreightTaxAmount || 0),
            roundedTotalDiscount: data.totalDiscount || 0,
            roundedTotalOrderAmount: data.totalAmount || 0
          });

          setNeedsTotalsRefresh(false);

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

  useEffect(() => {
    let isMounted = true;
    const initializeData = async () => {
      try {
        await Promise.all([
          dispatch(fetchBusinesses()),
          dispatch(fetchShipping()),
          dispatch(fetchLocations()),
          dispatch(fetchPurchaseTaxes()),
        ]);
        if (!isMounted || isEditMode) return;
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
          base_amounts: [],
          desc_discount_amounts: [],
          desc_overall_discounts: [],
          include_tax: [],
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
        if (shippingaddress.length > 0) {
          updates.shippingAddress = shippingaddress[2]?.address ?? '';
        }
        if (businesses.length === 1) {
          updates.billingAddress = `${businesses[0].address1 ?? ''} ${businesses[0].address2 ?? ''}`.trim();
        }
        dispatch(setServiceData(updates as ServiceData));
        setRoundOffInputValue('0');
        setFreights([]);
      } catch (error) {
        console.error('Error initializing data:', error);
      }
    };
    initializeData();
    return () => { isMounted = false; };
  }, [dispatch, isEditMode]);

  useEffect(() => {
    const trackFormState = () => {
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
  }, [serviceData, descriptions, overallDiscountValue, roundOffValue, freights]);

  useBeforeUnload(isFormDirty, 'You have unsaved changes. Are you sure you want to leave?');

  // ===== INCLUDE TAX HANDLERS =====
  const handleIncludeTaxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newIncludeTax = event.target.checked;

    if (newIncludeTax) {
      // Switching to INCLUDE TAX mode
      if (baseAmount > 0) {
        const calculatedFeeWithTax = newDescription.tax_per > 0
          ? baseAmount * (1 + (newDescription.tax_per / 100))
          : baseAmount;
        setFeeWithTax(parseFloat(calculatedFeeWithTax.toFixed(2)));

        dispatch(setNewDescriptionData({
          ...newDescription,
          include_tax: true,
          fee: parseFloat(calculatedFeeWithTax.toFixed(2)),
          fee_with_tax: parseFloat(calculatedFeeWithTax.toFixed(2)),
          base_amount: baseAmount,
        }));
      } else {
        dispatch(setNewDescriptionData({
          ...newDescription,
          include_tax: true,
        }));
      }
    } else {
      // Switching to EXCLUDE TAX mode
      if (feeWithTax > 0) {
        const calculatedBase = newDescription.tax_per > 0
          ? feeWithTax / (1 + (newDescription.tax_per / 100))
          : feeWithTax;
        setBaseAmount(parseFloat(calculatedBase.toFixed(2)));

        dispatch(setNewDescriptionData({
          ...newDescription,
          include_tax: false,
          base_amount: parseFloat(calculatedBase.toFixed(2)),
          fee: feeWithTax,
          fee_with_tax: feeWithTax,
        }));
      } else {
        dispatch(setNewDescriptionData({
          ...newDescription,
          include_tax: false,
        }));
      }
    }

    setIncludeTax(newIncludeTax);
  };

  const handleFeeWithTaxChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d{0,8}(\.\d{0,2})?$/.test(value) || value === '') {
      const parsedValue = value === '' ? 0 : parseFloat(value) || 0;
      setFeeWithTax(parsedValue);

      let calculatedBase = parsedValue;
      if (newDescription.tax_per > 0) {
        calculatedBase = parsedValue / (1 + (newDescription.tax_per / 100));
      }
      setBaseAmount(parseFloat(calculatedBase.toFixed(2)));

      dispatch(setNewDescriptionData({
        ...newDescription,
        fee: parsedValue,
        fee_with_tax: parsedValue,
        base_amount: parseFloat(calculatedBase.toFixed(2)),
        include_tax: true,
      }));
      setErrors(prev => ({ ...prev, fee: false }));
    }
  };

  const handleBaseAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d{0,8}(\.\d{0,2})?$/.test(value) || value === '') {
      const parsedValue = value === '' ? 0 : parseFloat(value) || 0;
      setBaseAmount(parsedValue);

      let calculatedFeeWithTax = parsedValue;
      if (newDescription.tax_per > 0) {
        calculatedFeeWithTax = parsedValue * (1 + (newDescription.tax_per / 100));
      }
      setFeeWithTax(parseFloat(calculatedFeeWithTax.toFixed(2)));

      dispatch(setNewDescriptionData({
        ...newDescription,
        base_amount: parsedValue,
        fee: parseFloat(calculatedFeeWithTax.toFixed(2)),
        fee_with_tax: parseFloat(calculatedFeeWithTax.toFixed(2)),
        include_tax: false,
      }));
      setErrors(prev => ({ ...prev, fee: false }));
    }
  };

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
  }, [dispatch, serviceData]);

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
      case 'taxPer':
        if (/^\d{0,2}(\.\d{0,2})?$/.test(value) || value === '') {
          const parsedValue = value === '' ? 0 : parseFloat(value) || 0;
          if (parsedValue > 99.99) {
            dispatch(setSnackbarMessage('Tax percentage cannot exceed 99.99%'));
            dispatch(setSnackbarOpen(true));
            return;
          }
          dispatch(setNewDescriptionData({ ...newDescription, tax_per: parsedValue }));

          if (includeTax && feeWithTax > 0) {
            const taxRate = 1 + (parsedValue / 100);
            const calculatedBase = feeWithTax / taxRate;
            setBaseAmount(parseFloat(calculatedBase.toFixed(2)));
          } else if (!includeTax && baseAmount > 0) {
            const taxAmount = baseAmount * (parsedValue / 100);
            const calculatedFeeWithTax = baseAmount + taxAmount;
            setFeeWithTax(parseFloat(calculatedFeeWithTax.toFixed(2)));
          }

          setErrors(prev => ({ ...prev, taxPer: false }));
        }
        break;
    }
  }, [dispatch, newDescription, includeTax, feeWithTax, baseAmount]);

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

  // ===== FIXED: Add Description Handler =====
  const handleAddDescription = useCallback(async () => {
    const editingIndex = (newDescription as any).index;
    const isCurrentlyEditing = editingIndex !== undefined && editingIndex >= 0;

    // Check for discount conflict - WARN only, don't block
    if (overallDiscountValue > 0 && (newDescription as any).discountAmount > 0) {
      dispatch(setSnackbarMessage('Warning: Adding individual discount while overall discount exists'));
      dispatch(setSnackbarOpen(true));
      // Continue with adding description
    }

    // Validation
    if (!newDescription.description?.trim()) {
      setErrors(prev => ({ ...prev, description: true }));
      dispatch(setSnackbarMessage('Description is required'));
      dispatch(setSnackbarOpen(true));
      return;
    }

    if (!newDescription.quantity || newDescription.quantity < 1) {
      setErrors(prev => ({ ...prev, quantity: true }));
      dispatch(setSnackbarMessage('Quantity must be at least 1'));
      dispatch(setSnackbarOpen(true));
      return;
    }

    if (includeTax) {
      if (!feeWithTax || feeWithTax <= 0) {
        setErrors(prev => ({ ...prev, fee: true }));
        dispatch(setSnackbarMessage('Fee (with tax) must be greater than 0'));
        dispatch(setSnackbarOpen(true));
        return;
      }
    } else {
      if (!baseAmount || baseAmount <= 0) {
        setErrors(prev => ({ ...prev, fee: true }));
        dispatch(setSnackbarMessage('Base amount (without tax) must be greater than 0'));
        dispatch(setSnackbarOpen(true));
        return;
      }
    }

    setLoadingStates(prev => ({ ...prev, description: true }));

    try {
      const quantity = newDescription.quantity || 1;

      // Calculate PER UNIT VALUES
      let feePerUnit: number;
      let basePerUnit: number;

      if (includeTax) {
        feePerUnit = feeWithTax;
        basePerUnit = newDescription.tax_per > 0
          ? feeWithTax / (1 + (newDescription.tax_per / 100))
          : feeWithTax;
      } else {
        basePerUnit = baseAmount;
        feePerUnit = newDescription.tax_per > 0
          ? baseAmount * (1 + (newDescription.tax_per / 100))
          : baseAmount;
      }

      feePerUnit = Number(feePerUnit.toFixed(2));
      basePerUnit = Number(basePerUnit.toFixed(2));

      // Calculate LINE TOTALS
      const lineTotalWithTax = feePerUnit * quantity;
      const lineBaseWithoutTax = basePerUnit * quantity;
      const lineTaxAmount = lineTotalWithTax - lineBaseWithoutTax;

      // Split tax
      let sgst = 0, cgst = 0, igst = 0;
      if (newDescription.tax_type === 'cgst_sgst') {
        sgst = parseFloat((lineTaxAmount / 2).toFixed(2));
        cgst = parseFloat((lineTaxAmount / 2).toFixed(2));
      } else {
        igst = parseFloat(lineTaxAmount.toFixed(2));
      }

      // Create description object
      const newDescWithId: ServiceDescription = {
        id: isCurrentlyEditing ? newDescription.id : generateUniqueId(),
        sacCode: newDescription.sacCode || '',
        description: newDescription.description.trim(),
        from_date: newDescription.from_date || null,
        to_date: newDescription.to_date || null,
        remarks: newDescription.remarks || '',
        fee: feePerUnit,
        base_amount: basePerUnit,
        fee_with_tax: feePerUnit,
        include_tax: includeTax,
        tax_type: newDescription.tax_type,
        tax_per: newDescription.tax_per || 0,
        total: Number(lineTotalWithTax.toFixed(2)),
        taxAmount: Number(lineTaxAmount.toFixed(2)),
        totalFee: Number(lineBaseWithoutTax.toFixed(2)),
        finalFee: Number(lineBaseWithoutTax.toFixed(2)),
        sgst: sgst,
        cgst: cgst,
        igst: igst,
        discountAmount: 0,
        discount_percentage: 0,
        discount_amount: 0,
        quantity: quantity,
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

      dispatch(setSnackbarOpen(true));

      // Reset form
      dispatch(setNewDescriptionData({
        id: '',
        sacCode: '',
        description: '',
        from_date: null,
        to_date: null,
        fee: 0,
        fee_with_tax: 0,
        base_amount: 0,
        include_tax: true,
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

      setIncludeTax(true);
      setFeeWithTax(0);
      setBaseAmount(0);
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

      setTimeout(() => {
        setNeedsTotalsRefresh(true);
      }, 100);

    } catch (error) {
      console.error('❌ Add/Update description error:', error);
      dispatch(setSnackbarMessage('Failed to save description. Please try again.'));
      dispatch(setSnackbarOpen(true));
    } finally {
      setLoadingStates(prev => ({ ...prev, description: false }));
    }
  }, [
    dispatch,
    newDescription,
    includeTax,
    feeWithTax,
    baseAmount,
    overallDiscountValue
  ]);

  const handleAddFreights = useCallback((newFreights: FreightData[]) => {
    setFreights(newFreights);
    if (!refreshScheduled.current) {
      refreshScheduled.current = true;
      setNeedsTotalsRefresh(true);
    }
  }, []);

  const handleDeleteFreight = useCallback((index: number) => {
    setFreights(prev => prev.filter((_, i) => i !== index));
    if (!refreshScheduled.current) {
      refreshScheduled.current = true;
      setNeedsTotalsRefresh(true);
    }
  }, []);

  const handleEditDescription = useCallback((index: number) => {
    const desc = descriptions[index];
    if (desc) {
      setIncludeTax(desc.include_tax ?? true);
      setFeeWithTax(desc.fee || 0);
      setBaseAmount(desc.base_amount || 0);

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
    if (!refreshScheduled.current) {
      refreshScheduled.current = true;
      setNeedsTotalsRefresh(true);
    }
  }, [dispatch]);

  // ===== FIXED: Overall Discount Handler - Now always editable =====
  const handleOverallDiscountChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d{0,6}(\.\d{0,2})?$/.test(value)) {
      const parsedValue = value === '' ? 0 : parseFloat(value) || 0;

      // Validate max discount (only warning, not blocking)
      let maxDiscount;
      if (overallDiscountMode === 'percentage') {
        maxDiscount = 99.99;
      } else {
        maxDiscount = totals.roundedTotalOrderAmount;
      }

      if (parsedValue > maxDiscount) {
        dispatch(setSnackbarMessage(
          `Warning: Discount ${parsedValue}${overallDiscountMode === 'percentage' ? '%' : '₹'} exceeds maximum allowed ${maxDiscount.toFixed(2)}${overallDiscountMode === 'percentage' ? '%' : '₹'}`
        ));
        dispatch(setSnackbarOpen(true));
        // Still set the value (user can override)
      }

      setOverallDiscountValue(parsedValue);
    }
  }, [overallDiscountMode, totals.roundedTotalOrderAmount, dispatch]);

  // ===== FIXED: Handle discount mode change with value conversion =====
  const handleDiscountModeChange = useCallback((e: any) => {
    const newMode = e.target.value as 'percentage' | 'amount';
    
    // Convert the discount value when switching modes
    if (overallDiscountValue > 0 && descriptions.length > 0) {
      const subtotal = totals.subTotal;
      
      if (newMode === 'percentage' && overallDiscountMode === 'amount') {
        // Convert from amount to percentage
        const newPercentage = (overallDiscountValue / subtotal) * 100;
        setOverallDiscountValue(parseFloat(newPercentage.toFixed(2)));
      } else if (newMode === 'amount' && overallDiscountMode === 'percentage') {
        // Convert from percentage to amount
        const newAmount = (overallDiscountValue / 100) * subtotal;
        setOverallDiscountValue(parseFloat(newAmount.toFixed(2)));
      }
    }
    
    setOverallDiscountMode(newMode);
    
    // Trigger totals refresh
    if (!refreshScheduled.current) {
      refreshScheduled.current = true;
      setNeedsTotalsRefresh(true);
    }
  }, [overallDiscountMode, overallDiscountValue, descriptions.length, totals.subTotal]);

  const handleApplyDiscount = useCallback(async () => {
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

    setNeedsTotalsRefresh(true);

    dispatch(setSnackbarMessage(
      `Successfully applied ${overallDiscountValue}${overallDiscountMode === 'percentage' ? '%' : '₹'} discount`
    ));
    dispatch(setSnackbarOpen(true));
  }, [overallDiscountValue, overallDiscountMode, descriptions.length, dispatch]);

  const handleClearOverallDiscount = useCallback(async () => {
    if (loadingStates.totals) return;

    setOverallDiscountValue(0);
    setNeedsTotalsRefresh(true);

    dispatch(setSnackbarMessage('Overall discount removed'));
    dispatch(setSnackbarOpen(true));
  }, [loadingStates.totals, dispatch]);

  // ===== FIXED: Round Off Handler with Auto-Apply on Enter/Tab/Blur =====
  const handleRoundOffInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow negative values with optional decimal
    if (value === '' || /^-?\d*\.?\d{0,2}$/.test(value)) {
      setRoundOffInputValue(value);
    }
  }, []);

  const handleRoundOffKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      applyRoundOffValue();
    }
  }, []);

  const applyRoundOffValue = useCallback(() => {
    if (roundOffInputValue === '') {
      setRoundOffValue(0);
    } else {
      const parsedValue = parseFloat(roundOffInputValue) || 0;
      setRoundOffValue(parsedValue);
    }
    
    // Trigger totals refresh
    if (!refreshScheduled.current) {
      refreshScheduled.current = true;
      setNeedsTotalsRefresh(true);
    }
  }, [roundOffInputValue]);

  const handleRoundOffBlur = useCallback(() => {
    applyRoundOffValue();
  }, [applyRoundOffValue]);

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

  const handleClear = useCallback((preventRefresh: boolean = false) => {
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
      base_amounts: [],
      desc_discount_amounts: [],
      desc_overall_discounts: [],
      include_tax: [],
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
      fee_with_tax: 0,
      base_amount: 0,
      include_tax: true,
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

    setIncludeTax(true);
    setFeeWithTax(0);
    setBaseAmount(0);
    setVendorSearch(null);
    setLocationSearch(null);
    setSelectedService(null);
    setOverallDiscountValue(0);
    setOverallDiscountMode('percentage');
    setRoundOffValue(0);
    setRoundOffInputValue('0');
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

    dispatch(clearCalculatedTotals());

    if (!preventRefresh && !refreshScheduled.current) {
      refreshScheduled.current = true;
      setNeedsTotalsRefresh(true);
    }

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

      const finalPaymentAmount = totals.roundedTotalOrderAmount + freightGrandTotal;

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

      const dataToSubmit = {
        ...serviceData,
        freights: freightData,
        totalFreightAmount: freightSubTotal,
        totalFreightTaxAmount: freightTaxTotal,
        workOrderDate: serviceData.workOrderDate ? formatDateForBackend(parseDate(serviceData.workOrderDate)) : null,

        totalAmount: finalPaymentAmount,
        totalTax: totals.roundedTotalTax,
        totalDiscount: totals.overallDiscountAmount, // Always send the actual discount
        totalFees: totals.subTotal,

        overallDiscountType: overallDiscountMode,
        overallDiscountAppliedOn: overallDiscountAppliedOn,
        overallDiscountValue: overallDiscountValue, // Always send the value
        roundOffValue,

        quantity: descriptions.map(desc => desc.quantity),
        remarks: descriptions.map(desc => desc.remarks || ''),
        sacCode: descriptions.map(desc => desc.sacCode || ''),
        desc_ids: descriptions.map(desc => desc.id || ''),
        descriptions: descriptions.map(desc => desc.description),
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
        base_amounts: serviceData.base_amounts || [],
        desc_overall_discounts: serviceData.desc_overall_discounts || [],
        include_tax: descriptions.map(desc => desc.include_tax ?? true),
        termsandConditions: serviceData.termsandConditions || [''],
        desc_discount_percentages: serviceData.desc_discount_percentages || [],
        desc_discount_amounts: serviceData.desc_discount_amounts || [],
      } as ServiceData;

      let result;

      if (isEditMode && editId) {
        result = await dispatch(updateService({ mongoId: editId, service: dataToSubmit })).unwrap();
        dispatch(setSnackbarMessage(`Service Order ${result.serviceId || editId} successfully updated.`));
      } else {
        result = await dispatch(addService(dataToSubmit)).unwrap();
        dispatch(setSnackbarMessage(`Service Order ${result.serviceId} successfully created.`));
      }

      dispatch(setSnackbarOpen(true));

      const preventRefresh = true;
      handleClear(preventRefresh);

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
    serviceData, descriptions, totals, freights, freightSubTotal, freightTaxTotal, freightGrandTotal,
    overallDiscountMode, overallDiscountAppliedOn, overallDiscountValue, roundOffValue,
    dispatch, isEditMode, editId, handleClear, router
  ]);

  const handleTaxPercentageChange = (value: any) => {
    if (value) {
      const taxPercent = value.purchasetaxPercentage;

      if (includeTax) {
        if (feeWithTax > 0) {
          const taxRate = 1 + (taxPercent / 100);
          const calculatedBase = feeWithTax / taxRate;
          setBaseAmount(parseFloat(calculatedBase.toFixed(2)));

          dispatch(setNewDescriptionData({
            ...newDescription,
            tax_per: taxPercent,
            base_amount: parseFloat(calculatedBase.toFixed(2)),
            fee: feeWithTax,
            fee_with_tax: feeWithTax,
          }));
        } else {
          dispatch(setNewDescriptionData({
            ...newDescription,
            tax_per: taxPercent,
          }));
        }
      } else {
        if (baseAmount > 0) {
          const calculatedFeeWithTax = baseAmount * (1 + (taxPercent / 100));
          setFeeWithTax(parseFloat(calculatedFeeWithTax.toFixed(2)));

          dispatch(setNewDescriptionData({
            ...newDescription,
            tax_per: taxPercent,
            fee: parseFloat(calculatedFeeWithTax.toFixed(2)),
            fee_with_tax: parseFloat(calculatedFeeWithTax.toFixed(2)),
            base_amount: baseAmount,
          }));
        } else {
          dispatch(setNewDescriptionData({
            ...newDescription,
            tax_per: taxPercent,
          }));
        }
      }
      setErrors(prev => ({ ...prev, taxPer: false }));
    } else {
      if (includeTax) {
        setBaseAmount(feeWithTax);
        dispatch(setNewDescriptionData({
          ...newDescription,
          tax_per: 0,
          base_amount: feeWithTax,
          fee: feeWithTax,
          fee_with_tax: feeWithTax,
        }));
      } else {
        setFeeWithTax(baseAmount);
        dispatch(setNewDescriptionData({
          ...newDescription,
          tax_per: 0,
          fee: baseAmount,
          fee_with_tax: baseAmount,
          base_amount: baseAmount,
        }));
      }
    }
  };

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
        const finalAmount = totals.roundedTotalOrderAmount + freightGrandTotal;
        setIsHoldOrderDialog(finalAmount > serviceData.creditLimit);
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
  }, [serviceData, totals.roundedTotalOrderAmount, freightGrandTotal, serviceData.creditLimit, dispatch]);

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

  if (loadingStates.initial) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh" flexDirection="column">
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>Loading service order data...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#ffffff' }}>
      <Box sx={{ flex: 1, p: 3, overflowY: 'auto', maxHeight: 'calc(100vh - 64px)' }}>
        <Box sx={{
          width: '100%',
          maxWidth: { xs: '100%', sm: '100%', md: '1200px', lg: '1400px', xl: '1600px' },
          mx: 'auto',
          px: { xs: 2, sm: 3, md: 4 },
          py: 3,
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Button variant="contained" color="primary" onClick={handleBackToService}>
              Back to Service Orders
            </Button>
          </Box>

          {/* DISCOUNT CONFLICT WARNING - Now just a warning, not blocking */}
          {showDiscountConflictWarning && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Both individual discounts and overall discount exist. This may cause unexpected calculations.
            </Alert>
          )}

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
                      setTimeout(() => descriptionRef.current?.focus(), 100);
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
                  inputProps={{ min: 1, step: 1 }}
                  autoComplete="off"
                />
              </Grid>

              <Grid item xs={12} sm={2}>
                <SmartDatePicker
                  label="From Date"
                  value={newDescription.from_date ? parseDate(newDescription.from_date) : null}
                  onChange={(date) => handleDescriptionDateChange('from_date', date)}
                  minDate={serviceData.workOrderDate ? parseDate(serviceData.workOrderDate) : null}
                />
              </Grid>

              <Grid item xs={12} sm={2}>
                <SmartDatePicker
                  label="To Date"
                  value={newDescription.to_date ? parseDate(newDescription.to_date) : null}
                  onChange={(date) => handleDescriptionDateChange('to_date', date)}
                  minDate={newDescription.from_date ? parseDate(newDescription.from_date) : null}
                />
              </Grid>

              <Grid item xs={12} sm={2}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={includeTax}
                      onChange={handleIncludeTaxChange}
                      color="primary"
                      size="small"
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Typography variant="body2">Include Tax</Typography>
                      <Tooltip title="ON: You enter amount WITH tax, OFF: You enter amount WITHOUT tax">
                        <InfoIcon fontSize="small" sx={{ ml: 0.5, color: 'text.secondary' }} />
                      </Tooltip>
                    </Box>
                  }
                />
              </Grid>

              <Grid item xs={12} sm={1.5}>
                {includeTax ? (
                  <TextField
                    fullWidth
                    label="Fee (₹) *with tax*"
                    name="feeWithTax"
                    type="text"
                    value={feeWithTax === 0 ? '' : feeWithTax}
                    onChange={handleFeeWithTaxChange}
                    size="small"
                    error={errors.fee}
                    helperText={errors.fee ? 'Fee is required' : 'Amount including tax'}
                    inputProps={{ min: 0, step: '0.01' }}
                    autoComplete="off"
                  />
                ) : (
                  <TextField
                    fullWidth
                    label="Base Amt (₹) *without tax*"
                    name="baseAmount"
                    type="text"
                    value={baseAmount === 0 ? '' : baseAmount}
                    onChange={handleBaseAmountChange}
                    size="small"
                    error={errors.fee}
                    helperText={errors.fee ? 'Base amount is required' : 'Amount before tax'}
                    inputProps={{ min: 0, step: '0.01' }}
                    autoComplete="off"
                  />
                )}
              </Grid>

              <Grid item xs={12} sm={1.5}>
                <Autocomplete
                  fullWidth
                  options={taxItems || []}
                  getOptionLabel={(option) => `${option.purchasetaxName}`}
                  value={taxItems?.find(tax => tax.purchasetaxPercentage === newDescription.tax_per) || null}
                  onChange={(event, value) => {
                    handleTaxPercentageChange(value);
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

              <Grid item xs={12} sm={2.5}>
                <Box sx={{ p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                  <Typography variant="caption" display="block" color="text.secondary">
                    Quantity: {newDescription.quantity || 1}
                  </Typography>
                  <Typography variant="caption" display="block" color="text.secondary">
                    Base Amt (per unit): ₹
                    {includeTax
                      ? (newDescription.tax_per > 0
                        ? (feeWithTax / (1 + (newDescription.tax_per / 100))).toFixed(2)
                        : feeWithTax.toFixed(2))
                      : baseAmount.toFixed(2)
                    }
                  </Typography>
                  <Typography variant="caption" display="block" color="text.secondary">
                    Tax ({newDescription.tax_per}%): ₹
                    {includeTax
                      ? (newDescription.tax_per > 0
                        ? (feeWithTax - (feeWithTax / (1 + (newDescription.tax_per / 100)))).toFixed(2)
                        : '0.00')
                      : (baseAmount * (newDescription.tax_per / 100)).toFixed(2)
                    }
                  </Typography>
                  <Typography variant="caption" display="block" fontWeight="bold">
                    Total ({newDescription.quantity || 1} ×
                    {includeTax
                      ? ` ₹${feeWithTax.toFixed(2)}`
                      : ` ₹${(baseAmount + (baseAmount * newDescription.tax_per / 100)).toFixed(2)}`
                    }):
                    ₹{((newDescription.quantity || 1) *
                      (includeTax
                        ? feeWithTax
                        : (baseAmount + (baseAmount * newDescription.tax_per / 100))
                      )).toFixed(2)}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                {isEditing && (
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={() => {
                      dispatch(clearDescriptionForEditing());
                      setIncludeTax(true);
                      setFeeWithTax(0);
                      setBaseAmount(0);
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
                  '& th': { fontWeight: 'bold', borderBottom: '2px solid rgba(0,0,0,0.12)' }
                }}>
                  <TableRow>
                    <TableCell>S.No</TableCell>
                    <TableCell>SAC Code</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Remarks</TableCell>
                    <TableCell>Qty</TableCell>
                    <TableCell>From Date</TableCell>
                    <TableCell>To Date</TableCell>
                    <TableCell>Include Tax</TableCell>
                    <TableCell align="right">Fee/Base (per unit)</TableCell>
                    <TableCell align="right">Tax %</TableCell>
                    <TableCell align="right">SGST</TableCell>
                    <TableCell align="right">CGST</TableCell>
                    <TableCell align="right">IGST</TableCell>
                    <TableCell align="right">Ind. Disc</TableCell>
                    <TableCell align="right">Final Amt (₹)</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {descriptions.map((desc, index) => {
                    const finalAmount = serviceData.desc_totals?.[index] !== undefined
                      ? serviceData.desc_totals[index]
                      : desc.total || 0;

                    const individualDiscountAmount = serviceData.desc_discount_amounts?.[index] !== undefined
                      ? serviceData.desc_discount_amounts[index]
                      : desc.discountAmount || 0;

                    const sgst = serviceData.desc_sgst?.[index] !== undefined
                      ? serviceData.desc_sgst[index]
                      : desc.sgst || 0;

                    const cgst = serviceData.desc_cgst?.[index] !== undefined
                      ? serviceData.desc_cgst[index]
                      : desc.cgst || 0;

                    const igst = serviceData.desc_igst?.[index] !== undefined
                      ? serviceData.desc_igst[index]
                      : desc.igst || 0;

                    return (
                      <TableRow key={desc.id || index} hover>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{desc.sacCode || 'N/A'}</TableCell>
                        <TableCell>{desc.description}</TableCell>
                        <TableCell>{desc.remarks || 'N/A'}</TableCell>
                        <TableCell>{desc.quantity}</TableCell>
                        <TableCell>{formatDateForDisplay(desc.from_date)}</TableCell>
                        <TableCell>{formatDateForDisplay(desc.to_date)}</TableCell>
                        <TableCell>
                          {desc.include_tax ? (
                            <Typography color="success.main">Yes</Typography>
                          ) : (
                            <Typography color="text.secondary">No</Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {desc.include_tax ? (
                            <Tooltip title="Amount WITH tax per unit">
                              <Typography variant="body2">
                                ₹{(desc.fee || 0).toFixed(2)}
                              </Typography>
                            </Tooltip>
                          ) : (
                            <Tooltip title="Amount WITHOUT tax per unit">
                              <Typography variant="body2">
                                ₹{(desc.base_amount || 0).toFixed(2)}
                              </Typography>
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell align="right">{desc.tax_per?.toFixed(2)}%</TableCell>
                        <TableCell align="right">₹{sgst.toFixed(2)}</TableCell>
                        <TableCell align="right">₹{cgst.toFixed(2)}</TableCell>
                        <TableCell align="right">₹{igst.toFixed(2)}</TableCell>
                        <TableCell align="right">₹{individualDiscountAmount.toFixed(2)}</TableCell>
                        <TableCell align="right">
                          <Typography fontWeight="bold" color="success.main">
                            ₹{finalAmount.toFixed(2)}
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
                  })}

                  {/* Table footer with totals */}
                  <TableRow sx={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}>
                    <TableCell colSpan={8} align="right"><strong>Totals:</strong></TableCell>
                    <TableCell align="right">
                      <strong>
                        ₹{(serviceData.desc_totals?.reduce((a, b) => a + b, 0) || 0).toFixed(2)}
                      </strong>
                    </TableCell>
                    <TableCell colSpan={4} />
                    <TableCell align="right">
                      <strong>
                        ₹{(serviceData.desc_discount_amounts?.reduce((a, b) => a + b, 0) || 0).toFixed(2)}
                      </strong>
                    </TableCell>
                    <TableCell align="right">
                      <Typography fontWeight="bold" color="success.main">
                        ₹{(serviceData.totalAmount || 0).toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Box>

          {/* Overall Discount Section - Always editable */}
          <Box sx={{ mt: 2, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={2}>
                <Typography variant="subtitle2">Overall Discount:</Typography>
              </Grid>
              <Grid item xs={12} sm={2}>
                <TextField
                  fullWidth
                  size="small"
                  label={overallDiscountMode === 'percentage' ? 'Discount %' : 'Discount Amount'}
                  value={overallDiscountValue || ''}
                  onChange={handleOverallDiscountChange}
                  disabled={serviceTotalsLoading}
                  inputProps={{ step: '0.01', min: 0 }}
                />
              </Grid>
              <Grid item xs={12} sm={2}>
                <FormControl size="small" fullWidth>
                  <Select
                    value={overallDiscountMode}
                    onChange={handleDiscountModeChange}
                    disabled={serviceTotalsLoading}
                  >
                    <MenuItem value="percentage">Percentage</MenuItem>
                    <MenuItem value="amount">Amount</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={2}>
                <FormControl size="small" fullWidth>
                  <Select
                    value={overallDiscountAppliedOn}
                    onChange={(e) => setOverallDiscountAppliedOn(e.target.value as 'before_tax' | 'after_tax')}
                    disabled={serviceTotalsLoading}
                  >
                    <MenuItem value="after_tax">After Tax</MenuItem>
                    <MenuItem value="before_tax">Before Tax</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={2}>
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleApplyDiscount}
                  disabled={overallDiscountValue <= 0 || descriptions.length === 0 || serviceTotalsLoading}
                >
                  Apply
                </Button>
              </Grid>
              <Grid item xs={12} sm={2}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleClearOverallDiscount}
                  disabled={overallDiscountValue === 0 || serviceTotalsLoading}
                  startIcon={<ClearIcon />}
                >
                  Clear
                </Button>
              </Grid>
            </Grid>
          </Box>

          {/* Freight Section */}
          <Box sx={{ mt: 3, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Freight Charges</Typography>
              <Button
                variant="outlined"
                color="primary"
                onClick={() => setOpenFreightDialog(true)}
                startIcon={<AddIcon />}
                disabled={serviceTotalsLoading}
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
                          <IconButton size="small" onClick={() => handleDeleteFreight(index)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
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
              <Typography variant="body2" color="text.secondary">No freight charges added.</Typography>
            )}
          </Box>

          {/* Totals Section with Round Off field */}
          <Grid container spacing={2} sx={{ mt: 2 }}>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                label="Subtotal (Without Tax)"
                value={totals.subTotal.toFixed(2)}
                size="small"
                InputProps={{ readOnly: true }}
                helperText="Total before tax"
                disabled={true}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                label="Total Tax"
                value={totals.taxAmount.toFixed(2)}
                size="small"
                InputProps={{ readOnly: true }}
                disabled={true}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                label="Total Discount"
                value={totals.overallDiscountAmount.toFixed(2)}
                size="small"
                InputProps={{ readOnly: true }}
                color="success"
                disabled={true}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                label="Round Off"
                value={roundOffInputValue}
                onChange={handleRoundOffInputChange}
                onKeyDown={handleRoundOffKeyDown}
                onBlur={handleRoundOffBlur}
                size="small"
                type="text"
                inputProps={{ step: '0.01' }}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Total After Discount"
                value={totals.roundedTotalOrderAmount.toFixed(2)}
                size="small"
                InputProps={{ readOnly: true }}
                helperText="Service total with tax after discount"
                disabled={true}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Freight Charges"
                value={freightGrandTotal.toFixed(2)}
                size="small"
                disabled={true}
                InputProps={{ readOnly: true }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Final Payment Amount"
                value={(totals.roundedTotalOrderAmount + freightGrandTotal).toFixed(2)}
                size="small"
                InputProps={{ readOnly: true }}
                error={totals.roundedTotalOrderAmount + freightGrandTotal > serviceData.creditLimit}
                helperText={totals.roundedTotalOrderAmount + freightGrandTotal > serviceData.creditLimit ? 'Exceeds credit limit' : ''}
                sx={{ '& .MuiInputBase-input': { fontWeight: 'bold', fontSize: '1.1rem' } }}
                disabled={true}
              />
            </Grid>
          </Grid>

          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={4}>
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
                    error={formErrors.billingAddress}
                    helperText={formErrors.billingAddress ? 'Required' : ''}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <Grid container spacing={1}>
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
                        error={formErrors.shippingAddress}
                        helperText={formErrors.shippingAddress ? 'Required' : ''}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={2}>
                  <IconButton color="primary" onClick={() => setOpenShippingDialog(true)} sx={{ p: 0 }}>
                    <AddIcon />
                  </IconButton>
                </Grid>
              </Grid>
            </Grid>
            <Grid item xs={12} sm={4}>
              <LocationAutocomplete
                value={locationSearch}
                onChange={handleLocationChange}
                label="Location"
                error={formErrors.locationName}
                helperText={formErrors.locationName ? 'Required' : ''}
              />
            </Grid>
          </Grid>

          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Comments"
                name="comments"
                value={serviceData.comments}
                onChange={handleTextFieldChange}
                size="small"
                multiline
                rows={3}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              {serviceData.termsandConditions.map((term, index) => (
                <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <TextField
                    fullWidth
                    label={`Terms & Conditions ${index + 1}`}
                    value={term}
                    onChange={(e) => handleTextFieldChange(e, index)}
                    size="small"
                  />
                  <IconButton onClick={() => handleRemoveTerm(index)} size="small">
                    <RemoveIcon />
                  </IconButton>
                </Box>
              ))}
              {serviceData.termsandConditions.length < 3 && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleAddTerm}
                  startIcon={<AddIcon />}
                >
                  Add Term
                </Button>
              )}
            </Grid>
          </Grid>
        </Box>
      </Box>

      {/* Footer Actions */}
      <Box sx={{ p: 2, bgcolor: 'white', borderTop: '1px solid #e0e0e0', position: 'sticky', bottom: 0 }}>
        <Grid container spacing={2} justifyContent="flex-end">
          <Grid item>
            <Button
              variant="outlined"
              onClick={() => handleClear(false)}
            >
              {isEditMode ? 'Cancel Edit' : 'Clear All'}
            </Button>
          </Grid>

          <Grid item>
            <Button
              variant="contained"
              color="primary"
              onClick={handleOpenDialog}
              disabled={loadingStates.submit || loadingStates.description || serviceTotalsLoading}
            >
              {isEditMode ? 'Update Service Order' : 'Submit Service Order'}
            </Button>
          </Grid>
        </Grid>
      </Box>

      {/* Dialogs */}
      <Dialog open={open} onClose={() => setDialogOpen(false)}>
        <DialogTitle>{isHoldOrderDialog ? 'Confirm Hold' : (isEditMode ? 'Confirm Update' : 'Confirm Order')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {isHoldOrderDialog
              ? `Amount (${(totals.roundedTotalOrderAmount + freightGrandTotal).toFixed(2)}) exceeds credit limit (${serviceData.creditLimit.toFixed(2)}). Order will be placed on hold. Proceed?`
              : (isEditMode ? 'Update this service order?' : 'Submit this service order?')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} color="primary" variant="contained" disabled={loadingStates.submit}>
            {loadingStates.submit ? (isEditMode ? 'Updating...' : 'Submitting...') : (isEditMode ? 'Update' : 'Confirm')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openShippingDialog} onClose={() => setOpenShippingDialog(false)}>
        <DialogTitle>Add New Shipping Address</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Address"
            value={updatedShippingRow?.address || ''}
            onChange={(e) => setUpdatedShippingRow({ ...updatedShippingRow!, address: e.target.value })}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenShippingDialog(false)}>Cancel</Button>
          <Button onClick={() => { setOpenShippingDialog(false); }} color="primary">Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showNavigationConfirm} onClose={() => setShowNavigationConfirm(false)}>
        <DialogTitle>Unsaved Changes</DialogTitle>
        <DialogContent>
          <DialogContentText>You have unsaved changes. Leave anyway?</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNavigationConfirm(false)}>Stay</Button>
          <Button onClick={() => { setShowNavigationConfirm(false); pendingNavigation?.(); }} color="primary">Leave</Button>
        </DialogActions>
      </Dialog>

      <FreightSelectionDialog
        open={openFreightDialog}
        onClose={() => setOpenFreightDialog(false)}
        onAddFreights={handleAddFreights}
        existingFreights={freights}
      />

      <Backdrop sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }} open={loadingStates.description || serviceTotalsLoading || loadingStates.submit}>
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