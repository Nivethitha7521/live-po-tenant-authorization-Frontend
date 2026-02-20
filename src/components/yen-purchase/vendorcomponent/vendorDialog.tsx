'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Button, Typography, Grid, Modal, TextField, MenuItem, Stepper, Step, StepLabel,
  IconButton
} from '@mui/material';
import { Formik, Form, FormikProps, useFormikContext } from 'formik';
import * as yup from 'yup';
import AddIcon from '@mui/icons-material/Add';
import {
  addVendor,
  updateVendor,
  setDialogOpen,
  setVendorData,
  setSnackbarMessage,
  setSnackbarOpen,
  fetchVendors,
  setEditIndex,
  selectVendorItems,
} from '../../../features/yen-purchase/PurchaseMaster/vendorSlice';
import OptimizedTextField from '../../OptimizedTextField';
import LocationArea from '../../LocationArea';
import { AppDispatch } from '@/redux/store';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ConfirmationDialog from './confirmationDialog';
import VendorTypeDialog from './vendortypedialogcomponent';
import { setVendorTypeData } from '@/features/yen-purchase/PurchaseMaster/VendorTypeSlice';
import { resetLocationState } from '../../../features/locationAreaSlice';
import { Vendor } from '@/Models/vendor';
import { FormikErrors } from 'formik';
import { fetchBank, selectOutgoings } from '@/features/yen-purchase/Outgoing/outgoingPaymentSlice';
import { fetchVendorTypeItems } 
from '@/features/yen-purchase/PurchaseMaster/VendorTypeSlice';
const validationSchema = yup.object({
  vendorName: yup
    .string()
    .trim('Vendor name cannot have leading or trailing spaces')
    .required('Vendor name is required'),
  contactpersonPhone: yup
    .string()
    .matches(/^[6-9]\d{9}$/, 'Contact phone number must be 10 digits and start with 6')    
    .required('Contact person phone is required'),
  contactpersonEmail: yup
    .string()
    .email('Enter a valid email address')
    .optional(),
  website: yup
    .string()
    .optional(),
  vendorType: yup.string().required('Vendor type is required'),
  address: yup.string().required('Address is required'),
  country: yup.string().optional(),
  state: yup.string().optional(),
  city: yup.string().optional(),
  postalCode: yup.string().when('country', {
    is: (country: string) => !!country,
    then: (schema) => schema.required('Postal code is required'),
    otherwise: (schema) => schema.notRequired(),
  }),
  paymentTerms: yup.string().required('Payment terms are required'),
  preferredpaymentMethod: yup.string().required('Preferred payment method is required'),
  creditLimit: yup
    .number()
    .required('Credit limit is required')
    .typeError('Credit limit must be a number')
    .positive('Credit limit must be positive'),
  bankName: yup.string().when('preferredpaymentMethod', {
    is: (val: string) => val !== 'Cash',
    then: (schema) => schema.required('Bank name is required'),
    otherwise: (schema) => schema.notRequired(),
  }),
  accountNumber: yup.number().when('preferredpaymentMethod', {
    is: (val: string) => val !== 'Cash',
    then: (schema) =>
      schema
        .required('Account number is required')
        .typeError('Account number must be a number')
        .integer('Account number must be an integer')
        .positive('Account number must be positive'),
    otherwise: (schema) => schema.notRequired(),
  }),
  ifscCode: yup.string().when('preferredpaymentMethod', {
    is: (val: string) => val !== 'Cash',
    then: (schema) => schema.required('IFSC code is required'),
    otherwise: (schema) => schema.notRequired(),
  }),
});

type DialogOpenState = 'none' | 'edit' | 'deactivated';

