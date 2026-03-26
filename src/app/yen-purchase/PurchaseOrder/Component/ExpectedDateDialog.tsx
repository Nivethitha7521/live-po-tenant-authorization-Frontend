// components/ExpectedDeliveryDatePicker.tsx

import React, { useEffect, useState } from 'react';
import { TextField, TextFieldProps } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/redux/store';
import { validateDate, fetchDateSettings } from '../../../yen-settings/Features/PurchaseDateSettingSlice';

// Extend dayjs with plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Kolkata');

interface DateValidationResult {
  valid: boolean;
  message: string;
  minDate?: string | null;
  maxDate?: string | null;
  restrictionType: string;
  daysValue?: number;
}

interface ExpectedDeliveryDatePickerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  onValidationChange?: (isValid: boolean) => void;
  label?: string;
  required?: boolean;
  error?: boolean;
  helperText?: string;
  orderDate?: Date | null; // Pass order date for validation
  disabled?: boolean;
}

export const ExpectedDeliveryDatePicker: React.FC<ExpectedDeliveryDatePickerProps> = ({
  value,
  onChange,
  onValidationChange,
  label = "Expected Delivery",
  required = false,
  error: externalError,
  helperText: externalHelperText,
  orderDate,
  disabled = false
}) => {
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
  const [localError, setLocalError] = useState<string>('');

  // Convert UTC date from backend to local date for display
  const toDayjs = (date: Date | null): Dayjs | null => {
    if (!date) return null;
    
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return null;
      
      // Create dayjs object in IST timezone
      return dayjs(d).tz('Asia/Kolkata');
    } catch (error) {
      console.error('Error converting date:', error);
      return null;
    }
  };

  // Convert local date to UTC midnight for storage
  const toDate = (day: Dayjs | null): Date | null => {
    if (!day) return null;
    
    // Get the date in IST at midnight
    const istDate = day.tz('Asia/Kolkata').startOf('day');
    
    // Convert to UTC midnight
    const utcDate = istDate.utc().toDate();
    
    // Set to UTC midnight explicitly
    utcDate.setUTCHours(0, 0, 0, 0);
    
    return utcDate;
  };

  const [internalValue, setInternalValue] = useState<Dayjs | null>(
    value ? toDayjs(value) : null
  );

  // Update internal value when external value changes
  useEffect(() => {
    setInternalValue(value ? toDayjs(value) : null);
  }, [value]);

  // Fetch settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      try {
        const result = await dispatch(fetchDateSettings()).unwrap();
        console.log('📋 Settings loaded:', result);
        setSettings(result);
      } catch (error) {
        console.error('Failed to load date settings:', error);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, [dispatch]);

  // Validate date when it changes or when orderDate changes
  useEffect(() => {
    if (value && orderDate) {
      validateSelectedDate(value, orderDate);
    } else if (value && !orderDate) {
      setLocalError('Order date must be selected first');
      onValidationChange?.(false);
    } else if (required) {
      setLocalError(`${label} is required`);
      onValidationChange?.(false);
    } else {
      setLocalError('');
      onValidationChange?.(true);
    }
  }, [value, orderDate, required]);

  const validateSelectedDate = async (date: Date, orderDateInput: Date) => {
    try {
      // Create UTC midnight dates for both order date and expected delivery date
      const deliveryUtcDate = new Date(Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        0, 0, 0, 0
      ));
      
      const orderUtcDate = new Date(Date.UTC(
        orderDateInput.getFullYear(),
        orderDateInput.getMonth(),
        orderDateInput.getDate(),
        0, 0, 0, 0
      ));
      
      console.log('📤 Validating expected delivery date:', {
        orderDate: orderUtcDate.toISOString(),
        expectedDelivery: deliveryUtcDate.toISOString(),
        orderLocal: orderDateInput.toLocaleDateString('en-IN'),
        deliveryLocal: date.toLocaleDateString('en-IN')
      });
      
      // Use validateDate with dateType='expected' and pass orderDate
      const result = await dispatch(validateDate({ 
        date: deliveryUtcDate,
        dateType: 'expected',  // This is the key - use 'expected' type
        orderDate: orderUtcDate
      })).unwrap();
      
      console.log('✅ Validation result:', result);
      setValidationResult(result);
      
      if (!result.valid) {
        setLocalError(result.message);
        onValidationChange?.(false);
      } else {
        setLocalError('');
        onValidationChange?.(true);
      }
    } catch (error: any) {
      console.error('Validation error:', error);
      const errorResult = {
        valid: false,
        message: error?.message || 'Validation failed',
        minDate: null,
        maxDate: null,
        restrictionType: 'error'
      };
      setValidationResult(errorResult);
      setLocalError(errorResult.message);
      onValidationChange?.(false);
    }
  };

  const getDatePickerProps = () => {
    const today = dayjs().tz('Asia/Kolkata').startOf('day');

    let minDate: Dayjs | undefined;
    let maxDate: Dayjs | undefined;
    let shouldDisableDate: ((date: Dayjs) => boolean) | undefined;

    // Get the order date as Dayjs if available
    const orderDayjs = orderDate ? dayjs(orderDate).tz('Asia/Kolkata', true).startOf('day') : null;

    // Base minimum date is the order date (or today if no order date)
    const baseMinDate = orderDayjs || today;
    
    // Use validation result min/max if available
    if (validationResult.minDate) {
      const validationMin = dayjs(validationResult.minDate).tz('Asia/Kolkata', true).startOf('day');
      // Take the later of validation min and base min
      minDate = validationMin.isAfter(baseMinDate) ? validationMin : baseMinDate;
    } else {
      minDate = baseMinDate;
    }
    
    if (validationResult.maxDate) {
      maxDate = dayjs(validationResult.maxDate).tz('Asia/Kolkata', true).startOf('day');
    }

    // Apply settings-based restrictions if validation result doesn't have them
    if (!validationResult.minDate && !validationResult.maxDate && settings?.expectedDeliveryRestriction?.isActive) {
      const restriction = settings.expectedDeliveryRestriction;
      
      switch (restriction.restrictionType) {
        case 'current_only':
          minDate = today;
          maxDate = today;
          break;
        case 'days_before':
          minDate = today.subtract(restriction.daysValue, 'day');
          maxDate = today;
          break;
        case 'days_after':
          minDate = today;
          maxDate = today.add(restriction.daysValue, 'day');
          break;
        case 'date_range':
          if (restriction.startDate && restriction.endDate) {
            const settingMin = dayjs(restriction.startDate).tz('Asia/Kolkata', true).startOf('day');
            const settingMax = dayjs(restriction.endDate).tz('Asia/Kolkata', true).startOf('day');
            
            minDate = settingMin.isAfter(baseMinDate) ? settingMin : baseMinDate;
            maxDate = settingMax;
          }
          break;
        default:
          break;
      }
    }

    // Ensure min date is not before order date
    if (orderDayjs && minDate && minDate.isBefore(orderDayjs, 'day')) {
      minDate = orderDayjs;
    }

    console.log('📅 Date picker props:', {
      minDate: minDate?.format('DD/MM/YYYY'),
      maxDate: maxDate?.format('DD/MM/YYYY'),
      orderDate: orderDayjs?.format('DD/MM/YYYY')
    });

    // Create disable function if min/max defined
    if (minDate || maxDate) {
      shouldDisableDate = (date: Dayjs) => {
        // Check if date is before minDate
        if (minDate && date.isBefore(minDate, 'day')) return true;
        
        // Check if date is after maxDate
        if (maxDate && date.isAfter(maxDate, 'day')) return true;
        
        return false;
      };
    }

    return {
      minDate,
      maxDate,
      shouldDisableDate,
      disabled: disabled || loading || !settings || !orderDate,
    };
  };

  const datePickerProps = getDatePickerProps();

  const handleDateChange = (newValue: Dayjs | null) => {
    setInternalValue(newValue);
    
    // Convert to UTC midnight for storage
    const utcDate = newValue ? toDate(newValue) : null;
    
    if (newValue && orderDate) {
      console.log('📅 Expected Delivery Debug:', {
        local: newValue.tz('Asia/Kolkata').format('DD/MM/YYYY'),
        utc: utcDate?.toISOString(),
        orderDate: orderDate ? new Date(orderDate).toLocaleDateString('en-IN') : 'none'
      });
    }
    
    onChange(utcDate);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <DatePicker
        label={label}
        value={internalValue}
        onChange={handleDateChange}
        minDate={datePickerProps.minDate}
        maxDate={datePickerProps.maxDate}
        shouldDisableDate={datePickerProps.shouldDisableDate}
        disabled={datePickerProps.disabled}
        format="DD/MM/YYYY"
        slotProps={{
          textField: {
            required,
            error: externalError || !validationResult.valid || !!localError,
            helperText: externalHelperText || localError || validationResult.message || 
                       (!orderDate ? 'Select order date first' : 
                        !settings ? 'Loading settings...' : ''),
            fullWidth: true,
            size: 'small',
            placeholder: 'DD/MM/YYYY',
          } as TextFieldProps
        }}
      />
    </LocalizationProvider>
  );
};