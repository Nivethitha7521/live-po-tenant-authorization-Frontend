"use client";
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Paper,
  Typography,
  Box,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
} from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import {
  createAmountOnlyDebitNote,
  setSnackbarMessageGRN,
  setSnackbarOpenGRN,
} from '@/features/yen-purchase/GRN/grnSlice';
import { AppDispatch, RootState } from '@/redux/store';
import CloseIcon from '@mui/icons-material/Close';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ConfirmationDialog from '@/components/confirmationDialog';

// Main Component
interface AmountReturnDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  documentId: string;
  documentType: 'grn' | 'outgoing_payment';
  documentNumber: string;
  maxAmount: number;
  currentPage: number;
  pageSize: number;
}

const AmountReturnDialog: React.FC<AmountReturnDialogProps> = ({
  open,
  onClose,
  onSuccess,
  documentId,
  documentType,
  documentNumber,
  maxAmount,
  currentPage,
  pageSize,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { loading } = useSelector((state: RootState) => state.grn);
  
  const [debitAmount, setDebitAmount] = useState<number>(0);
  const [reason, setReason] = useState<string>('');
  const [createdBy] = useState<string>('system-user');
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
const isValidForm =
  debitAmount > 0 &&
  debitAmount <= maxAmount &&
  reason.trim().length > 0;


  const handleAmountChange = (value: number) => {
    const numValue = Number(value) || 0;
    setDebitAmount(numValue);
    
    if (numValue > maxAmount) {
      setErrorMessage(`Amount cannot exceed maximum: ₹${maxAmount.toFixed(2)}`);
    } else {
      setErrorMessage('');
    }
  };

 const handleConfirmClick = () => {
  if (!isValidForm) {
    if (debitAmount <= 0) {
      setErrorMessage('Amount must be greater than 0');
    } else if (debitAmount > maxAmount) {
      setErrorMessage(`Amount cannot exceed maximum: ₹${maxAmount.toFixed(2)}`);
    } else if (!reason.trim()) {
      setErrorMessage('Reason is required');
    }
    return;
  }

  setErrorMessage('');
  setConfirmDialogOpen(true);
};


  const handleSubmit = async () => {
    try {
      setConfirmDialogOpen(false);
      setIsSubmitting(true);
      
      const payload = {
        documentId,
        documentType,
        totalAmount: debitAmount,
        reason,
        createdBy,
        comments: '',
      };

      const result = await dispatch(createAmountOnlyDebitNote(payload)).unwrap();
      
      // Show success message from backend
      dispatch(setSnackbarMessageGRN(result.message || 'Debit note created successfully'));
      dispatch(setSnackbarOpenGRN(true));
      
      onSuccess();
      resetForm();
      setIsSubmitting(false);
      onClose();
      
    } catch (error: any) {
      console.error('Failed to create amount-only debit note:', error);
      
      // Handle validation errors from backend
      let errorMsg = 'Failed to create debit note';
      if (error.payload) {
        try {
          const errorData = JSON.parse(error.payload);
          if (errorData.message) {
            errorMsg = errorData.message;
          } else if (errorData.available_amount !== undefined) {
            errorMsg = `Cannot create debit note. Available amount: ₹${errorData.available_amount.toFixed(2)}`;
          }
        } catch {
          errorMsg = error.payload || 'Failed to create debit note';
        }
      }
      
      dispatch(setSnackbarMessageGRN(errorMsg));
      dispatch(setSnackbarOpenGRN(true));
      setIsSubmitting(false);
    }
  };

  const handleConfirmationClose = () => {
    setConfirmDialogOpen(false);
  };

  const resetForm = () => {
    setDebitAmount(0);
    setReason('');
    setErrorMessage('');
  };

  const handleClose = () => {
    if (!isSubmitting) {
      resetForm();
      onClose();
    }
  };

  const isLoading = loading || isSubmitting;

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 2 }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          bgcolor: '#f5f5f5',
          borderBottom: 1,
          borderColor: 'divider'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <AttachMoneyIcon color="primary" />
            <Typography variant="h6">
              Amount-wise Return / Debit Note
            </Typography>
          </Box>
          <IconButton onClick={handleClose} size="small" disabled={isLoading}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>Note:</strong> This creates a financial debit note without modifying item quantities. 
              Maximum available amount: <strong>₹{maxAmount.toFixed(2)}</strong>
            </Typography>
          </Alert>

          {errorMessage && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorMessage}
            </Alert>
          )}

          <Grid container spacing={3}>
            {/* Document Info */}
            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: '#fafafa' }}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Document Type:
                    </Typography>
                    <Typography fontWeight="medium">
                      {documentType === 'grn' ? 'GRN' : 'Outgoing Payment'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Document No:
                    </Typography>
                    <Typography fontWeight="medium">
                      {documentNumber}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">
                      Maximum Amount:
                    </Typography>
                    <Typography fontWeight="bold" color="primary">
                      ₹{maxAmount.toFixed(2)}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

            {/* Amount and Reason in single row */}
            <Grid item xs={6}>
              <TextField
                fullWidth
                required
                label="Debit Amount (₹)"
                type="number"
                value={debitAmount || ''}
                onChange={(e) => handleAmountChange(Number(e.target.value) || 0)}
                InputProps={{
                  inputProps: { 
                    min: 0.01, 
                    max: maxAmount, 
                    step: 0.01
                  },
                  startAdornment: (
                    <InputAdornment position="start">
                      <Typography>₹</Typography>
                    </InputAdornment>
                  ),
                }}
                helperText={`Max: ₹${maxAmount.toFixed(2)}`}
                error={debitAmount > maxAmount}
                autoComplete="off"
                disabled={isLoading}
              />
            </Grid>

            <Grid item xs={6}>
              <TextField
                fullWidth
                required
                label="Reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter reason..."
                autoComplete="off"
                disabled={isLoading}
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={handleClose} color="inherit" disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmClick}
            disabled={!isValidForm || isLoading}
            startIcon={
              isLoading ? 
                <CircularProgress size={20} color="inherit" /> : 
                <AttachMoneyIcon />
            }
          >
            {isLoading ? 'Creating...' : 'Create Debit Note'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={confirmDialogOpen}
        onClose={handleConfirmationClose}
        onConfirm={handleSubmit}
        title="Confirm Debit Note Creation"
        description={
          <Box>
            <Typography variant="body1" gutterBottom>
              Are you sure you want to create this debit note?
            </Typography>
            <Box sx={{ mt: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
              <Typography variant="body2"><strong>Document:</strong> {documentNumber}</Typography>
              <Typography variant="body2"><strong>Amount:</strong> ₹{debitAmount.toFixed(2)}</Typography>
              <Typography variant="body2"><strong>Reason:</strong> {reason}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Remaining available: ₹{(maxAmount - debitAmount).toFixed(2)}
              </Typography>
            </Box>
          </Box>
        }
        confirmText="OK"
        cancelText="Cancel"
      />
    </>
  );
};

export default AmountReturnDialog;