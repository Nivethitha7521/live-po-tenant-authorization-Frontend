// components/yen-purchase/Component/UnifiedDatePicker.tsx

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

type DateType = 'order' | 'expected' | 'invoice';

interface UnifiedDatePickerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  onValidationChange?: (isValid: boolean) => void;
  label?: string;
  required?: boolean;
  error?: boolean;
  helperText?: string;
  dateType: DateType;
  orderDate?: Date | null;
  disabled?: boolean;
  skipInitialValidation?: boolean;
}

export const UnifiedDatePicker: React.FC<UnifiedDatePickerProps> = ({
  value,
  onChange,
  onValidationChange,
  label,
  required = false,
  error: externalError,
  helperText: externalHelperText,
  dateType,
  orderDate,
  disabled = false,
  skipInitialValidation = false
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
  const [hasUserChanged, setHasUserChanged] = useState(false);
// In UnifiedDatePicker.tsx, update the toDayjs function:

const toDayjs = (date: Date | null): Dayjs | null => {
  if (!date) return null;
  
  try {
    // Check if this is a UTC date from the database
    // If the time component is 00:00:00.000, it's likely a UTC date
    const isUTCMidnight = date.getUTCHours() === 0 && 
                          date.getUTCMinutes() === 0 && 
                          date.getUTCSeconds() === 0;
    
    if (isUTCMidnight) {
      // For UTC midnight dates, use the UTC components directly
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth();
      const dayOfMonth = date.getUTCDate();
      
      // Create a dayjs object with the exact date (no timezone shift)
      return dayjs.tz(
        `${year}-${String(month + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`,
        'YYYY-MM-DD',
        'Asia/Kolkata'
      ).startOf('day');
    } else {
      // For local dates, use as-is
      return dayjs.tz(date, 'Asia/Kolkata').startOf('day');
    }
  } catch (error) {
    console.error('Error converting date to dayjs:', error);
    return null;
  }
};

  // Convert local date to UTC midnight for storage
  const toDate = (day: Dayjs | null): Date | null => {
    if (!day) return null;
    
    // Get the local date components (what user sees)
    const localDate = day.tz('Asia/Kolkata');
    const year = localDate.year();
    const month = localDate.month();
    const dayOfMonth = localDate.date();
    
    // Create UTC midnight date (what backend expects)
    return new Date(Date.UTC(year, month, dayOfMonth, 0, 0, 0, 0));
  };

  const [internalValue, setInternalValue] = useState<Dayjs | null>(
    value ? toDayjs(value) : null
  );

  // Update internal value when external value changes
  useEffect(() => {
    const newInternalValue = value ? toDayjs(value) : null;
    setInternalValue(newInternalValue);
    
    // If we're in edit mode and have a value, mark it as valid
    if (value && skipInitialValidation && !hasUserChanged) {
      setLocalError('');
      onValidationChange?.(true);
    }
  }, [value, skipInitialValidation]);

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

  // Initial validation - skip if skipInitialValidation is true (edit mode)
  useEffect(() => {
    // In edit mode with existing data, don't show validation errors
    if (skipInitialValidation && !hasUserChanged && value) {
      setLocalError('');
      onValidationChange?.(true);
      return;
    }
    
    // Only validate if user has changed the date or not in edit mode
    if (value && (hasUserChanged || !skipInitialValidation)) {
      validateSelectedDate(value);
    } else if (required && !value) {
      setLocalError(`${getDefaultLabel()} is required`);
      onValidationChange?.(false);
    } else {
      setLocalError('');
      onValidationChange?.(true);
    }
  }, [value, required, hasUserChanged, skipInitialValidation]);

  const getDefaultLabel = (): string => {
    switch (dateType) {
      case 'order': return 'Order Date';
      case 'expected': return 'Expected Delivery';
      case 'invoice': return 'Invoice Date';
      default: return 'Date';
    }
  };

  const finalLabel = label || getDefaultLabel();

  const validateSelectedDate = async (date: Date) => {
    try {
      // Ensure we're sending UTC midnight to backend
      const utcDate = new Date(Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        0, 0, 0, 0
      ));
      
      let orderUtcDate: Date | undefined;
      if (orderDate && (dateType === 'expected' || dateType === 'invoice')) {
        orderUtcDate = new Date(Date.UTC(
          orderDate.getUTCFullYear(),
          orderDate.getUTCMonth(),
          orderDate.getUTCDate(),
          0, 0, 0, 0
        ));
      }
      
      const result = await dispatch(validateDate({
        date: utcDate,
        dateType,
        orderDate: orderUtcDate
      })).unwrap();
      
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
      setLocalError(error?.message || 'Validation failed');
      onValidationChange?.(false);
    }
  };

  const getDatePickerProps = () => {
    const today = dayjs().tz('Asia/Kolkata').startOf('day');
    let minDate: Dayjs | undefined;
    let maxDate: Dayjs | undefined;
    let shouldDisableDate: ((date: Dayjs) => boolean) | undefined;

    // Parse order date for expected/invoice date restrictions
    const orderDayjs = orderDate ? (() => {
      try {
        const d = new Date(orderDate);
        if (isNaN(d.getTime())) return null;
        
        const year = d.getUTCFullYear();
        const month = d.getUTCMonth();
        const dayOfMonth = d.getUTCDate();
        
        return dayjs.tz(
          `${year}-${String(month + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`,
          'YYYY-MM-DD',
          'Asia/Kolkata'
        ).startOf('day');
      } catch (error) {
        console.error('Error parsing order date:', error);
        return null;
      }
    })() : null;

    // Get restrictions from settings based on date type
    let restriction = null;
    switch (dateType) {
      case 'order':
        restriction = settings?.orderDateRestriction;
        break;
      case 'expected':
        restriction = settings?.expectedDeliveryRestriction;
        break;
      case 'invoice':
        restriction = settings?.invoiceDateRestriction;
        break;
    }

    // Apply validation result min/max if available and user has changed
    if (hasUserChanged && !skipInitialValidation) {
      if (validationResult.minDate) {
        const minDateObj = dayjs(validationResult.minDate);
        if (minDateObj.isValid()) {
          minDate = dayjs.tz(
            `${minDateObj.year()}-${String(minDateObj.month() + 1).padStart(2, '0')}-${String(minDateObj.date()).padStart(2, '0')}`,
            'YYYY-MM-DD',
            'Asia/Kolkata'
          ).startOf('day');
        }
      }
      if (validationResult.maxDate) {
        const maxDateObj = dayjs(validationResult.maxDate);
        if (maxDateObj.isValid()) {
          maxDate = dayjs.tz(
            `${maxDateObj.year()}-${String(maxDateObj.month() + 1).padStart(2, '0')}-${String(maxDateObj.date()).padStart(2, '0')}`,
            'YYYY-MM-DD',
            'Asia/Kolkata'
          ).startOf('day');
        }
      }
    }

    // Apply restrictions from settings if no validation result min/max
    if (!minDate && !maxDate && restriction?.isActive) {
      switch (restriction.restrictionType) {
        case 'current_only':
          minDate = today;
          maxDate = today;
          break;
        case 'days_before':
          if (restriction.daysValue) {
            minDate = today.subtract(restriction.daysValue, 'day');
            maxDate = today;
          }
          break;
        case 'days_after':
          if (restriction.daysValue) {
            minDate = today;
            maxDate = today.add(restriction.daysValue, 'day');
          }
          break;
        case 'date_range':
          if (restriction.startDate && restriction.endDate) {
            const startDate = dayjs(restriction.startDate);
            const endDate = dayjs(restriction.endDate);
            if (startDate.isValid() && endDate.isValid()) {
              minDate = dayjs.tz(
                `${startDate.year()}-${String(startDate.month() + 1).padStart(2, '0')}-${String(startDate.date()).padStart(2, '0')}`,
                'YYYY-MM-DD',
                'Asia/Kolkata'
              ).startOf('day');
              maxDate = dayjs.tz(
                `${endDate.year()}-${String(endDate.month() + 1).padStart(2, '0')}-${String(endDate.date()).padStart(2, '0')}`,
                'YYYY-MM-DD',
                'Asia/Kolkata'
              ).startOf('day');
            }
          }
          break;
        default:
          break;
      }
    }

    // Special handling for expected delivery date based on order date
    if (dateType === 'expected' && orderDayjs) {
      if (!minDate && !maxDate && restriction?.isActive) {
        switch (restriction.restrictionType) {
          case 'current_only':
            minDate = orderDayjs;
            maxDate = orderDayjs;
            break;
          case 'days_before':
            if (restriction.daysValue) {
              minDate = orderDayjs.subtract(restriction.daysValue, 'day');
              maxDate = orderDayjs;
            }
            break;
          case 'days_after':
            if (restriction.daysValue) {
              minDate = orderDayjs;
              maxDate = orderDayjs.add(restriction.daysValue, 'day');
            }
            break;
          default:
            if (!minDate) minDate = orderDayjs;
            break;
        }
      } else if (!minDate) {
        minDate = orderDayjs;
      }
    }

    // Special handling for invoice date with days after order
    if (dateType === 'invoice' && orderDayjs) {
      const daysAfterOrder = settings?.invoiceDaysAfterOrder || 0;
      
      if (daysAfterOrder > 0 && !minDate) {
        minDate = orderDayjs.add(daysAfterOrder, 'day');
      }
    }

    // Disable if no order date for dependent dates
    if ((dateType === 'expected' || dateType === 'invoice') && !orderDayjs) {
      return {
        minDate: undefined,
        maxDate: undefined,
        shouldDisableDate: undefined,
        disabled: true,
      };
    }

    // Create disable function if min/max dates exist
    if (minDate || maxDate) {
      shouldDisableDate = (date: Dayjs) => {
        // Convert both dates to UTC date strings for comparison
        const dateStr = date.format('YYYY-MM-DD');
        if (minDate && dateStr < minDate.format('YYYY-MM-DD')) return true;
        if (maxDate && dateStr > maxDate.format('YYYY-MM-DD')) return true;
        return false;
      };
    }

    const isDisabled = disabled || loading || !settings || 
      ((dateType === 'expected' || dateType === 'invoice') && !orderDate);

    return {
      minDate,
      maxDate,
      shouldDisableDate,
      disabled: isDisabled,
    };
  };

  const datePickerProps = getDatePickerProps();

  const handleDateChange = (newValue: Dayjs | null) => {
    setInternalValue(newValue);
    setHasUserChanged(true);
    
    const utcDate = newValue ? toDate(newValue) : null;
    
    if (newValue) {
      // Check if order date is required for expected/invoice dates
      if ((dateType === 'expected' || dateType === 'invoice') && !orderDate) {
        setLocalError('Order date must be selected first');
        onValidationChange?.(false);
      } else if (utcDate) {
        validateSelectedDate(utcDate);
      }
    } else {
      if (required) {
        setLocalError(`${finalLabel} is required`);
        onValidationChange?.(false);
      } else {
        setLocalError('');
        onValidationChange?.(true);
      }
    }
    
    onChange(utcDate);
  };

  const showError = () => {
    // In edit mode with existing data that hasn't been changed, don't show error
    if (skipInitialValidation && !hasUserChanged && value) {
      return false;
    }
    return externalError || (!validationResult.valid && hasUserChanged) || !!localError;
  };

  const getHelperText = () => {
    // In edit mode with existing data that hasn't been changed, don't show helper text
    if (skipInitialValidation && !hasUserChanged && value) {
      return '';
    }
    
    if ((dateType === 'expected' || dateType === 'invoice') && !orderDate) {
      return 'Select order date first';
    }
    
    return externalHelperText || (hasUserChanged ? (localError || validationResult.message) : '') ||
      (!settings ? 'Loading settings...' : '');
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <DatePicker
        label={finalLabel}
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
            error: showError(),
            helperText: getHelperText(),
            fullWidth: true,
            size: 'small',
            placeholder: 'DD/MM/YYYY',
          } as TextFieldProps
        }}
      />
    </LocalizationProvider>
  );
};