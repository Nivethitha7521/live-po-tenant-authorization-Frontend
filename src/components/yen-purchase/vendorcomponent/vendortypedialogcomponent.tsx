'use client';
import React, { useEffect, useState, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '@/redux/store';
import {
  addVendorTypeItem,
  updateVendorTypeItem,
  selectVendorTypeItems,
  setSnackbarMessage,
  setSnackbarOpen,
  setVendorTypeData,
  fetchVendorTypeItems,
} from '../../../features/yen-purchase/PurchaseMaster/VendorTypeSlice';
import ConfirmationDialog from './confirmationDialog';

interface VendorTypeDialogProps {
  isEdit: boolean;
  open: boolean;
  onClose: () => void;
  onVendorTypeAdded?: (vendorType: string) => void;
}

const VendorTypeDialogComponent: React.FC<VendorTypeDialogProps> = ({
  isEdit,
  open,
  onClose,
  onVendorTypeAdded,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const {
    vendorTypeData,
    loading,
    error,
    editVendorTypeId,
    vendoritems,
    deactivatedItems,
  } = useSelector(selectVendorTypeItems);

  const [isDirty, setIsDirty] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [formErrors, setFormErrors] = useState({
    vendorType: '',
    duplicate: '',
  });
  const abortController = useRef(new AbortController());

  useEffect(() => {
    if (open) {
      setFormErrors({ vendorType: '', duplicate: '' });
      setIsDirty(false);
      abortController.current = new AbortController(); // Reset AbortController
    }
    return () => {
      abortController.current.abort(); // Cancel requests on unmount
    };
  }, [open]);

  const handleClose = (forceClose = false) => {
    if (isDirty && !forceClose) {
      setShowCloseConfirm(true);
      return;
    }

    dispatch(setVendorTypeData({
      vendortypeId: '',
      vendorType: '',
      status: 'active',
      randomId: '',
    }));
    setIsDirty(false);
    onClose();
  };

  const handleCloseConfirm = (shouldClose: boolean) => {
    setShowCloseConfirm(false);
    if (shouldClose) {
      handleClose(true);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    dispatch(setVendorTypeData({
      ...vendorTypeData,
      [name]: value,
    }));

    if (value !== vendorTypeData.vendorType) {
      setIsDirty(true);
    }

    if (name === 'vendorType') {
      setFormErrors({ vendorType: '', duplicate: '' });
    }
  };

  const validateForm = () => {
    let isValid = true;
    const newErrors = { vendorType: '', duplicate: '' };

    const trimmedValue = vendorTypeData.vendorType.trim();

    if (!trimmedValue) {
      newErrors.vendorType = 'Vendor Type is required';
      isValid = false;
    } else if (trimmedValue.length < 3) {
      newErrors.vendorType = 'Vendor Type must be at least 3 characters';
      isValid = false;
    }

    if (isValid) {
      const allVendorTypes = [...vendoritems, ...deactivatedItems];
      const isDuplicate = allVendorTypes.some(
        (type) =>
          type.vendortypeId !== vendorTypeData.vendortypeId &&
          type.vendorType.toLowerCase() === trimmedValue.toLowerCase()
      );

      if (isDuplicate) {
        newErrors.duplicate = 'This vendor type already exists';
        isValid = false;
      }
    }

    setFormErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      if (isEdit && editVendorTypeId) {
        await dispatch(updateVendorTypeItem({
          vendortypeId: editVendorTypeId,
          vendortype: vendorTypeData,
          signal: abortController.current.signal,
        })).unwrap();
        dispatch(setSnackbarMessage('Vendor type updated successfully'));
      } else {
        const result = await dispatch(addVendorTypeItem({
          data: vendorTypeData,
          signal: abortController.current.signal,
        })).unwrap();
        dispatch(setSnackbarMessage('Vendor type added successfully'));
        if (onVendorTypeAdded) {
          onVendorTypeAdded(result.vendorType);
        }
      }
      dispatch(setSnackbarOpen(true));
      dispatch(fetchVendorTypeItems({ signal: abortController.current.signal }));
      handleClose(true);
    } catch (error: any) {
      const errorMessage = typeof error === 'string' ? error : error.message || `Failed to ${isEdit ? 'update' : 'add'} vendor type`;
      dispatch(setSnackbarMessage(errorMessage));
      dispatch(setSnackbarOpen(true));
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={(e, reason) => {
          if (isDirty) {
            setShowCloseConfirm(true);
          } else {
            handleClose(true);
          }
        }}
        disableEscapeKeyDown={isDirty}
        maxWidth="sm"
      >
        <DialogTitle>{isEdit ? 'Edit Vendor Type' : 'Add New Vendor Type'}</DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <TextField
              autoComplete="off"
              autoFocus
              margin="dense"
              name="vendorType"
              label="Vendor Type *"
              type="text"
              fullWidth
              variant="outlined"
              value={vendorTypeData.vendorType}
              onChange={handleInputChange}
              error={!!formErrors.vendorType || !!formErrors.duplicate}
              helperText={formErrors.vendorType || formErrors.duplicate}
              required
              sx={{ mt: 2 }}
            />
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => handleClose(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              color="primary"
              variant="contained"
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : (isEdit ? 'Update' : 'Add')}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <ConfirmationDialog
        open={showCloseConfirm}
        title="Unsaved Changes"
        message="You have unsaved changes. Are you sure you want to leave?"
        onCancel={() => handleCloseConfirm(false)}
        onConfirm={() => handleCloseConfirm(true)}
        confirmText="Confirm"
        cancelText="Close"
      />
    </>
  );
};

export default VendorTypeDialogComponent;