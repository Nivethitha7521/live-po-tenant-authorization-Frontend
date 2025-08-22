import React, { useEffect, useMemo } from 'react';
import { FormControl, TextField, Box } from '@mui/material';

interface DateRangeFilterProps {
  startDate: Date | null;
  endDate: Date | null;
  onStartDateChange: (value: Date | null) => void;
  onEndDateChange: (value: Date | null) => void;
}

const DateRangeFilter: React.FC<DateRangeFilterProps> = ({ startDate, endDate, onStartDateChange, onEndDateChange }) => {
  const currentDate = useMemo(() => new Date(), []); // Memoize currentDate
  const currentDateString = currentDate.toISOString().split('T')[0]; // Get current date in YYYY-MM-DD format

  useEffect(() => {
    if (!startDate) {
      onStartDateChange(currentDate);
    }
    if (!endDate) {
      onEndDateChange(currentDate);
    }
  }, [startDate, endDate, onStartDateChange, onEndDateChange, currentDate]); // Add currentDate to dependencies

  const handleStartDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const formattedStartDate = event.target.value ? new Date(event.target.value) : currentDate;
    onStartDateChange(formattedStartDate);
  };

  const handleEndDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const formattedEndDate = event.target.value ? new Date(event.target.value) : currentDate;
    onEndDateChange(formattedEndDate);
  };

  const startDateString = startDate ? startDate.toISOString().split('T')[0] : currentDateString;
  const endDateString = endDate ? endDate.toISOString().split('T')[0] : currentDateString;

  return (
    <Box display="flex" gap={2}>
      <FormControl fullWidth>
        <TextField
          label="From Date"
          type="date"
          value={startDateString}
          onChange={handleStartDateChange}
          InputLabelProps={{
            shrink: true,
          }}
          inputProps={{
            max: currentDateString,
          }}
        />
      </FormControl>

      <FormControl fullWidth>
        <TextField
          label="To Date"
          type="date"
          value={endDateString}
          onChange={handleEndDateChange}
          InputLabelProps={{
            shrink: true,
          }}
          inputProps={{
            min: startDateString || '',
            max: currentDateString,
          }}
        />
      </FormControl>
    </Box>
  );
};

export default DateRangeFilter;