'use client';
import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  CircularProgress,
  DialogContentText,
} from '@mui/material';
import { Formik, Form, Field, FormikProps } from 'formik';
import * as Yup from 'yup';
import { PurchaseSubcategory } from '@/Models/purchasesubcategory';

const createValidationSchema = (existingSubcategories: string[], editIndex: number | null) => {
  return Yup.object({
    purchasesubcategoryName: Yup.string()
      .min(3, 'Minimum 3 characters required')
      .max(24, 'Maximum 24 characters allowed')
      .required('Subcategory is required')
      .matches(/^[a-zA-Z0-9 ]*$/, 'Only alphanumeric characters and spaces are allowed')
      .test('no-leading-trailing-spaces', 'Subcategory cannot start or end with spaces', (value) => {
        if (!value) return true;
        return value === value.trim();
      })
      .test('no-duplicate', 'Subcategory already exists', function (value) {
        if (!value) return true;

        // Add null check for existingSubcategories
        if (!existingSubcategories || !Array.isArray(existingSubcategories)) {
          return true;
        }

        // Normalize by removing all spaces and converting to lowercase
        const normalizedValue = value.replace(/\s+/g, '').toLowerCase();
        const isDuplicate = existingSubcategories.some((name, index) => {
          // Add null check for name
          if (!name) return false;
          if (editIndex !== null && index === editIndex) return false;
          const normalizedExisting = name.replace(/\s+/g, '').toLowerCase();
          return normalizedExisting === normalizedValue;
        });
        return !isDuplicate;
      }),
  });
};

interface PurchaseSubcategoryFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: PurchaseSubcategory, { setFieldError, resetForm }: any) => void;
  initialValues: PurchaseSubcategory;
  editIndex: number | null;
  loading: boolean;
  existingSubcategories: string[];
}

const PurchaseSubcategoryForm: React.FC<PurchaseSubcategoryFormProps> = ({
  open,
  onClose,
  onSubmit,
  initialValues,
  editIndex,
  loading,
  existingSubcategories,
}) => {
  const [isTouched, setIsTouched] = useState(false);
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<FormikProps<PurchaseSubcategory>>(null);
  const validationSchema = createValidationSchema(existingSubcategories, editIndex);
  // Update the useEffect for focusing
  useEffect(() => {
    if (open) {
      // Reset form validation state when dialog opens
      if (formRef.current) {
        formRef.current.resetForm();
      }

      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const length = inputRef.current.value.length;
          inputRef.current.setSelectionRange(length, length);
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [open]);

  // Handle any attempt to close the dialog
  const handleAttemptClose = (reason: 'backdropClick' | 'escapeKeyDown' | 'cancelButton') => {
    if (isTouched) {
      setShowCloseConfirmation(true);
    } else {
      onClose();
    }
  };

  const handleConfirmClose = () => {
    setShowCloseConfirmation(false);
    onClose();
  };

  const handleCancelClose = () => {
    setShowCloseConfirmation(false);
  };

  const handleSaveConfirmation = () => {
    setShowSaveConfirmation(true);
  };

  const handleConfirmSave = () => {
    setShowSaveConfirmation(false);
    document.getElementById('purchaseSubcategoryForm')?.dispatchEvent(
      new Event('submit', { cancelable: true, bubbles: true })
    );
  };

  const handleCancelSave = () => {
    setShowSaveConfirmation(false);
  };

  const handleFormSubmit = (values: PurchaseSubcategory, formikHelpers: any) => {
    const trimmedValues = {
      ...values,
      purchasesubcategoryName: values.purchasesubcategoryName.trim(),
    };

    onSubmit(trimmedValues, {
      ...formikHelpers,
      onSuccess: () => {
        setIsTouched(false);
      },
    });
  };

  const handlePaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  ) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text/plain');
    // Only allow alphanumeric and spaces, replace multiple spaces with single space
    const cleanedText = pastedText.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, ' ');

    const syntheticEvent = {
      target: {
        name: 'purchasesubcategoryName',
        value: cleanedText,
      },
    } as React.ChangeEvent<HTMLInputElement>;

    handleChange(syntheticEvent);
    setIsTouched(true);
  };

  return (
    <>
      {/* Main Dialog */}
      <Dialog
        open={open}
        onClose={(event, reason) => {
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
            handleAttemptClose(reason);
          }
        }}
        disableEscapeKeyDown={isTouched}
      >
        <DialogTitle>{editIndex === null ? 'Add Subcategory' : 'Edit Subcategory'}</DialogTitle>
        <Formik
          innerRef={formRef}  // Add this
          initialValues={initialValues}
          validationSchema={validationSchema}
          onSubmit={handleFormSubmit}
          enableReinitialize
          validateOnMount={false} // Add this line
          validateOnChange={true}
        >
          {({ values, errors, touched, handleChange, handleBlur, isValid, validateField, setFieldValue }) => (
            <Form id="purchaseSubcategoryForm">
              <DialogContent>
                <Field
                  inputRef={inputRef}
                  fullWidth
                  autoComplete="off"
                  autoFocus
                  name="purchasesubcategoryName"
                  label="Subcategory Name"
                  as={TextField}
                  variant="outlined"
                  error={touched.purchasesubcategoryName && Boolean(errors.purchasesubcategoryName)}
                  helperText={touched.purchasesubcategoryName && errors.purchasesubcategoryName}
                  value={values.purchasesubcategoryName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    // Replace multiple spaces with single space
                    const value = e.target.value.replace(/\s+/g, ' ');
                    e.target.value = value;
                    handleChange(e);
                    setIsTouched(true);

                    if (value.length === 24) {
                      validateField('purchasesubcategoryName');
                    }
                  }}
                  onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                    const value = e.target.value;
                    if (value) {
                      const trimmedValue = value.trim();
                      if (trimmedValue !== value) {
                        setFieldValue('purchasesubcategoryName', trimmedValue);
                      }
                    }
                    handleBlur(e);
                  }}
                  onPaste={(e: React.ClipboardEvent<HTMLInputElement>) => handlePaste(e, handleChange)}
                  inputProps={{
                    maxLength: 24,
                  }}
                />
              </DialogContent>
              <DialogActions>
                <Button onClick={() => handleAttemptClose('cancelButton')} color="primary">
                  Cancel
                </Button>
                <Button
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

      {/* Confirmation Dialogs */}
      <Dialog open={showCloseConfirmation} onClose={handleCancelClose}>
        <DialogTitle>Unsaved Changes</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You have unsaved changes. Are you sure you want to close?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelClose} color="primary">
            Cancel
          </Button>
          <Button onClick={handleConfirmClose} color="primary" autoFocus>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showSaveConfirmation} onClose={handleCancelSave}>
        <DialogTitle>Confirm Action</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {editIndex === null
              ? 'Are you sure you want to add this subcategory?'
              : 'Are you sure you want to update this subcategory?'}
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

export default PurchaseSubcategoryForm;