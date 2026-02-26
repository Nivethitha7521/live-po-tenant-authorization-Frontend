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
import { AppDispatch, RootState } from '@/redux/store';
import {
  processPayment,
  setSnackbarMessage,
  setSnackbarOpen,
  fetchActiveDebitsVendor,
  fetchBank
} from '@/features/yen-purchase/Outgoing/outgoingPaymentSlice';
import { fetchActiveAdvancesVendorByName } from '@/features/yen-purchase/Outgoing/advancePaymentSlice';
import { ProcessPaymentRequest } from '@/Models/outgoingModel';

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
  const { banks, debits } = useSelector((state: RootState) => state.outgoingPayment);
  const { singleadvance } = useSelector((state: RootState) => state.advances);

  const [paymentDetails, setPaymentDetails] = useState({
    paymentMethod: '',
    neftNo: '',
    amount: '',
    bankName: '',
    paymentType: 'full' as 'full' | 'partial',
    rtgsNo: '',
    paymentMode: 'Bank' as 'Cash' | 'Bank',
    cashAmount: 0,
    upi: '',
    impsNo: '',
    selectedDebitNotes: [] as string[],
    selectedAdvancePayments: [] as string[],
    paymentDate: '',
  });

  const [error, setError] = useState('');
  const [dateError, setDateError] = useState('');
  const [dateWarning, setDateWarning] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const totalPayable = selectedOutgoing?.totalPayableAmount || 0;

  // Compute invoice date string for min date
  const invoiceDate = selectedOutgoing ? new Date(selectedOutgoing[dateField]) : new Date(0);
  const invoiceDateStr = invoiceDate.toISOString().split('T')[0];
  const currentDate = new Date().toISOString().split('T')[0];

useEffect(()=>{
  dispatch(fetchBank());
},[dispatch]);
useEffect(() => {
  if (selectedOutgoing && open) {
    dispatch(fetchActiveDebitsVendor(selectedOutgoing.vendorName));
    dispatch(fetchActiveAdvancesVendorByName(selectedOutgoing.vendorName));
    const initialAmount = totalPayable.toFixed(2);
    const currentDateStr = new Date().toISOString().split('T')[0];
    
    // Debug: Check what date field contains
    console.log('Invoice date field:', selectedOutgoing[dateField]);
    console.log('Parsed invoice date:', new Date(selectedOutgoing[dateField]));
    
    setPaymentDetails({
      paymentMethod: '',
      neftNo: '',
      amount: initialAmount,
      bankName: '',
      paymentType: 'full',
      rtgsNo: '',
      paymentMode: 'Bank',
      cashAmount: 0,
      upi: '',
      impsNo: '',
      selectedDebitNotes: [],
      selectedAdvancePayments: [],
      paymentDate: currentDateStr,
    });
    setError('');
    setDateError('');
    setDateWarning('');
    setShowConfirmation(false);
  }
}, [selectedOutgoing, open, dispatch, totalPayable]);

  const uncappedDebitSum = paymentDetails.selectedDebitNotes.reduce((sum, debitId) => {
    const debit = debits.find((d: any) => d.randomId === debitId);
    return sum + (debit ? (debit.finalAmount || 0) : 0);
  }, 0);

  const uncappedAdvanceSum = paymentDetails.selectedAdvancePayments.reduce((sum, advanceId) => {
    const advance = singleadvance.find((a: any) => a.randomId === advanceId);
    return sum + (advance ? (advance.pendingAmount || 0) : 0);
  }, 0);

  const paymentNum = parseFloat(paymentDetails.amount || '0');
  const isPartial = paymentDetails.paymentType === 'partial';
  const available = isPartial ? Math.max(0, totalPayable - paymentNum) : totalPayable;
  const effectiveDebit = Math.min(uncappedDebitSum, available);
  const effectiveAdvance = Math.min(uncappedAdvanceSum, available - effectiveDebit);
  const totalDebitAmount = effectiveDebit;
  const totalAdvanceAmount = effectiveAdvance;

  const getBaseRemainingForAdjustments = () => totalPayable - uncappedDebitSum - (isPartial ? paymentNum : 0);

  const validateAmount = (amount: string, maxAllowed: number, isPartialCheck: boolean): string => {
    if (isPartialCheck && !amount) return 'Please enter an amount';
    const numAmount = parseFloat(amount || '0');
    if (isNaN(numAmount)) return 'Invalid amount format';
    if (numAmount < 0) return 'Amount cannot be negative';
    if (isPartialCheck && numAmount > maxAllowed) {
      return `Payment amount (₹${numAmount.toFixed(2)}) exceeds total payable amount (₹${maxAllowed.toFixed(2)})`;
    }
    return '';
  };

