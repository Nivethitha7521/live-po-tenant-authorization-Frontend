'use client';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '../../../../redux/store';
import {
  fetchPurchaseSubcategories,
  updatePurchaseSubcategory,
  addPurchaseSubcategory,
  deactivatePurchaseSubcategory,
  activatePurchaseSubcategory,
  setPurchaseSubcategoryData,
  setEditIndex,
  setDialogOpen,
  setSnackbarOpen,
  setSnackbarMessage,
  setSearchQuery,
  setShowDeactivated,
  selectPurchaseSubcategoryItems,
  importPurchaseSubcategoriesCSV,
  exportPurchaseSubcategoriesCSV,
  setShowImportResultDialog,
  resetImportResult,
} from '../../../../features/yen-purchase/PurchaseMaster/PurchaseSubcategorySlice';
import { Box, Snackbar,Alert } from '@mui/material';
import PurchaseSubcategoryActions from '../../../../components/yen-purchase/purchasemaster/subcategory/purchaseSubcategoryActions';
import PurchaseSubcategoryTable from '../../../../components/yen-purchase/purchasemaster/subcategory/purchaseSubcategoryTable';
import PurchaseSubcategoryForm from '../../../../components/yen-purchase/purchasemaster/subcategory/purchaseSubcategoryForm';
import { PurchaseSubcategory } from '@/Models/purchasesubcategory';
import CommonImportResultDialog from '@/components/yen-purchase/CommonImportDialog';
import { usePermissions } from '@/hooks/usePermissions';
const initialSubcategoryState: PurchaseSubcategory = {
  purchasesubcategoryId: '',
  purchasesubcategoryName: '',
  status: 'active',
  randomId: '',
};

