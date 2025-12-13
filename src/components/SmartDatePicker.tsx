// components/common/SmartDatePicker.tsx - IMPROVED VERSION WITH VALUE CLAMPING
import React, { useState, useEffect } from 'react';
import { TextField } from '@mui/material';

interface SmartDatePickerProps {
  label: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  minDate?: Date | null;
  maxDate?: Date | null;
  required?: boolean;
  disabled?: boolean;
}

const SmartDatePicker: React.FC<SmartDatePickerProps> = ({
  label,
  value,
  onChange,
  minDate,
  maxDate,
  required = false,
  disabled = false,
}) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Ensure time is midnight for consistent comparison

  const formatDateForInput = (date: Date | null): string => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  };

  const parseInputToDate = (inputStr: string): Date | null => {
    if (!inputStr) return null;
    const date = new Date(inputStr);
    date.setHours(0, 0, 0, 0); // Normalize to midnight
    return isNaN(date.getTime()) ? null : date;
  };

  const [inputValue, setInputValue] = useState<string>(
    formatDateForInput(value || today)
  );

  // Sync internal state with external value prop
  useEffect(() => {
    const formatted = formatDateForInput(value);
    if (formatted !== inputValue) {
      setInputValue(formatted);
    }
  }, [value, inputValue]);

  // Clamp value to min/max bounds when minDate, maxDate, or value changes
  useEffect(() => {
    const currentDate = value || today;
    let clampedDate = currentDate;

    if (minDate && clampedDate < minDate) {
      clampedDate = new Date(minDate);
    }
    if (maxDate && clampedDate > maxDate) {
      clampedDate = new Date(maxDate);
    }

    const clampedInput = formatDateForInput(clampedDate);
    if (clampedInput !== inputValue) {
      setInputValue(clampedInput);
      // Only call onChange if the value actually changed (to avoid loops)
      if (value?.getTime() !== clampedDate.getTime()) {
        onChange(clampedDate);
      }
    }
  }, [minDate, maxDate, value, today, inputValue, onChange]);

  // Initial default if value is null (but don't call onChange here to avoid loops)
  useEffect(() => {
    if (!value) {
      const defaultDate = today;
      // Clamp default to min/max if provided
      let clampedDefault = defaultDate;
      if (minDate && clampedDefault < minDate) clampedDefault = new Date(minDate);
      if (maxDate && clampedDefault > maxDate) clampedDefault = new Date(maxDate);
      setInputValue(formatDateForInput(clampedDefault));
    }
  }, []); // Run only once on mount if no value

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;

    const newInputValue = e.target.value;
    setInputValue(newInputValue);

    const selectedDate = parseInputToDate(newInputValue);
    if (selectedDate) {
      // Clamp the selected date
      let clampedDate = new Date(selectedDate);
      if (minDate && clampedDate < minDate) {
        clampedDate = new Date(minDate);
        setInputValue(formatDateForInput(clampedDate));
      }
      if (maxDate && clampedDate > maxDate) {
        clampedDate = new Date(maxDate);
        setInputValue(formatDateForInput(clampedDate));
      }
      onChange(clampedDate);
    } else {
      onChange(null);
    }
  };

  const minDateString = minDate ? formatDateForInput(minDate) : undefined;
  const maxDateString = maxDate ? formatDateForInput(maxDate) : undefined;

  return (
    <TextField
      fullWidth
      label={label}
      type="date"
      value={inputValue}
      onChange={handleDateChange}
      InputLabelProps={{
        shrink: true,
      }}
      inputProps={{
        min: minDateString,
        max: maxDateString,
      }}
      size="small"
      variant="outlined"
      required={required}
      disabled={disabled}
      error={!!(required && !inputValue)} // Simple error if required and empty
    />
  );
};

export default SmartDatePicker;