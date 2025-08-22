'use client';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Box, Snackbar, Alert, Typography } from '@mui/material';
import { RootState, AppDispatch } from '../../../../redux/store';
import {
  fetchCategories,
  fetchSubcategories,
  setCategoryData,
  setDialogOpen,
  setEditIndex,
  setSnackbarOpen,
  setShowImportResultDialog,
  resetImportResult,
} from '../../../../features/yen-purchase/PurchaseMaster/PurchaseCategorySlice';
import CategoryTable from '../../../../components/yen-purchase/purchasemaster/category/categoryTable';
import AddEditDialog from '../../../../components/yen-purchase/purchasemaster/category/addEditdialog';
import SearchToolbar from '../../../../components/yen-purchase/purchasemaster/category/toolbar';
import { initialCategoryState } from '@/Models/purchasecategory';
import CommonImportResultDialog from '@/components/yen-purchase/CommonImportDialog';

const PurchaseCategory: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const {
    categories,
    error,
    snackbarOpen,
    snackbarMessage,
    loading,
    dialogOpen,
    importResult,
    showImportResultDialog,
  } = useSelector((state: RootState) => state.purchaseCategory);

  useEffect(() => {
    dispatch(fetchCategories());
    dispatch(fetchSubcategories());
  }, [dispatch]);

  const handleSnackbarClose = () => {
    dispatch(setSnackbarOpen(false));
  };

  const handleAddCategory = () => {
    dispatch(setDialogOpen('add'));
  };

  const handleEditCategory = (categoryId: string) => {
    const categoryToEdit = categories.find(cat => cat.purchasecategoryId === categoryId);
    if (categoryToEdit) {
      dispatch(setCategoryData(initialCategoryState));
      dispatch(setCategoryData({
        ...categoryToEdit,
        status: categoryToEdit.status || 'active',
        randomId: categoryToEdit.randomId || '',
      }));
      dispatch(setEditIndex(categoryId));
      dispatch(setDialogOpen('edit'));
    }
  };

  const handleCategoryAdded = () => {
    dispatch(fetchCategories());
  };

  const handleCloseImportResultDialog = () => {
    dispatch(setShowImportResultDialog(false));
    dispatch(resetImportResult());
  };

  if (loading) return <Typography>Loading...</Typography>;
  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <Box>
      <SearchToolbar />
      <CategoryTable onEditClick={handleEditCategory} />
      <AddEditDialog
        open={dialogOpen === 'add' || dialogOpen === 'edit'}
        onClose={() => {
          dispatch(setDialogOpen('none'));
          dispatch(setEditIndex(null));
        }}
        onCategoryAdded={handleCategoryAdded}
      />
      <CommonImportResultDialog
        open={showImportResultDialog}
        onClose={handleCloseImportResultDialog}
        importResult={importResult}
        module="category"
      />
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={handleSnackbarClose}
        message={snackbarMessage}
      />
    </Box>
  );
};

export default PurchaseCategory;