const PurchaseSubcategoryPage: React.FC = () => {
  const dispatch: AppDispatch = useDispatch();
  const { hasPermission, isModuleVisible } = usePermissions(); 
  const {
    items: purchaseSubcategories,
    deactivatedSubcategories,
    purchaseSubcategoryData,
    editIndex,
    dialogOpen,
    snackbarOpen,
    snackbarMessage,
    showDeactivated,
    searchQuery,
    importStatus,
    exportStatus,
    importResult,
    showImportResultDialog,
  } = useSelector(selectPurchaseSubcategoryItems);
  const [loading, setLoading] = useState(false);
  const existingSubcategories = purchaseSubcategories.map((item) => item.purchasesubcategoryName);

   
  const canAdd = hasPermission('yenerp', 'purchasesubcategory', 'add');
  const canEdit = hasPermission('yenerp', 'purchasesubcategory', 'edit');
  const canDelete = hasPermission('yenerp', 'purchasesubcategory', 'delete');
 

  useEffect(() => {
    dispatch(fetchPurchaseSubcategories());
  }, [dispatch]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setSearchQuery(e.target.value));
  };

  const filteredSubcategories = (showDeactivated ? deactivatedSubcategories : purchaseSubcategories).filter((subcategory) =>
    subcategory.purchasesubcategoryName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

 const handleDialogOpen = (action: 'add' | 'edit' = 'add') => {
  console.log('🟢 handleDialogOpen called with action:', action);
  
  if (action === 'add') {
    if (!canAdd) {
      console.log('❌ Add permission denied');
      dispatch(setSnackbarMessage('You do not have permission to add subcategories'));
      dispatch(setSnackbarOpen(true));
      return;
    }
  } else if (action === 'edit') {
    if (!canEdit) {
      console.log('❌ Edit permission denied');
      dispatch(setSnackbarMessage('You do not have permission to edit subcategories'));
      dispatch(setSnackbarOpen(true));
      return;
    }
  }
  dispatch(setDialogOpen('edit'));
};

  const handleDialogClose = () => {
    dispatch(setDialogOpen('none'));
    dispatch(setPurchaseSubcategoryData(initialSubcategoryState));
    dispatch(setEditIndex(null));
  };

  const handleCloseImportResultDialog = () => {
    dispatch(setShowImportResultDialog(false));
    dispatch(resetImportResult());
  };

  const handleSubmit = (values: PurchaseSubcategory, { setFieldError }: any) => {
    const alphanumericRegex = /^[a-zA-Z0-9 ]*$/;

    if (!alphanumericRegex.test(values.purchasesubcategoryName)) {
      setFieldError('purchasesubcategoryName', 'Subcategory name can only contain letters, numbers, and spaces.');
      return;
    }

    const isDuplicate = purchaseSubcategories.some(
      (subcategory) =>
        subcategory.purchasesubcategoryName.toLowerCase() === values.purchasesubcategoryName.toLowerCase() &&
        subcategory.purchasesubcategoryId !== values.purchasesubcategoryId
    );

    if (isDuplicate) {
      setFieldError('purchasesubcategoryName', 'Subcategory name already exists');
      return;
    }

    setLoading(true);

    if (editIndex !== null) {

       if (!canEdit) { 
        dispatch(setSnackbarMessage('You do not have permission to edit subcategories'));
        dispatch(setSnackbarOpen(true));
        setLoading(false);
        return;
      }

      dispatch(
        updatePurchaseSubcategory({
          purchasesubcategoryId: values.purchasesubcategoryId,
          purchasesubcategory: values,
        })
      )
        .unwrap()
        .then(() => {
          dispatch(setSnackbarMessage('Purchase subcategory updated successfully'));
          dispatch(setSnackbarOpen(true));
          dispatch(fetchPurchaseSubcategories());
          handleDialogClose();
        })
        .catch((error) => {
          dispatch(setSnackbarMessage(`Failed to update purchase subcategory: ${error.message || error}`));
          dispatch(setSnackbarOpen(true));
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      if (!canAdd) { 
        dispatch(setSnackbarMessage('You do not have permission to add subcategories'));
        dispatch(setSnackbarOpen(true));
        setLoading(false);
        return;
      }

      dispatch(addPurchaseSubcategory(values))
        .unwrap()
        .then(() => {
          dispatch(setSnackbarMessage('Purchase subcategory added successfully'));
          dispatch(setSnackbarOpen(true));
          dispatch(fetchPurchaseSubcategories());
          handleDialogClose();
        })
        .catch((error) => {
          dispatch(setSnackbarMessage(`Failed to add purchase subcategory: ${error.message || error}`));
          dispatch(setSnackbarOpen(true));
        })
        .finally(() => {
          setLoading(false);
        });
    }
  };

 const handleEdit = (index: number) => {
    if (!canEdit) {
    dispatch(setSnackbarMessage('You do not have permission to edit subcategories'));
    dispatch(setSnackbarOpen(true));
    return;
  }
  
  dispatch(setEditIndex(index));
  dispatch(setPurchaseSubcategoryData(purchaseSubcategories[index]));
  handleDialogOpen('edit');
};

  const handleDeactivate = (purchasesubcategoryId: string) => {
     if (!canDelete) { 
      dispatch(setSnackbarMessage('You do not have permission to deactivate subcategories'));
      dispatch(setSnackbarOpen(true));
      return;
    }
    dispatch(deactivatePurchaseSubcategory(purchasesubcategoryId))
      .then(() => {
        dispatch(setSnackbarMessage('Purchase subcategory deactivated successfully'));
        dispatch(setSnackbarOpen(true));
        dispatch(fetchPurchaseSubcategories());
      })
      .catch((error) => {
        dispatch(setSnackbarMessage(`Failed to deactivate purchase subcategory: ${error.message}`));
        dispatch(setSnackbarOpen(true));
      });
  };

  const handleActivate = (purchasesubcategoryId: string) => {
     if (!canDelete) { 
            dispatch(setSnackbarMessage('You do not have permission to activate subcategories'));
      dispatch(setSnackbarOpen(true));
      return;
    }
    dispatch(activatePurchaseSubcategory(purchasesubcategoryId))
      .then(() => {
        dispatch(setSnackbarMessage('Purchase subcategory activated successfully'));
        dispatch(setSnackbarOpen(true));
        dispatch(fetchPurchaseSubcategories());
      })
      .catch((error) => {
        dispatch(setSnackbarMessage(`Failed to activate purchase subcategory: ${error.message}`));
        dispatch(setSnackbarOpen(true));
      });
  };

  const toggleShowDeactivated = () => {
    dispatch(setShowDeactivated(!showDeactivated));
  };

  const handleImportCSV = (file: File): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (!file || file.size === 0) {
        dispatch(setSnackbarMessage('Please select a CSV file to import'));
        dispatch(setSnackbarOpen(true));
        dispatch(setShowImportResultDialog(true));
        reject('No file selected');
        return;
      }

      if (!file.name.endsWith('.csv')) {
        dispatch(setSnackbarMessage('Invalid file format. Please upload a CSV file.'));
        dispatch(setSnackbarOpen(true));
        dispatch(setShowImportResultDialog(true));
        reject('Invalid file format');
        return;
      }

      dispatch(importPurchaseSubcategoriesCSV(file))
        .unwrap()
        .then((response) => {
          dispatch(setShowImportResultDialog(true));
          dispatch(setSnackbarMessage(response.message || 'Purchase subcategories imported successfully'));
          dispatch(setSnackbarOpen(true));
          dispatch(fetchPurchaseSubcategories());
          resolve(response);
        })
        .catch((error) => {
          const errorMessage = error?.detail?.message || error?.message || 'Failed to import CSV';
          dispatch(setSnackbarMessage(`Import failed: ${errorMessage}`));
          dispatch(setSnackbarOpen(true));
          dispatch(setShowImportResultDialog(true));
          reject(error);
        });
    });
  };

  const handleSampleCSV = () => {
    const sampleHeader = 'Subcategory\n';
    const sampleRow = 'Sample Subcategory';
    const csvContent = `${sampleHeader}${sampleRow}`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_purchase_subcategories.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    dispatch(exportPurchaseSubcategoriesCSV())
      .unwrap()
      .then(() => {
        dispatch(setSnackbarMessage('Purchase subcategories exported successfully'));
        dispatch(setSnackbarOpen(true));
      })
      .catch((error) => {
        dispatch(setSnackbarMessage(`Export failed: ${error.message || error}`));
        dispatch(setSnackbarOpen(true));
      });
  };
