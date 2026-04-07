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
import { Formik, Form, FormikHelpers } from 'formik';
import * as Yup from 'yup';
import { PurchaseItemType } from '@/Models/itemType';

const validationSchema = Yup.object({
  itemtypeName: Yup.string()
    .required('Item Type is required')
    .max(24, 'Maximum 24 characters allowed')
    .test('no-leading-trailing-spaces', 'Item type cannot start or end with spaces', (value) => {
      if (!value) return true;
      return value === value.trim();
    })
    .test('no-multiple-spaces', 'Item type cannot contain multiple consecutive spaces', (value) => {
      if (!value) return true;
      return !/\s{2,}/.test(value);
    }),
});

interface ItemTypeFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: PurchaseItemType, formikHelpers: FormikHelpers<PurchaseItemType>) => void;
  initialValues: PurchaseItemType;
  editIndex: string | null;
  loading: boolean;
}

const ItemTypeForm: React.FC<ItemTypeFormProps> = ({
  open,
  onClose,
  onSubmit,
  initialValues,
  editIndex,
  loading,
}) => {
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [closeDialogConfirmationOpen, setCloseDialogConfirmationOpen] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [formState, setFormState] = useState<{
    values: PurchaseItemType;
    formikHelpers: FormikHelpers<PurchaseItemType> | null;
  }>({
    values: initialValues,
    formikHelpers: null,
  });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setUnsavedChanges(false);
    }
  }, [open, initialValues]);
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

  const handleFormSubmit = (values: PurchaseItemType, formikHelpers: FormikHelpers<PurchaseItemType>) => {
    const normalizedValues = {
      ...values,
      itemtypeName: values.itemtypeName.trim().replace(/\s+/g, ' '),
    };
    setFormState({ values: normalizedValues, formikHelpers });
    setConfirmationOpen(true);
  };

  const confirmAndSubmit = () => {
    if (formState.formikHelpers) {
      setUnsavedChanges(false);
      onSubmit(formState.values, formState.formikHelpers);
      setConfirmationOpen(false);
    }
  };

  const handleCloseDialog = () => {
    if (unsavedChanges) {
      setCloseDialogConfirmationOpen(true);
    } else {
      onClose();
    }
  };

  const handleConfirmCloseDialog = () => {
    setCloseDialogConfirmationOpen(false);
    setUnsavedChanges(false);
    onClose();
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={handleCloseDialog}
        disableEscapeKeyDown
      >
        <DialogTitle>{editIndex !== null ? 'Edit Item Type' : 'Add New Item Type'}</DialogTitle>
        <Formik
          initialValues={initialValues}
          validationSchema={validationSchema}
          onSubmit={handleFormSubmit}
          enableReinitialize
        >
          {({ values, errors, touched, handleChange, handleBlur, submitForm }) => (
            <Form>
              <DialogContent>
                <TextField
                  inputRef={inputRef}
                  autoComplete="off"
                  margin="dense"
                  id="itemtypeName"
                  name="itemtypeName"
                  label="Item Type Name"
                  type="text"
                  fullWidth
                  variant="outlined"
                  error={touched.itemtypeName && Boolean(errors.itemtypeName)}
                  helperText={touched.itemtypeName && errors.itemtypeName}
                  value={values.itemtypeName}
                  onChange={(e) => {
                    handleChange(e);
                    setUnsavedChanges(true);
                  }}
                  onBlur={handleBlur}
                />
              </DialogContent>
              <DialogActions>
                <Button onClick={handleCloseDialog} color="primary">
                  Cancel
                </Button>
                <Button
                  type="button"
                  color="primary"
                  onClick={() => {
                    submitForm();
                  }}
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={24} /> : null}
                >
                  {loading ? 'Processing...' : editIndex !== null ? 'Save Changes' : 'Add'}
                </Button>
              </DialogActions>
            </Form>
          )}
        </Formik>
      </Dialog>
      <Dialog
        open={confirmationOpen}
        onClose={() => setConfirmationOpen(false)}
      >
        <DialogTitle>Confirm Action</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to {editIndex !== null ? 'save changes' : 'add this item'}?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmationOpen(false)}>Cancel</Button>
          <Button onClick={confirmAndSubmit}>OK</Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={closeDialogConfirmationOpen}
        onClose={() => setCloseDialogConfirmationOpen(false)}
      >
        <DialogTitle>Unsaved Changes</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You have unsaved changes. Are you sure you want to close without saving?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloseDialogConfirmationOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmCloseDialog}>Confirm</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ItemTypeForm;