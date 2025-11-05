// components/common/SmartDatePicker.tsx - SIMPLER VERSION
import React, { useState, useEffect } from 'react';
import { TextField } from '@mui/material';

interface SmartDatePickerProps {
  label: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  minDate?: Date;
  maxDate?: Date;
  required?: boolean;
  disabled?: boolean; // Added disabled prop
}

const SmartDatePicker: React.FC<SmartDatePickerProps> = ({
  label,
  value,
  onChange,
  minDate,
  maxDate,
  required = false,
  disabled = false, // Default to false
}) => {
  const today = new Date();
  
  const formatDateForInput = (date: Date | null): string => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  };

  // Use today's date if value is null, otherwise use the provided value
  const [inputValue, setInputValue] = useState<string>(
    formatDateForInput(value || today) // ← This keeps current date as default
  );

  // Sync with external value changes
  useEffect(() => {
    if (value && value instanceof Date && !isNaN(value.getTime())) {
      setInputValue(formatDateForInput(value));
    } else if (!value) {
      // If value is null, show today's date and call onChange with today's date
      setInputValue(formatDateForInput(today));
      onChange(today);
    }
  }, [value]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return; // Prevent changes when disabled
    
    const newValue = e.target.value;
    setInputValue(newValue);
    
    if (newValue) {
      const selectedDate = new Date(newValue);
      if (!isNaN(selectedDate.getTime())) {
        onChange(selectedDate);
      } else {
        onChange(null);
      }
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
      disabled={disabled} // Added disabled prop
    />
  );
};

export default SmartDatePicker;