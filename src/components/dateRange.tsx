import React from 'react';
import { Button, Dialog, DialogContent, DialogTitle, Box } from '@mui/material';
import { DateRangePicker } from 'react-date-range';
import { addDays, startOfYear, endOfYear, startOfDay, endOfDay } from 'date-fns';

// Define the type for the selection range
interface SelectionRange {
  startDate: Date;
  endDate: Date;
  key: string;
}

interface DateRangeDialogProps {
  selectionRange: SelectionRange;
  setSelectionRange: React.Dispatch<React.SetStateAction<SelectionRange>>;
  onApply?: () => void;
}

const DateRangeDialog: React.FC<DateRangeDialogProps> = ({ selectionRange, setSelectionRange, onApply }) => {
  const [open, setOpen] = React.useState(false);

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const handleSelect = (ranges: any) => {
    
    // Set start and end of the selected day
    setSelectionRange({
      startDate: startOfDay(ranges.selection.startDate),
      endDate: endOfDay(ranges.selection.endDate),
      key: 'selection',
    });
  };

  const handlePresetSelection = (preset: string) => {
    let startDate: Date, endDate: Date;
    const today = new Date();

    switch (preset) {
      case 'This Year':
        startDate = startOfYear(today);
        endDate = endOfYear(today);
        break;
      case 'Before Year':
        startDate = startOfYear(addDays(today, -365));
        endDate = endOfYear(addDays(today, -365));
        break;
      default:
        startDate = endDate = today;
        break;
    }
    setSelectionRange({
      startDate: startOfDay(startDate),
      endDate: endOfDay(endDate),
      key: 'selection',
    });
  };

  const handleClear = () => {
    const today = new Date();
    setSelectionRange({
      startDate: startOfDay(today),
      endDate: endOfDay(today),
      key: 'selection',
    });
  };

  const handleApply = () => {
    if (onApply) {
      onApply();
    }
    handleClose();
  };

  const formatDate = (date: Date) => {
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  };

  return (
    <Box>
      <Button variant="contained" onClick={handleOpen}>
        {selectionRange.startDate && selectionRange.endDate
          ? `${formatDate(selectionRange.startDate)} - ${formatDate(selectionRange.endDate)}`
          : "Date Filter"}
      </Button>

      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>
          Select Date Range
          {/* Clear Button */}
          <Button
            color="primary"
            onClick={handleClear}
            variant='outlined'
            aria-label="clear"
            style={{ position: 'absolute', top: 10, right: 150 }}
          >
            Clear
          </Button>
          <Button onClick={handleClose} aria-label="cancel" variant='outlined'
            style={{ position: 'absolute', top: 10, right: 80 }}
            color="primary">
            Cancel
          </Button>
          {/* Apply Button */}
          <Button
            color="primary"
            onClick={handleApply}
            aria-label="apply"
            variant='outlined'
            style={{ position: 'absolute', top: 10, right: 10 }}
          >
            Apply
          </Button>
        </DialogTitle>

        <DialogContent>
          {/* Preset Buttons */}
          <Button onClick={() => handlePresetSelection('This Year')}>This Year</Button>
          <Button onClick={() => handlePresetSelection('Before Year')}>Before Year</Button>

          <DateRangePicker
            ranges={[selectionRange]}
            onChange={handleSelect}
            months={2}
            direction="horizontal"
          />
        </DialogContent>

      </Dialog>
    </Box>
  );
};

export default DateRangeDialog;