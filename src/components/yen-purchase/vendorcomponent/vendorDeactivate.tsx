// vendordeactivate.tsx - Fixed with prop
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

interface VendorDeactivateDialogProps {
  canDelete: boolean; // ✅ ADD PERMISSION PROP
}

// ✅ RECEIVE THE PROP IN COMPONENT PARAMETERS
const VendorDeactivateDialog: React.FC<VendorDeactivateDialogProps> = ({ canDelete }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { deactivateDialogOpen, itemToDeactivate } = useSelector(selectVendorItems);

  const handleDeactivateConfirm = () => {
    if (itemToDeactivate && canDelete) { // ✅ NOW canDelete IS AVAILABLE
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
        <Button 
          onClick={handleDeactivateConfirm} 
          color="primary"
          disabled={!canDelete} // ✅ DISABLE IF NO PERMISSION
        >
          Deactivate
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default VendorDeactivateDialog;