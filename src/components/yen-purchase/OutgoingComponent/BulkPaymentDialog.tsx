import React, { useState, useEffect, useMemo } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Select,
  FormControl,
  InputLabel,
  Chip,
  Alert,
  Checkbox,
  ListItemText
} from '@mui/material';
import { Outgoing, PaymentInfo } from '@/Models/outgoingModel';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '@/redux/store';
import { fetchActiveDebitsMultipleVendor, processBulkPayment, selectOutgoings } from '@/features/yen-purchase/Outgoing/outgoingPaymentSlice';
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

const BulkPaymentDialog: React.FC<PaymentDialogProps> = ({
  open,
  onClose,
  selectedOutgoings
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { banks, debits, loading, error } = useSelector(selectOutgoings);
  
  const [paymentDetails, setPaymentDetails] = useState({
    paymentMode: '' as 'Bank' | 'Cash' | '',
    paymentMethod: '',
    bankName: '',
    neftNo: '',
    rtgsNo: '',
    impsNo: '',
    upi: '',
    pettyCashAmount: 0,
    hoCash: 0,
    cashVoucherNo: ''
  });

  const [paymentTypeMultiple, setPaymentTypeMultiple] = useState<Record<string, 'full' | 'partial'>>({});
  const [partialAmount, setPartialAmount] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedDebitNotes, setSelectedDebitNotes] = useState<Record<string, string[]>>({});
  const [isLoadingDebits, setIsLoadingDebits] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    if (open && selectedOutgoings.length > 0) {
      console.log('Fetching debit notes for vendors...');
      setIsLoadingDebits(true);
      // Get unique vendor names from selected outgoings
      const vendorNames = [...new Set(selectedOutgoings.map(outgoing => outgoing.vendorName || 'Unknown Vendor'))].filter(
        name => name && name !== 'Unknown Vendor'
      );
      console.log('Vendor names:', vendorNames);
      if (vendorNames.length > 0) {
        dispatch(fetchActiveDebitsMultipleVendor(vendorNames))
          .unwrap()
          .then(debits => {
            console.log(`Fetched ${debits.length} debits for all vendors`);
          })
          .catch(error => {
            console.error('Error fetching debits:', error);
          })
          .finally(() => {
            setIsLoadingDebits(false);
          });
      } else {
        setIsLoadingDebits(false);
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

  // Calculate totals
  const totalOverallAmount = useMemo(() => {
    return selectedOutgoings.reduce(
      (total, outgoing) => total + (outgoing.totalPayableAmount || 0),
      0
    );
  }, [selectedOutgoings]);

  // Get vendor-specific debit notes
  const getVendorDebitNotes = (vendorName: string) => {
    return debits.filter(
      (debit) =>
        debit.vendorName === vendorName &&
        debit.status !== 'Cleared' &&
        debit.status !== 'Applied'
    );
  };

  // Calculate total debit amount for a vendor
  const calculateVendorDebitAmount = (vendorName: string) => {
    const debitNotes = selectedDebitNotes[vendorName] || [];
    return debitNotes.reduce((sum, debitId) => {
      const debit = debits.find(d => d.randomId === debitId);
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
  const validateAmount = (outgoingId: string, amount: string, maxAllowed: number): string => {
    if (!amount && paymentTypeMultiple[outgoingId] === 'partial') {
      return 'Please enter an amount';
    }
    
    const numAmount = parseFloat(amount || '0');
    if (isNaN(numAmount)) return 'Invalid amount format';
    if (numAmount < 0) return 'Amount cannot be negative';
    if (numAmount > maxAllowed) return `Payment amount cannot exceed payable amount (₹${maxAllowed.toFixed(2)})`;

    return '';
  };

  const handlePaymentModeChange = (event: SelectChangeEvent<'Bank' | 'Cash'>) => {
    const value = event.target.value as 'Bank' | 'Cash';
    setPaymentDetails(prev => ({
      ...prev,
      paymentMode: value,
      paymentMethod: value === 'Bank' ? 'neft' : 'pettyCash'
    }));
  };

  const handleBankNameChange = (event: SelectChangeEvent<string>) => {
    setPaymentDetails(prev => ({ ...prev, bankName: event.target.value }));
  };

  const handlePaymentMethodChange = (event: SelectChangeEvent<string>) => {
    setPaymentDetails(prev => ({ ...prev, paymentMethod: event.target.value }));
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setPaymentDetails(prev => ({ ...prev, [name]: value }));
  };

  const handlePaymentTypeChangeMultiple = (outgoingId: string, event: SelectChangeEvent<'full' | 'partial'>) => {
    const value = event.target.value as 'full' | 'partial';
    setPaymentTypeMultiple(prev => ({ ...prev, [outgoingId]: value }));
    
    if (value === 'full') {
      setPartialAmount(prev => ({ ...prev, [outgoingId]: '' }));
      setErrors(prev => ({ ...prev, [outgoingId]: '' }));
    }
  };

  const handlePartialAmountChange = (outgoingId: string, value: string, maxAmount: number) => {
    if (value === '') {
      setPartialAmount(prev => ({ ...prev, [outgoingId]: '' }));
      setErrors(prev => ({ ...prev, [outgoingId]: '' }));
      return;
    }

    const validationError = validateAmount(outgoingId, value, maxAmount);
    setErrors(prev => ({ ...prev, [outgoingId]: validationError }));
    setPartialAmount(prev => ({ ...prev, [outgoingId]: value }));
  };

  const handleDebitNoteSelection = (vendorName: string, event: SelectChangeEvent<string[]>) => {
    const selectedDebitIds = event.target.value as string[];
    
    // Validate that selected debit notes belong to the correct vendor
    const validDebitIds = selectedDebitIds.filter(debitId => {
      const debit = debits.find(d => d.randomId === debitId);
      return debit && debit.vendorName === vendorName;
    });

    setSelectedDebitNotes(prev => ({
      ...prev,
      [vendorName]: validDebitIds
    }));

    // Revalidate all amounts for this vendor after debit note selection
    const vendorOutgoings = groupedOutgoings[vendorName] || [];
    vendorOutgoings.forEach(outgoing => {
      const outgoingId = outgoing.outgoingId as string;
      const currentAmount = partialAmount[outgoingId] || '';
      if (currentAmount) {
        const validationError = validateAmount(outgoingId, currentAmount, outgoing.totalPayableAmount || 0);
        setErrors(prev => ({ ...prev, [outgoingId]: validationError }));
      }
    });
  };

  const validateForm = (): boolean => {
    let isValid = true;
    const newErrors: Record<string, string> = {};

    if (!paymentDetails.paymentMode) {
      newErrors._general = 'Payment mode is required';
      isValid = false;
    }

    // Validate vendor-level debit notes
    Object.keys(groupedOutgoings).forEach(vendorName => {
      const vendorDebitAmount = calculateVendorDebitAmount(vendorName);
      const vendorPayableAmount = calculateVendorPayableAmount(vendorName);
      
      if (vendorDebitAmount > vendorPayableAmount) {
        newErrors[vendorName] = `Debit notes exceed vendor's total payable amount`;
        isValid = false;
      }
    });

    // Validate each outgoing
    for (const outgoing of selectedOutgoings) {
      const outgoingId = outgoing.outgoingId as string;
      const paymentType = paymentTypeMultiple[outgoingId] || 'full';
      
      if (paymentType === 'partial') {
        const amount = partialAmount[outgoingId] || '';
        const validationError = validateAmount(outgoingId, amount, outgoing.totalPayableAmount || 0);
        if (validationError) {
          newErrors[outgoingId] = validationError;
          isValid = false;
        }
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleProcessPayment = () => {
    if (!validateForm()) return;
    setShowConfirmation(true);
  };

  const handleConfirmYes = async () => {
    setShowConfirmation(false);
    try {
      const payments: PaymentInfo[] = selectedOutgoings.map((outgoing) => {
        const outgoingId = outgoing.outgoingId as string;
        const vendorName = outgoing.vendorName || 'Unknown Vendor';
        const paymentType = paymentTypeMultiple[outgoingId] || 'full';
        const vendorSelectedDebitNotes = selectedDebitNotes[vendorName] || [];
        
        const amount = paymentType === 'partial'
          ? parseFloat(partialAmount[outgoingId] || '0')
          : (outgoing.totalPayableAmount || 0);

        return {
          paymentMode: paymentDetails.paymentMode as 'Bank' | 'Cash',
          paymentType,
          fullPaymentAmount: paymentType === 'full' ? amount : 0,
          partialAmount: paymentType === 'partial' ? amount : 0,
          paymentMethod: paymentDetails.paymentMethod,
          neftNo: paymentDetails.neftNo,
          rtgsNo: paymentDetails.rtgsNo,
          impsNo: paymentDetails.impsNo,
          upi: paymentDetails.upi,
          pettyCashAmount: paymentDetails.pettyCashAmount,
          hoCash: paymentDetails.hoCash,
          bankName: paymentDetails.bankName,
          selectedDebitNotes: vendorSelectedDebitNotes // Send the selected debit note IDs
        };
      });

      const outgoingIds = selectedOutgoings.map(outgoing => outgoing.outgoingId as string);

      await dispatch(processBulkPayment({ payments, outgoingIds })).unwrap();
      
      // Reset form and close dialog on success
      setPaymentDetails({
        paymentMode: '',
        paymentMethod: '',
        bankName: '',
        neftNo: '',
        rtgsNo: '',
        impsNo: '',
        upi: '',
        pettyCashAmount: 0,
        hoCash: 0,
        cashVoucherNo: ''
      });
      setPaymentTypeMultiple({});
      setPartialAmount({});
      setSelectedDebitNotes({});
      setErrors({});
      
      onClose();
      
    } catch (error) {
      console.error('Payment processing failed:', error);
    }
  };

  const handleClose = () => {
    // Reset all states when closing
    setPaymentDetails({
      paymentMode: '',
      paymentMethod: '',
      bankName: '',
      neftNo: '',
      rtgsNo: '',
      impsNo: '',
      upi: '',
      pettyCashAmount: 0,
      hoCash: 0,
      cashVoucherNo: ''
    });
    setPaymentTypeMultiple({});
    setPartialAmount({});
    setSelectedDebitNotes({});
    setErrors({});
    onClose();
  };

  return (
    <>
      <Dialog 
        open={open} 
        onClose={handleClose}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { maxHeight: '90vh' } }}
      >
        <DialogTitle>
          Bulk Payment Processing
          <Typography variant="h6" color="primary" sx={{ mt: 1 }}>
            Total Amount: ₹{totalOverallAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </Typography>
        </DialogTitle>

        <DialogContent dividers>
          {errors._general && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errors._general}
            </Alert>
          )}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Error loading debit notes: {error}
            </Alert>
          )}
          {(isLoadingDebits || loading) && (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mb: 2 }}>
              <CircularProgress size={24} />
              <Typography variant="body2" sx={{ ml: 2 }}>
                Loading debit notes...
              </Typography>
            </Box>
          )}

          {/* Payment Details Section */}
          <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="h6" gutterBottom>
              Payment Details
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <FormControl sx={{ minWidth: 120 }}>
                <InputLabel>Payment Mode</InputLabel>
                <Select
                  value={paymentDetails.paymentMode}
                  onChange={handlePaymentModeChange}
                  label="Payment Mode"
                >
                  <MenuItem value="Cash">Cash</MenuItem>
                  <MenuItem value="Bank">Bank</MenuItem>
                </Select>
              </FormControl>

              {paymentDetails.paymentMode === 'Bank' && (
                <>
                  <FormControl sx={{ minWidth: 120 }}>
                    <InputLabel>Bank</InputLabel>
                    <Select
                      name="bankName"
                      value={paymentDetails.bankName}
                      onChange={handleBankNameChange}
                      label="Bank"
                    >
                      {banks.map((bank) => (
                        <MenuItem key={bank.bankMasterId} value={bank.bankName}>
                          {bank.bankName}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl sx={{ minWidth: 120 }}>
                    <InputLabel>Method</InputLabel>
                    <Select
                      name="paymentMethod"
                      value={paymentDetails.paymentMethod}
                      onChange={handlePaymentMethodChange}
                      label="Method"
                    >
                      <MenuItem value="neft">NEFT</MenuItem>
                      <MenuItem value="rtgs">RTGS</MenuItem>
                      <MenuItem value="imps">IMPS</MenuItem>
                      <MenuItem value="upi">UPI</MenuItem>
                    </Select>
                  </FormControl>

                  {paymentDetails.paymentMethod === 'neft' && (
                    <TextField
                      name="neftNo"
                      label="NEFT Number"
                      value={paymentDetails.neftNo}
                      onChange={handleInputChange}
                      sx={{ minWidth: 200 }}
                    />
                  )}
                  {paymentDetails.paymentMethod === 'rtgs' && (
                    <TextField
                      name="rtgsNo"
                      label="RTGS Number"
                      value={paymentDetails.rtgsNo}
                      onChange={handleInputChange}
                      sx={{ minWidth: 200 }}
                    />
                  )}
                  {paymentDetails.paymentMethod === 'imps' && (
                    <TextField
                      name="impsNo"
                      label="IMPS Number"
                      value={paymentDetails.impsNo}
                      onChange={handleInputChange}
                      sx={{ minWidth: 200 }}
                    />
                  )}
                  {paymentDetails.paymentMethod === 'upi' && (
                    <TextField
                      name="upi"
                      label="UPI ID"
                      value={paymentDetails.upi}
                      onChange={handleInputChange}
                      sx={{ minWidth: 200 }}
                    />
                  )}
                </>
              )}

              {paymentDetails.paymentMode === 'Cash' && (
                <FormControl sx={{ minWidth: 120 }}>
                  <InputLabel>Method</InputLabel>
                  <Select
                    name="paymentMethod"
                    value={paymentDetails.paymentMethod}
                    onChange={handlePaymentMethodChange}
                    label="Method"
                  >
                    <MenuItem value="pettyCash">Petty Cash</MenuItem>
                    <MenuItem value="hoCash">HO Cash</MenuItem>
                  </Select>
                </FormControl>
              )}
            </Box>
          </Box>

          {/* Vendor Sections */}
          {Object.entries(groupedOutgoings).map(([vendorName, vendorOutgoings]) => {
            const vendorDebitNotes = getVendorDebitNotes(vendorName);
            const vendorTotal = calculateVendorPayableAmount(vendorName);
            return (
              <Box key={vendorName} sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom color="primary">
                  {vendorName}
                  <Chip
                    label={`Total: ₹${vendorTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                    color="primary"
                    sx={{
                      ml: 2,
                      color: 'white',
                      fontWeight: 'bold',
                      borderRadius: '16px',
                      '& .MuiChip-label': { color: 'white' }
                    }}
                  />
                </Typography>
                {errors[vendorName] && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {errors[vendorName]}
                  </Alert>
                )}
                {vendorDebitNotes.length > 0 ? (
                  <Box sx={{ mb: 2, p: 2, bgcolor: 'warning.light', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Available Debit Notes for {vendorName}:
                    </Typography>
                    <FormControl fullWidth>
                      <InputLabel>Select Debit Notes</InputLabel>
                      <Select
                        multiple
                        value={selectedDebitNotes[vendorName] || []}
                        onChange={(e) => handleDebitNoteSelection(vendorName, e as SelectChangeEvent<string[]>)}
                        renderValue={(selected) => (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {selected.map((value) => {
                              const debit = vendorDebitNotes.find(d => d.randomId === value);
                              return debit ? (
                                <Chip
                                  key={value}
                                  label={`${debit.noteId} - ₹${debit.finalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
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
                              primary={`${debit.noteId} - ₹${debit.finalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                              secondary={`Status: ${debit.status}`}
                            />
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                ) : (
                  !isLoadingDebits && (
                    <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                      No active debit notes available for {vendorName}
                    </Typography>
                  )
                )}
                <TableContainer component={Paper}>
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
                              ₹{payableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={paymentType}
                                onChange={(e) => handlePaymentTypeChangeMultiple(outgoingId, e as SelectChangeEvent<'full' | 'partial'>)}
                                size="small"
                                sx={{ minWidth: 100 }}
                              >
                                <MenuItem value="full">Full</MenuItem>
                                <MenuItem value="partial">Partial</MenuItem>
                              </Select>
                            </TableCell>
                            <TableCell>
                              {paymentType === 'partial' && (
                                <TextField
                                  size="small"
                                  type="number"
                                  value={partialAmount[outgoingId] || ''}
                                  onChange={(e) => handlePartialAmountChange(outgoingId, e.target.value, payableAmount)}
                                  error={!!currentError}
                                  helperText={currentError}
                                  sx={{ width: 120 }}
                                  inputProps={{
                                    min: 0,
                                    max: payableAmount,
                                    step: '0.01'
                                  }}
                                />
                              )}
                              {paymentType === 'full' && (
                                <Typography variant="body2">
                                  ₹{payableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              {currentError && (
                                <Typography variant="caption" color="error">
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
              </Box>
            );
          })}
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleProcessPayment}
            color="primary"
            variant="contained"
            disabled={loading || isLoadingDebits || Object.keys(errors).some(key => key !== '_general' && errors[key])}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? 'Processing...' : 'Confirm Payment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmation} onClose={() => setShowConfirmation(false)}>
        <DialogTitle>Confirm Payment</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to process this bulk payment?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConfirmation(false)} color="inherit">
            No
          </Button>
          <Button onClick={handleConfirmYes} color="primary" variant="contained" disabled={loading}>
            Yes
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default BulkPaymentDialog;