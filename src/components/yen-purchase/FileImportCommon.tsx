'use client';
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material';

interface CommonImportConfirmationDialogProps {
  open: boolean;
  fileName: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

const CommonImportConfirmationDialog: React.FC<CommonImportConfirmationDialogProps> = ({
  open,
  fileName,
  onConfirm,
  onCancel,
  isLoading,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby="import-confirmation-dialog-title"
      aria-describedby="import-confirmation-dialog-description"
    >
      <DialogTitle id="import-confirmation-dialog-title">Confirm Import</DialogTitle>
      <DialogContent>
        <DialogContentText id="import-confirmation-dialog-description">
          Are you sure you want to import {fileName || 'this file'}? This action may overwrite existing data.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} color="primary">
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          color="primary"
          variant="contained"
          autoFocus
          disabled={isLoading}
        >
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CommonImportConfirmationDialog;