"use client";
import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
  Typography, Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, CircularProgress, Select, FormControl, InputLabel, Chip, Alert, Checkbox,
  ListItemText, Snackbar, FormHelperText,
} from '@mui/material';
import { BulkPaymentRequest, Outgoing, PaymentInfo } from '@/Models/outgoingModel';
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
  pendingAmount?: number;
}

interface AdvancePayment {
  advanceId?: string;
  randomId?: string;
  vendorName?: string;
  amount?: number;
  pendingAmount?: number;
  status?: string;
  paymentDate?: Date;
  createdDate?: Date;
}

interface PaymentDetailsState {
  paymentMode: 'Bank' | 'Cash' | '';
  paymentMethod: string;
  bankName: string;
  cashAmount: number;
  referenceNumber: string;
  paymentDate: Date;  // Ensure it's always a Date object
}

const BulkPaymentDialog: React.FC<PaymentDialogProps> = ({
  open, onClose, selectedOutgoings
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { banks, debits, loading, error } = useSelector(selectOutgoings);
  const { activeAdvances } = useSelector(selectAdvances);
  
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetailsState>({
    paymentMode: 'Bank',
    paymentMethod: 'neft',
    bankName: '',
    cashAmount: 0,
    referenceNumber: '',
    paymentDate: new Date(),  // Initialize as current Date
  });
  const [paymentTypeMultiple, setPaymentTypeMultiple] = useState<Record<string, 'full' | 'partial'>>({});
  const [partialAmount, setPartialAmount] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedDebitNotes, setSelectedDebitNotes] = useState<Record<string, string[]>>({});
  const [selectedAdvancePayments, setSelectedAdvancePayments] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPaymentModeDialog, setShowPaymentModeDialog] = useState(false);
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Compute max invoice date for payment date constraints
  const maxInvoiceDate = useMemo(() => {
    if (selectedOutgoings.length === 0) return new Date(0);
    const dates = selectedOutgoings
      .map(outgoing => new Date(outgoing.invoiceDate || ''))
      .filter(date => !isNaN(date.getTime()));
    if (dates.length === 0) return new Date(0);
    const maxTime = Math.max(...dates.map(d => d.getTime()));
    return new Date(maxTime);
  }, [selectedOutgoings]);

  // FIXED: Use local YYYY-MM-DD for input constraints
  const maxInvoiceDateStr = useMemo(() => 
    maxInvoiceDate.toLocaleDateString('en-CA'), [maxInvoiceDate]
  );

  // FIXED: Use local YYYY-MM-DD for input constraints
  const currentDateStr = useMemo(() => 
    new Date().toLocaleDateString('en-CA'), []
  );

  useEffect(() => {
    if (open && selectedOutgoings.length > 0) {
      setIsLoading(true);
      setErrors((prev) => ({ ...prev, _general: '' }));

      // Set payment date to current date, but ensure it's after max invoice date
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const maxInv = new Date(maxInvoiceDate);
      maxInv.setHours(0, 0, 0, 0);
      const paymentDateToSet = new Date(Math.max(today.getTime(), maxInv.getTime()));
      setPaymentDetails(prev => ({ ...prev, paymentDate: paymentDateToSet }));

      const vendorNames = [
        ...new Set(
          selectedOutgoings.map((outgoing) => outgoing.vendorName || 'Unknown Vendor')
        ),
      ].filter((name) => name && name !== 'Unknown Vendor');

      if (vendorNames.length > 0) {
        // FIXED: Handle each dispatch individually to prevent overall failure on empty data
        const debitsPromise = dispatch(fetchActiveDebitsMultipleVendor(vendorNames)).unwrap().catch((error: any) => {
          console.error('Failed to fetch debits:', error);
          return []; // Return empty on error/empty
        });
        const advancesPromise = dispatch(fetchActiveAdvancesMultipleVendor(vendorNames)).unwrap().catch((error: any) => {
          console.error('Failed to fetch advances:', error);
          return []; // Return empty on error/empty
        });

        Promise.all([debitsPromise, advancesPromise])
          .then(([debitsResult, advancesResult]) => {
            console.log(`Fetched payment options for ${vendorNames.length} vendors (debits: ${debitsResult.length}, advances: ${advancesResult.length})`);
          })
          .catch((error) => {
            console.error('Unexpected error in payment options fetch:', error);
          })
          .finally(() => {
            setIsLoading(false);
          });
      } else {
        setIsLoading(false);
        setErrors((prev) => ({ ...prev, _general: 'No vendors selected' }));
      }
    }

    return () => {
      if (!open) {
        dispatch(clearAdvances());
      }
    };
  }, [open, selectedOutgoings, dispatch, maxInvoiceDate]);

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

  const totalOverallAmount = useMemo(() => {
    return selectedOutgoings.reduce(
      (total, outgoing) => total + (outgoing.totalPayableAmount || 0),
      0
    );
  }, [selectedOutgoings]);

  const getVendorDebitNotes = (vendorName: string) => {
    return debits.filter(
      (debit) => debit.vendorName === vendorName &&
        debit.status !== 'Cleared' &&
        (debit.pendingAmount || debit.finalAmount) > 0
    );
  };

  const getVendorAdvancePayments = (vendorName: string) => {
    return activeAdvances.filter(
      (advance) => advance.vendorName === vendorName &&
        advance.status !== 'Completed' &&
        (advance.pendingAmount || 0) > 0
    );
  };

  const calculateVendorAdvanceTotal = (vendorName: string) => {
    const vendorAdvances = getVendorAdvancePayments(vendorName);
    return vendorAdvances.reduce((sum, advance) => sum + (advance.pendingAmount || 0), 0);
  };

  const calculateVendorDebitAmount = (vendorName: string) => {
    const debitNotes = selectedDebitNotes[vendorName] || [];
    return debitNotes.reduce((sum, debitId) => {
      const debit = debits.find((d) => d.randomId === debitId);
      return sum + (debit ? (debit.pendingAmount || debit.finalAmount || 0) : 0);
    }, 0);
  };

  const calculateVendorAdvanceAmount = (vendorName: string) => {
    const advanceIds = selectedAdvancePayments[vendorName] || [];
    return advanceIds.reduce((sum, advanceId) => {
      const advance = activeAdvances.find((a) => a.randomId === advanceId || a.advanceId === advanceId);
      return sum + (advance ? (advance.pendingAmount || 0) : 0);
    }, 0);
  };

  const calculateVendorPayableAmount = (vendorName: string) => {
    const vendorOutgoings = groupedOutgoings[vendorName] || [];
    return vendorOutgoings.reduce(
      (sum, outgoing) => sum + (outgoing.totalPayableAmount || 0),
      0
    );
  };

  const calculateMaxAllowedPayment = (outgoing: Outgoing) => {
    const vendorName = outgoing.vendorName || 'Unknown Vendor';
    const vendorDebitAmount = calculateVendorDebitAmount(vendorName);
    const vendorAdvanceAmount = calculateVendorAdvanceAmount(vendorName);
    const totalVendorPayable = calculateVendorPayableAmount(vendorName);

    if (totalVendorPayable <= 0) return 0;

    const outgoingProportion = (outgoing.totalPayableAmount || 0) / totalVendorPayable;
    const allocatedDebits = vendorDebitAmount * outgoingProportion;
    const allocatedAdvances = vendorAdvanceAmount * outgoingProportion;

    return Math.max(0, (outgoing.totalPayableAmount || 0) - allocatedDebits - allocatedAdvances);
  };

  // Calculate total payment amount after adjustments
  const totalPaymentAmount = useMemo(() => {
    return selectedOutgoings.reduce((total, outgoing) => {
      const outgoingId = outgoing.outgoingId as string;
      const paymentType = paymentTypeMultiple[outgoingId] || 'full';
      
      if (paymentType === 'full') {
        const maxAllowed = calculateMaxAllowedPayment(outgoing);
        return total + maxAllowed;
      } else {
        const amount = parseFloat(partialAmount[outgoingId] || '0');
        return total + (isNaN(amount) ? 0 : amount);
      }
    }, 0);
  }, [selectedOutgoings, paymentTypeMultiple, partialAmount]);

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

  const handlePaymentModeChange = (event: SelectChangeEvent<'Bank' | 'Cash'>) => {
    const value = event.target.value as 'Bank' | 'Cash';
    setPaymentDetails((prev) => ({
      ...prev,
      paymentMode: value,
      paymentMethod: value === 'Bank' ? 'neft' : 'cash',
      bankName: value === 'Bank' ? prev.bankName : '',
      cashAmount: 0,
      referenceNumber: '',
    }));
    setErrors((prev) => ({ ...prev, _paymentMode: '' }));
  };

  const handleBankNameChange = (event: SelectChangeEvent) => {
    setPaymentDetails((prev) => ({ ...prev, bankName: event.target.value }));
    setErrors((prev) => ({ ...prev, _paymentMode: '' }));
  };

  const handlePaymentMethodChange = (event: SelectChangeEvent) => {
    setPaymentDetails((prev) => ({
      ...prev,
      paymentMethod: event.target.value,
      referenceNumber: ''
    }));
    setErrors((prev) => ({ ...prev, _paymentMode: '' }));
  };

  const handleReferenceNumberChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPaymentDetails((prev) => ({ ...prev, referenceNumber: event.target.value }));
    setErrors((prev) => ({ ...prev, _paymentMode: '' }));
  };

  // FIXED: Explicit local midnight parsing
  const handlePaymentDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = event.target.value;
    const newDate = dateValue ? new Date(`${dateValue}T00:00:00`) : new Date();  // Explicit local midnight
    
    // Validate against max invoice date
    const maxInv = new Date(maxInvoiceDate);
    maxInv.setHours(0, 0, 0, 0);
    newDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let dateError = '';
    if (newDate < maxInv) {
      dateError = 'Payment date cannot be before the latest invoice date';
    } else if (newDate > today) {
      dateError = 'Future date not allowed';
    }

    setErrors(prev => ({ ...prev, _paymentDate: dateError }));
    setPaymentDetails((prev) => ({ ...prev, paymentDate: newDate }));
  };

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

  const validateForm = (): boolean => {
    let isValid = true;
    const newErrors: Record<string, string> = {};

    if (Object.keys(groupedOutgoings).length === 0) {
      newErrors._general = 'No vendors selected';
      isValid = false;
    }

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

    if (paymentDetails.paymentMode === 'Bank' && !paymentDetails.referenceNumber.trim()) {
      newErrors._paymentMode = `Please enter ${getReferenceLabel(paymentDetails.paymentMethod)}`;
      setErrors((prev) => ({ ...prev, ...newErrors }));
      return false;
    }

    // Validate Date object
    if (isNaN(paymentDetails.paymentDate.getTime())) {
      newErrors._paymentDate = 'Invalid payment date';
      setErrors((prev) => ({ ...prev, ...newErrors }));
      return false;
    }

    // Validate against max invoice date and future
    const selectedDate = new Date(paymentDetails.paymentDate);
    selectedDate.setHours(0, 0, 0, 0);
    const maxInv = new Date(maxInvoiceDate);
    maxInv.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate < maxInv) {
      newErrors._paymentDate = 'Payment date cannot be before the latest invoice date';
      setErrors((prev) => ({ ...prev, ...newErrors }));
      return false;
    }

    if (selectedDate > today) {
      newErrors._paymentDate = 'Future date not allowed';
      setErrors((prev) => ({ ...prev, ...newErrors }));
      return false;
    }

    setErrors((prev) => ({ ...prev, _paymentMode: '', _paymentDate: '' }));
    return true;
  };

  const getReferenceLabel = (method: string): string => {
    switch (method) {
      case 'neft': return 'NEFT Reference Number';
      case 'rtgs': return 'RTGS Reference Number';
      case 'imps': return 'IMPS Reference Number';
      case 'upi': return 'UPI ID';
      default: return 'Reference Number';
    }
  };

  const handleProcessPayment = () => {
    if (!validateForm()) return;
    setShowPaymentModeDialog(true);
  };

  const handlePaymentModeConfirm = () => {
    if (!validatePaymentMode()) return;
    setShowPaymentModeDialog(false);
    setShowConfirmationDialog(true);
  };

  const handleConfirmPayment = async () => {
    try {
      const payments: PaymentInfo[] = selectedOutgoings.map((outgoing) => {
        const outgoingId = outgoing.outgoingId as string;
        const vendorName = outgoing.vendorName || 'Unknown Vendor';
        const paymentType = paymentTypeMultiple[outgoingId] || 'full';

        const amount = paymentType === 'partial'
          ? parseFloat(partialAmount[outgoingId] || '0')
          : calculateMaxAllowedPayment(outgoing);

        const payment: PaymentInfo = {
          outgoingId,
          paymentMode: paymentDetails.paymentMode as 'Bank' | 'Cash',
          paymentType,
          totalPayableAmount: outgoing.totalPayableAmount || 0,
          fullPaymentAmount: paymentType === 'full' ? amount : 0,
          partialAmount: paymentType === 'partial' ? amount : 0,
          paymentMethod: paymentDetails.paymentMethod,
          cashAmount: paymentDetails.paymentMode === 'Cash' ? amount : 0,
          bankName: paymentDetails.bankName,
          selectedDebitNotes: selectedDebitNotes[vendorName] || [],
          selectedAdvancePayments: selectedAdvancePayments[vendorName] || [],
        };

        if (paymentDetails.paymentMode === 'Bank') {
          switch (paymentDetails.paymentMethod) {
            case 'neft':
              payment.neftNo = paymentDetails.referenceNumber;
              break;
            case 'rtgs':
              payment.rtgsNo = paymentDetails.referenceNumber;
              break;
            case 'imps':
              payment.impsNo = paymentDetails.referenceNumber;
              break;
            case 'upi':
              payment.upi = paymentDetails.referenceNumber;
              break;
          }
        }

        return payment;
      });

      const outgoingIds = selectedOutgoings.map(
        (outgoing) => outgoing.outgoingId as string
      );

      // Use Date object directly (thunk will serialize to string)
      const bulkPaymentRequest: BulkPaymentRequest = {
        payments,
        outgoingIds,
        paymentDate: paymentDetails.paymentDate,  // Pass Date object
      };

      const result = await dispatch(processBulkPayment(bulkPaymentRequest)).unwrap();

      if (result.errors && result.errors.length > 0) {
        setSuccessMessage(`Processed ${result.totalProcessed} payments successfully. ${result.totalFailed} failed.`);
      } else {
        setSuccessMessage('All payments processed successfully!');
      }

      await dispatch(fetchOutgoings({
        page: 1,
        size: 50,
        filterByAmount: true,
        filterBy: 'invoiceDate',
      })).unwrap();

      setPaymentDetails({
        paymentMode: 'Bank',
        paymentMethod: 'neft',
        bankName: '',
        cashAmount: 0,
        referenceNumber: '',
        paymentDate: new Date(),  // Reset to current Date
      });
      setPaymentTypeMultiple({});
      setPartialAmount({});
      setSelectedDebitNotes({});
      setSelectedAdvancePayments({});
      setErrors({});
      setShowConfirmationDialog(false);
      
      if (result.totalFailed === 0) {
        onClose();
      }
    } catch (error) {
      console.error('Payment processing failed:', error);
      setErrors((prev) => ({
        ...prev,
        _general: 'Failed to process payment. Please try again.'
      }));
      setShowConfirmationDialog(false);
    }
  };

  const handleCancelConfirmation = () => {
    setShowConfirmationDialog(false);
    setShowPaymentModeDialog(true);
  };

  const handleClose = () => {
    setPaymentDetails({
      paymentMode: 'Bank',
      paymentMethod: 'neft',
      bankName: '',
      cashAmount: 0,
      referenceNumber: '',
      paymentDate: new Date(),  // Reset to Date
    });
    setPaymentTypeMultiple({});
    setPartialAmount({});
    setSelectedDebitNotes({});
    setSelectedAdvancePayments({});
    setErrors({});
    setShowPaymentModeDialog(false);
    setShowConfirmationDialog(false);
    setSuccessMessage(null);
    onClose();
  };

  return (
    <>
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
            <Typography >
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
                                label={`${debit.randomId} (₹${(debit.pendingAmount || debit.finalAmount).toLocaleString('en-IN')})`}
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
                            primary={`${debit.randomId} - ₹${(debit.pendingAmount || debit.finalAmount).toLocaleString('en-IN')}`}
                            secondary={`Pending: ₹${(debit.pendingAmount || debit.finalAmount).toLocaleString('en-IN')} | Status: ${debit.status}`}
                          />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

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
                              <Typography  fontWeight="medium">
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
                                  autoComplete='off'
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
                key !== '_general' && key !== '_paymentMode' && key !== '_paymentDate' && errors[key]
              )
            }
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? 'Processing...' : 'Process Payment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Payment Mode Dialog */}
      <Dialog
        open={showPaymentModeDialog}
        onClose={() => setShowPaymentModeDialog(false)}
        sx={{
          '& .MuiDialog-container': {
            '& .MuiPaper-root': {
              maxWidth: '250px',
            },
          },
        }}
      >
        <DialogTitle>
          <Typography variant="h6">Payment Details</Typography>
        </DialogTitle>
        <DialogContent>
          {errors._paymentMode && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errors._paymentMode}
            </Alert>
          )}
          {errors._paymentDate && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errors._paymentDate}
            </Alert>
          )}

          <Box sx={{ mb: 3, p: 2, backgroundColor: 'info.light', borderRadius: 1 }}>
            <Typography variant="h6" gutterBottom>
              Total Payment: ₹{totalPaymentAmount.toLocaleString('en-IN', {
                minimumFractionDigits: 2
              })}
            </Typography>
            <Typography >
              Configure payment details
            </Typography>
          </Box>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Payment Mode *</InputLabel>
            <Select
              value={paymentDetails.paymentMode}
              label="Payment Mode *"
              onChange={handlePaymentModeChange}
              error={!!errors._paymentMode}
              autoFocus={false}
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
                  autoFocus={false}
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
                  autoFocus={false}
                >
                  <MenuItem value="neft">NEFT</MenuItem>
                  <MenuItem value="rtgs">RTGS</MenuItem>
                  <MenuItem value="imps">IMPS</MenuItem>
                  <MenuItem value="upi">UPI</MenuItem>
                </Select>
              </FormControl>

              <TextField
                autoComplete='off'
                fullWidth
                label={getReferenceLabel(paymentDetails.paymentMethod)}
                value={paymentDetails.referenceNumber}
                onChange={handleReferenceNumberChange}
                error={!!errors._paymentMode}
                helperText={errors._paymentMode}
                placeholder={`Enter ${getReferenceLabel(paymentDetails.paymentMethod)}`}
                autoFocus={false}
                sx={{ mb: 2 }}
              />
            </>
          )}

          {/* FIXED: Use local YYYY-MM-DD for value */}
          <TextField
            fullWidth
            label="Payment Date"
            type="date"
            value={paymentDetails.paymentDate.toLocaleDateString('en-CA')}  // FIXED: Local serialization
            onChange={handlePaymentDateChange}
            error={!!errors._paymentDate}
            helperText={errors._paymentDate}
            InputLabelProps={{
              shrink: true,
            }}
            inputProps={{
              min: maxInvoiceDateStr,
              max: currentDateStr,
            }}
            autoFocus={false}
            sx={{ mb: 2 }}
          />
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
            onClick={handlePaymentModeConfirm}
            variant="contained"
            size="large"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? 'Processing...' : 'Continue'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Final Confirmation Dialog */}
      <Dialog
        open={showConfirmationDialog}
        onClose={handleCancelConfirmation}
        sx={{
          '& .MuiDialog-container': {
            '& .MuiPaper-root': {
              maxWidth: '400px',
            },
          },
        }}
      >
        <DialogTitle>
          <Typography variant="h6">Confirm Bulk Payment</Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 3, p: 2, backgroundColor: 'success.light', borderRadius: 1 }}>
            <Typography variant="h6" gutterBottom>
              Final Payment Summary
            </Typography>
            <Typography  color="success.dark">
              Please review all details before confirming
            </Typography>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1" gutterBottom fontWeight="bold">
              Payment Details:
            </Typography>
            <Typography  gutterBottom>
              <strong>Total Amount:</strong> ₹{totalOverallAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Typography>
            <Typography  gutterBottom>
              <strong>Final Payment:</strong> ₹{totalPaymentAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Typography>
            <Typography  gutterBottom>
              <strong>Payment Mode:</strong> {paymentDetails.paymentMode}
            </Typography>
            {paymentDetails.paymentMode === 'Bank' && (
              <>
                <Typography  gutterBottom>
                  <strong>Bank:</strong> {paymentDetails.bankName}
                </Typography>
                <Typography  gutterBottom>
                  <strong>Method:</strong> {paymentDetails.paymentMethod.toUpperCase()}
                </Typography>
                <Typography  gutterBottom>
                  <strong>Reference:</strong> {paymentDetails.referenceNumber}
                </Typography>
              </>
            )}
            <Typography  gutterBottom>
              <strong>Payment Date:</strong> {paymentDetails.paymentDate.toLocaleDateString()}  
            </Typography>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1" gutterBottom fontWeight="bold">
              Transaction Summary:
            </Typography>
            <Typography  gutterBottom>
              <strong>Invoices:</strong> {selectedOutgoings.length}
            </Typography>
            <Typography  gutterBottom>
              <strong>Vendors:</strong> {Object.keys(groupedOutgoings).length}
            </Typography>
          </Box>

          
            <Typography variant="body1">
              Are you sure you want to process this bulk payment?
            </Typography>
       
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={handleCancelConfirmation}
            color="inherit"
            size="large"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmPayment}
            variant="contained"
            color="success"
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