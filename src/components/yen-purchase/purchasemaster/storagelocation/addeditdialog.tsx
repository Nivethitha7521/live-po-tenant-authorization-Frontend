'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, CircularProgress, DialogContentText } from '@mui/material';
import { StorageLocationItem } from '@/Models/storagelocation';

interface StorageLocationFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: StorageLocationItem) => void;
  initialValues: StorageLocationItem;
  editIndex: string | null;
  loading: boolean;
  locationNameTouched: boolean;
  resetForm: () => void;
}

const StorageLocationForm: React.FC<StorageLocationFormProps> = ({
  open,
  onClose,
  onSubmit,
  initialValues,
  editIndex,
  loading,
  locationNameTouched,
  resetForm,
}) => {
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [postSubmitDialogOpen, setPostSubmitDialogOpen] = useState(false);
  const [showError, setShowError] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [localValues, setLocalValues] = useState<StorageLocationItem>(initialValues);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Add this useEffect to sync localValues with initialValues when they change
  useEffect(() => {
    setLocalValues(initialValues);
  }, [initialValues]);
useEffect(() => {
  if (open) {
    // Double focus approach for maximum reliability
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        // Move cursor to end if there's text
        const length = inputRef.current.value.length;
        inputRef.current.setSelectionRange(length, length);
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }
}, [open]);

  const validateLocationName = (value: string): string | null => {
    if (!value.trim()) {
      return 'Storage Location Name is required';
    }
    const regex = /^[a-zA-Z0-9 ]+$/;
    if (!regex.test(value)) {
      return 'Storage Location Name can only contain letters, numbers, and spaces';
    }
    if (value !== value.trim()) {
      return 'Storage Location Name cannot start or end with spaces';
    }
    if (/\s{2,}/.test(value)) {
      return 'Storage Location Name cannot contain multiple consecutive spaces';
    }
    return null;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLocalValues((prev) => ({ ...prev, [name]: value }));
    if (name === 'locationName') {
      const error = validateLocationName(value);
      setValidationError(error);
      setShowError(!!error);
    }
    setUnsavedChanges(true);
  };

  const handleBlur = () => {
    const error = validateLocationName(localValues.locationName);
    setValidationError(error);
    setShowError(!!error);
  };

  const handleClose = () => {
    if (unsavedChanges) {
      setConfirmDialogOpen(true);
    } else {
      onClose();
      resetForm();
    }
  };

  const handleCancelClose = () => {
    setConfirmDialogOpen(false);
  };

  const handleConfirmClose = () => {
    setConfirmDialogOpen(false);
    onClose();
    resetForm();
  };

  const handleSubmit = () => {
    const normalizedName = localValues.locationName.trim().replace(/\s+/g, ' ');
    const error = validateLocationName(normalizedName);
    if (error) {
      setShowError(true);
      setValidationError(error);
      return;
    }
    setLocalValues((prev) => ({ ...prev, locationName: normalizedName }));
    setPostSubmitDialogOpen(true);
  };

  const handleCancelSave = () => {
    setPostSubmitDialogOpen(false);
  };

  const handleConfirmSubmit = () => {
    console.log('handleConfirmSubmit called with:', localValues);
    const normalizedName = localValues.locationName.trim().replace(/\s+/g, ' ');
    const error = validateLocationName(normalizedName);
    if (error) {
      setShowError(true);
      setValidationError(error);
      setPostSubmitDialogOpen(false);
      return;
    }

    if (isSubmitting) {
      console.log('Submission blocked: already submitting');
      return;
    }

    setIsSubmitting(true);
    onSubmit({ ...localValues, locationName: normalizedName });
  };

  useEffect(() => {
    if (!loading && isSubmitting) {
      setIsSubmitting(false);
      setPostSubmitDialogOpen(false);
      setUnsavedChanges(false);
      if (!editIndex) {
        setLocalValues(initialValues);
      }
    }
  }, [loading, isSubmitting, editIndex, initialValues]);

  return (
    <>
      <Dialog
        open={open}
        onClose={(_, reason) => {
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
            handleClose();
          }
        }}
      >
        <DialogTitle>{editIndex !== null ? 'Edit Storage Location' : 'Add Storage Location'}</DialogTitle>
        <DialogContent>
          <TextField
            inputRef={inputRef}
            autoComplete="off"
            margin="dense"
            name="locationName"
            label="Storage Location Name"
            type="text"
            fullWidth
            required
            value={localValues.locationName}
            onChange={handleInputChange}
            onBlur={handleBlur}
            error={showError}
            helperText={showError ? validationError : ''}
            disabled={loading}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="primary" disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            color="primary"
            disabled={loading || !!validationError}
            startIcon={loading ? <CircularProgress size={24} /> : null}
          >
            {loading ? 'Processing...' : editIndex !== null ? 'Save Changes' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={confirmDialogOpen}
        onClose={handleCancelClose}
      >
        <DialogTitle>Unsaved Changes</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You have unsaved changes. Are you sure you want to close this dialog without saving?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelClose} color="primary">
            No
          </Button>
          <Button onClick={handleConfirmClose} color="primary" autoFocus>
            Yes, Discard Changes
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={postSubmitDialogOpen}
        onClose={handleCancelSave}
      >
        <DialogTitle>Confirm Action</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {editIndex === null
              ? 'Are you sure you want to add this Storage Location?'
              : 'Are you sure you want to update this Storage Location?'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelSave} color="primary">
            Cancel
          </Button>
          <Button
            onClick={handleConfirmSubmit}
            color="primary"
            autoFocus
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : null}
          >
            {loading ? 'Processing...' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default StorageLocationForm;