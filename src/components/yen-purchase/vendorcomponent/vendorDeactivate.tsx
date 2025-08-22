'use client';
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button
} from '@mui/material';
import {
  setDeactivateDialogOpen, setItemToDeactivate, deactivateVendor,
  selectVendorItems
} from '../../../features/yen-purchase/PurchaseMaster/vendorSlice';
import { AppDispatch } from '@/redux/store';

const VendorDeactivateDialog = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { deactivateDialogOpen, itemToDeactivate } = useSelector(selectVendorItems);

  const handleDeactivateConfirm = () => {
    if (itemToDeactivate) {
      dispatch(deactivateVendor(itemToDeactivate.vendorId));
    }
    dispatch(setDeactivateDialogOpen(false));
    dispatch(setItemToDeactivate(null));
  };

  const handleDeactivateCancel = () => {
    dispatch(setItemToDeactivate(null));
    dispatch(setDeactivateDialogOpen(false));
  };

  return (
    <Dialog open={deactivateDialogOpen} onClose={handleDeactivateCancel}>
      <DialogTitle>Deactivate Vendor</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Are you sure you want to deactivate this vendor?
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleDeactivateCancel} color="primary">
          Cancel
        </Button>
        <Button onClick={handleDeactivateConfirm} color="primary">
          Deactivate
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default VendorDeactivateDialog;
