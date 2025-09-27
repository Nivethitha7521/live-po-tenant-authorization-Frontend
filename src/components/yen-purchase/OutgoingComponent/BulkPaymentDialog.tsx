"use client";
import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
  Typography, Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, CircularProgress, Select, FormControl, InputLabel, Chip, Alert, Checkbox,
  ListItemText, Snackbar,
} from '@mui/material';
import { Outgoing, PaymentInfo } from '@/Models/outgoingModel';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '@/redux/store';
import {
  fetchActiveDebitsMultipleVendor, processBulkPayment, selectOutgoings, fetchOutgoings,
} from '@/features/yen-purchase/Outgoing/outgoingPaymentSlice';
import type { SelectChangeEvent } from '@mui/material/Select';

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  selectedOutgoings: Outgoing[];
}

interface DebitNote {
  randomId: string;
  noteId: string;
  vendorName: string;
  finalAmount: number;
  status: string;
  totalAmount: number;
}

interface PaymentDetailsState {
  paymentMode: 'Bank' | 'Cash' | '';
  paymentMethod: string;
  bankName: string;
  cashAmount: number;
}

const BulkPaymentDialog: React.FC<PaymentDialogProps> = ({
  open, onClose, selectedOutgoings
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { banks, debits, loading, error } = useSelector(selectOutgoings);

  const [paymentDetails, setPaymentDetails] = useState<PaymentDetailsState>({
    paymentMode: '',
    paymentMethod: '',
    bankName: '',
    cashAmount: 0,
  });
  const [paymentTypeMultiple, setPaymentTypeMultiple] = useState<Record<string, 'full' | 'partial'>>({});
  const [partialAmount, setPartialAmount] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedDebitNotes, setSelectedDebitNotes] = useState<Record<string, string[]>>({});
  const [isLoadingDebits, setIsLoadingDebits] = useState(false);
  const [showPaymentModeDialog, setShowPaymentModeDialog] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch debit notes when dialog opens
  useEffect(() => {
    if (open && selectedOutgoings.length > 0) {
      setIsLoadingDebits(true);
      setErrors((prev) => ({ ...prev, _general: '' }));

      const vendorNames = [
        ...new Set(
          selectedOutgoings.map((outgoing) => outgoing.vendorName || 'Unknown Vendor')
        ),
      ].filter((name) => name && name !== 'Unknown Vendor');

      if (vendorNames.length > 0) {
        dispatch(fetchActiveDebitsMultipleVendor(vendorNames))
          .unwrap()
          .then(() => {
            console.log(`Fetched debits for all vendors`);
          })
          .catch((error) => {
            console.error('Error fetching debits:', error);
            setErrors((prev) => ({ ...prev, _general: 'Failed to load debit notes' }));
          })
          .finally(() => {
            setIsLoadingDebits(false);
          });
      } else {
        setIsLoadingDebits(false);
        setErrors((prev) => ({ ...prev, _general: 'No vendors selected' }));
      }
    }
  }, [open, selectedOutgoings, dispatch]);

  // Group outgoings by vendor
  const groupedOutgoings = useMemo(() => {
    return selectedOutgoings.reduce((acc, outgoing) => {
      const vendorName = outgoing.vendorName || 'Unknown Vendor';
      if (!acc[vendorName]) {
        acc[vendorName] = [];
      }
      acc[vendorName].push(outgoing);
      return acc;
    }, {} as Record<string, Outgoing[]>);
  }, [selectedOutgoings]);

  // Calculate total overall amount
  const totalOverallAmount = useMemo(() => {
    return selectedOutgoings.reduce(
      (total, outgoing) => total + (outgoing.totalPayableAmount || 0),
      0
    );
  }, [selectedOutgoings]);

  // Get vendor-specific debit notes
  const getVendorDebitNotes = (vendorName: string) => {
    return debits.filter(
      (debit) => debit.vendorName === vendorName &&
                debit.status !== 'Cleared' &&
                debit.status !== 'Applied'
    );
  };

  // Calculate total debit amount for a vendor
  const calculateVendorDebitAmount = (vendorName: string) => {
    const debitNotes = selectedDebitNotes[vendorName] || [];
    return debitNotes.reduce((sum, debitId) => {
      const debit = debits.find((d) => d.randomId === debitId);
      return sum + (debit ? debit.finalAmount : 0);
    }, 0);
  };

  // Calculate total payable amount for a vendor
  const calculateVendorPayableAmount = (vendorName: string) => {
    const vendorOutgoings = groupedOutgoings[vendorName] || [];
    return vendorOutgoings.reduce(
      (sum, outgoing) => sum + (outgoing.totalPayableAmount || 0),
      0
    );
  };

  // Validate amount for individual outgoing
  const validateAmount = (
    outgoingId: string,
    amount: string,
    maxAllowed: number
  ): string => {
    if (!amount && paymentTypeMultiple[outgoingId] === 'partial') {
      return 'Please enter an amount';
    }

    const numAmount = parseFloat(amount || '0');
    if (isNaN(numAmount)) return 'Invalid amount format';
    if (numAmount < 0) return 'Amount cannot be negative';
    if (numAmount > maxAllowed) return `Payment amount cannot exceed payable amount (₹${maxAllowed.toFixed(2)})`;

    return '';
  };

  // Handle payment type change for individual outgoing
  const handlePaymentTypeChangeMultiple = (
    outgoingId: string,
    event: SelectChangeEvent<'full' | 'partial'>
  ) => {
    const value = event.target.value as 'full' | 'partial';
    setPaymentTypeMultiple((prev) => ({ ...prev, [outgoingId]: value }));

    if (value === 'full') {
      setPartialAmount((prev) => ({ ...prev, [outgoingId]: '' }));
      setErrors((prev) => ({ ...prev, [outgoingId]: '' }));
    }
  };

  // Handle payment mode change
  const handlePaymentModeChange = (event: SelectChangeEvent<'Bank' | 'Cash'>) => {
    const value = event.target.value as 'Bank' | 'Cash';
    setPaymentDetails((prev) => ({
      ...prev,
      paymentMode: value,
      paymentMethod: value === 'Bank' ? 'neft' : 'cash',
      bankName: value === 'Bank' ? prev.bankName : '',
      cashAmount: 0,
    }));
    setErrors((prev) => ({ ...prev, _paymentMode: '' }));
  };

  // Handle bank name change
  const handleBankNameChange = (event: SelectChangeEvent) => {
    setPaymentDetails((prev) => ({ ...prev, bankName: event.target.value }));
    setErrors((prev) => ({ ...prev, _paymentMode: '' }));
  };

  // Handle payment method change
  const handlePaymentMethodChange = (event: SelectChangeEvent) => {
    setPaymentDetails((prev) => ({ ...prev, paymentMethod: event.target.value }));
    setErrors((prev) => ({ ...prev, _paymentMode: '' }));
  };

  // Handle partial amount change
  const handlePartialAmountChange = (
    outgoingId: string,
    value: string,
    maxAmount: number
  ) => {
    if (value === '') {
      setPartialAmount((prev) => ({ ...prev, [outgoingId]: '' }));
      setErrors((prev) => ({ ...prev, [outgoingId]: '' }));
      return;
    }

    const validationError = validateAmount(outgoingId, value, maxAmount);
    setErrors((prev) => ({ ...prev, [outgoingId]: validationError }));
    setPartialAmount((prev) => ({ ...prev, [outgoingId]: value }));
  };

  // Handle debit note selection
  const handleDebitNoteSelection = (
    vendorName: string,
    event: SelectChangeEvent<string[]>
  ) => {
    const selectedDebitIds = event.target.value as string[];
    const validDebitIds = selectedDebitIds.filter((debitId) => {
      const debit = debits.find((d) => d.randomId === debitId);
      return debit && debit.vendorName === vendorName;
    });

    setSelectedDebitNotes((prev) => ({
      ...prev,
      [vendorName]: validDebitIds,
    }));

    // Revalidate amounts after debit note selection
    const vendorOutgoings = groupedOutgoings[vendorName] || [];
    vendorOutgoings.forEach((outgoing) => {
      const outgoingId = outgoing.outgoingId as string;
      const currentAmount = partialAmount[outgoingId] || '';

      if (currentAmount) {
        const validationError = validateAmount(
          outgoingId,
          currentAmount,
          outgoing.totalPayableAmount || 0
        );
        setErrors((prev) => ({ ...prev, [outgoingId]: validationError }));
      }
    });
  };

  // Validate the main form
  const validateForm = (): boolean => {
    let isValid = true;
    const newErrors: Record<string, string> = {};

    if (Object.keys(groupedOutgoings).length === 0) {
      newErrors._general = 'No vendors selected';
      isValid = false;
    }

    Object.keys(groupedOutgoings).forEach((vendorName) => {
      const vendorDebitAmount = calculateVendorDebitAmount(vendorName);
      const vendorPayableAmount = calculateVendorPayableAmount(vendorName);

      if (vendorDebitAmount > vendorPayableAmount) {
        newErrors[vendorName] = `Debit notes exceed vendor's total payable amount`;
        isValid = false;
      }
    });

    for (const outgoing of selectedOutgoings) {
      const outgoingId = outgoing.outgoingId as string;
      const paymentType = paymentTypeMultiple[outgoingId] || 'full';

      if (paymentType === 'partial') {
        const amount = partialAmount[outgoingId] || '';
        const validationError = validateAmount(
          outgoingId,
          amount,
          outgoing.totalPayableAmount || 0
        );

        if (validationError) {
          newErrors[outgoingId] = validationError;
          isValid = false;
        }
      }
    }

    setErrors((prev) => ({ ...prev, ...newErrors }));
    return isValid;
  };

  // Validate payment mode dialog inputs
  const validatePaymentMode = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!paymentDetails.paymentMode) {
      newErrors._paymentMode = 'Payment mode is required';
      setErrors((prev) => ({ ...prev, ...newErrors }));
      return false;
    }

    if (paymentDetails.paymentMode === 'Bank' && !paymentDetails.bankName) {
      newErrors._paymentMode = 'Please select a bank';
      setErrors((prev) => ({ ...prev, ...newErrors }));
      return false;
    }

    setErrors((prev) => ({ ...prev, _paymentMode: '' }));
    return true;
  };

  // Handle opening the payment mode dialog
  const handleProcessPayment = () => {
    if (!validateForm()) return;
    setShowPaymentModeDialog(true);
  };

  // Handle final payment confirmation
  const handleConfirmPayment = async () => {
    if (!validatePaymentMode()) return;

    try {
      const payments: PaymentInfo[] = selectedOutgoings.map((outgoing) => {
        const outgoingId = outgoing.outgoingId as string;
        const vendorName = outgoing.vendorName || 'Unknown Vendor';
        const paymentType = paymentTypeMultiple[outgoingId] || 'full';
        const vendorSelectedDebitNotes = selectedDebitNotes[vendorName] || [];

        const amount = paymentType === 'partial'
          ? parseFloat(partialAmount[outgoingId] || '0')
          : outgoing.totalPayableAmount || 0;

        return {
          outgoingId,
          paymentMode: paymentDetails.paymentMode as 'Bank' | 'Cash',
          paymentType,
          fullPaymentAmount: paymentType === 'full' ? amount : 0,
          partialAmount: paymentType === 'partial' ? amount : 0,
          paymentMethod: paymentDetails.paymentMethod,
          cashAmount: paymentDetails.paymentMode === 'Cash' ? amount : 0,
          bankName: paymentDetails.bankName,
          selectedDebitNotes: vendorSelectedDebitNotes,
        };
      });

      const outgoingIds = selectedOutgoings.map(
        (outgoing) => outgoing.outgoingId as string
      );

      // Process the bulk payment
      await dispatch(processBulkPayment({ payments, outgoingIds })).unwrap();

      // Immediately fetch updated outgoings data
      await dispatch(fetchOutgoings({
        page: 1,
        size: 50,
        filterByAmount: true,
        filterBy: 'invoiceDate',
      })).unwrap();

      // Show success notification
      setSuccessMessage('Payment processed and data updated successfully');

      // Reset state
      setPaymentDetails({
        paymentMode: '',
        paymentMethod: '',
        bankName: '',
        cashAmount: 0,
      });
      setPaymentTypeMultiple({});
      setPartialAmount({});
      setSelectedDebitNotes({});
      setErrors({});
      setShowPaymentModeDialog(false);
      onClose();
    } catch (error) {
      console.error('Payment processing failed:', error);
      setErrors((prev) => ({
        ...prev,
        _general: 'Failed to process payment. Please try again.'
      }));
    }
  };

  // Handle closing the dialog
  const handleClose = () => {
    setPaymentDetails({
      paymentMode: '',
      paymentMethod: '',
      bankName: '',
      cashAmount: 0,
    });
    setPaymentTypeMultiple({});
    setPartialAmount({});
    setSelectedDebitNotes({});
    setErrors({});
    setShowPaymentModeDialog(false);
    setSuccessMessage(null);
    onClose();
  };

  return (
    <>
      {/* Success Notification */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={6000}
        onClose={() => setSuccessMessage(null)}
      >
        <Alert
          onClose={() => setSuccessMessage(null)}
          severity="success"
          sx={{ width: '100%' }}
        >
          {successMessage}
        </Alert>
      </Snackbar>

      {/* Main Bulk Payment Dialog */}
      <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
        <DialogTitle>Bulk Payment Processing</DialogTitle>
        <DialogContent>
          <Typography variant="h6" gutterBottom>
            Total Amount: ₹{totalOverallAmount.toLocaleString('en-IN', {
              minimumFractionDigits: 2
            })}
          </Typography>

          {errors._general && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errors._general}
            </Alert>
          )}

          {(isLoadingDebits || loading) && (
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <CircularProgress size={20} />
              <Typography>Loading debit notes...</Typography>
            </Box>
          )}

          {/* Vendor Sections */}
          {Object.entries(groupedOutgoings).map(([vendorName, vendorOutgoings]) => {
            const vendorDebitNotes = getVendorDebitNotes(vendorName);
            const vendorTotal = calculateVendorPayableAmount(vendorName);
            const vendorDebitAmount = calculateVendorDebitAmount(vendorName);

            return (
              <Paper key={vendorName} sx={{ p: 2, mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                  {vendorName}
                </Typography>

                {vendorDebitAmount > 0 && (
                  <Chip
                    label={`Debit Applied: ₹${vendorDebitAmount.toLocaleString('en-IN')}`}
                    color="primary"
                    sx={{ mb: 2 }}
                  />
                )}

                {errors[vendorName] && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {errors[vendorName]}
                  </Alert>
                )}

                {vendorDebitNotes.length > 0 && (
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Available Debit Notes for {vendorName}</InputLabel>
                    <Select
                      multiple
                      value={selectedDebitNotes[vendorName] || []}
                      label={`Available Debit Notes for ${vendorName}`}
                      onChange={(e) =>
                        handleDebitNoteSelection(vendorName, e as SelectChangeEvent<string[]>)
                      }
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {selected.map((value) => {
                            const debit = vendorDebitNotes.find((d) => d.randomId === value);
                            return debit ? (
                              <Chip
                                key={value}
                                label={`${debit.noteId} (₹${debit.finalAmount})`}
                                size="small"
                              />
                            ) : null;
                          })}
                        </Box>
                      )}
                    >
                      {vendorDebitNotes.map((debit) => (
                        <MenuItem key={debit.randomId} value={debit.randomId}>
                          <Checkbox
                            checked={(selectedDebitNotes[vendorName] || []).includes(debit.randomId)}
                          />
                          <ListItemText
                            primary={`${debit.noteId} - ₹${debit.finalAmount.toLocaleString('en-IN')}`}
                            secondary={`Status: ${debit.status}`}
                          />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Invoice No</TableCell>
                        <TableCell>Payable Amount</TableCell>
                        <TableCell>Payment Type</TableCell>
                        <TableCell>Partial Amount</TableCell>
                        <TableCell>Error</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {vendorOutgoings.map((outgoing) => {
                        const outgoingId = outgoing.outgoingId as string;
                        const paymentType = paymentTypeMultiple[outgoingId] || 'full';
                        const payableAmount = outgoing.totalPayableAmount || 0;
                        const currentError = errors[outgoingId] || '';

                        return (
                          <TableRow key={outgoingId}>
                            <TableCell>{outgoing.invoiceNo}</TableCell>
                            <TableCell>
                              ₹{payableAmount.toLocaleString('en-IN', {
                                minimumFractionDigits: 2
                              })}
                            </TableCell>
                            <TableCell>
                              <FormControl size="small">
                                <Select
                                  value={paymentType}
                                  onChange={(e) =>
                                    handlePaymentTypeChangeMultiple(
                                      outgoingId,
                                      e as SelectChangeEvent<'full' | 'partial'>
                                    )
                                  }
                                  size="small"
                                  sx={{ minWidth: 100 }}
                                >
                                  <MenuItem value="full">Full</MenuItem>
                                  <MenuItem value="partial">Partial</MenuItem>
                                </Select>
                              </FormControl>
                            </TableCell>
                            <TableCell>
                              {paymentType === 'partial' && (
                                <TextField
                                  type="number"
                                  value={partialAmount[outgoingId] || ''}
                                  onChange={(e) =>
                                    handlePartialAmountChange(
                                      outgoingId,
                                      e.target.value,
                                      payableAmount
                                    )
                                  }
                                  error={!!currentError}
                                  helperText={currentError}
                                  sx={{ width: 120 }}
                                  inputProps={{
                                    min: 0,
                                    max: payableAmount,
                                    step: '0.01',
                                  }}
                                />
                              )}
                              {paymentType === 'full' && (
                                <Typography>
                                  ₹{payableAmount.toLocaleString('en-IN', {
                                    minimumFractionDigits: 2
                                  })}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              {currentError && (
                                <Typography color="error" variant="caption">
                                  {currentError}
                                </Typography>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            );
          })}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleProcessPayment}
            variant="contained"
            disabled={
              isLoadingDebits ||
              loading ||
              Object.keys(errors).some(key =>
                key !== '_general' && key !== '_paymentMode' && errors[key]
              )
            }
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? 'Processing...' : 'Confirm Payment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Payment Mode Confirmation Dialog */}
      <Dialog
        open={showPaymentModeDialog}
        onClose={() => setShowPaymentModeDialog(false)}
        maxWidth="sm"
      >
        <DialogTitle>Confirm Payment Details</DialogTitle>
        <DialogContent>
          {errors._paymentMode && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errors._paymentMode}
            </Alert>
          )}

          <Typography variant="h6" gutterBottom>
            Total Amount: ₹{totalOverallAmount.toLocaleString('en-IN', {
              minimumFractionDigits: 2
            })}
          </Typography>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Payment Mode</InputLabel>
            <Select
              value={paymentDetails.paymentMode}
              label="Payment Mode"
              onChange={handlePaymentModeChange}
            >
              <MenuItem value="Cash">Cash</MenuItem>
              <MenuItem value="Bank">Bank</MenuItem>
            </Select>
          </FormControl>

          {paymentDetails.paymentMode === 'Bank' && (
            <>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Bank Name</InputLabel>
                <Select
                  value={paymentDetails.bankName}
                  label="Bank Name"
                  onChange={handleBankNameChange}
                >
                  {banks.map((bank) => (
                    <MenuItem key={bank.bankName} value={bank.bankName}>
                      {bank.bankName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Payment Method</InputLabel>
                <Select
                  value={paymentDetails.paymentMethod}
                  label="Payment Method"
                  onChange={handlePaymentMethodChange}
                >
                  <MenuItem value="neft">NEFT</MenuItem>
                  <MenuItem value="rtgs">RTGS</MenuItem>
                  <MenuItem value="imps">IMPS</MenuItem>
                  <MenuItem value="upi">UPI</MenuItem>
                </Select>
              </FormControl>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPaymentModeDialog(false)} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleConfirmPayment}
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? 'Processing...' : 'Confirm Payment'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default BulkPaymentDialog;