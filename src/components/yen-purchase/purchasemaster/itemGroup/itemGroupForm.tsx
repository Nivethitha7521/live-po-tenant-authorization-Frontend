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
  Dialog as ConfirmDialog,
  DialogContentText,
} from '@mui/material';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { PurchaseGroupItem } from '@/Models/itemgroup';
import { FormikHelpers } from 'formik';

// Normalize function to preserve internal spaces
const normalizeName = (value: string) => {
  return value.trim(); // Only trim leading/trailing spaces
};

const validationSchema = Yup.object({
  itemgroupName: Yup.string()
    .required('Item group is required')
    .max(24, 'Maximum 24 characters required')
    .matches(/^[a-zA-Z0-9 ]*$/, 'Item group must only contain letters, numbers, and spaces')
    .test('no-leading-trailing-spaces', 'Item group cannot start or end with spaces', (value) => {
      if (!value) return false;
      return value === value.trim();
    })
    .test('no-only-spaces', 'Item group cannot be only spaces', (value) => {
      if (!value) return false;
      return value.trim().length > 0;
    }),
});

interface ItemGroupFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: PurchaseGroupItem, formikHelpers: FormikHelpers<PurchaseGroupItem>) => Promise<void>;
  initialValues: PurchaseGroupItem;
  editIndex: number | null;
  loading: boolean;
}

const ItemGroupForm: React.FC<ItemGroupFormProps> = ({
  open,
  onClose,
  onSubmit,
  initialValues,
  editIndex,
  loading,
}) => {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [confirmSubmitDialog, setConfirmSubmitDialog] = useState(false);
  const [formikProps, setFormikProps] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false); // Track submission state
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClose = (formikDirty: boolean) => {
    if (formikDirty || unsavedChanges) {
      setShowConfirmDialog(true);
    } else {
      onClose();
    }
  };

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const length = inputRef.current.value.length;
          inputRef.current.setSelectionRange(length, length);
        }
      }, 100);
      setIsSubmitting(false); // Reset submitting state when dialog opens
      setUnsavedChanges(false); // Reset unsaved changes
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleConfirmClose = () => {
    setShowConfirmDialog(false);
    setUnsavedChanges(false);
    setIsSubmitting(false);
    onClose();
  };

  const handleSubmitClick = (formikProps: any) => {
    setFormikProps(formikProps);
    setConfirmSubmitDialog(true);
  };

  const handleConfirmSubmit = async () => {
    if (formikProps) {
      setIsSubmitting(true); // Disable button during submission
      setConfirmSubmitDialog(false);
      try {
        await formikProps.submitForm(); // Trigger Formik submission
      } catch (error) {
        // Error is handled in onSubmit; dialog will close
      }
    }
  };

  return (
    <>
      <Dialog open={open} onClose={() => handleClose(unsavedChanges)}>
        <DialogTitle>
          {editIndex !== null ? 'Edit Purchase Group Item' : 'Add New Purchase Group Item'}
        </DialogTitle>
        <Formik
          initialValues={{ ...initialValues, itemgroupName: normalizeName(initialValues.itemgroupName) }}
          validationSchema={validationSchema}
          onSubmit={async (values, formikHelpers) => {
            // Ensure final trim before submission
            const finalValues = {
              ...values,
              itemgroupName: values.itemgroupName.trim(),
            };
            try {
              await onSubmit(finalValues, formikHelpers);
              setUnsavedChanges(false);
              setIsSubmitting(false);
              onClose(); // Close dialog on success
            } catch (error: any) {
              // Handle errors (e.g., duplicate name or server error)
              formikHelpers.setFieldError(
                'itemgroupName',
                error.message || 'Failed to save item group'
              );
              setIsSubmitting(false); // Re-enable button on error
              onClose(); // Close dialog on error
            }
          }}
        >
          {({
            values,
            errors,
            touched,
            handleChange,
            handleBlur,
            dirty,
            submitForm,
            setFieldValue,
          }) => (
            <Form>
              <DialogContent>
                <TextField
                  inputRef={inputRef}
                  autoComplete="off"
                  margin="dense"
                  id="itemgroupName"
                  name="itemgroupName"
                  label="Item Group Name"
                  type="text"
                  fullWidth
                  variant="outlined"
                  value={values.itemgroupName}
                  onChange={(e) => {
                    // Prevent leading spaces and collapse multiple spaces
                    let newValue = e.target.value.replace(/\s+/g, ' ').trimStart();
                    setFieldValue('itemgroupName', newValue);
                    setUnsavedChanges(true);
                  }}
                  onBlur={(e) => {
                    // Trim on blur
                    const trimmedValue = e.target.value.trim();
                    setFieldValue('itemgroupName', trimmedValue);
                    handleBlur(e);
                  }}
                  error={touched.itemgroupName && !!errors.itemgroupName}
                  helperText={
                    (touched.itemgroupName && errors.itemgroupName)}
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
                <Button onClick={() => handleClose(dirty)} color="primary" disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  color="primary"
                  disabled={isSubmitting || loading || !values.itemgroupName.trim()}
                  startIcon={isSubmitting || loading ? <CircularProgress size={24} /> : null}
                  onClick={() => handleSubmitClick({ submitForm, dirty })}
                >
                  {isSubmitting || loading ? 'Processing...' : editIndex !== null ? 'Save Changes' : 'Add'}
                </Button>
              </DialogActions>
            </Form>
          )}
        </Formik>
      </Dialog>

      <ConfirmDialog open={showConfirmDialog} onClose={() => setShowConfirmDialog(false)}>
        <DialogTitle>Unsaved Changes</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You have unsaved changes. Are you sure you want to close the dialog without saving?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConfirmDialog(false)} color="primary" disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirmClose} color="primary" disabled={isSubmitting}>
            Confirm
          </Button>
        </DialogActions>
      </ConfirmDialog>

      <ConfirmDialog open={confirmSubmitDialog} onClose={() => setConfirmSubmitDialog(false)}>
        <DialogTitle>{editIndex !== null ? 'Confirm Edit' : 'Confirm Add'}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to {editIndex !== null ? 'save the changes' : 'add this item'}?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmSubmitDialog(false)} color="primary" disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirmSubmit} color="primary" disabled={isSubmitting}>
            Confirm
          </Button>
        </DialogActions>
      </ConfirmDialog>
    </>
  );
};

export default ItemGroupForm;