// ✅ MODULE VISIBILITY CHECK
if (!isModuleVisible("yenerp", "purchasesubcategory")) {
  return (
    <Box p={3}>
      <Alert severity="error">
        You do not have access to the Purchase Subcategory module.
      </Alert>
    </Box>
  );
}

  return (
    <Box>
      <PurchaseSubcategoryActions
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onDialogOpen={handleDialogOpen}
        onSampleCSV={handleSampleCSV}
        onImportCSV={handleImportCSV}
        onExportCSV={handleExportCSV}
        showDeactivated={showDeactivated}
        onToggleShowDeactivated={toggleShowDeactivated}
        importStatus={importStatus}
        exportStatus={exportStatus}
        permissions={{ 
          add: canAdd,
          edit: canEdit, 
          delete: canDelete
        }}
      />

      <PurchaseSubcategoryTable
        subcategories={filteredSubcategories}
        showDeactivated={showDeactivated}
        handleEdit={handleEdit}
        handleDeactivate={handleDeactivate}
        handleActivate={handleActivate}
        canEdit={canEdit}
        canDelete={canDelete} 
      />

      <PurchaseSubcategoryForm
        open={dialogOpen === 'edit'}
        onClose={handleDialogClose}
        onSubmit={handleSubmit}
        initialValues={purchaseSubcategoryData}
        editIndex={editIndex}
        loading={loading}
        existingSubcategories={existingSubcategories}
      />

      <CommonImportResultDialog
        open={showImportResultDialog}
        onClose={handleCloseImportResultDialog}
        importResult={importResult}
        module="subcategory"
      />

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => dispatch(setSnackbarOpen(false))}
        message={snackbarMessage}
      />
    </Box>
  );
};

export default PurchaseSubcategoryPage;