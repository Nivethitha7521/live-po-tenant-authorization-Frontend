'use client';
import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Grid, TextField, FormControl, InputLabel, Select, MenuItem,
  FormHelperText, Stepper, Step, StepLabel, Box, IconButton,
  InputAdornment
} from '@mui/material';
import { Formik, Form, FormikHelpers, useFormikContext, FormikProps } from 'formik';
import * as yup from 'yup';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ConfirmationDialog from '../../confirmationDialog';
import AddEditDialog from '../purchasemaster/category/addEditdialog';
import PurchaseSubcategoryForm from '../purchasemaster/subcategory/purchaseSubcategoryForm';
import { addPurchaseSubcategory, fetchPurchaseSubcategories, selectPurchaseSubcategoryItems } from '@/features/yen-purchase/PurchaseMaster/PurchaseSubcategorySlice';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/redux/store';
import { useSelector } from '@/features/hooks';
import { setSnackbarMessage, setSnackbarOpen } from '@/features/yen-purchase/PurchaseMaster/purchaseItemSlice';
import { fetchCategories } from '@/features/yen-purchase/PurchaseMaster/PurchaseCategorySlice';

interface PurchaseItemFormProps {
  open: boolean;
  onClose: () => void;
  initialValues: any;
  validationSchema: yup.ObjectSchema<any>;
  onSubmit: (values: any) => Promise<void>;
  editIndex: number | null;
  categories: any[];
  uoms: any[];
  groupitems: any[];
  taxes: any[];
  locations: any[];
  itemtypes: any[];
  existingItems: any[];
}

const steps = ['Basic Information', 'Pricing & Inventory', 'Additional Details', 'Review'];

// Helper component to track form dirty state
const FormDirtyTracker: React.FC<{ setIsDirty: (dirty: boolean) => void }> = ({ setIsDirty }) => {
  const formik = useFormikContext();

  useEffect(() => {
    setIsDirty(formik.dirty);
  }, [formik.dirty, setIsDirty]);

  return null;
};