const initialVendorState: Vendor = {
  vendorId: '',
  vendorName: '',
  randomId: '',
  contactpersonName: '',
  contactpersonPhone: '',
  contactpersonEmail: '',
  address: '',
  country: '',
  state: '',
  city: '',
  postalCode: 0,
  website: '',
  vendorType: '',
  gstNumber: '',
  paymentTerms: '',
  bankName: '',
  accountNumber: 0,
  ifscCode: '',
  creditLimit: 0,
  preferredpaymentMethod: '',
  status: '',
  notes: '',
  createdDate: null,
  updatedDate: null,
};

interface VendorDialogProps {
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

// Normalize vendorData to ensure no null values
const normalizeVendorData = (data: Vendor): Vendor => ({
  ...initialVendorState,
  ...data,
  vendorId: data.vendorId || '',
  vendorName: data.vendorName?.trim() || '', // Trim vendorName
  randomId: data.randomId || '',
  contactpersonName: data.contactpersonName || '',
  contactpersonPhone: data.contactpersonPhone || '',
  contactpersonEmail: data.contactpersonEmail || '',
  address: data.address || '',
  country: data.country || '',
  state: data.state || '',
  city: data.city || '',
  postalCode: data.postalCode || 0,
  website: data.website || '',
  vendorType: data.vendorType || '',
  gstNumber: data.gstNumber || '',
  paymentTerms: data.paymentTerms || '',
  bankName: data.bankName || '',
  accountNumber: data.accountNumber || 0,
  ifscCode: data.ifscCode || '',
  creditLimit: data.creditLimit || 0,
  preferredpaymentMethod: data.preferredpaymentMethod || '',
  status: data.status || '',
  notes: data.notes || '',
  createdDate: data.createdDate || null,
  updatedDate: data.updatedDate || null,
});

const steps = [
  'Basic Information',
  'Location Details',
  'Payment Information',
  'Bank Account Details',
];

const FormDirtyTracker: React.FC<{ setIsDirty: (dirty: boolean) => void }> = ({ setIsDirty }) => {
  const formik = useFormikContext();

  useEffect(() => {
    setIsDirty(formik.dirty);
  }, [formik.dirty, setIsDirty]);

  return null;
};

const VendorDialog = ({ loading, setLoading }: VendorDialogProps) => {
  const dispatch = useDispatch<AppDispatch>();
  const { dialogOpen, vendorData, editIndex, items, vendorTypeItems } = useSelector(selectVendorItems);
  const { banks } = useSelector(selectOutgoings);
  const [activeStep, setActiveStep] = React.useState(0);
  const totalSteps = steps.length;
  type VendorFormValues = typeof initialVendorState;
  const formRef = React.useRef<FormikProps<VendorFormValues>>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showVendorTypeDialog, setShowVendorTypeDialog] = useState(false);
  const [initialValues, setInitialValues] = useState<VendorFormValues>(normalizeVendorData(vendorData));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (dialogOpen === 'edit' && !vendorData.vendorId) {
      dispatch(resetLocationState());
      setIsDirty(false);
    }
  }, [dialogOpen, vendorData.vendorId, dispatch]);
useEffect(() => {
  if (dialogOpen) {
    dispatch(fetchVendorTypeItems({}));
  }
}, [dialogOpen, dispatch]);
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'F5' || (e.ctrlKey && e.key === 'r')) && isDirty) {
        e.preventDefault();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDirty]);

  useEffect(() => {
    setInitialValues(normalizeVendorData(vendorData));
  }, [vendorData]);

   useEffect(() => {
      dispatch(fetchBank());
    }, [dispatch]);

  const handleDialogClose = (forceClose = false) => {
    if (isDirty && !forceClose) {
      setShowCloseConfirm(true);
      return;
    }
    dispatch(resetLocationState());
    dispatch(setDialogOpen('none'));
    dispatch(setVendorData(initialVendorState));
    dispatch(setEditIndex(null));
    setActiveStep(0);
    setIsDirty(false);
    setShowDuplicateDialog(false);
  };
