// VendorActivateDialog.jsx - Confirmation dialog for activation
'use client';
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button
} from '@mui/material';
import {
  setActivateDialogOpen, setItemToActivate, activateVendor,
  selectVendorItems
} from '../../../features/yen-purchase/PurchaseMaster/vendorSlice';
import { AppDispatch } from '@/redux/store';

const VendorActivateDialog = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { activateDialogOpen, itemToActivate } = useSelector(selectVendorItems);

  const handleActivateConfirm = () => {
    if (itemToActivate) {
      dispatch(activateVendor(itemToActivate.vendorId));
    }
    dispatch(setActivateDialogOpen(false));
    dispatch(setItemToActivate(null));
  };

  const handleActivateCancel = () => {
    dispatch(setItemToActivate(null));
    dispatch(setActivateDialogOpen(false));
  };

  return (
    <Dialog open={activateDialogOpen} onClose={handleActivateCancel}>
      <DialogTitle>Activate Vendor</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Are you sure you want to activate this vendor?
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleActivateCancel} color="primary">
          Cancel
        </Button>
        <Button onClick={handleActivateConfirm} color="primary">
          Activate
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default VendorActivateDialog;