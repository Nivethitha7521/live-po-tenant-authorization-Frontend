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
import { usePermissions } from '../../../../hooks/usePermissions';

const PurchaseCategory: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
    const { hasPermission, isModuleVisible } = usePermissions();  

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
 const canAdd = hasPermission('yenerp', 'purchasecategory', 'add');
  const canEdit = hasPermission('yenerp', 'purchasecategory', 'edit');
  const canDelete = hasPermission('yenerp', 'purchasecategory', 'delete');
  useEffect(() => {
    dispatch(fetchCategories());
    dispatch(fetchSubcategories());
  }, [dispatch]);

  const handleSnackbarClose = () => {
    dispatch(setSnackbarOpen(false));
  };

  const handleAddCategory = () => {
    if (canAdd) {
    dispatch(setDialogOpen('add'));
  };
};

  const handleEditCategory = (categoryId: string) => {
    if (canEdit) { 
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
if (!isModuleVisible('yenerp', 'purchasecategory')) {
    return (
        <Box p={3}>
            <Alert severity="error">You do not have access to the Purchase Category module.</Alert>
        </Box>
    );
}
  return (
    <Box>
      <SearchToolbar
      onAddClick={canAdd ? handleAddCategory : undefined}
        showAddButton={canAdd} />
      <CategoryTable onEditClick={handleEditCategory}
       canEdit={canEdit}
        canDelete={canDelete} />
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