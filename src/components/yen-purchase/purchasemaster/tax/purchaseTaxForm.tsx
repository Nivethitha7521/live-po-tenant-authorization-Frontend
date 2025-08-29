'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, CircularProgress, DialogContentText } from '@mui/material';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { PurchaseTax } from '@/Models/purchasetax';

const validationSchema = Yup.object({
  purchasetaxName: Yup.string()
    .required('Tax Name is required')
    .max(24, 'Maximum 24 characters required')
    .test('no-leading-trailing-spaces', 'Subcategory cannot start or end with spaces', (value) => {
  if (!value) return true;
  return value === value.trim();
}),
  purchasetaxPercentage: Yup.number()
    .typeError('Percentage must be a number')
    .required('Percentage is required')
    .min(0, 'Percentage must be at least 0')
    .max(50, 'Percentage cannot exceed 50'),
});

interface PurchaseTaxFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: PurchaseTax, { setFieldError }: any) => void;
  initialValues: PurchaseTax;
  editIndex: number | null;
  loading: boolean;
}

const PurchaseTaxForm: React.FC<PurchaseTaxFormProps> = ({
  open,
  onClose,
  onSubmit,
  initialValues,
  editIndex,
  loading,
}) => {
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [isTouched, setIsTouched] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCloseDialog = () => {
    if (isTouched && !isSubmitted) {
      setConfirmationOpen(true);
    } else {
      onClose();
    }
  };
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

  const handleConfirmCloseDialog = () => {
    setConfirmationOpen(false);
    setIsTouched(false);
    setIsSubmitted(false);
    onClose();
  };

  const handleSaveConfirmation = () => {
    setShowSaveConfirmation(true);
  };

  const handleConfirmSave = () => {
    setShowSaveConfirmation(false);
    document.getElementById('purchaseTaxForm')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  };

  const handleCancelSave = () => {
    setShowSaveConfirmation(false);
  };

  const handleFormSubmit = (values: PurchaseTax, formikHelpers: any) => {
    onSubmit(values, {
      ...formikHelpers,
      onSuccess: () => {
        setIsTouched(false);
        setIsSubmitted(true);
        onClose();
      },
    });
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={(event, reason) => {
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
            handleCloseDialog();
          }
        }}
      >
        <DialogTitle>{editIndex !== null ? 'Edit Purchase Tax' : 'Add Purchase Tax'}</DialogTitle>
        <Formik
          initialValues={initialValues}
          validationSchema={validationSchema}
          onSubmit={handleFormSubmit}
          validateOnChange={true}
        >
          {({ values, errors, touched, isValid, handleChange, handleBlur }) => (
            <Form id="purchaseTaxForm">
              <DialogContent>
                <TextField
                  inputRef={inputRef}
                  autoComplete="off"
                  margin="dense"
                  name="purchasetaxName"
                  label="Tax Name"
                  type="text"
                  fullWidth
                  value={values.purchasetaxName}
                  onChange={(e) => {
                    setIsTouched(true);
                    handleChange(e);
                  }}
                  onBlur={handleBlur}
                  error={touched.purchasetaxName && !!errors.purchasetaxName}
                  helperText={touched.purchasetaxName && errors.purchasetaxName}
                />
                <TextField
                  autoComplete="off"
                  margin="dense"
                  name="purchasetaxPercentage"
                  label="Tax Percentage"
                  type="number"
                  fullWidth
                  value={values.purchasetaxPercentage}
                  onChange={(e) => {
                    setIsTouched(true);
                    handleChange(e);
                  }}
                  onBlur={handleBlur}
                  error={touched.purchasetaxPercentage && !!errors.purchasetaxPercentage}
                  helperText={touched.purchasetaxPercentage && errors.purchasetaxPercentage}
                />
              </DialogContent>
              <DialogActions>
                <Button onClick={handleCloseDialog} color="primary" disabled={loading}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveConfirmation}
                  color="primary"
                  disabled={loading || !isValid}
                  startIcon={loading ? <CircularProgress size={24} /> : null}
                >
                  {loading ? 'Processing...' : editIndex !== null ? 'Save Changes' : 'Add'}
                </Button>
              </DialogActions>
            </Form>
          )}
        </Formik>
      </Dialog>

      <Dialog open={confirmationOpen} onClose={() => setConfirmationOpen(false)}>
        <DialogTitle>Unsaved Changes</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You have unsaved changes. Are you sure you want to close without saving?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmationOpen(false)} color="primary">
            Cancel
          </Button>
          <Button onClick={handleConfirmCloseDialog} color="primary">
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showSaveConfirmation} onClose={handleCancelSave}>
        <DialogTitle>Confirm Action</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {editIndex === null ? 'Are you sure you want to add this tax?' : 'Are you sure you want to update this tax?'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelSave} color="primary">
            Cancel
          </Button>
          <Button onClick={handleConfirmSave} color="primary" autoFocus>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default PurchaseTaxForm;