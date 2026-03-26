import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  TextField,
  CircularProgress,
} from '@mui/material';

interface ConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  loading?: boolean;
  confirmText?: string;
  cancelText?: string;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  loading = false,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
}) => (
  <Dialog open={open} onClose={onClose}>
    <DialogTitle>{title}</DialogTitle>
    <DialogContent>
      <DialogContentText>{message}</DialogContentText>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>{cancelText}</Button>
      <Button
        onClick={onConfirm}
        color="primary"
        variant="contained"
        disabled={loading}
        startIcon={loading ? <CircularProgress size={20} /> : null}
      >
        {loading ? 'Processing...' : confirmText}
      </Button>
    </DialogActions>
  </Dialog>
);

interface ShippingDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  shippingData: any;
  onFieldChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, field: string) => void;
}

export const ShippingDialog: React.FC<ShippingDialogProps> = ({
  open,
  onClose,
  onSave,
  shippingData,
  onFieldChange,
}) => (
  <Dialog open={open} onClose={onClose}>
    <DialogTitle>Add New Shipping Address</DialogTitle>
    <DialogContent>
      <TextField
        fullWidth
        label="Address"
        value={shippingData?.address || ''}
        onChange={(e) => onFieldChange(e, 'address')}
        margin="normal"
        variant="outlined"
      />
      <TextField
        fullWidth
        label="Phone Number"
        value={shippingData?.phoneNo || ''}
        onChange={(e) => onFieldChange(e, 'phoneNo')}
        margin="normal"
        variant="outlined"
      />
      <TextField
        fullWidth
        label="Email"
        value={shippingData?.emailId || ''}
        onChange={(e) => onFieldChange(e, 'emailId')}
        margin="normal"
        variant="outlined"
      />
      <TextField
        fullWidth
        label="GSTIN"
        value={shippingData?.gstIn || ''}
        onChange={(e) => onFieldChange(e, 'gstIn')}
        margin="normal"
        variant="outlined"
      />
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Cancel</Button>
      <Button onClick={onSave} color="primary">Save</Button>
    </DialogActions>
  </Dialog>
);

interface ImportResultsDialogProps {
  open: boolean;
  onClose: () => void;
  importResults: {
    message?: string;
    successMessages?: string[];
    duplicates?: string[];
    updatedItems?: string[];
    warnings?: string[];
    errors?: string[];
  };
}

export const ImportResultsDialog: React.FC<ImportResultsDialogProps> = ({
  open,
  onClose,
  importResults,
}) => (
  <Dialog open={open} onClose={onClose}>
    <DialogTitle>CSV Import Results</DialogTitle>
    <DialogContent>
      <DialogContentText component="div">
        {/* Render results based on importResults object */}
      </DialogContentText>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} color="primary">Close</Button>
    </DialogActions>
  </Dialog>
);