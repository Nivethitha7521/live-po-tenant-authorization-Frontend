import React from 'react';
import { Button, Dialog, DialogContent, DialogTitle, Box } from '@mui/material';
import { addDays, startOfYear, endOfYear, startOfDay, endOfDay } from 'date-fns';
import 'react-date-range/dist/styles.css'; // Main style file
import 'react-date-range/dist/theme/default.css'; // Theme CSS file
import { DateRangePicker, RangeKeyDict } from 'react-date-range';

interface SelectionRange {
  startDate: string; // ISO string
  endDate: string;   // ISO string
  key: string;
}

interface DateRangeDialogProps {
  selectionRange: SelectionRange;
  setSelectionRange: React.Dispatch<React.SetStateAction<SelectionRange>>;
}

const DateRangeDialog: React.FC<DateRangeDialogProps> = ({ selectionRange, setSelectionRange }) => {
  const [open, setOpen] = React.useState(false);

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const handleSelect = (ranges: RangeKeyDict) => {
    const selectedRange = ranges.selection;
    const startDate = selectedRange.startDate || new Date();
    const endDate = selectedRange.endDate || new Date();

    setSelectionRange({
      startDate: startOfDay(startDate).toISOString(),
      endDate: endOfDay(endDate).toISOString(),
      key: 'selection',
    });
  };

  const handlePresetSelection = (preset: string) => {
    const today = new Date();
    let startDate: Date, endDate: Date;

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
      startDate: startOfDay(startDate).toISOString(),
      endDate: endOfDay(endDate).toISOString(),
      key: 'selection',
    });
  };

  const handleClear = () => {
    const today = new Date();
    setSelectionRange({
      startDate: startOfDay(today).toISOString(),
      endDate: endOfDay(today).toISOString(),
      key: 'selection',
    });
  };

  const handleApply = () => handleClose();

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  };

  // Convert ISO strings to Date objects for DateRangePicker
  const pickerRange = {
    startDate: new Date(selectionRange.startDate),
    endDate: new Date(selectionRange.endDate),
    key: selectionRange.key,
  };

  return (
    <Box sx={{ padding: '16px' }}>
      <Button
        variant="contained"
        onClick={handleOpen}
        sx={{
          textTransform: 'none',
          fontWeight: 'medium',
          padding: '8px 16px',
          borderRadius: '8px',
          backgroundColor: '#1976d2',
          '&:hover': { backgroundColor: '#1565c0' },
        }}
      >
        {selectionRange.startDate && selectionRange.endDate
          ? `${formatDate(selectionRange.startDate)} - ${formatDate(selectionRange.endDate)}`
          : 'Date Filter'}
      </Button>

      <Dialog
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            minWidth: { xs: '90%', sm: '600px' },
            maxWidth: { xs: '100%', sm: '900px' },
            borderRadius: '12px',
            padding: '16px',
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            fontSize: '1.25rem',
            fontWeight: '600',
          }}
        >
          <label>Select Date Range</label>
          <Box sx={{ display: 'flex', gap: '8px' }}>
            <Button
              color="primary"
              onClick={handleClear}
              variant="outlined"
              aria-label="clear"
              sx={{
                textTransform: 'none',
                borderRadius: '8px',
                padding: '6px 16px',
                borderColor: '#1976d2',
                color: '#1976d2',
              }}
            >
              Clear
            </Button>
            <Button
              color="primary"
              onClick={handleClose}
              variant="outlined"
              aria-label="cancel"
              sx={{
                textTransform: 'none',
                borderRadius: '8px',
                padding: '6px 16px',
                borderColor: '#1976d2',
                color: '#1976d2',
              }}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              onClick={handleApply}
              variant="contained"
              aria-label="apply"
              sx={{
                textTransform: 'none',
                borderRadius: '8px',
                padding: '6px 16px',
                backgroundColor: '#1976d2',
                '&:hover': { backgroundColor: '#1565c0' },
              }}
            >
              Apply
            </Button>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ padding: '24px' }}>
          <Box sx={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <Button
              onClick={() => handlePresetSelection('This Year')}
              variant="outlined"
              sx={{
                textTransform: 'none',
                borderRadius: '8px',
                padding: '6px 16px',
                borderColor: '#1976d2',
                color: '#1976d2',
              }}
            >
              This Year
            </Button>
            <Button
              onClick={() => handlePresetSelection('Before Year')}
              variant="outlined"
              sx={{
                textTransform: 'none',
                borderRadius: '8px',
                padding: '6px 16px',
                borderColor: '#1976d2',
                color: '#1976d2',
              }}
            >
              Before Year
            </Button>
          </Box>
          <DateRangePicker
            ranges={[pickerRange]}
            onChange={handleSelect}
            months={2}
            direction="horizontal"
            className="dateRangePicker"
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default DateRangeDialog;