const PurchaseItemForm: React.FC<PurchaseItemFormProps> = ({
  open,
  onClose,
  initialValues,
  validationSchema,
  onSubmit,
  editIndex,
categories: propCategories,
  uoms,
  groupitems,
  taxes,
  locations,
  itemtypes,
  existingItems
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { items: purchaseSubcategories } = useSelector(selectPurchaseSubcategoryItems);
  const [activeStep, setActiveStep] = useState(0);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const formRef = React.useRef<FormikProps<any>>(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [subcategoryDialogOpen, setSubcategoryDialogOpen] = useState(false);
  const existingSubcategories = purchaseSubcategories.map(item => item.purchasesubcategoryName);
  const totalSteps = steps.length;
  const inputRef = useRef<HTMLInputElement>(null);
  const [localCategories, setLocalCategories] = useState(propCategories); // Local state for categories
  const handleDialogClose = (forceClose = false) => {
    if (isDirty && !forceClose) {
      setShowCloseConfirm(true);
      return;
    }
    onClose();
    setActiveStep(0);
    setIsDirty(false);
    setShowDuplicateDialog(false);
  };
// Sync localCategories with propCategories when propCategories changes
  useEffect(() => {
    setLocalCategories(propCategories);
  }, [propCategories]);
  // Handle browser reload prevention
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

  const handleCategoryAdded = () => {
    setCategoryDialogOpen(false);
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

  const handleModalClose = (event: {}, reason: 'backdropClick' | 'escapeKeyDown') => {
    if (isDirty) {
      setShowCloseConfirm(true);
    } else {
      handleDialogClose(true);
    }
  };

  const handleNext = async () => {
    if (formRef.current) {
      const formik = formRef.current;

      // Define fields to validate for each step
      const stepFields: { [key: number]: string[] } = {
        0: ['itemName', 'purchasesubcategoryName', 'purchasecategoryName', 'itemgroupName', 'itemType', 'supplier'],
        1: ['uom', 'purchasePrice', 'purchasetaxName', 'stockQuantity'],
        2: ['reorderLevel', 'hsnCode', 'locationName', 'shelfLife'],
        3: ['barcode', 'description'],
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
      const hasErrors = stepFields[activeStep].some((field) => errors[field]);

      // Duplicate item name check for Step 0
      let duplicateError = false;
      if (activeStep === 0 && formik.values.itemName) {
        const normalizedInputName = formik.values.itemName
          .trim()
          .toLowerCase()
          .replace(/\s+/g, ''); // Remove extra spaces
        const existingItem = existingItems.find(
          (item) =>
            item.itemName
              .trim()
              .toLowerCase()
              .replace(/\s+/g, '') === normalizedInputName &&
            item.purchaseitemId !== formik.values.purchaseitemId
        );
        if (existingItem) {
          formik.setFieldError('itemName', 'Item with this name already exists');
          formik.setFieldTouched('itemName', true);
          duplicateError = true;
          setShowDuplicateDialog(true);
        }
      }

      if (hasErrors || duplicateError) {
        dispatch(
          setSnackbarMessage(
            duplicateError ? 'Item with this name already exists' : 'Please fill all required fields correctly'
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

  const handleCloseConfirm = (shouldClose: boolean) => {
    setShowCloseConfirm(false);
    if (shouldClose) {
      handleDialogClose(true);
    }
  };

  const handleDuplicateDialogClose = () => {
    setShowDuplicateDialog(false);
  };

  const handleManualSubmit = async () => {
    if (formRef.current) {
      const formik = formRef.current;

      const errors = await formik.validateForm();

      formik.setTouched({
        itemName: true,
        purchasesubcategoryName: true,
        purchasecategoryName: true,
        itemgroupName: true,
        itemType: true,
        supplier: true,
        uom: true,
        purchasePrice: true,
        purchasetaxName: true,
        stockQuantity: true,
        reorderLevel: true,
        hsnCode: true,
        locationName: true,
        shelfLife: true,
        barcode: true,
        description: true,
      });

      if (Object.keys(errors).length > 0) {
        let errorStep = 0;
        if (
          errors.itemName ||
          errors.purchasesubcategoryName ||
          errors.purchasecategoryName ||
          errors.itemgroupName ||
          errors.itemType ||
          errors.supplier
        ) {
          errorStep = 0;
        } else if (
          errors.uom ||
          errors.purchasePrice ||
          errors.purchasetaxName ||
          errors.stockQuantity
        ) {
          errorStep = 1;
        } else if (
          errors.reorderLevel ||
          errors.hsnCode ||
          errors.locationName ||
          errors.shelfLife
        ) {
          errorStep = 2;
        } else if (
          errors.barcode ||
          errors.description
        ) {
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

  const handleFormSubmit = async (values: any, actions: FormikHelpers<any>) => {
    try {
      setLoading(true);
      const normalizedValues = {
        ...values,
        itemName: values.itemName.trim()
      };
      await onSubmit(normalizedValues);
      handleDialogClose(true);
    } catch (error) {
      // Error handling is done in parent component
    } finally {
      setLoading(false);
      actions.setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleModalClose}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown={isDirty}
    >
      <DialogTitle>
        {editIndex !== null ? 'Edit Purchase Item' : 'Add Purchase Item'}
      </DialogTitle>

      <Box sx={{ px: 3, pt: 2 }}>
        <Stepper activeStep={activeStep} alternativeLabel>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      <Formik
        innerRef={formRef}
        initialValues={initialValues}
        validationSchema={validationSchema}
        onSubmit={handleFormSubmit}
        enableReinitialize
      >
        {({ values, handleChange, setFieldValue, errors, touched }) => (
          <Form>
            <FormDirtyTracker setIsDirty={setIsDirty} />
            <DialogContent>
              {activeStep === 0 && (
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      inputRef={inputRef}
                      fullWidth
                      autoComplete='off'
                      label='Item Name*'
                      name="itemName"
                      value={values.itemName}
                      onChange={handleChange}
                      onBlur={() => {
                        if (values.itemName) {
                          const normalizedInputName = values.itemName
                            .trim()
                            .toLowerCase()
                            .replace(/\s+/g, '');
                          const existingItem = existingItems.find(
                            (item) =>
                              item.itemName
                                .trim()
                                .toLowerCase()
                                .replace(/\s+/g, '') === normalizedInputName &&
                              item.purchaseitemId !== values.purchaseitemId
                          );
                          if (existingItem) {
                            setFieldValue('itemName', values.itemName);
                            formRef.current?.setFieldError('itemName', 'Item with this name already exists');
                            setShowDuplicateDialog(true);
                          }
                        }
                      }}
                      error={touched.itemName && Boolean(errors.itemName)}
                      helperText={touched.itemName && errors.itemName ? String(errors.itemName) : ''}
                      required
                    />
                  </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth error={touched.purchasesubcategoryName && Boolean(errors.purchasesubcategoryName)}>
                      <InputLabel>Purchase Subcategory*</InputLabel>
                      <Select
                        label="Purchase Subcategory*"
                        name="purchasesubcategoryName"
                        value={values.purchasesubcategoryName}
                        onChange={(event) => {
                          const selectedSubcategory = event.target.value as string;
                          setFieldValue('purchasesubcategoryName', selectedSubcategory);
                          const category = localCategories.find(cat =>
                            cat.subcategories?.includes(selectedSubcategory)
                          );
                          if (category) {
                            setFieldValue('purchasecategoryName', category.purchasecategoryName);
                          }
                        }}
                        endAdornment={
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setSubcategoryDialogOpen(true)}
                              edge="end"
                              title="Add new subcategory"
                            >
                              <AddIcon />
                            </IconButton>
                          </InputAdornment>
                        }
                        required
                      >
                        {localCategories.length ? (
                          localCategories.flatMap(category =>
                            (category.subcategories || []).map((subcategoryName: string) => (
                              <MenuItem
                                key={`${category.purchasecategoryId}-${subcategoryName}`}
                                value={subcategoryName}
                              >
                                {subcategoryName}
                              </MenuItem>
                            ))
                          )
                        ) : (
                          <MenuItem disabled>No subcategories available</MenuItem>
                        )}
                      </Select>
                      <FormHelperText>
                        {touched.purchasesubcategoryName && errors.purchasesubcategoryName
                          ? String(errors.purchasesubcategoryName)
                          : ''}
                      </FormHelperText>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      label="Purchase Category*"
                      name="purchasecategoryName"
                      value={values.purchasecategoryName}
                      onChange={handleChange}
                      error={touched.purchasecategoryName && Boolean(errors.purchasecategoryName)}
                      helperText={touched.purchasecategoryName && errors.purchasecategoryName ? String(errors.purchasecategoryName) : ''}
                      fullWidth
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setCategoryDialogOpen(true)}
                              edge="end"
                              title="Add new category"
                            >
                              <AddIcon />
                            </IconButton>
                          </InputAdornment>
                        )
                      }}
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth error={touched.itemgroupName && Boolean(errors.itemgroupName)}>
                      <InputLabel>Item Group*</InputLabel>
                      <Select
                        label="Item Group"
                        name="itemgroupName"
                        value={values.itemgroupName}
                        onChange={handleChange}
                        required
                      >
                        {groupitems.map((groupitem) => (
                          <MenuItem key={groupitem.itemgroupName} value={groupitem.itemgroupName}>
                            {groupitem.itemgroupName}
                          </MenuItem>
                        ))}
                      </Select>
                      <FormHelperText>
                        {touched.itemgroupName && errors.itemgroupName ? String(errors.itemgroupName) : ''}
                      </FormHelperText>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth error={touched.itemType && Boolean(errors.itemType)}>
                      <InputLabel id="itemType-label">Item Type*</InputLabel>
                      <Select
                        labelId="itemType-label"
                        label="Item Type"
                        name="itemType"
                        value={values.itemType}
                        onChange={handleChange}
                        required
                      >
                        {itemtypes.map((type) => (
                          <MenuItem key={type.itemtypeName} value={type.itemtypeName}>
                            {type.itemtypeName}
                          </MenuItem>
                        ))}
                      </Select>
                      <FormHelperText>
                        {touched.itemType && errors.itemType ? String(errors.itemType) : ''}
                      </FormHelperText>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      fullWidth
                      label="Supplier"
                      name="supplier"
                      value={values.supplier}
                      onChange={handleChange}
                      error={touched.supplier && Boolean(errors.supplier)}
                      helperText={touched.supplier && errors.supplier ? String(errors.supplier) : ''}
                      required
                    />
                  </Grid>
                </Grid>
              )}

              {activeStep === 1 && (
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth error={touched.uom && Boolean(errors.uom)}>
                      <InputLabel>UOM*</InputLabel>
                      <Select
                        label="UOM"
                        name="uom"
                        value={values.uom}
                        onChange={handleChange}
                        required
                      >
                        {uoms.map((uom) => (
                          <MenuItem key={uom.uom} value={uom.uom}>
                            {uom.uom}
                          </MenuItem>
                        ))}
                      </Select>
                      <FormHelperText>
                        {touched.uom && errors.uom ? String(errors.uom) : ''}
                      </FormHelperText>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      fullWidth
                      label='Purchase Price'
                      name="purchasePrice"
                      value={values.purchasePrice}
                      onChange={handleChange}
                      error={touched.purchasePrice && Boolean(errors.purchasePrice)}
                      helperText={touched.purchasePrice && errors.purchasePrice ? String(errors.purchasePrice) : ''}
                      type="number"
                      InputProps={{ inputProps: { step: "1" } }}
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth error={touched.purchasetaxName && Boolean(errors.purchasetaxName)}>
                      <InputLabel>Tax Percentage*</InputLabel>
                      <Select
                        label="Tax Percentage"
                        name="purchasetaxName"
                        value={values.purchasetaxName}
                        onChange={handleChange}
                        required
                      >
                        {taxes.map((tax) => (
                          <MenuItem key={tax.purchasetaxPercentage} value={tax.purchasetaxPercentage}>
                            {`${tax.purchasetaxPercentage}%`}
                          </MenuItem>
                        ))}
                      </Select>
                      <FormHelperText>
                        {touched.purchasetaxName && errors.purchasetaxName ? String(errors.purchasetaxName) : ''}
                      </FormHelperText>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      label="Stock Quantity"
                      name="stockQuantity"
                      value={values.stockQuantity}
                      onChange={handleChange}
                      error={touched.stockQuantity && Boolean(errors.stockQuantity)}
                      helperText={touched.stockQuantity && errors.stockQuantity ? String(errors.stockQuantity) : ''}
                      type="number"
                      fullWidth
                      required
                    />
                  </Grid>
                </Grid>
              )}

              {activeStep === 2 && (
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      fullWidth
                      label='Reorder Level'
                      name="reorderLevel"
                      value={values.reorderLevel}
                      onChange={handleChange}
                      error={touched.reorderLevel && Boolean(errors.reorderLevel)}
                      helperText={touched.reorderLevel && errors.reorderLevel ? String(errors.reorderLevel) : ''}
                      type="number"
                      inputProps={{ min: 0 }}
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      fullWidth
                      label='HSN Code'
                      name="hsnCode"
                      value={values.hsnCode}
                      onChange={handleChange}
                      error={touched.hsnCode && Boolean(errors.hsnCode)}
                      helperText={touched.hsnCode && errors.hsnCode ? String(errors.hsnCode) : ''}
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth error={touched.locationName && Boolean(errors.locationName)}>
                      <InputLabel>Storage Location</InputLabel>
                      <Select
                        label="Storage Location"
                        name="locationName"
                        value={values.locationName || ''}
                        onChange={handleChange}
                        required
                      >
                        {locations.map(location => (
                          <MenuItem key={location.locationName} value={location.locationName}>
                            {location.locationName}
                          </MenuItem>
                        ))}
                      </Select>
                      <FormHelperText>
                        {touched.locationName && errors.locationName ? String(errors.locationName) : ''}
                      </FormHelperText>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      fullWidth
                      label="Shelf Life"
                      name="shelfLife"
                      value={values.shelfLife}
                      onChange={handleChange}
                      error={touched.shelfLife && Boolean(errors.shelfLife)}
                      helperText={touched.shelfLife && errors.shelfLife ? String(errors.shelfLife) : ''}
                      required
                    />
                  </Grid>
                </Grid>
              )}

              {activeStep === 3 && (
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      fullWidth
                      label='Barcode'
                      name="barcode"
                      value={values.barcode}
                      onChange={handleChange}
                      error={touched.barcode && Boolean(errors.barcode)}
                      helperText={touched.barcode && errors.barcode ? String(errors.barcode) : ''}
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={9}>
                    <TextField
                      fullWidth
                      label='Description'
                      rows={4}
                      name="description"
                      value={values.description}
                      onChange={handleChange}
                      error={touched.description && Boolean(errors.description)}
                      helperText={touched.description && errors.description ? String(errors.description) : ''}
                      multiline
                      required
                    />
                  </Grid>
                </Grid>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => handleDialogClose(false)} color="primary">
                Cancel
              </Button>
              <Box sx={{ flexGrow: 1 }} />
              <Button
                variant="outlined"
                onClick={handlePrev}
                disabled={activeStep === 0}
                startIcon={<ArrowBackIcon />}
              >
                Back
              </Button>
              {activeStep < totalSteps - 1 ? (
                <Button
                  variant="contained"
                  onClick={handleNext}
                  endIcon={<ArrowForwardIcon />}
                >
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
                  {loading ? 'Processing...' : editIndex !== null ? 'Update' : 'Add'}
                </Button>
              )}
            </DialogActions>
          </Form>
        )}
      </Formik>
      <ConfirmationDialog
        open={showCloseConfirm}
        title="Unsaved Changes"
        description="You have unsaved changes. Are you sure you want to leave?"
        onClose={() => handleCloseConfirm(false)}
        onConfirm={() => handleCloseConfirm(true)}
        confirmText="Confirm"
        cancelText="Cancel"
      />
      <ConfirmationDialog
        open={showDuplicateDialog}
        title="Duplicate Item Name"
        description="An item with this name already exists. Please choose a different name."
        onClose={handleDuplicateDialogClose}
        onConfirm={handleDuplicateDialogClose}
        confirmText="OK"
        cancelText=""
      />
      <AddEditDialog
        open={categoryDialogOpen}
        onClose={() => setCategoryDialogOpen(false)}
        onCategoryAdded={handleCategoryAdded}
      />
      <PurchaseSubcategoryForm
        open={subcategoryDialogOpen}
        onClose={() => setSubcategoryDialogOpen(false)}
        onSubmit={async (newSubcategory) => {
          try {
            await dispatch(addPurchaseSubcategory(newSubcategory));
            await dispatch(fetchCategories());
            // Update the parent form's subcategory field
            if (formRef.current) {
              formRef.current.setFieldValue(
                'purchasesubcategoryName',
                newSubcategory.purchasesubcategoryName
              );
            }

          } catch (error) {
            // Handle error
          }
        }}
        initialValues={{
          purchasesubcategoryName: "",
          purchasesubcategoryId: "",
          status: "active",
          randomId: ""
        }}
        editIndex={null}
        loading={false}
        existingSubcategories={existingSubcategories}
      />
    </Dialog>
  );
};

export default PurchaseItemForm;