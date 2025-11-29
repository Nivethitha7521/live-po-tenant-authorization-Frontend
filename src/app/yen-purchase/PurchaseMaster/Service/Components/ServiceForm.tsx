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
import { FormikHelpers } from 'formik';
import { Service } from '../Models/Service';

// Form values type limited to edited fields
type FormValues = {
  serviceName: string;
  saccode?: number;
};

// Normalize function to preserve internal spaces
const normalizeName = (value: string) => {
  return value.trim(); // Only trim leading/trailing spaces
};

const validationSchema = Yup.object({
  serviceName: Yup.string()
    .required('Service name is required')
    .matches(/^[a-zA-Z0-9 ]*$/, 'Service must only contain letters, numbers, and spaces')
    .test('no-leading-trailing-spaces', 'Service cannot start or end with spaces', (value) => {
      if (!value) return false;
      return value === value.trim();
    })
    .test('no-only-spaces', 'Service cannot be only spaces', (value) => {
      if (!value) return false;
      return value.trim().length > 0;
    }),
  saccode: Yup.number()
    .integer('SAC Code must be an integer')
    .min(0, 'SAC Code cannot be negative')
    .max(99999999, 'SAC Code too long')
    .nullable(),
});

interface ServiceFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: FormValues, formikHelpers: FormikHelpers<FormValues>) => Promise<void>;
  initialValues: Service;
  editIndex: number | null;
  loading: boolean;
}

const ServiceForm: React.FC<ServiceFormProps> = ({
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

  const handleSubmitClick = (formikPropsParam: any) => {
    setFormikProps(formikPropsParam);
    setConfirmSubmitDialog(true);
  };

  const handleConfirmSubmit = async () => {
    if (formikProps) {
      setIsSubmitting(true); // Disable button during submission
      setConfirmSubmitDialog(false);
      try {
        await formikProps.submitForm(); // Trigger Formik submission
      } catch (error) {
        // Error handled in onSubmit; dialog stays open
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <>
      <Dialog open={open} onClose={() => handleClose(unsavedChanges)}>
        <DialogTitle>
          {editIndex !== null ? 'Edit Service Item' : 'Add New Service Item'}
        </DialogTitle>
        <Formik<FormValues>
          initialValues={{ 
            serviceName: normalizeName(initialValues.serviceName || ''), 
            saccode: initialValues.saccode || undefined
          }}
          validationSchema={validationSchema}
          onSubmit={async (values, formikHelpers) => {
            // Ensure final trim before submission
            const finalValues: FormValues = {
              ...values,
              serviceName: values.serviceName.trim(),
            };
            try {
              await onSubmit(finalValues, formikHelpers);
              // Close handled in onSubmit on success
            } catch (error: any) {
              // Field errors and snackbars handled in onSubmit; dialog stays open
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
                  id="serviceName"
                  name="serviceName"
                  label="Service Name"
                  type="text"
                  fullWidth
                  variant="outlined"
                  value={values.serviceName}
                  onChange={(e) => {
                    // Prevent leading spaces and collapse multiple spaces
                    let newValue = e.target.value.replace(/\s+/g, ' ').trimStart();
                    setFieldValue('serviceName', newValue);
                    setUnsavedChanges(true);
                  }}
                  onBlur={(e) => {
                    // Trim on blur
                    const trimmedValue = e.target.value.trim();
                    setFieldValue('serviceName', trimmedValue);
                    handleBlur(e);
                  }}
                  error={touched.serviceName && !!errors.serviceName}
                  helperText={
                    (touched.serviceName && errors.serviceName) as React.ReactNode
                  }
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
                <TextField
                  autoComplete="off"
                  margin="dense"
                  id="saccode"
                  name="saccode"
                  label="SAC Code"
                  type="number"
                  fullWidth
                  variant="outlined"
                  value={values.saccode ?? ''}
                  onChange={(e) => {
                    const value = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                    setFieldValue('saccode', value);
                    setUnsavedChanges(true);
                  }}
                  onBlur={handleBlur}
                  error={touched.saccode && !!errors.saccode}
                  helperText={
                    (touched.saccode && errors.saccode) as React.ReactNode
                  }
                  inputProps={{
                    min: 0,
                    max: 99999999,
                    step: 1,
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
                  disabled={isSubmitting || loading || !values.serviceName.trim()}
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
            Are you sure you want to {editIndex !== null ? 'save the changes' : 'add this service item'}?
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

export default ServiceForm;