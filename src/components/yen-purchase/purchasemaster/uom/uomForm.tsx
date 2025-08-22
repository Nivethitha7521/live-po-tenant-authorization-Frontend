'use client';
import React, { useEffect, useRef, useState } from 'react';
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
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import { UOMItem } from '@/Models/uom';

// Normalize UOM name for duplicate checking (remove spaces, lowercase)
const normalizeUOMName = (name: string) => name.replace(/\s+/g, '').toLowerCase();

// Validation schema
const validationSchema = (existingUOMItems: UOMItem[], currentUOMId: string | null) =>
  Yup.object({
    uom: Yup.string()
      .trim() // Automatically trim leading/trailing spaces
      .required('UOM is required')
      .matches(/^[a-zA-Z0-9 ]*$/, 'UOM must only contain letters, numbers, and spaces')
      .min(1, 'UOM cannot be empty')
      .test('no-leading-trailing-spaces', 'UOM cannot start or end with spaces', (value) => {
        if (!value) return true; // Skip if empty (handled by required)
        return value === value.trim();
      })
      .test('unique-uom', 'UOM already exists', function (value) {
        if (!value) return true; // Skip if empty (handled by required)
        const normalizedInput = normalizeUOMName(value);
        return !existingUOMItems.some(
          (item) =>
            normalizeUOMName(item.uom) === normalizedInput &&
            item.purchaseuomId !== currentUOMId // Exclude current UOM in edit mode
        );
      }),
    precisionValue: Yup.number()
      .required('Precision Value is required')
      .typeError('Precision Value must be a number')
      .min(0, 'Precision Value must be non-negative'),
  });

interface UOMFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: UOMItem) => void;
  initialValues: UOMItem;
  editIndex: string | null;
  loading: boolean;
  existingUOMItems: UOMItem[];
}

const UOMForm: React.FC<UOMFormProps> = ({
  open,
  onClose,
  onSubmit,
  initialValues,
  editIndex,
  loading,
  existingUOMItems,
}) => {
  const [isTouched, setIsTouched] = useState(false);
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
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
    document.getElementById('uomForm')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  };

  const handleCancelSave = () => {
    setShowSaveConfirmation(false);
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={(event, reason) => {
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
            handleAttemptClose(reason);
          }
        }}
        disableEscapeKeyDown={isTouched}
      >
        <DialogTitle>{editIndex === null ? 'Add UOM' : 'Edit UOM'}</DialogTitle>
        <Formik
          initialValues={initialValues}
          validationSchema={validationSchema(existingUOMItems, editIndex)}
          onSubmit={(values, { resetForm }) => {
            // Trim UOM before submission
            const trimmedValues = { ...values, uom: values.uom.trim() };
            onSubmit(trimmedValues);
            resetForm();
            setIsTouched(false);
          }}
          validateOnChange={true}
          enableReinitialize
        >
          {({ values, errors, touched, handleChange, handleBlur, isValid }) => (
            <Form id="uomForm">
              <DialogContent>
                <Field
                  fullWidth
                  inputRef={inputRef}
                  autoComplete="off"
                  name="uom"
                  label="UOM"
                  as={TextField}
                  variant="outlined"
                  error={touched.uom && Boolean(errors.uom)}
                  helperText={touched.uom && errors.uom}
                  value={values.uom}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const trimmedValue = e.target.value.trimStart(); // Prevent leading spaces
                    handleChange({
                      ...e,
                      target: { ...e.target, name: 'uom', value: trimmedValue },
                    });
                    setIsTouched(true);
                  }}
                  onPaste={(e: React.ClipboardEvent<HTMLInputElement>) => {
                    e.preventDefault();
                    const pastedText = e.clipboardData.getData('text').trim(); // Trim leading/trailing spaces on paste
                    if (pastedText.length === 0) {
                      // Prevent empty or whitespace-only paste
                      handleChange({
                        target: { name: 'uom', value: '' },
                      } as any);
                    } else {
                      handleChange({
                        target: { name: 'uom', value: pastedText },
                      } as any);
                    }
                    setIsTouched(true);
                  }}
                  onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                    // Trim trailing spaces on blur
                    const trimmedValue = e.target.value.trim();
                    handleChange({
                      target: { name: 'uom', value: trimmedValue },
                    } as any);
                    handleBlur(e);
                  }}
                />
                <Field
                  fullWidth
                  autoComplete="off"
                  name="precisionValue"
                  label="Precision Value"
                  sx={{ marginTop: 2 }}
                  as={TextField}
                  variant="outlined"
                  error={touched.precisionValue && Boolean(errors.precisionValue)}
                  helperText={touched.precisionValue && errors.precisionValue}
                  value={values.precisionValue}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    handleChange(e);
                    setIsTouched(true);
                  }}
                  onBlur={handleBlur}
                  type="number"
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

      {/* Close Confirmation Dialog */}
      <Dialog open={showCloseConfirmation} onClose={handleCancelClose}>
        <DialogTitle>Unsaved Changes</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You have unsaved changes. Are you sure you want to close this dialog without saving?
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

      {/* Save Confirmation Dialog */}
      <Dialog open={showSaveConfirmation} onClose={handleCancelSave}>
        <DialogTitle>Confirm Action</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {editIndex === null ? 'Are you sure you want to add this UOM?' : 'Are you sure you want to update this UOM?'}
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

export default UOMForm;