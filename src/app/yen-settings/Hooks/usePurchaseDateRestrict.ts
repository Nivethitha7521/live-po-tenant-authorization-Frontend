// hooks/usePurchaseDateRestrictions.ts
import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/redux/store';
import {
  fetchDateSettings,
  validateDate,  // Use unified validateDate for all types
  calculateExpectedDelivery
} from '../Features/PurchaseDateSettingSlice';
import { addDays, subDays, startOfDay } from 'date-fns';

interface ValidationResult {
  valid: boolean;
  message: string;
  minDate?: Date | null;
  maxDate?: Date | null;
}

export const usePurchaseDateRestrictions = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { settings, loading } = useSelector((state: RootState) => state.purchaseDateSettings);
  
  const [minDate, setMinDate] = useState<Date | null>(null);
  const [maxDate, setMaxDate] = useState<Date | null>(null);
  const [dateError, setDateError] = useState<string>('');
  const [invoiceError, setInvoiceError] = useState<string>('');

  // Fetch settings on mount
  useEffect(() => {
    dispatch(fetchDateSettings());
  }, [dispatch]);

  // Update min/max dates when settings change
  useEffect(() => {
    if (!settings) return;

    const today = startOfDay(new Date());
    const restriction = settings.orderDateRestriction;

    switch (restriction.restrictionType) {
      case 'current_only':
        setMinDate(today);
        setMaxDate(today);
        break;
      case 'days_before':
        setMinDate(startOfDay(subDays(today, restriction.daysValue)));
        setMaxDate(today);
        break;
      case 'days_after':
        setMinDate(today);
        setMaxDate(startOfDay(addDays(today, restriction.daysValue)));
        break;
      case 'date_range':
        setMinDate(restriction.startDate ? new Date(restriction.startDate) : null);
        setMaxDate(restriction.endDate ? new Date(restriction.endDate) : null);
        break;
      default:
        setMinDate(null);
        setMaxDate(null);
        break;
    }
  }, [settings]);

  // Unified validation function for order date
  const validateOrderDateFn = useCallback(async (date: Date): Promise<boolean> => {
    try {
      const result = await dispatch(validateDate({ 
        date, 
        dateType: 'order' 
      })).unwrap();
      
      if (!result.valid) {
        setDateError(result.message);
        return false;
      }
      setDateError('');
      return true;
    } catch (error) {
      setDateError('Validation failed');
      return false;
    }
  }, [dispatch]);

  // Get expected delivery date
  const getExpectedDeliveryDate = useCallback(async (orderDate: Date): Promise<Date> => {
    try {
      const result = await dispatch(calculateExpectedDelivery(orderDate)).unwrap();
      return new Date(result.expectedDeliveryDate);
    } catch (error) {
      // Fallback to local calculation
      return addDays(orderDate, settings?.expectedDeliveryDays || 7);
    }
  }, [dispatch, settings]);

  // Unified validation function for invoice date
  const validateInvoiceDateFn = useCallback(async (invoiceDate: Date, orderDate: Date): Promise<boolean> => {
    try {
      const result = await dispatch(validateDate({ 
        date: invoiceDate, 
        dateType: 'invoice',
        orderDate: orderDate 
      })).unwrap();
      
      if (!result.valid) {
        setInvoiceError(result.message);
        return false;
      }
      setInvoiceError('');
      return true;
    } catch (error) {
      setInvoiceError('Validation failed');
      return false;
    }
  }, [dispatch]);

  // Helper function to validate any date type
  const validateAnyDate = useCallback(async (
    date: Date, 
    dateType: 'order' | 'expected' | 'invoice',
    relatedOrderDate?: Date
  ): Promise<boolean> => {
    try {
      const params: any = { date, dateType };
      if (relatedOrderDate) {
        params.orderDate = relatedOrderDate;
      }
      
      const result = await dispatch(validateDate(params)).unwrap();
      
      if (!result.valid) {
        if (dateType === 'invoice') {
          setInvoiceError(result.message);
        } else {
          setDateError(result.message);
        }
        return false;
      }
      
      if (dateType === 'invoice') {
        setInvoiceError('');
      } else {
        setDateError('');
      }
      return true;
    } catch (error) {
      const errorMsg = 'Validation failed';
      if (dateType === 'invoice') {
        setInvoiceError(errorMsg);
      } else {
        setDateError(errorMsg);
      }
      return false;
    }
  }, [dispatch]);

  return {
    settings,
    loading,
    minDate,
    maxDate,
    dateError,
    invoiceError,
    validateOrderDate: validateOrderDateFn,
    getExpectedDeliveryDate,
    validateInvoiceDate: validateInvoiceDateFn,
    validateAnyDate,  // New generic function
    expectedDeliveryDays: settings?.expectedDeliveryDays || 7
  };
};