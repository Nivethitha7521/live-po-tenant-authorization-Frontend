// components/OrderdatePicker.tsx
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

interface OrderDatePickerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  onValidationChange?: (isValid: boolean) => void;
  label?: string;
  required?: boolean;
  error?: boolean;
  helperText?: string;
  skipInitialValidation?: boolean; // Add this prop
  initialValue?: Date | null; // Add this to track original value
}

export const OrderDatePicker: React.FC<OrderDatePickerProps> = ({
  value,
  onChange,
  onValidationChange,
  label = "Order Date",
  required = false,
  error: externalError,
  helperText: externalHelperText,
  skipInitialValidation = false,
  initialValue,
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

  // Convert UTC date from backend to local date for display
  const toDayjs = (date: Date | null): Dayjs | null => {
    if (!date) return null;
    
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return null;
      
      return dayjs(d).tz('Asia/Kolkata', true);
    } catch (error) {
      console.error('Error converting date:', error);
      return null;
    }
  };

  // Convert local date to UTC midnight for storage
  const toDate = (day: Dayjs | null): Date | null => {
    if (!day) return null;
    
    const istDate = day.tz('Asia/Kolkata').startOf('day');
    return istDate.utc().toDate();
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
        setSettings(result);
      } catch (error) {
        console.error('Failed to load date settings:', error);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, [dispatch]);

  // Initial validation - skip if skipInitialValidation is true
  useEffect(() => {
    // If we should skip initial validation, mark as valid and return
    if (skipInitialValidation && !hasUserChanged) {
      setLocalError('');
      onValidationChange?.(true);
      return;
    }
    
    // Only validate if user has changed the date or if not skipping initial validation
    if (value && (hasUserChanged || !skipInitialValidation)) {
      validateSelectedDate(value);
    } else if (required && !value) {
      setLocalError('Order date is required');
      onValidationChange?.(false);
    } else {
      setLocalError('');
      onValidationChange?.(true);
    }
  }, [value, required, hasUserChanged, skipInitialValidation]);

  const validateSelectedDate = async (date: Date) => {
    try {
      const utcDate = new Date(Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        0, 0, 0, 0
      ));
      
      console.log('📤 Validating date:', {
        original: date.toLocaleDateString('en-IN'),
        month: date.getMonth() + 1,
        utcSent: utcDate.toISOString()
      });
      
      const result = await dispatch(validateDate({ 
        date: utcDate, 
        dateType: 'order' 
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

    // Use validation result min/max if available
    if (validationResult.minDate) {
      minDate = dayjs(validationResult.minDate).tz('Asia/Kolkata', true);
    }
    if (validationResult.maxDate) {
      maxDate = dayjs(validationResult.maxDate).tz('Asia/Kolkata', true);
    }

    // Fallback to settings if validation result doesn't have min/max
    if (!minDate && !maxDate && settings?.orderDateRestriction?.isActive) {
      const restriction = settings.orderDateRestriction;
      
      switch (restriction.restrictionType) {
        case 'current_only':
          minDate = today;
          maxDate = today;
          shouldDisableDate = (date: Dayjs) => !date.isSame(today, 'day');
          break;
        case 'days_before':
          minDate = today.subtract(restriction.daysValue, 'day');
          maxDate = today;
          shouldDisableDate = (date: Dayjs) => 
            date.isBefore(minDate, 'day') || date.isAfter(maxDate, 'day');
          break;
        case 'days_after':
          minDate = today;
          maxDate = today.add(restriction.daysValue, 'day');
          shouldDisableDate = (date: Dayjs) => 
            date.isBefore(minDate, 'day') || date.isAfter(maxDate, 'day');
          break;
        case 'date_range':
          if (restriction.startDate && restriction.endDate) {
            minDate = dayjs(restriction.startDate).tz('Asia/Kolkata', true).startOf('day');
            maxDate = dayjs(restriction.endDate).tz('Asia/Kolkata', true).startOf('day');
            shouldDisableDate = (date: Dayjs) => 
              date.isBefore(minDate, 'day') || date.isAfter(maxDate, 'day');
          }
          break;
        default:
          break;
      }
    }

    return {
      minDate,
      maxDate,
      shouldDisableDate,
      disabled: loading || !settings,
    };
  };

  const datePickerProps = getDatePickerProps();

  const handleDateChange = (newValue: Dayjs | null) => {
    setInternalValue(newValue);
    setHasUserChanged(true); // Mark that user has changed the date
    
    // Convert to UTC midnight for storage
    const utcDate = newValue ? toDate(newValue) : null;
    
    if (newValue) {
      console.log('📅 DatePicker Debug:', {
        local: newValue.tz('Asia/Kolkata').format('DD/MM/YYYY'),
        utc: utcDate?.toISOString(),
        month: newValue.tz('Asia/Kolkata').month() + 1
      });
    } else {
      console.log('📅 DatePicker Debug: Date cleared');
    }
    
    onChange(utcDate);
    
    // Validate immediately when user changes
    if (utcDate) {
      validateSelectedDate(utcDate);
    } else if (required) {
      setLocalError('Order date is required');
      onValidationChange?.(false);
    } else {
      setLocalError('');
      onValidationChange?.(true);
    }
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
            error: externalError || (!validationResult.valid && hasUserChanged) || !!localError,
            helperText: externalHelperText || (hasUserChanged ? (localError || validationResult.message) : ''),
            fullWidth: true,
            size: 'small',
            placeholder: 'DD/MM/YYYY',
          } as TextFieldProps
        }}
      />
    </LocalizationProvider>
  );
};