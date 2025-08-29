'use client';
import React, { FC, useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  CircularProgress,
  DialogContentText,
} from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import {
  setVendorTypeData,
  setDialogOpen,
  selectVendorTypeItems,
} from '../../../../features/yen-purchase/PurchaseMaster/VendorTypeSlice';

interface VendorDialogProps {
  handleSubmit: () => void;
  loading: boolean;
  error: { vendorType: string };
  existingVendorTypes: string[];
}

const VendorTypeDialog: FC<VendorDialogProps> = ({ handleSubmit, loading, error, existingVendorTypes }) => {
  const dispatch = useDispatch();
  const { dialogOpen, vendorTypeData, editVendorTypeId } = useSelector(selectVendorTypeItems);

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationType, setConfirmationType] = useState<'close' | 'submit'>('close');
  const [originalData, setOriginalData] = useState(vendorTypeData);
  const [hasChanges, setHasChanges] = useState(false);
  const [localError, setLocalError] = useState('');
  const [localWarning, setLocalWarning] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (dialogOpen === 'edit' || dialogOpen === 'add') {
      setOriginalData(vendorTypeData);
      setHasChanges(false);
      setLocalError('');
      setLocalWarning('');
    }
  }, [dialogOpen, vendorTypeData]);

  useEffect(() => {
    if (dialogOpen) {
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const length = inputRef.current.value.length;
          inputRef.current.setSelectionRange(length, length);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [dialogOpen]);

  useEffect(() => {
    if (dialogOpen === 'edit' || dialogOpen === 'add') {
      setHasChanges(originalData.vendorType !== vendorTypeData.vendorType);
    }
  }, [vendorTypeData, originalData, dialogOpen]);

  const normalizeForDuplicateCheck = (value: string): string => {
    return value.trim().replace(/\s+/g, '').toLowerCase();
  };

  const normalizeInput = (value: string): string => {
    return value.trimStart().replace(/\s+/g, ' ');
  };

  const hasLeadingSpaces = (value: string): boolean => {
    return value.startsWith(' ');
  };

  const hasTrailingSpaces = (value: string): boolean => {
    return value.endsWith(' ');
  };

  const handleTextFieldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    // Reject leading spaces
    if (hasLeadingSpaces(value)) {
      setLocalError('Leading spaces are not allowed');
      return;
    }

    const normalizedValue = normalizeInput(value);

    // Warn about trailing spaces
    if (hasTrailingSpaces(value)) {
      setLocalWarning('Trailing spaces will be removed');
    } else {
      setLocalWarning('');
    }

    // Validation rules
    const regex = /^[a-zA-Z0-9][a-zA-Z0-9 ]*$/;
    const duplicateCheckValue = normalizeForDuplicateCheck(normalizedValue);
    const isDuplicate = existingVendorTypes.some(
      (type) =>
        normalizeForDuplicateCheck(type) === duplicateCheckValue &&
        normalizeForDuplicateCheck(type) !== normalizeForDuplicateCheck(originalData.vendorType)
    );

    if (normalizedValue.length > 24) {
      setLocalError('Vendor Type cannot exceed 24 characters');
    } else if (!regex.test(normalizedValue) && normalizedValue !== '') {
      setLocalError('Must start with letter/number and can contain single spaces');
    } else if (isDuplicate) {
      setLocalError(`Vendor type '${normalizedValue}' already exists`);
    } else {
      setLocalError('');
    }

    dispatch(setVendorTypeData({ ...vendorTypeData, [name]: normalizedValue }));
  };

  const handleBlur = () => {
    const trimmedValue = vendorTypeData.vendorType.trim();
    dispatch(setVendorTypeData({ ...vendorTypeData, vendorType: trimmedValue }));
    if (hasTrailingSpaces(vendorTypeData.vendorType)) {
      setLocalWarning('');
    }
  };

  const handleSubmitClick = () => {
    const trimmedValue = vendorTypeData.vendorType.trim();
    if (trimmedValue.length < 3) {
      setLocalError('Vendor Type must be at least 3 characters');
      return;
    }
    setConfirmationType('submit');
    setShowConfirmation(true);
  };

  const handleConfirmSubmit = () => {
    setShowConfirmation(false);
    dispatch(setVendorTypeData({ ...vendorTypeData, vendorType: vendorTypeData.vendorType.trim() }));
    handleSubmit();
  };

  const handleDialogClose = () => {
    if (hasChanges) {
      setConfirmationType('close');
      setShowConfirmation(true);
    } else {
      dispatch(setDialogOpen('none'));
    }
  };

  const handleConfirmClose = () => {
    setShowConfirmation(false);
    dispatch(setDialogOpen('none'));
  };

  const handleCancelClose = () => {
    setShowConfirmation(false);
  };

  return (
    <>
      <Dialog
        open={dialogOpen === 'edit' || dialogOpen === 'add'}
        onClose={handleDialogClose}
        disableEscapeKeyDown
      >
        <DialogTitle>{editVendorTypeId ? 'Edit Vendor Type' : 'Add Vendor Type'}</DialogTitle>
        <DialogContent>
          <TextField
            inputRef={inputRef}
            autoComplete="off"
            autoFocus
            margin="dense"
            name="vendorType"
            label="Vendor Type"
            type="text"
            fullWidth
            variant="outlined"
            value={vendorTypeData.vendorType}
            onChange={handleTextFieldChange}
            onBlur={handleBlur}
            error={!!error.vendorType || !!localError}
            helperText={error.vendorType || localError || localWarning}
            inputProps={{ maxLength: 24 }}
            InputLabelProps={{
              sx: {
                '&::after': {
                  content: '"*"',
                  color: 'red',
                  marginLeft: '4px',
                },
              },
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>Cancel</Button>
          <Button
            onClick={handleSubmitClick}
            disabled={loading || vendorTypeData.vendorType.trim().length < 3 || !!localError}
            startIcon={loading ? <CircularProgress size={24} /> : null}
          >
            {loading ? 'Submitting...' : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={showConfirmation}
        onClose={handleCancelClose}
      >
        <DialogTitle>Confirmation</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirmationType === 'close'
              ? 'You have unsaved changes. Are you sure you want to close the dialog?'
              : 'Are you sure you want to submit the changes?'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelClose}>Cancel</Button>
          <Button onClick={confirmationType === 'close' ? handleConfirmClose : handleConfirmSubmit}>
            {confirmationType === 'close' ? 'Close without saving' : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default VendorTypeDialog;