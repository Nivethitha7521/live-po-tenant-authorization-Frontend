import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Typography,
  Box,
  FormControl,
  InputLabel,
  Select,
  Checkbox,
  ListItemText,
  CircularProgress,
  SelectChangeEvent,
} from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '@/redux/store';
import {
  processPayment,
  setSnackbarMessage,
  setSnackbarOpen,
  fetchActiveDebitsVendor,
} from '@/features/yen-purchase/Outgoing/outgoingPaymentSlice';

interface SinglePaymentDialogProps {
  open: boolean;
  onClose: () => void;
  selectedOutgoing: any;
  currentPage: number;
  pageSize: number;
  dateField: string;
  onPaymentSuccess: () => void;
}

const SinglePaymentDialog: React.FC<SinglePaymentDialogProps> = ({
  open,
  onClose,
  selectedOutgoing,
  currentPage,
  pageSize,
  dateField,
  onPaymentSuccess,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { banks } = useSelector((state: any) => state.outgoingPayment);

  const [paymentDetails, setPaymentDetails] = useState({
    paymentMethod: '',
    neftNo: '',
    amount: '',
    bankName: '',
    paymentType: 'full' as 'full' | 'partial',
    rtgsNo: '',
    paymentMode: 'Cash' as 'Cash' | 'Bank',
    cashAmount: 0,
    upi: '',
    impsNo: '',
    selectedDebitNotes: [] as string[],
  });

  const [activeDebits, setActiveDebits] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (selectedOutgoing && open) {
      fetchActiveDebits();
      // Set default amount for full payment when dialog opens
      setPaymentDetails((prev) => ({
        ...prev,
        paymentType: 'full',
        paymentMode: 'Cash',
        paymentMethod: 'cash',
        amount: selectedOutgoing?.totalPayableAmount?.toFixed(2) || '',
        cashAmount: selectedOutgoing?.totalPayableAmount || 0,
      }));
    }
  }, [selectedOutgoing, open]);

  const fetchActiveDebits = async () => {
    try {
      const response = await dispatch(
        fetchActiveDebitsVendor(selectedOutgoing.vendorName)
      ).unwrap();
      const active = response.filter(
        (note: any) => note.status === 'Active' || note.status === 'Partially Cleared'
      );
      setActiveDebits(active);
    } catch (err) {
      dispatch(setSnackbarMessage('Failed to load active debit notes'));
      dispatch(setSnackbarOpen(true));
      console.error('Error fetching debit notes:', err);
    }
  };

  const totalDebitAmount = paymentDetails.selectedDebitNotes.reduce((sum, debitId) => {
    const debit = activeDebits.find((d) => d.randomId === debitId);
    return sum + (debit ? parseFloat(debit.finalAmount || '0') : 0);
  }, 0);

  const validateAmount = (amount: string, maxAllowed: number): string => {
    if (!amount) return 'Please enter an amount';
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return 'Invalid amount format';
    if (numAmount < 0) return 'Amount cannot be negative';

    const remainingPayable = maxAllowed - totalDebitAmount;
    if (numAmount > remainingPayable) {
      return `Payment amount (₹${numAmount.toFixed(2)}) cannot exceed remaining payable amount (₹${remainingPayable.toFixed(2)}) after applying debit notes`;
    }
    return '';
  };

  const handlePaymentTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedType = e.target.value as 'full' | 'partial';
    setPaymentDetails((prevDetails) => ({
      ...prevDetails,
      paymentType: selectedType,
      amount:
        selectedType === 'full' && selectedOutgoing
          ? (selectedOutgoing.totalPayableAmount - totalDebitAmount).toFixed(2)
          : '',
      ...(prevDetails.paymentMode === 'Cash'
        ? { cashAmount: selectedType === 'full' ? selectedOutgoing.totalPayableAmount - totalDebitAmount : 0 }
        : {}),
    }));
    setError('');
  };

  const handlePaymentModeChange = (e: React.ChangeEvent<{ value: unknown }>) => {
    const selectedMode = e.target.value as 'Cash' | 'Bank';
    setPaymentDetails((prevDetails) => ({
      ...prevDetails,
      paymentMode: selectedMode,
      paymentMethod: selectedMode === 'Cash' ? 'cash' : '',
      cashAmount: selectedMode === 'Cash' ? parseFloat(prevDetails.amount || '0') : 0,
    }));
  };

  const handlePaymentMethodChange = (e: React.ChangeEvent<{ value: unknown }>) => {
    const selectedMethod = e.target.value as string;
    setPaymentDetails((prevDetails) => ({
      ...prevDetails,
      paymentMethod: selectedMethod,
    }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'amount') {
      if (!/^\d*\.?\d*$/.test(value)) return;

      if (selectedOutgoing?.totalPayableAmount) {
        const validationError = validateAmount(value, selectedOutgoing.totalPayableAmount);
        setError(validationError);
      }
    }

    setPaymentDetails((prevDetails) => ({
      ...prevDetails,
      [name]: value,
      ...(name === 'amount' && prevDetails.paymentMode === 'Cash' && prevDetails.paymentMethod === 'cash'
        ? { cashAmount: parseFloat(value || '0') }
        : {}),
    }));
  };

  const handleDebitNoteChange = (selectedValues: string[]) => {
    setPaymentDetails((prev) => {
      const totalDebitAmount = selectedValues.reduce((sum, id) => {
        const debit = activeDebits.find((d) => d.randomId === id);
        return sum + (debit ? parseFloat(debit.finalAmount || '0') : 0);
      }, 0);

      const totalPayable = selectedOutgoing?.totalPayableAmount || 0;
      const validationError =
        totalDebitAmount > totalPayable
          ? `Total debit notes (₹${totalDebitAmount.toFixed(2)}) cannot exceed total payable amount (₹${totalPayable.toFixed(2)})`
          : '';

      setError(validationError);
      return {
        ...prev,
        selectedDebitNotes: validationError ? prev.selectedDebitNotes : selectedValues,
        amount: validationError
          ? prev.amount
          : prev.paymentType === 'full'
          ? (totalPayable - totalDebitAmount).toFixed(2)
          : prev.amount,
        ...(prev.paymentMode === 'Cash' && prev.paymentMethod === 'cash'
          ? { cashAmount: parseFloat((totalPayable - totalDebitAmount).toFixed(2)) || 0 }
          : {}),
      };
    });
  };

  const resetPaymentDetails = () => {
    setPaymentDetails({
      paymentMethod: '',
      neftNo: '',
      amount: '',
      bankName: '',
      paymentType: 'full',
      rtgsNo: '',
      paymentMode: 'Cash',
      cashAmount: 0,
      upi: '',
      impsNo: '',
      selectedDebitNotes: [],
    });
    setError('');
  };

  const handleClose = () => {
    resetPaymentDetails();
    onClose();
  };

  const handleConfirmPayment = async () => {
    if (!selectedOutgoing || !paymentDetails.amount) {
      dispatch(setSnackbarMessage('Please enter a valid amount'));
      dispatch(setSnackbarOpen(true));
      return;
    }

    const validationError = validateAmount(
      paymentDetails.amount,
      selectedOutgoing.totalPayableAmount
    );
    if (validationError) {
      setError(validationError);
      dispatch(setSnackbarMessage(validationError));
      dispatch(setSnackbarOpen(true));
      return;
    }

    const paymentAmount = parseFloat(paymentDetails.amount);
    const paymentDetailsToSend = {
      outgoingId: selectedOutgoing.outgoingId,
      paymentType: paymentDetails.paymentType,
      totalPayableAmount: selectedOutgoing.totalPayableAmount || 0,
      fullPaymentAmount:
        paymentDetails.paymentType === 'full' ? selectedOutgoing.totalPayableAmount - totalDebitAmount : 0,
      partialAmount: paymentDetails.paymentType === 'partial' ? paymentAmount : 0,
      paymentMethod: paymentDetails.paymentMethod,
      paymentMode: paymentDetails.paymentMode,
      cashAmount:
        paymentDetails.paymentMode === 'Cash' && paymentDetails.paymentMethod === 'cash'
          ? paymentDetails.cashAmount
          : 0,
      upi: paymentDetails.paymentMethod === 'upi' ? paymentDetails.upi : '',
      bankName: paymentDetails.paymentMode === 'Bank' ? paymentDetails.bankName : '',
      impsNo: paymentDetails.paymentMethod === 'imps' ? paymentDetails.impsNo : '',
      neftNo: paymentDetails.paymentMethod === 'neft' ? paymentDetails.neftNo : '',
      rtgsNo: paymentDetails.paymentMethod === 'rtgs' ? paymentDetails.rtgsNo : '',
      chequeNo: '',
      selectedDebitNotes: paymentDetails.selectedDebitNotes,
    };

    try {
      setIsLoading(true);
      await dispatch(processPayment(paymentDetailsToSend)).unwrap();
      dispatch(setSnackbarMessage('Payment processed successfully'));
      dispatch(setSnackbarOpen(true));
      resetPaymentDetails();
      onPaymentSuccess();
      handleClose();
    } catch (error) {
      console.error('Failed to process payment:', error);
      dispatch(setSnackbarMessage('Failed to process payment. Please try again.'));
      dispatch(setSnackbarOpen(true));
    } finally {
      setIsLoading(false);
    }
  };

  if (!selectedOutgoing) return null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      sx={{
        '& .MuiDialog-paper': {
          width: '400px',
          maxWidth: '400px',
          minWidth: '400px',
        },
      }}
    >
      <DialogTitle>Payment Details</DialogTitle>
      <DialogContent>
        <Typography variant="body1" gutterBottom>
          Total Amount: ₹{selectedOutgoing?.totalPayableAmount?.toFixed(2) || 'N/A'}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Total Debit Amount: ₹{totalDebitAmount.toFixed(2)}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Remaining Payable: ₹{(selectedOutgoing?.totalPayableAmount - totalDebitAmount).toFixed(2)}
        </Typography>

        <TextField
          select
          name="paymentType"
          label="Payment Type"
          value={paymentDetails.paymentType}
          onChange={handlePaymentTypeChange}
          fullWidth
          margin="normal"
          size="small"
        >
          <MenuItem value="full">Full Payment</MenuItem>
          <MenuItem value="partial">Partial Payment</MenuItem>
        </TextField>

        <TextField
          autoComplete="off"
          name="amount"
          label="Amount"
          value={paymentDetails.amount}
          onChange={handleInputChange}
          fullWidth
          margin="normal"
          required
          error={!!error}
          helperText={error}
          disabled={paymentDetails.paymentType === 'full'}
          inputProps={{ type: 'number', step: '0.01' }}
          size="small"
        />

        <TextField
          select
          name="paymentMode"
          label="Payment Mode"
          value={paymentDetails.paymentMode}
          onChange={handlePaymentModeChange}
          fullWidth
          margin="normal"
          size="small"
        >
          <MenuItem value="Cash">Cash</MenuItem>
          <MenuItem value="Bank">Bank</MenuItem>
        </TextField>

        {paymentDetails.paymentMode === 'Bank' && (
          <>
            <TextField
              select
              name="bankName"
              label="Bank Name"
              value={paymentDetails.bankName}
              onChange={handleInputChange}
              fullWidth
              margin="normal"
              size="small"
            >
              {banks.map((bank: any) => (
                <MenuItem key={bank.bankMasterId} value={bank.bankName}>
                  {bank.bankName}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              name="paymentMethod"
              label="Payment Method"
              value={paymentDetails.paymentMethod}
              onChange={handlePaymentMethodChange}
              fullWidth
              margin="normal"
              size="small"
            >
              <MenuItem value="neft">NEFT</MenuItem>
              <MenuItem value="rtgs">RTGS</MenuItem>
              <MenuItem value="imps">IMPS</MenuItem>
              <MenuItem value="upi">UPI</MenuItem>
            </TextField>

            {paymentDetails.paymentMethod === 'neft' && (
              <TextField
                autoComplete="off"
                name="neftNo"
                label="NEFT Number"
                value={paymentDetails.neftNo}
                onChange={handleInputChange}
                fullWidth
                margin="normal"
                required
                size="small"
              />
            )}

            {paymentDetails.paymentMethod === 'rtgs' && (
              <TextField
                autoComplete="off"
                name="rtgsNo"
                label="RTGS Number"
                value={paymentDetails.rtgsNo}
                onChange={handleInputChange}
                fullWidth
                margin="normal"
                required
                size="small"
              />
            )}

            {paymentDetails.paymentMethod === 'imps' && (
              <TextField
                autoComplete="off"
                name="impsNo"
                label="IMPS Number"
                value={paymentDetails.impsNo}
                onChange={handleInputChange}
                fullWidth
                margin="normal"
                required
                size="small"
              />
            )}

            {paymentDetails.paymentMethod === 'upi' && (
              <TextField
                autoComplete="off"
                name="upi"
                label="UPI ID"
                value={paymentDetails.upi}
                onChange={handleInputChange}
                fullWidth
                margin="normal"
                required
                size="small"
              />
            )}
          </>
        )}

        {activeDebits.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2">Apply Debit Notes</Typography>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Apply Debit Notes</InputLabel>
              <Select
                multiple
                value={paymentDetails.selectedDebitNotes}
                onChange={(e: SelectChangeEvent<string[]>) =>
                  handleDebitNoteChange(e.target.value as string[])
                }
                label="Apply Debit Notes"
                size="small"
                renderValue={(selected) => {
                  if (selected.length === 0) return 'No debit notes selected';
                  return selected
                    .map((id) => {
                      const debit = activeDebits.find((d) => d.randomId === id);
                      return debit
                        ? `${debit.randomId} (₹${parseFloat(debit.finalAmount || '0').toFixed(2)})`
                        : '';
                    })
                    .join(', ');
                }}
              >
                {activeDebits.map((debit) => (
                  <MenuItem key={debit.randomId} value={debit.randomId}>
                    <Checkbox
                      checked={paymentDetails.selectedDebitNotes.includes(debit.randomId)}
                    />
                    <ListItemText
                      primary={`${debit.randomId} - ₹${parseFloat(debit.finalAmount || '0').toFixed(2)}`}
                    />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} color="primary" size="small">
          Cancel
        </Button>
        <Button
          onClick={handleConfirmPayment}
          color="primary"
          disabled={isLoading || !!error}
          size="small"
        >
          {isLoading ? <CircularProgress size={24} /> : 'Confirm Payment'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SinglePaymentDialog;