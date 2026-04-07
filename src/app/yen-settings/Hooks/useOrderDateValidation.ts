// hooks/useOrderDateValidation.ts
import { useState, useEffect, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/redux/store';
import { validateDate, fetchDateSettings } from '../Features/PurchaseDateSettingSlice'; // Changed to validateDate
import { format, isAfter, isBefore, isSameDay, parseISO } from 'date-fns';

interface DateValidationResult {
  valid: boolean;
  message: string;
  minDate?: Date | null;
  maxDate?: Date | null;
  restrictionType: string;
}

export const useOrderDateValidation = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [validationResult, setValidationResult] = useState<DateValidationResult>({
    valid: true,
    message: '',
    minDate: null,
    maxDate: null,
    restrictionType: 'no_restriction'
  });
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Fetch settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      try {
        const result = await dispatch(fetchDateSettings()).unwrap();
        setSettings(result);
      } catch (error) {
        console.error('Failed to load date settings:', error);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, [dispatch]);

  const validateSelectedDate = useCallback(async (date: Date | null): Promise<DateValidationResult> => {
    if (!date) {
      const result = {
        valid: false,
        message: 'Date is required',
        minDate: null,
        maxDate: null,
        restrictionType: 'error'
      };
      setValidationResult(result);
      return result;
    }

    try {
      // Use the unified validateDate with dateType='order'
      const result = await dispatch(validateDate({
        date,
        dateType: 'order'
      })).unwrap();
      
      // Convert string dates to Date objects if needed
      const formattedResult = {
        ...result,
        minDate: result.minDate ? new Date(result.minDate) : null,
        maxDate: result.maxDate ? new Date(result.maxDate) : null
      };
      
      setValidationResult(formattedResult);
      return formattedResult;
    } catch (error: any) {
      const errorResult = {
        valid: false,
        message: error.message || 'Validation failed',
        minDate: null,
        maxDate: null,
        restrictionType: 'error'
      };
      setValidationResult(errorResult);
      return errorResult;
    }
  }, [dispatch]);

  const getDatePickerProps = useCallback((selectedDate: Date | null) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let minDate: Date | undefined;
    let maxDate: Date | undefined;
    let shouldDisableDate: ((date: Date) => boolean) | undefined;

    // Use validation result min/max if available
    if (validationResult.minDate) {
      minDate = validationResult.minDate;
    }
    if (validationResult.maxDate) {
      maxDate = validationResult.maxDate;
    }

    // Fallback to settings if validation result doesn't have min/max
    if (!minDate && !maxDate && settings?.orderDateRestriction) {
      const restriction = settings.orderDateRestriction;
      
      switch (restriction.restrictionType) {
        case 'current_only':
          minDate = today;
          maxDate = today;
          shouldDisableDate = (date: Date) => !isSameDay(date, today);
          break;

        case 'days_before':
          minDate = new Date(today);
          minDate.setDate(today.getDate() - restriction.daysValue);
          maxDate = today;
          shouldDisableDate = (date: Date) => 
            isBefore(date, minDate!) || isAfter(date, maxDate!);
          break;

        case 'days_after':
          minDate = today;
          maxDate = new Date(today);
          maxDate.setDate(today.getDate() + restriction.daysValue);
          shouldDisableDate = (date: Date) => 
            isBefore(date, minDate!) || isAfter(date, maxDate!);
          break;

        case 'date_range':
          if (restriction.startDate && restriction.endDate) {
            minDate = parseISO(restriction.startDate);
            maxDate = parseISO(restriction.endDate);
            shouldDisableDate = (date: Date) => 
              isBefore(date, minDate!) || isAfter(date, maxDate!);
          }
          break;

        default:
          // no_restriction - all dates enabled
          break;
      }
    }

    return {
      minDate,
      maxDate,
      shouldDisableDate,
      disabled: loading || !settings,
      helperText: validationResult.message,
      error: !validationResult.valid && validationResult.message !== '',
    };
  }, [settings, loading, validationResult]);

  return {
    validateDate: validateSelectedDate,
    validationResult,
    getDatePickerProps,
    loading,
    settings
  };
};