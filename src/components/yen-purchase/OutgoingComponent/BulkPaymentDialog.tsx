"use client";
import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
  Typography, Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, CircularProgress, Select, FormControl, InputLabel, Chip, Alert, Checkbox,
  ListItemText, Snackbar, FormHelperText,
} from '@mui/material';
import { Outgoing, PaymentInfo } from '@/Models/outgoingModel';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '@/redux/store';
import {
  fetchActiveDebitsMultipleVendor,
  processBulkPayment,
  selectOutgoings,
  fetchOutgoings,
  clearAdvances,
} from '@/features/yen-purchase/Outgoing/outgoingPaymentSlice';
import type { SelectChangeEvent } from '@mui/material/Select';
import { fetchActiveAdvancesMultipleVendor, selectAdvances } from '@/features/yen-purchase/Outgoing/advancePaymentSlice';

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
  pendingAmount?: number; // ADDED
}

interface AdvancePayment {
  advanceId?: string;
  randomId?: string;
  vendorName?: string;
  amount?: number;
  pendingAmount?: number;
  status?: string;
  paymentDate?: string;
  createdDate?: string;
  // Add other fields as needed from backend response
}

interface PaymentDetailsState {
  paymentMode: 'Bank' | 'Cash' | '';
  paymentMethod: string;
  bankName: string;
  cashAmount: number;
  referenceNumber: string; // ADDED: Reference number field
}