const validateDate = (value: string): { error: string | null; warning: string | null } => {
  if (!value) return { error: 'Payment date is required', warning: null };
  
  const selectedDate = new Date(value);
  if (isNaN(selectedDate.getTime())) return { error: 'Invalid date format', warning: null };
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  selectedDate.setHours(0, 0, 0, 0);
  
  // Fix: Ensure invoice date is also normalized for comparison
  const normalizedInvoiceDate = new Date(invoiceDate);
  normalizedInvoiceDate.setHours(0, 0, 0, 0);
  
  if (selectedDate > today) return { error: 'Future date not allowed', warning: null };
  if (selectedDate < normalizedInvoiceDate) return { error: 'Payment date cannot be before invoice date', warning: null };
  
  return { error: null, warning: null };
};
  const handlePaymentTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedType = e.target.value as 'full' | 'partial';
    let newAmount;
    if (selectedType === 'full') {
      // For full payment, calculate the remaining amount after debit and advance
      const cappedDebit = Math.min(uncappedDebitSum, totalPayable);
      const cappedAdvance = Math.min(uncappedAdvanceSum, totalPayable - cappedDebit);
      newAmount = (totalPayable - cappedDebit - cappedAdvance).toFixed(2);
    } else {
      // For partial payment, start with empty amount so user can type
      newAmount = '';
    }
    setPaymentDetails((prev) => ({
      ...prev,
      paymentType: selectedType,
      amount: newAmount,
      cashAmount: prev.paymentMode === 'Cash' ? parseFloat(newAmount || '0') : 0,
    }));
    setError(validateAmount(newAmount, totalPayable, selectedType === 'partial'));
  };

  const handlePaymentModeChange = (e: React.ChangeEvent<{ value: unknown }>) => {
    const selectedMode = e.target.value as 'Cash' | 'Bank';
    setPaymentDetails((prev) => ({
      ...prev,
      paymentMode: selectedMode,
      paymentMethod: selectedMode === 'Cash' ? 'cash' : '',
      cashAmount: selectedMode === 'Cash' ? parseFloat(prev.amount || '0') : 0,
      bankName: selectedMode === 'Cash' ? '' : prev.bankName,
      neftNo: '',
      rtgsNo: '',
      impsNo: '',
      upi: '',
    }));
    setError('');
  };

  const handlePaymentMethodChange = (e: React.ChangeEvent<{ value: unknown }>) => {
    setPaymentDetails((prev) => ({
      ...prev,
      paymentMethod: e.target.value as string,
      neftNo: '',
      rtgsNo: '',
      impsNo: '',
      upi: '',
    }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'amount' && !/^\d*\.?\d*$/.test(value)) return;

    setPaymentDetails((prev) => {
      const newDetails = {
        ...prev,
        [name]: value,
        ...(name === 'amount' && prev.paymentMode === 'Cash' && prev.paymentMethod === 'cash'
          ? { cashAmount: parseFloat(value || '0') }
          : {}),
      };
      if (name === 'amount') {
        setError(validateAmount(value, totalPayable, isPartial));
      }
      if (name === 'paymentDate') {
        const validation = validateDate(value);
        setDateError(validation.error || '');
        setDateWarning(validation.warning || '');
      }
      return newDetails;
    });
  };

  const handleDebitNoteChange = (selectedValues: string[]) => {
    const newUncappedDebit = selectedValues.reduce((sum, id) => {
      const debit = debits.find((d: any) => d.randomId === id);
      return sum + (debit ? (debit.finalAmount || 0) : 0);
    }, 0);
    let newAmount = paymentDetails.amount;
    if (paymentDetails.paymentType === 'full') {
      const cappedDebit = Math.min(newUncappedDebit, totalPayable);
      const cappedAdvance = Math.min(uncappedAdvanceSum, totalPayable - cappedDebit);
      newAmount = (totalPayable - cappedDebit - cappedAdvance).toFixed(2);
    }
    setPaymentDetails((prev) => ({
      ...prev,
      selectedDebitNotes: selectedValues,
      amount: newAmount,
      cashAmount: prev.paymentMode === 'Cash' ? parseFloat(newAmount || '0') : 0,
    }));
    setError(paymentDetails.paymentType === 'partial' ? validateAmount(newAmount, totalPayable, true) : '');
  };

  const handleAdvancePaymentChange = (selectedValues: string[]) => {
    const newUncappedAdvance = selectedValues.reduce((sum, id) => {
      const advance = singleadvance.find((a: any) => a.randomId === id);
      return sum + (advance ? (advance.pendingAmount || 0) : 0);
    }, 0);
    let newAmount = paymentDetails.amount;
    if (paymentDetails.paymentType === 'full') {
      const cappedDebit = Math.min(uncappedDebitSum, totalPayable);
      const cappedAdvance = Math.min(newUncappedAdvance, totalPayable - cappedDebit);
      newAmount = (totalPayable - cappedDebit - cappedAdvance).toFixed(2);
    }
    setPaymentDetails((prev) => ({
      ...prev,
      selectedAdvancePayments: selectedValues,
      amount: newAmount,
      cashAmount: prev.paymentMode === 'Cash' ? parseFloat(newAmount || '0') : 0,
    }));
    setError(paymentDetails.paymentType === 'partial' ? validateAmount(newAmount, totalPayable, true) : '');
  };

  const resetPaymentDetails = () => {
    setPaymentDetails({
      paymentMethod: '',
      neftNo: '',
      amount: '',
      bankName: '',
      paymentType: 'full',
      rtgsNo: '',
      paymentMode: 'Bank',
      cashAmount: 0,
      upi: '',
      impsNo: '',
      selectedDebitNotes: [],
      selectedAdvancePayments: [],
      paymentDate: '',
    });
    setError('');
    setDateError('');
    setDateWarning('');
    setShowConfirmation(false);
  };

  const handleClose = () => {
    resetPaymentDetails();
    onClose();
  };

  const handlePaymentClick = () => {
    if (!selectedOutgoing) {
      dispatch(setSnackbarMessage('No outgoing payment selected'));
      dispatch(setSnackbarOpen(true));
      return;
    }

    const validationError = validateAmount(paymentDetails.amount, totalPayable, isPartial);
    if (validationError) {
      setError(validationError);
      dispatch(setSnackbarMessage(validationError));
      dispatch(setSnackbarOpen(true));
      return;
    }

    const dateValidation = validateDate(paymentDetails.paymentDate);
    if (dateValidation.error) {
      setDateError(dateValidation.error);
      dispatch(setSnackbarMessage(dateValidation.error));
      dispatch(setSnackbarOpen(true));
      return;
    }

    if (dateValidation.warning) {
      dispatch(setSnackbarMessage(dateValidation.warning));
      dispatch(setSnackbarOpen(true));
    }

    // Show confirmation dialog instead of processing immediately
    setShowConfirmation(true);
  };

  const handleConfirmPayment = async () => {
    const paymentAmount = parseFloat(paymentDetails.amount || '0');
    
    // FIXED: Create date in local timezone without UTC conversion
    const paymentDate = new Date(paymentDetails.paymentDate);
    // Set to noon to avoid timezone issues
    paymentDate.setHours(12, 0, 0, 0);

    const paymentDetailsToSend: ProcessPaymentRequest = {
      outgoingId: selectedOutgoing.outgoingId,
      paymentType: paymentDetails.paymentType,
      totalPayableAmount: totalPayable,
      fullPaymentAmount: paymentDetails.paymentType === 'full' ? totalPayable - totalDebitAmount - totalAdvanceAmount : 0,
      partialAmount: paymentDetails.paymentType === 'partial' ? paymentAmount : 0,
      paymentMethod: paymentDetails.paymentMethod,
      paymentMode: paymentDetails.paymentMode,
      cashAmount: paymentDetails.paymentMode === 'Cash' && paymentDetails.paymentMethod === 'cash' ? paymentAmount : 0,
      upi: paymentDetails.paymentMethod === 'upi' ? paymentDetails.upi : '',
      bankName: paymentDetails.paymentMode === 'Bank' ? paymentDetails.bankName : '',
      impsNo: paymentDetails.paymentMethod === 'imps' ? paymentDetails.impsNo : '',
      neftNo: paymentDetails.paymentMethod === 'neft' ? paymentDetails.neftNo : '',
      rtgsNo: paymentDetails.paymentMethod === 'rtgs' ? paymentDetails.rtgsNo : '',
      chequeNo: '',
      selectedDebitNotes: paymentDetails.selectedDebitNotes,
      selectedAdvancePayments: paymentDetails.selectedAdvancePayments,
      paymentDate: paymentDate, // This will be sent as local date time
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

  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
  };

  if (!selectedOutgoing) return null;

  return (
    <>
      {/* Main Payment Dialog */}
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
            Total Amount: ₹{totalPayable.toFixed(2)}
          </Typography>
          <Typography  >
            Total Debit Amount: ₹{totalDebitAmount.toFixed(2)}
          </Typography>
          <Typography  >
            Total Advance Amount: ₹{totalAdvanceAmount.toFixed(2)}
          </Typography>
          <Typography  >
            Remaining Payable: ₹{(totalPayable - totalDebitAmount - totalAdvanceAmount).toFixed(2)}
          </Typography>

          <TextField
            type="date"
            name="paymentDate"
            label="Payment Date"
            value={paymentDetails.paymentDate}
            onChange={handleInputChange}
            fullWidth
            margin="normal"
            required
            error={!!dateError}
            size="small"
            inputProps={{
              min:invoiceDateStr,
              max: currentDate,
            }}
          />

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
            disabled={paymentDetails.paymentType === 'full'} // Only disable for full payment
            inputProps={{ 
              type: 'number', 
              step: '0.01',
              min: 0,
              max: paymentDetails.paymentType === 'partial' ? totalPayable : undefined
            }}
            size="small"
            placeholder={paymentDetails.paymentType === 'partial' ? 'Enter partial amount' : ''}
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

          {debits.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2">Apply Debit Notes</Typography>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Apply Debit Notes</InputLabel>
                <Select
                  multiple
                  value={paymentDetails.selectedDebitNotes}
                  onChange={(e: SelectChangeEvent<string[]>) => handleDebitNoteChange(e.target.value as string[])}
                  label="Apply Debit Notes"
                  size="small"
                  renderValue={(selected) =>
                    selected.length === 0
                      ? 'No debit notes selected'
                      : selected
                          .map((id) => {
                            const debit = debits.find((d: any) => d.randomId === id);
                            return debit ? `${debit.randomId} (₹${(debit.finalAmount || 0).toFixed(2)})` : '';
                          })
                          .join(', ')
                  }
                >
                  {debits.map((debit: any) => (
                    <MenuItem key={debit.randomId} value={debit.randomId}>
                      <Checkbox checked={paymentDetails.selectedDebitNotes.includes(debit.randomId)} />
                      <ListItemText
                        primary={`${debit.randomId} - ₹${parseFloat(debit.finalAmount || '0').toFixed(2)}`}
                      />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          )}

          {singleadvance.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2">Apply Advance Payments</Typography>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Apply Advance Payments</InputLabel>
                <Select
                  multiple
                  value={paymentDetails.selectedAdvancePayments}
                  onChange={(e: SelectChangeEvent<string[]>) => handleAdvancePaymentChange(e.target.value as string[])}
                  label="Apply Advance Payments"
                  size="small"
                  renderValue={(selected) =>
                    selected.length === 0
                      ? 'No advance payments selected'
                      : selected
                          .map((id, index, array) => {
                            const advance = singleadvance.find((a: any) => a.randomId === id);
                            const prevAdvanceSum = array.slice(0, index).reduce((sum, prevId) => {
                              const prevAdvance = singleadvance.find((a: any) => a.randomId === prevId);
                              return sum + (prevAdvance ? (prevAdvance.pendingAmount || 0) : 0);
                            }, 0);
                            const remaining = getBaseRemainingForAdjustments() - prevAdvanceSum;
                            const cappedAmount = advance ? Math.min(advance.pendingAmount || 0, Math.max(0, remaining)) : 0;
                            return advance ? `${advance.randomId} (₹${cappedAmount.toFixed(2)})` : '';
                          })
                          .join(', ')
                  }
                >
                  {singleadvance.map((advance: any) => {
                    const index = paymentDetails.selectedAdvancePayments.indexOf(advance.randomId);
                    const prevSelectedSum = index >= 0 ? paymentDetails.selectedAdvancePayments
                      .slice(0, index)
                      .reduce((sum, prevId) => {
                        const prevAdvance = singleadvance.find((a: any) => a.randomId === prevId);
                        return sum + (prevAdvance ? (prevAdvance.pendingAmount || 0) : 0);
                      }, 0) : 0;
                    const remaining = getBaseRemainingForAdjustments() - prevSelectedSum;
                    const cappedAmount = Math.min(advance.pendingAmount || 0, Math.max(0, remaining));
                    return (
                      <MenuItem key={advance.randomId} value={advance.randomId} disabled={cappedAmount <= 0}>
                        <Checkbox checked={paymentDetails.selectedAdvancePayments.includes(advance.randomId)} />
                        <ListItemText
                          primary={`${advance.randomId} - ₹${parseFloat(advance.pendingAmount || '0').toFixed(2)} (Available: ₹${cappedAmount.toFixed(2)})`}
                        />
                      </MenuItem>
                    );
                  })}
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
            onClick={handlePaymentClick}
            color="primary"
            disabled={isLoading || !!error || !!dateError || (paymentDetails.paymentType === 'partial' && !parseFloat(paymentDetails.amount))}
            size="small"
          >
            {isLoading ? <CircularProgress size={24} /> : 'Process Payment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog
        open={showConfirmation}
        onClose={handleCancelConfirmation}
        maxWidth="xs"
        sx={{
          '& .MuiDialog-paper': {
            width: '350px',
            maxWidth: '350px',
            minWidth: '350px',
            fontSize:'16px',
          },
        }}
      >
        <DialogTitle>Confirm Payment</DialogTitle>
        <DialogContent>
          <Typography  gutterBottom>
            Are you sure you want to process this payment?
          </Typography>
          <Typography  gutterBottom>
            Total Amount: ₹{totalPayable.toFixed(2)}
          </Typography>
          <Typography   gutterBottom>
            Payment Amount: ₹{parseFloat(paymentDetails.amount || '0').toFixed(2)}
          </Typography>
          {totalDebitAmount > 0 && (
            <Typography  gutterBottom>
              Debit Adjustment: ₹{totalDebitAmount.toFixed(2)}
            </Typography>
          )}
          {totalAdvanceAmount > 0 && (
            <Typography   gutterBottom>
              Advance Adjustment: ₹{totalAdvanceAmount.toFixed(2)}
            </Typography>
          )}
          <Typography  >
            Payment Date: {paymentDetails.paymentDate}
          </Typography>
          <Typography  >
            Payment Mode: {paymentDetails.paymentMode}
          </Typography>
          {paymentDetails.paymentMode === 'Bank' && paymentDetails.bankName && (
            <Typography  >
              Bank: {paymentDetails.bankName}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelConfirmation} color="primary" size="small">
            Cancel
          </Button>
          <Button
            onClick={handleConfirmPayment}
            color="primary"
            disabled={isLoading}
            size="small"
            variant="contained"
          >
            {isLoading ? <CircularProgress size={24} /> : 'Confirm Payment'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SinglePaymentDialog;