useEffect(() => {
  if (dialogOpen) {
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
}, [dialogOpen]);

  const handleNext = async () => {
    if (formRef.current) {
      const formik = formRef.current;

      // Define fields to validate for each step
      const stepFields: { [key: number]: string[] } = {
        0: ['vendorName', 'contactpersonPhone', 'vendorType'],
        1: ['address'],
        2: ['paymentTerms', 'preferredpaymentMethod', 'creditLimit'],
        3: formik.values.preferredpaymentMethod !== 'Cash' ? ['bankName', 'accountNumber', 'ifscCode'] : [],
      };

      // Set touched for current step's fields
      const touchedFields = stepFields[activeStep].reduce((acc, field) => ({
        ...acc,
        [field]: true,
      }), {});
      formik.setTouched({ ...formik.touched, ...touchedFields });

      // Validate form
      const errors = await formik.validateForm();

      // Check for errors in current step's fields
      const hasErrors = stepFields[activeStep].some((field) => errors[field as keyof Vendor]);

      // Duplicate vendor name check for Step 0
      let duplicateError = false;
      if (activeStep === 0 && formik.values.vendorName) {
        const normalizedInputName = formik.values.vendorName
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '');
        const existingVendor = items.find(
          (vendor) =>
            vendor.vendorName
              .trim()
              .toLowerCase()
              .replace(/\s+/g, '') === normalizedInputName &&
            vendor.vendorId !== formik.values.vendorId
        );
        if (existingVendor) {
          formik.setFieldError('vendorName', 'Vendor with this name already exists');
          formik.setFieldTouched('vendorName', true);
          duplicateError = true;
          setShowDuplicateDialog(true);
        }
      }

      if (hasErrors || duplicateError) {
        dispatch(
          setSnackbarMessage(
            duplicateError ? 'Vendor with this name already exists' : 'Please fill all required fields correctly'
          )
        );
        dispatch(setSnackbarOpen(true));
        return;
      }

      setActiveStep((prevStep) => Math.min(prevStep + 1, totalSteps - 1));
    }
  };

  const handlePrev = () => {
    setActiveStep((prevStep) => Math.max(prevStep - 1, 0));
  };

  const handleManualSubmit = async () => {
    if (formRef.current) {
      const formik = formRef.current;

      const errors = await formik.validateForm();

      formik.setTouched({
        vendorName: true,
        contactpersonPhone: true,
        vendorType: true,
        address: true,
        country: true,
        postalCode: true,
        paymentTerms: true,
        preferredpaymentMethod: true,
        creditLimit: true,
        ...(formik.values.preferredpaymentMethod !== 'Cash' && {
          bankName: true,
          accountNumber: true,
          ifscCode: true,
        }),
      });

      if (Object.keys(errors).length > 0) {
        let errorStep = 0;
        if (errors.vendorName || errors.contactpersonPhone || errors.vendorType) {
          errorStep = 0;
        } else if (errors.address || errors.country || errors.state || errors.city || errors.postalCode) {
          errorStep = 1;
        } else if (errors.paymentTerms || errors.preferredpaymentMethod || errors.creditLimit) {
          errorStep = 2;
        } else if (errors.bankName || errors.accountNumber || errors.ifscCode) {
          errorStep = 3;
        }

        setActiveStep(errorStep);
        dispatch(setSnackbarMessage('Please fill all required fields'));
        dispatch(setSnackbarOpen(true));
        return;
      }

      formik.submitForm();
    }
  };

  const handleModalClose = (event: {}, reason: 'backdropClick' | 'escapeKeyDown') => {
    if (isDirty) {
      setShowCloseConfirm(true);
    } else {
      handleDialogClose(true);
    }
  };

  const handleOpenVendorTypeDialog = () => {
    dispatch(
      setVendorTypeData({
        vendortypeId: '',
        vendorType: '',
        status: 'active',
        randomId: '',
      })
    );
    setShowVendorTypeDialog(true);
  };

  const handleCloseConfirm = (shouldClose: boolean) => {
    setShowCloseConfirm(false);
    if (shouldClose) {
      handleDialogClose(true);
    }
  };

  const handleDuplicateDialogClose = () => {
    setShowDuplicateDialog(false);
  };

  return (
    <Modal open={dialogOpen === 'edit'} onClose={handleModalClose} disableEscapeKeyDown={isDirty}>
      <Box
        sx={{
          p: 4,
          backgroundColor: 'white',
          margin: 'auto',
          mt: 10,
          maxWidth: '800px',
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        <Typography variant="h6" gutterBottom>
          {vendorData.vendorId ? 'Edit Vendor' : 'Create Vendor'}
        </Typography>

        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Formik<VendorFormValues>
          innerRef={formRef}
          initialValues={initialValues}
          validationSchema={validationSchema}
          onSubmit={async (values, { resetForm }) => {
            try {
              setLoading(true);
              const formattedValues = {
                ...values,
                vendorName: values.vendorName.trim(), // Ensure no leading/trailing spaces
              };
              if (values.vendorId) {
                await dispatch(updateVendor({ vendorId: values.vendorId, vendor: formattedValues }));
                dispatch(setSnackbarMessage('Vendor updated successfully'));
              } else {
                const newVendorData = {
                  ...formattedValues,
                  status: 'active',
                  createdDate: new Date(),
                };
                await dispatch(addVendor(newVendorData));
                dispatch(setSnackbarMessage('Vendor added successfully'));
              }

              dispatch(setSnackbarOpen(true));
              await dispatch(fetchVendors());
              handleDialogClose(true);
              resetForm();
            } catch (error) {
              console.error('Error:', error);
              dispatch(setSnackbarMessage('Error occurred'));
              dispatch(setSnackbarOpen(true));
            } finally {
              setLoading(false);
            }
          }}
          enableReinitialize
        >
          {({ values, handleChange, handleBlur, touched, errors }) => (
            <Form>
              <FormDirtyTracker setIsDirty={setIsDirty} />
              {/* Step 1: Basic Information */}
              {activeStep === 0 && (
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={4}>
                    <OptimizedTextField
                      inputRef={inputRef}
                      label="Vendor Name"
                      name="vendorName"
                      type="text"
                      autoComplete="off"
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <Box display="flex" alignItems="center">
                      <TextField
                        select
                        fullWidth
                        label="Vendor Type"
                        name="vendorType"
                        value={values.vendorType}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        variant="outlined"
                        error={touched.vendorType && Boolean(errors.vendorType)}
                        helperText={touched.vendorType && errors.vendorType}
                        sx={{ flexGrow: 1 }}
                        required
                        InputLabelProps={{
                          sx: {
                            '&::after': {
                              content: '"*"',
                              color: 'red',
                              position: 'absolute',
                              right: -10,
                            },
                          },
                        }}
                      >
                        {vendorTypeItems.map((type, index) => (
                          <MenuItem
                            key={type.vendortypeId || `${type.vendorType}-${index}`}
                            value={type.vendorType}
                          >
                            {type.vendorType}
                          </MenuItem>
                        ))}
                      </TextField>
                      <IconButton
                        onClick={handleOpenVendorTypeDialog}
                        aria-label="add vendor type"
                        sx={{ ml: 1 }}
                      >
                        <AddIcon />
                      </IconButton>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <OptimizedTextField
                      label="Contact Person Name"
                      name="contactpersonName"
                      type="text"
                      autoComplete="off"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <OptimizedTextField
                      label="Mobile Number"
                      name="contactpersonPhone"
                      type="text"
                      autoComplete="off"
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <OptimizedTextField
                      label="Contact Person Email"
                      name="contactpersonEmail"
                      type="text"
                      autoComplete="off"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <OptimizedTextField
                      label="Website"
                      name="website"
                      type="text"
                      autoComplete="off"
                    />
                  </Grid>
                </Grid>
              )}

              {/* Step 2: Location Details */}
              {activeStep === 1 && (
                <Grid container spacing={2}>
                  <LocationArea
                    formik={
                      {
                        values,
                        handleChange,
                        handleBlur,
                        touched,
                        errors,
                        setFieldValue: formRef.current?.setFieldValue,
                        setFieldTouched: formRef.current?.setFieldTouched,
                      } as FormikProps<any>
                    }
                  />
                  <Grid item xs={12}>
                    <OptimizedTextField
                      label="Address"
                      name="address"
                      type="text"
                      autoComplete="off"
                      required
                    />
                  </Grid>
                </Grid>
              )}

              {/* Step 3: Payment Information */}
              {activeStep === 2 && (
                <Grid container spacing={2}>
                  <Grid item xs={4}>
                    <OptimizedTextField
                      label="GST Number"
                      name="gstNumber"
                      type="text"
                      autoComplete="off"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <TextField
                      select
                      fullWidth
                      label="Payment Terms"
                      name="paymentTerms"
                      value={values.paymentTerms}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      variant="outlined"
                      error={touched.paymentTerms && Boolean(errors.paymentTerms)}
                      helperText={touched.paymentTerms && errors.paymentTerms}
                      required
                      InputLabelProps={{
                        sx: {
                          '&::after': {
                            content: '"*"',
                            color: 'red',
                            position: 'absolute',
                            right: -10,
                          },
                        },
                      }}
                    >
                      {[...Array(30)].map((_, index) => (
                        <MenuItem
                          key={`term-${index}`}
                          value={`${index + 1} day${index === 0 ? '' : 's'}`}
                        >
                          {`${index + 1} day${index === 0 ? '' : 's'}`}
                        </MenuItem>
                      ))}
                      <MenuItem value="45 days">45 days</MenuItem>
                      <MenuItem value="50 days">50 days</MenuItem>
                      <MenuItem value="60 days">60 days</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <TextField
                      select
                      fullWidth
                      label="Preferred Payment Method"
                      name="preferredpaymentMethod"
                      value={values.preferredpaymentMethod}
                      onChange={(e) => {
                        handleChange(e);
                        if (e.target.value !== 'Cash') {
                          setTimeout(() => {
                            if (formRef.current) {
                              formRef.current.setFieldTouched('bankName', true);
                              formRef.current.setFieldTouched('accountNumber', true);
                              formRef.current.setFieldTouched('ifscCode', true);
                            }
                            setActiveStep(3);
                          }, 0);
                        }
                      }}
                      onBlur={handleBlur}
                      variant="outlined"
                      error={touched.preferredpaymentMethod && Boolean(errors.preferredpaymentMethod)}
                      helperText={touched.preferredpaymentMethod && errors.preferredpaymentMethod}
                      required
                      InputLabelProps={{
                        sx: {
                          '&::after': {
                            content: '"*"',
                            color: 'red',
                            position: 'absolute',
                            right: -10,
                          },
                        },
                      }}
                    >
                      <MenuItem value="Cash">Cash</MenuItem>
                      <MenuItem value="Cheque">Cheque</MenuItem>
                      <MenuItem value="Bank Transfer">Bank Transfer</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <OptimizedTextField
                      label="Credit Limit"
                      name="creditLimit"
                      type="number"
                      autoComplete="off"
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <OptimizedTextField
                      label="Notes"
                      name="notes"
                      type="text"
                      autoComplete="off"
                      multiline
                    />
                  </Grid>
                </Grid>
              )}

              {/* Step 4: Bank Account Details */}
              {activeStep === 3 && (
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={4}>
                    <TextField
                      select
                      fullWidth
                      label={
                        values.preferredpaymentMethod !== 'Cash' ? 'Bank Name*' : 'Bank Name'
                      }
                      name="bankName"
                      value={values.bankName}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.bankName && Boolean(errors.bankName)}
                      helperText={touched.bankName && errors.bankName}
                      required={values.preferredpaymentMethod !== 'Cash'}
                      variant="outlined"
                      InputLabelProps={{
                        sx: {
                          ...(values.preferredpaymentMethod !== 'Cash' && {
                            '&::after': {
                              content: '"*"',
                              color: 'red',
                              position: 'absolute',
                              right: -10,
                            },
                          }),
                        },
                      }}
                    >

                      {/* Map through loaded banks */}
                      {banks.map((bank) => (
                        <MenuItem key={bank.bankMasterId} value={bank.bankName}>
                          {bank.bankName}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>

                  <Grid item xs={12} sm={6} md={4}>
                    <TextField
                      fullWidth
                      label={values.preferredpaymentMethod !== 'Cash' ? 'Account Number*' : 'Account Number'}
                      name="accountNumber"
                      type="number"
                      autoComplete="off"
                      value={values.accountNumber}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.accountNumber && Boolean(errors.accountNumber)}
                      helperText={touched.accountNumber && errors.accountNumber}
                      required={values.preferredpaymentMethod !== 'Cash'}
                      inputProps={{
                        inputMode: 'numeric',
                        pattern: '[0-9]*',
                      }}
                      variant="outlined"
                      InputLabelProps={{
                        sx: {
                          ...(values.preferredpaymentMethod !== 'Cash' && {
                            '&::after': {
                              content: '"*"',
                              color: 'red',
                              position: 'absolute',
                              right: -10,
                            },
                          }),
                        },
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <TextField
                      fullWidth
                      label={values.preferredpaymentMethod !== 'Cash' ? 'IFSC Code*' : 'IFSC Code'}
                      name="ifscCode"
                      type="text"
                      autoComplete="off"
                      value={values.ifscCode}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.ifscCode && Boolean(errors.ifscCode)}
                      helperText={touched.ifscCode && errors.ifscCode}
                      required={values.preferredpaymentMethod !== 'Cash'}
                      variant="outlined"
                      InputLabelProps={{
                        sx: {
                          ...(values.preferredpaymentMethod !== 'Cash' && {
                            '&::after': {
                              content: '"*"',
                              color: 'red',
                              position: 'absolute',
                              right: -10,
                            },
                          }),
                        },
                      }}
                    />
                  </Grid>
                </Grid>
              )}

              {/* Navigation Buttons */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
                <Button
                  variant="outlined"
                  onClick={handlePrev}
                  disabled={activeStep === 0}
                  startIcon={<ArrowBackIcon />}
                >
                  Back
                </Button>
                {activeStep < totalSteps - 1 ? (
                  <Button variant="contained" onClick={handleNext} endIcon={<ArrowForwardIcon />}>
                    Next
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="contained"
                    color="primary"
                    disabled={loading}
                    onClick={handleManualSubmit}
                  >
                    {loading ? 'Submitting...' : vendorData.vendorId ? 'Update Vendor' : 'Add Vendor'}
                  </Button>
                )}
              </Box>
            </Form>
          )}
        </Formik>
        <ConfirmationDialog
          open={showCloseConfirm}
          title="Unsaved Changes"
          message="You have unsaved changes. Are you sure you want to leave?"
          onCancel={() => handleCloseConfirm(false)}
          onConfirm={() => handleCloseConfirm(true)}
          confirmText="Confirm"
          cancelText="Cancel"
        />
        <ConfirmationDialog
          open={showDuplicateDialog}
          title="Duplicate Vendor Name"
          message="A vendor with this name already exists. Please choose a different name."
          onCancel={handleDuplicateDialogClose}
          onConfirm={handleDuplicateDialogClose}
          confirmText="OK"
          cancelText=""
        />
        <VendorTypeDialog
          isEdit={false}
          open={showVendorTypeDialog}
          onClose={() => setShowVendorTypeDialog(false)}
          onVendorTypeAdded={(newType) => {
            if (formRef.current) {
              formRef.current.setFieldValue('vendorType', newType);
            }
            setShowVendorTypeDialog(false);
          }}
        />
      </Box>
    </Modal>
  );
};

export default VendorDialog;