const BulkPaymentDialog: React.FC<PaymentDialogProps> = ({
  open, onClose, selectedOutgoings
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { banks, debits, loading, error } = useSelector(selectOutgoings); // UPDATED: Include advances
  const {activeAdvances } =useSelector(selectAdvances);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetailsState>({
    paymentMode: '',
    paymentMethod: '',
    bankName: '',
    cashAmount: 0,
    referenceNumber: '', // ADDED
  });
  const [paymentTypeMultiple, setPaymentTypeMultiple] = useState<Record<string, 'full' | 'partial'>>({});
  const [partialAmount, setPartialAmount] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedDebitNotes, setSelectedDebitNotes] = useState<Record<string, string[]>>({});
  const [selectedAdvancePayments, setSelectedAdvancePayments] = useState<Record<string, string[]>>({}); // NEW: Advance payments
  const [isLoading, setIsLoading] = useState(false);
  const [showPaymentModeDialog, setShowPaymentModeDialog] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch debit notes AND advance payments when dialog opens
  useEffect(() => {
    if (open && selectedOutgoings.length > 0) {
      setIsLoading(true);
      setErrors((prev) => ({ ...prev, _general: '' }));

      const vendorNames = [
        ...new Set(
          selectedOutgoings.map((outgoing) => outgoing.vendorName || 'Unknown Vendor')
        ),
      ].filter((name) => name && name !== 'Unknown Vendor');

      if (vendorNames.length > 0) {
        // Fetch both debits and advances in parallel
        Promise.all([
          dispatch(fetchActiveDebitsMultipleVendor(vendorNames)).unwrap(),
          dispatch(fetchActiveAdvancesMultipleVendor(vendorNames)).unwrap()
        ])
        .then(() => {
          console.log(`Fetched payment options for ${vendorNames.length} vendors`);
        })
        .catch((error) => {
          console.error('Error fetching payment options:', error);
          setErrors((prev) => ({ ...prev, _general: 'Failed to load payment options' }));
        })
        .finally(() => {
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
        setErrors((prev) => ({ ...prev, _general: 'No vendors selected' }));
      }
    }

    // Cleanup when dialog closes
    return () => {
      if (!open) {
        dispatch(clearAdvances());
      }
    };
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
                (debit.pendingAmount || debit.finalAmount) > 0
    );
  };

  // Get vendor-specific advance payments
  const getVendorAdvancePayments = (vendorName: string) => {
    return activeAdvances.filter(
      (advance) => advance.vendorName === vendorName &&
                  advance.status !== 'Completed' &&
                  (advance.pendingAmount || 0) > 0
    );
  };

  // Calculate total available advance for vendor
  const calculateVendorAdvanceTotal = (vendorName: string) => {
    const vendorAdvances = getVendorAdvancePayments(vendorName);
    return vendorAdvances.reduce((sum, advance) => sum + (advance.pendingAmount || 0), 0);
  };

  // Calculate total debit amount for a vendor
  const calculateVendorDebitAmount = (vendorName: string) => {
    const debitNotes = selectedDebitNotes[vendorName] || [];
    return debitNotes.reduce((sum, debitId) => {
      const debit = debits.find((d) => d.randomId === debitId);
      return sum + (debit ? (debit.pendingAmount || debit.finalAmount || 0) : 0);
    }, 0);
  };

  // Calculate total advance amount used for a vendor
  const calculateVendorAdvanceAmount = (vendorName: string) => {
    const advanceIds = selectedAdvancePayments[vendorName] || [];
    return advanceIds.reduce((sum, advanceId) => {
      const advance = activeAdvances.find((a) => a.randomId === advanceId || a.advanceId === advanceId);
      return sum + (advance ? (advance.pendingAmount || 0) : 0);
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

  // Calculate maximum allowed payment for an outgoing (considering debits and advances)
  const calculateMaxAllowedPayment = (outgoing: Outgoing) => {
    const vendorName = outgoing.vendorName || 'Unknown Vendor';
    const vendorDebitAmount = calculateVendorDebitAmount(vendorName);
    const vendorAdvanceAmount = calculateVendorAdvanceAmount(vendorName);
    const totalVendorPayable = calculateVendorPayableAmount(vendorName);
    
    if (totalVendorPayable <= 0) return 0;
    
    // Distribute debits and advances proportionally across vendor's outgoings
    const outgoingProportion = (outgoing.totalPayableAmount || 0) / totalVendorPayable;
    const allocatedDebits = vendorDebitAmount * outgoingProportion;
    const allocatedAdvances = vendorAdvanceAmount * outgoingProportion;
    
    return Math.max(0, (outgoing.totalPayableAmount || 0) - allocatedDebits - allocatedAdvances);
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
    if (numAmount > maxAllowed) {
      return `Payment amount cannot exceed ₹${maxAllowed.toFixed(2)} (after debits/advances)`;
    }

    return '';
  };

  // Handle payment type change for individual outgoing
  const handlePaymentTypeChangeMultiple = (
    outgoingId: string,
    event: SelectChangeEvent<'full' | 'partial'>,
    outgoing: Outgoing
  ) => {
    const value = event.target.value as 'full' | 'partial';
    setPaymentTypeMultiple((prev) => ({ ...prev, [outgoingId]: value }));

    if (value === 'full') {
      const maxAllowed = calculateMaxAllowedPayment(outgoing);
      setPartialAmount((prev) => ({ ...prev, [outgoingId]: maxAllowed.toFixed(2) }));
      setErrors((prev) => ({ ...prev, [outgoingId]: '' }));
    } else {
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
      referenceNumber: '', // ADDED: Reset reference on mode change
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
    setPaymentDetails((prev) => ({ 
      ...prev, 
      paymentMethod: event.target.value,
      referenceNumber: '' // ADDED: Reset reference on method change
    }));
    setErrors((prev) => ({ ...prev, _paymentMode: '' }));
  };

  // ADDED: Handle reference number change
  const handleReferenceNumberChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPaymentDetails((prev) => ({ ...prev, referenceNumber: event.target.value }));
    setErrors((prev) => ({ ...prev, _paymentMode: '' }));
  };

  // Handle partial amount change
  const handlePartialAmountChange = (
    outgoingId: string,
    value: string,
    outgoing: Outgoing
  ) => {
    if (value === '') {
      setPartialAmount((prev) => ({ ...prev, [outgoingId]: '' }));
      setErrors((prev) => ({ ...prev, [outgoingId]: '' }));
      return;
    }

    const maxAllowed = calculateMaxAllowedPayment(outgoing);
    const validationError = validateAmount(outgoingId, value, maxAllowed);
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
        const maxAllowed = calculateMaxAllowedPayment(outgoing);
        const validationError = validateAmount(outgoingId, currentAmount, maxAllowed);
        setErrors((prev) => ({ ...prev, [outgoingId]: validationError }));
      }
    });
  };

  // Handle advance payment selection
  const handleAdvancePaymentSelection = (
    vendorName: string,
    event: SelectChangeEvent<string[]>
  ) => {
    const selectedAdvanceIds = event.target.value as string[];
    const validAdvanceIds = selectedAdvanceIds.filter((advanceId) => {
      const advance = activeAdvances.find((a) => a.randomId === advanceId || a.advanceId === advanceId);
      return advance && advance.vendorName === vendorName;
    });

    setSelectedAdvancePayments((prev) => ({
      ...prev,
      [vendorName]: validAdvanceIds,
    }));

    // Revalidate amounts after advance payment selection
    const vendorOutgoings = groupedOutgoings[vendorName] || [];
    vendorOutgoings.forEach((outgoing) => {
      const outgoingId = outgoing.outgoingId as string;
      const currentAmount = partialAmount[outgoingId] || '';

      if (currentAmount) {
        const maxAllowed = calculateMaxAllowedPayment(outgoing);
        const validationError = validateAmount(outgoingId, currentAmount, maxAllowed);
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

    // Validate each outgoing individually
    selectedOutgoings.forEach((outgoing) => {
      const outgoingId = outgoing.outgoingId as string;
      const paymentType = paymentTypeMultiple[outgoingId] || 'full';

      if (paymentType === 'partial') {
        const amount = partialAmount[outgoingId] || '';
        const maxAllowed = calculateMaxAllowedPayment(outgoing);
        const validationError = validateAmount(outgoingId, amount, maxAllowed);

        if (validationError) {
          newErrors[outgoingId] = validationError;
          isValid = false;
        }
      }
    });

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

    // ADDED: Validate reference number for bank payments
    if (paymentDetails.paymentMode === 'Bank' && !paymentDetails.referenceNumber.trim()) {
      newErrors._paymentMode = `Please enter ${getReferenceLabel(paymentDetails.paymentMethod)}`;
      setErrors((prev) => ({ ...prev, ...newErrors }));
      return false;
    }

    setErrors((prev) => ({ ...prev, _paymentMode: '' }));
    return true;
  };

  // ADDED: Helper to get reference label based on payment method
  const getReferenceLabel = (method: string): string => {
    switch (method) {
      case 'neft': return 'NEFT Reference Number';
      case 'rtgs': return 'RTGS Reference Number';
      case 'imps': return 'IMPS Reference Number';
      case 'upi': return 'UPI ID';
      default: return 'Reference Number';
    }
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
        
        const amount = paymentType === 'partial'
          ? parseFloat(partialAmount[outgoingId] || '0')
          : calculateMaxAllowedPayment(outgoing);

        return {
          outgoingId,
          paymentMode: paymentDetails.paymentMode as 'Bank' | 'Cash',
          paymentType,
          totalPayableAmount: outgoing.totalPayableAmount || 0,
          fullPaymentAmount: paymentType === 'full' ? amount : 0,
          partialAmount: paymentType === 'partial' ? amount : 0,
          paymentMethod: paymentDetails.paymentMethod,
          cashAmount: paymentDetails.paymentMode === 'Cash' ? amount : 0,
          bankName: paymentDetails.bankName,
          referenceNumber: paymentDetails.referenceNumber, // ADDED: Include reference number
          selectedDebitNotes: selectedDebitNotes[vendorName] || [],
          selectedAdvancePayments: selectedAdvancePayments[vendorName] || [], // NEW: Include advances
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
      setSuccessMessage('Bulk payment processed successfully!');

      // Reset state
      setPaymentDetails({
        paymentMode: '',
        paymentMethod: '',
        bankName: '',
        cashAmount: 0,
        referenceNumber: '', // ADDED
      });
      setPaymentTypeMultiple({});
      setPartialAmount({});
      setSelectedDebitNotes({});
      setSelectedAdvancePayments({});
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
      referenceNumber: '', // ADDED
    });
    setPaymentTypeMultiple({});
    setPartialAmount({});
    setSelectedDebitNotes({});
    setSelectedAdvancePayments({});
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
        <DialogTitle>
          <Typography variant="h5" component="div">
            Bulk Payment Processing
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Process payments for multiple vendors and invoices
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 3, p: 2, backgroundColor: 'primary.light', borderRadius: 1 }}>
            <Typography variant="h6" gutterBottom>
              Total Amount: ₹{totalOverallAmount.toLocaleString('en-IN', {
                minimumFractionDigits: 2
              })}
            </Typography>
            <Typography variant="body2">
              Processing {selectedOutgoings.length} invoices across {Object.keys(groupedOutgoings).length} vendors
            </Typography>
          </Box>

          {errors._general && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errors._general}
            </Alert>
          )}

          {isLoading && (
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <CircularProgress size={20} />
              <Typography>Loading payment options...</Typography>
            </Box>
          )}

          {/* Vendor Sections */}
          {Object.entries(groupedOutgoings).map(([vendorName, vendorOutgoings]) => {
            const vendorDebitNotes = getVendorDebitNotes(vendorName);
            const vendorAdvancePayments = getVendorAdvancePayments(vendorName);
            const vendorTotal = calculateVendorPayableAmount(vendorName);
            const vendorDebitAmount = calculateVendorDebitAmount(vendorName);
            const vendorAdvanceAmount = calculateVendorAdvanceAmount(vendorName);
            const vendorAdvanceTotal = calculateVendorAdvanceTotal(vendorName);

            return (
              <Paper key={vendorName} sx={{ p: 3, mb: 3, border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="h6" gutterBottom color="primary">
                  {vendorName}
                </Typography>

                {/* Vendor Summary */}
                <Box display="flex" gap={2} sx={{ mb: 3 }} flexWrap="wrap">
                  <Chip
                    label={`Total Payable: ₹${vendorTotal.toLocaleString('en-IN')}`}
                    color="default"
                    variant="outlined"
                  />
                  {vendorDebitAmount > 0 && (
                    <Chip
                      label={`Debit Applied: ₹${vendorDebitAmount.toLocaleString('en-IN')}`}
                      color="primary"
                    />
                  )}
                  {vendorAdvanceAmount > 0 && (
                    <Chip
                      label={`Advance Applied: ₹${vendorAdvanceAmount.toLocaleString('en-IN')}`}
                      color="secondary"
                    />
                  )}
                  {vendorAdvanceTotal > 0 && (
                    <Chip
                      label={`Available Advance: ₹${vendorAdvanceTotal.toLocaleString('en-IN')}`}
                      color="success"
                      variant="outlined"
                    />
                  )}
                </Box>

                {/* Debit Notes Selection */}
                {vendorDebitNotes.length > 0 && (
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Select Debit Notes for {vendorName}</InputLabel>
                    <Select
                      multiple
                      value={selectedDebitNotes[vendorName] || []}
                      label={`Select Debit Notes for ${vendorName}`}
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
                                label={`${debit.noteId} (₹${(debit.pendingAmount || debit.finalAmount).toLocaleString('en-IN')})`}
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
                            primary={`${debit.noteId} - ₹${(debit.pendingAmount || debit.finalAmount).toLocaleString('en-IN')}`}
                            secondary={`Pending: ₹${(debit.pendingAmount || debit.finalAmount).toLocaleString('en-IN')} | Status: ${debit.status}`}
                          />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                {/* Advance Payments Selection */}
                {vendorAdvancePayments.length > 0 && (
                  <FormControl fullWidth sx={{ mb: 3 }}>
                    <InputLabel>Select Advance Payments for {vendorName}</InputLabel>
                    <Select
                      multiple
                      value={selectedAdvancePayments[vendorName] || []}
                      label={`Select Advance Payments for ${vendorName}`}
                      onChange={(e) =>
                        handleAdvancePaymentSelection(vendorName, e as SelectChangeEvent<string[]>)
                      }
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {selected.map((value) => {
                            const advance = vendorAdvancePayments.find((a) => a.randomId === value || a.advanceId === value);
                            return advance ? (
                              <Chip
                                key={value}
                                label={`Advance (₹${(advance.pendingAmount || 0).toLocaleString('en-IN')})`}
                                size="small"
                                color="secondary"
                              />
                            ) : null;
                          })}
                        </Box>
                      )}
                    >
                      {vendorAdvancePayments.map((advance) => (
                        <MenuItem key={advance.randomId || advance.advanceId} value={advance.randomId || advance.advanceId || ''}>
                          <Checkbox
                            checked={(selectedAdvancePayments[vendorName] || []).includes(advance.randomId || advance.advanceId || '')}
                          />
                          <ListItemText
                            primary={`Advance - ₹${(advance.pendingAmount || 0).toLocaleString('en-IN')}`}
                            secondary={`Pending: ₹${(advance.pendingAmount || 0).toLocaleString('en-IN')} | Status: ${advance.status}`}
                          />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                {/* Outgoing Payments Table */}
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Invoice No</TableCell>
                        <TableCell>Payable Amount</TableCell>
                        <TableCell>Max Allowed</TableCell>
                        <TableCell>Payment Type</TableCell>
                        <TableCell>Payment Amount</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {vendorOutgoings.map((outgoing) => {
                        const outgoingId = outgoing.outgoingId as string;
                        const paymentType = paymentTypeMultiple[outgoingId] || 'full';
                        const payableAmount = outgoing.totalPayableAmount || 0;
                        const maxAllowed = calculateMaxAllowedPayment(outgoing);
                        const currentError = errors[outgoingId] || '';
                        const paymentAmount = paymentType === 'partial' 
                          ? parseFloat(partialAmount[outgoingId] || '0')
                          : maxAllowed;

                        return (
                          <TableRow key={outgoingId} hover>
                            <TableCell>
                              <Typography variant="body2" fontWeight="medium">
                                {outgoing.invoiceNo || 'N/A'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography>
                                ₹{payableAmount.toLocaleString('en-IN', {
                                  minimumFractionDigits: 2
                                })}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography 
                                variant="body2" 
                                color={maxAllowed < payableAmount ? "warning.main" : "text.primary"}
                                fontWeight="medium"
                              >
                                ₹{maxAllowed.toLocaleString('en-IN', {
                                  minimumFractionDigits: 2
                                })}
                              </Typography>
                              {maxAllowed < payableAmount && (
                                <FormHelperText>
                                  After debits/advances
                                </FormHelperText>
                              )}
                            </TableCell>
                            <TableCell>
                              <FormControl size="small" fullWidth>
                                <Select
                                  value={paymentType}
                                  onChange={(e) =>
                                    handlePaymentTypeChangeMultiple(
                                      outgoingId,
                                      e as SelectChangeEvent<'full' | 'partial'>,
                                      outgoing
                                    )
                                  }
                                  size="small"
                                >
                                  <MenuItem value="full">Full</MenuItem>
                                  <MenuItem value="partial">Partial</MenuItem>
                                </Select>
                              </FormControl>
                            </TableCell>
                            <TableCell>
                              {paymentType === 'partial' ? (
                                <TextField
                                  type="number"
                                  value={partialAmount[outgoingId] || ''}
                                  onChange={(e) =>
                                    handlePartialAmountChange(
                                      outgoingId,
                                      e.target.value,
                                      outgoing
                                    )
                                  }
                                  error={!!currentError}
                                  helperText={currentError}
                                  sx={{ width: 140 }}
                                  inputProps={{
                                    min: 0,
                                    max: maxAllowed,
                                    step: '0.01',
                                  }}
                                  size="small"
                                />
                              ) : (
                                <Typography fontWeight="medium">
                                  ₹{paymentAmount.toLocaleString('en-IN', {
                                    minimumFractionDigits: 2
                                  })}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              {currentError ? (
                                <Typography color="error" variant="caption">
                                  {currentError}
                                </Typography>
                              ) : (
                                <Chip 
                                  label={paymentType === 'full' ? 'Full Payment' : 'Partial Payment'} 
                                  size="small" 
                                  color={paymentType === 'full' ? 'success' : 'warning'}
                                  variant="outlined"
                                />
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
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button onClick={handleClose} color="inherit" size="large">
            Cancel
          </Button>
          <Button
            onClick={handleProcessPayment}
            variant="contained"
            size="large"
            disabled={
              isLoading ||
              loading ||
              Object.keys(errors).some(key =>
                key !== '_general' && key !== '_paymentMode' && errors[key]
              )
            }
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? 'Processing...' : 'Process Payment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Payment Mode Confirmation Dialog */}
      <Dialog
        open={showPaymentModeDialog}
        onClose={() => setShowPaymentModeDialog(false)}
        maxWidth="sm"
      >
        <DialogTitle>
          <Typography variant="h6">Confirm Payment Details</Typography>
        </DialogTitle>
        <DialogContent>
          {errors._paymentMode && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errors._paymentMode}
            </Alert>
          )}

          <Box sx={{ mb: 3, p: 2, backgroundColor: 'success.light', borderRadius: 1 }}>
            <Typography variant="h6" gutterBottom>
              Total Payment: ₹{totalOverallAmount.toLocaleString('en-IN', {
                minimumFractionDigits: 2
              })}
            </Typography>
            <Typography variant="body2">
              Confirm payment details before proceeding
            </Typography>
          </Box>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Payment Mode *</InputLabel>
            <Select
              value={paymentDetails.paymentMode}
              label="Payment Mode *"
              onChange={handlePaymentModeChange}
              error={!!errors._paymentMode}
            >
              <MenuItem value="Cash">Cash</MenuItem>
              <MenuItem value="Bank">Bank</MenuItem>
            </Select>
            {errors._paymentMode && (
              <FormHelperText error>{errors._paymentMode}</FormHelperText>
            )}
          </FormControl>

          {paymentDetails.paymentMode === 'Bank' && (
            <>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Bank Name *</InputLabel>
                <Select
                  value={paymentDetails.bankName}
                  label="Bank Name *"
                  onChange={handleBankNameChange}
                  error={!!errors._paymentMode}
                >
                  {banks.map((bank) => (
                    <MenuItem key={bank.bankName} value={bank.bankName}>
                      {bank.bankName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Payment Method *</InputLabel>
                <Select
                  value={paymentDetails.paymentMethod}
                  label="Payment Method *"
                  onChange={handlePaymentMethodChange}
                >
                  <MenuItem value="neft">NEFT</MenuItem>
                  <MenuItem value="rtgs">RTGS</MenuItem>
                  <MenuItem value="imps">IMPS</MenuItem>
                  <MenuItem value="upi">UPI</MenuItem>
                </Select>
              </FormControl>

              {/* ADDED: Reference Number Field */}
              <TextField
                fullWidth
                label={getReferenceLabel(paymentDetails.paymentMethod)}
                value={paymentDetails.referenceNumber}
                onChange={handleReferenceNumberChange}
                error={!!errors._paymentMode}
                helperText={errors._paymentMode}
                placeholder={`Enter ${getReferenceLabel(paymentDetails.paymentMethod)}`}
                sx={{ mb: 2 }}
              />
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            onClick={() => setShowPaymentModeDialog(false)} 
            color="inherit"
            size="large"
          >
            Back
          </Button>
          <Button
            onClick={handleConfirmPayment}
            variant="contained"
            size="large"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? 'Processing...' : 'Confirm & Pay'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default BulkPaymentDialog;