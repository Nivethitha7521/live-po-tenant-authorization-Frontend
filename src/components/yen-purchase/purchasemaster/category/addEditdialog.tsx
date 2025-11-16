'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Button,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Select,
  MenuItem,
  Chip,
  Checkbox,
  ListItemText,
  Box,
  FormControl,
  InputLabel,
  FormHelperText,
  CircularProgress,
  DialogContentText,
  IconButton,
} from '@mui/material';
import { AppDispatch, RootState } from '@/redux/store';
import {
  addCategory,
  updateCategory,
  fetchCategories,
  setCategoryData,
  setDialogOpen,
  setEditIndex,
  setSnackbarMessage,
  setSnackbarOpen,
} from '../../../../features/yen-purchase/PurchaseMaster/PurchaseCategorySlice';
import { initialCategoryState } from '@/Models/purchasecategory';
import { ClearIcon } from '@mui/x-date-pickers/icons';

interface AddEditDialogProps {
  open: boolean;
  onClose: () => void;
  onCategoryAdded?: (newCategory: any) => void;
}

const AddEditDialog: React.FC<AddEditDialogProps> = ({ open, onClose, onCategoryAdded }) => {
  const dispatch = useDispatch<AppDispatch>();
  const {
    categories,
    subcategories,
    editIndex,
    categoryData,
  } = useSelector((state: RootState) => state.purchaseCategory);
  const [isTouched, setIsTouched] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [closeDialogConfirmationOpen, setCloseDialogConfirmationOpen] = useState(false);
  const [categoryNameError, setCategoryNameError] = useState<string | null>(null);
  // Add a state for tracking if subcategories have been touched
  const [subcategoriesTouched, setSubcategoriesTouched] = useState(false);
  // For custom select handling
  const [selectOpen, setSelectOpen] = useState(false);
  const [tempSubcategories, setTempSubcategories] = useState<string[]>([]);
  const selectRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (open) {
      if (!editIndex) {
        dispatch(setCategoryData(initialCategoryState));
      }
      setIsTouched(false);
      setSubcategoriesTouched(false);
      setHasUnsavedChanges(false);
      setCategoryNameError(null);
      setTempSubcategories(categoryData.subcategories);
    }
  }, [open, dispatch, editIndex]);

  useEffect(() => {
    if (categoryData.purchasecategoryName || categoryData.subcategories.length > 0) {
      setHasUnsavedChanges(true);
    } else {
      setHasUnsavedChanges(false);
    }
  }, [categoryData]);

  // Normalize category name for duplicate checking
  const normalizeCategoryName = (name: string): string => {
    return name.toLowerCase().replace(/\s+/g, '').trim();
  };

  // Check for duplicate category names
  const isDuplicateCategoryName = (name: string): boolean => {
    if (!name.trim()) return false;
    const normalizedInput = normalizeCategoryName(name);
    return categories.some(
      (category) =>
        normalizeCategoryName(category.purchasecategoryName) === normalizedInput &&
        category.purchasecategoryId !== categoryData.purchasecategoryId
    );
  };

  // Modify the validation function to only validate when touched or submitting
  const validateCategoryName = (value: string, forceValidation = false) => {
    if (!isTouched && !forceValidation) return; // Skip validation if not touched

    if (!value.trim()) {
      setCategoryNameError('Category Name is required');
    } else if (value.length > 24) {
      setCategoryNameError('Maximum 24 characters allowed');
    } else if (!/^[a-zA-Z0-9\s]*$/.test(value)) {
      setCategoryNameError('Only letters, numbers, and spaces allowed');
    } else if (value.startsWith(' ') || value.endsWith(' ') ) {
      setCategoryNameError('Category name cannot start or end with spaces');
    } else if (isDuplicateCategoryName(value)) {
      setCategoryNameError('Category name already exists');
    } else {
      setCategoryNameError(null);
    }
  };

  // Update the text field change handler
  const handleTextFieldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const processedValue = name === 'purchasecategoryName'
      ? value.replace(/^\s+/, '')
      : value;

    dispatch(setCategoryData({ ...categoryData, [name]: processedValue }));
    setIsTouched(true);
    setHasUnsavedChanges(true);

    if (name === 'purchasecategoryName') {
      validateCategoryName(processedValue, true); // Force validation on change
    }
  };

  const handleSelectOpen = () => {
    setSelectOpen(true);
    setTempSubcategories(categoryData.subcategories);
    setSubcategoriesTouched(true); // Mark as touched when opened
  };

  const handleSelectClose = () => {
    setSelectOpen(false);
  };

  const handleTempSubcategoryToggle = (value: string) => {
    if (tempSubcategories.includes(value)) {
      setTempSubcategories(tempSubcategories.filter((item) => item !== value));
    } else {
      setTempSubcategories([...tempSubcategories, value]);
    }
    setHasUnsavedChanges(true);
  };

  const handleApplySelection = () => {
    dispatch(
      setCategoryData({
        ...categoryData,
        subcategories: tempSubcategories,
      })
    );
    setIsTouched(true);
    setSubcategoriesTouched(true);
    handleSelectClose();
  };

  const handleCancelSelection = () => {
    setTempSubcategories(categoryData.subcategories);
    handleSelectClose();
  };

  const handleAddOrUpdate = () => {
    setConfirmationOpen(true);
  };

  // Update the save handler to force validation
  const handleConfirmAddOrUpdate = async () => {
    setConfirmationOpen(false);

    // Force validation before submission
    validateCategoryName(categoryData.purchasecategoryName, true);
    setSubcategoriesTouched(true);

    if (categoryNameError) {
      dispatch(setSnackbarMessage(categoryNameError));
      dispatch(setSnackbarOpen(true));
      return;
    }

    if (!categoryData.purchasecategoryName.trim()) {
      dispatch(setSnackbarMessage('Category Name is required'));
      dispatch(setSnackbarOpen(true));
      validateCategoryName(categoryData.purchasecategoryName, true);
      return;
    }

    if (categoryData.subcategories.length === 0) {
      dispatch(setSnackbarMessage('At least one subcategory is required'));
      dispatch(setSnackbarOpen(true));
      return;
    }
    setLoading(true);
    try {
      let result;
      if (categoryData.purchasecategoryId) {
        result = await dispatch(
          updateCategory({
            purchasecategoryId: categoryData.purchasecategoryId,
            category: categoryData,
          })
        ).unwrap();
        dispatch(setSnackbarMessage('Category updated successfully!'));
      } else {
        result = await dispatch(addCategory(categoryData)).unwrap();
        dispatch(setSnackbarMessage('Category added successfully!'));
        if (onCategoryAdded) {
          onCategoryAdded(result);
        }
      }

      dispatch(setCategoryData(initialCategoryState));
      dispatch(setEditIndex(null));
      dispatch(fetchCategories());
      dispatch(setSnackbarOpen(true));
      setHasUnsavedChanges(false);
      setIsTouched(false);
      onClose();
    } catch (error: any) {
      dispatch(setSnackbarMessage(error.message || 'An error occurred'));
      dispatch(setSnackbarOpen(true));
    } finally {
      setLoading(false);
    }
  };

  const handleClearSubcategories = () => {
    setTempSubcategories([]); // Clear temporary subcategories
    dispatch(setCategoryData({ ...categoryData, subcategories: [] })); // Clear Redux state subcategories
    setIsTouched(true);
    setHasUnsavedChanges(true);
    setSubcategoriesTouched(true);
    setSelectOpen(false); // Close dropdown to refresh UI
  };

  const handleCloseDialog = () => {
    if (hasUnsavedChanges) {
      setCloseDialogConfirmationOpen(true);
    } else {
      handleConfirmCloseDialog();
    }
  };

  const handleConfirmCloseDialog = () => {
    dispatch(setCategoryData(initialCategoryState));
    dispatch(setEditIndex(null));
    setIsTouched(false);
    setCloseDialogConfirmationOpen(false);
    setHasUnsavedChanges(false);
    setCategoryNameError(null);
    onClose();
  };

  const assignedSubcategories = new Set(categories.flatMap((category) => category.subcategories));

  // UPDATED: Render count instead of individual chips to avoid misalignment/UI bloat
  const renderSelectedValue = (selected: string[]) => {
    if (selected.length === 0) {
      return <Box sx={{ color: 'text.secondary', fontStyle: 'italic' }}>Select subcategories...</Box>;
    }
    return (
      <Chip
        label={`${selected.length} selected`}
        color="primary"
        variant="outlined"
        size="small"
        onDelete={selected.length > 0 ? handleClearSubcategories : undefined}
      />
    );
  };

  return (
    <>
      <Dialog open={open} onClose={handleCloseDialog}>
        <DialogTitle>
          {editIndex !== null ? `Edit Category: ${categoryData.purchasecategoryName}` : 'Add New Category'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoComplete="off"
            label="Category Name"
            name="purchasecategoryName"
            inputRef={inputRef}
            value={categoryData.purchasecategoryName}
            onChange={handleTextFieldChange}
            onFocus={() => setIsTouched(true)}
            error={!!categoryNameError}
            helperText={categoryNameError || ''}
            inputProps={{
              maxLength: 24,
            }}
            margin="normal"
            onPaste={(e) => {
              const pastedText = e.clipboardData.getData('text').replace(/^\s+|\s+$/g, ''); // Trim only start and end
              e.preventDefault();
              dispatch(setCategoryData({ ...categoryData, purchasecategoryName: pastedText }));
              setIsTouched(true);
              setHasUnsavedChanges(true);
              validateCategoryName(pastedText);
            }}
          />
          <FormControl
            fullWidth
            margin="normal"
            error={subcategoriesTouched && categoryData.subcategories.length === 0}
            ref={selectRef}
          >
            <InputLabel>Subcategories</InputLabel>
            <Select
              multiple
              open={selectOpen}
              onOpen={handleSelectOpen}
              onClose={handleCancelSelection}
              value={categoryData.subcategories}
              renderValue={renderSelectedValue} // UPDATED: Use count-based renderer
              fullWidth
              MenuProps={{
                PaperProps: {
                  style: {
                    maxHeight: 300,
                  },
                },
              }}
            >
              {subcategories.map((subcategory) => (
                <MenuItem
                  key={subcategory.purchasesubcategoryId}
                  value={subcategory.purchasesubcategoryName}
                  disabled={
                    assignedSubcategories.has(subcategory.purchasesubcategoryName) &&
                    !categoryData.subcategories.includes(subcategory.purchasesubcategoryName) &&
                    !tempSubcategories.includes(subcategory.purchasesubcategoryName)
                  }
                  onClick={() => handleTempSubcategoryToggle(subcategory.purchasesubcategoryName)}
                >
                  <Checkbox checked={tempSubcategories.includes(subcategory.purchasesubcategoryName)} />
                  <ListItemText primary={subcategory.purchasesubcategoryName} />
                </MenuItem>
              ))}
              {/* UPDATED: Clear All option for convenience */}
              {tempSubcategories.length > 0 && (
                <MenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClearSubcategories();
                  }}
                  sx={{ justifyContent: 'center', py: 1 }}
                >
                  <IconButton size="small" color="error">
                    <ClearIcon fontSize="small" />
                  </IconButton>
                  Clear All ({tempSubcategories.length})
                </MenuItem>
              )}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  p: 1,
                  position: 'sticky',
                  bottom: 0,
                  bgcolor: 'background.paper',
                  zIndex: 1,
                  borderTop: '1px solid #e0e0e0',
                }}
              >
                <Button onClick={handleCancelSelection} sx={{ mr: 1 }} size="small">
                  Cancel
                </Button>
                <Button onClick={handleApplySelection} color="primary" size="small">
                  OK ({tempSubcategories.length} selected)
                </Button>
              </Box>
            </Select>
            {subcategoriesTouched && categoryData.subcategories.length === 0 && (
              <FormHelperText error>At least one subcategory is required</FormHelperText>
            )}
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleAddOrUpdate}
            color="primary"
            disabled={loading || !!categoryNameError || !categoryData.purchasecategoryName.trim() || categoryData.subcategories.length === 0}
            startIcon={loading ? <CircularProgress size={24} /> : null}
          >
            {loading ? 'Processing...' : editIndex !== null ? 'Save Changes' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmationOpen} onClose={() => setConfirmationOpen(false)}>
        <DialogTitle>Confirm Action</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to {editIndex !== null ? 'save changes' : 'add this category'}?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmationOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmAddOrUpdate}>OK</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={closeDialogConfirmationOpen} onClose={() => setCloseDialogConfirmationOpen(false)}>
        <DialogTitle>Unsaved Changes</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You have unsaved changes. Are you sure you want to close this dialog without saving?
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

export default AddEditDialog;