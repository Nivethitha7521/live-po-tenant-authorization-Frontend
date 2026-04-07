'use client';
import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/redux/store';
import {
  fetchPurchaseGroupItems,
  updatePurchaseGroupItem,
  addPurchaseGroupItem,
  deactivatePurchaseGroupItem,
  activatePurchaseGroupItem,
  setPurchaseGroupItemData,
  setEditIndex,
  setDialogOpen,
  setShowDeactivated,
  selectPurchaseGroupItems,
  setSearchQuery,
  setSnackbarMessage,
  setSnackbarOpen,
  resetImportState,
  importCSV,
  exportCSV,
  setShowImportResultDialog,
} from '../../../../features/yen-purchase/PurchaseMaster/GroupMasterSlice';
import { Box, Snackbar, Backdrop, CircularProgress, Typography } from '@mui/material';
import ItemGroupActions from '../../../../components/yen-purchase/purchasemaster/itemGroup/itemGroupActions';
import ItemGroupForm from '../../../../components/yen-purchase/purchasemaster/itemGroup/itemGroupForm';
import ItemGroupTable from '../../../../components/yen-purchase/purchasemaster/itemGroup/itemGroupTable';
import CommonImportResultDialog from '@/components/yen-purchase/CommonImportDialog';
import { PurchaseGroupItem } from '@/Models/itemgroup';
import { FormikHelpers } from 'formik';
import { usePermissions } from '@/hooks/usePermissions'; 
const initialPurchaseGroupItemState: PurchaseGroupItem = {
  itemgroupId: '',
  itemgroupName: '',
  status: 'active',
  randomId: '',
};

const normalizeNameForComparison = (name: string | undefined | null): string => {
  if (!name) return '';
  return name
    .trim() 
    .replace(/\s+/g, '') 
    .toLowerCase(); 
};

const ItemGroupPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const {
    items: purchaseGroupItems,
    deactivatedItems,
    purchaseGroupItemData,
    editIndex,
    dialogOpen,
    showDeactivated,
    searchQuery,
    importing,
    exporting,
    importSuccess,
    importResult,
    showImportResultDialog,
    snackbarOpen,
    snackbarMessage,
  } = useSelector(selectPurchaseGroupItems);

  const { hasPermission, isModuleVisible } = usePermissions();
  
 
  const canAdd = hasPermission('yenerp', 'itemgroup', 'add');
  const canEdit = hasPermission('yenerp', 'itemgroup', 'edit');
  const canDelete = hasPermission('yenerp', 'itemgroup', 'delete');


  useEffect(() => {
    dispatch(fetchPurchaseGroupItems());
  }, [dispatch, showDeactivated]);

  useEffect(() => {
    if (importSuccess) {
      dispatch(fetchPurchaseGroupItems());
    }
  }, [importSuccess, dispatch]);

 const handleDialogOpen = () => {
    if (!canAdd) {
      dispatch(setSnackbarMessage('You do not have permission to add item groups'));
      dispatch(setSnackbarOpen(true));
      return;
    }
    dispatch(setDialogOpen('edit'));
  };

  const handleDialogClose = () => {
    dispatch(setDialogOpen('none'));
    dispatch(setPurchaseGroupItemData(initialPurchaseGroupItemState));
    dispatch(setEditIndex(null));
  };

  const handleExportCSV = () => {
    dispatch(exportCSV());
  };


  const handleSampleCSV = () => {
    const sampleHeader = 'Item Group,Status,Created Date,Updated Date\n';
    const sampleRows = 'Sample Group 1,active,13-06-2025,13-06-2025\nSample Group 2,active,13-06-2025,13-06-2025\n';
    const csvContent = `${sampleHeader}${sampleRows}`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_itemgroups.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

 // In handleImportCSV function:
const handleImportCSV = (file: File): Promise<any> => {
  return new Promise((resolve, reject) => {
    dispatch(importCSV(file))
      .unwrap()
      .then((response) => {
        resolve(response);
      })
      .catch((error) => {
        // Extract proper error message
        const errorMessage = error?.detail || error?.message || 'Import failed';
        reject(new Error(errorMessage));
      });
  });
};
 
   const handleImportResultsClose = () => {
    dispatch(resetImportState());
  };


  const handleAddUpdateItemGroup = async (
    values: PurchaseGroupItem,
    { setFieldError }: FormikHelpers<PurchaseGroupItem>
  ): Promise<void> => {
    const normalizedName = values.itemgroupName.trim().replace(/\s+/g, ' ');
    if (!normalizedName) {
      setFieldError('itemgroupName', 'Item group name cannot be empty');
      return;
    }
     
    if (editIndex !== null && !canEdit) {
      dispatch(setSnackbarMessage('You do not have permission to edit item groups'));
      dispatch(setSnackbarOpen(true));
      return;
    }
 console.log('🔴 Sending payload to API:', {
    ...values,
    itemgroupName: normalizedName
  });
    const isDuplicate = [...purchaseGroupItems, ...deactivatedItems].some(
      (groupitem) =>
        normalizeNameForComparison(groupitem.itemgroupName) === normalizeNameForComparison(normalizedName) &&
        groupitem.itemgroupId !== values.itemgroupId
    );

    if (isDuplicate) {
      setFieldError('itemgroupName', 'Item group name already exists (case-insensitive, spaces normalized)');
      return;
    }

    const payload = { ...values, itemgroupName: normalizedName };
    if (editIndex !== null) {
      try {
        await dispatch(updatePurchaseGroupItem({ ...payload, itemgroupId: purchaseGroupItemData.itemgroupId }))
          .unwrap();
        dispatch(setSnackbarMessage('Item group updated successfully'));
        dispatch(setSnackbarOpen(true));
        dispatch(fetchPurchaseGroupItems());
        handleDialogClose();
      } catch (error: any) {
        const message = error.message?.includes('already exists')
          ? 'Item group name already exists (case-insensitive, spaces normalized)'
          : `Failed to update item group: ${error.message}`;
        dispatch(setSnackbarMessage(message));
        dispatch(setSnackbarOpen(true));
      }
    } else {
      try {
        await dispatch(addPurchaseGroupItem(payload))
          .unwrap();
        dispatch(setSnackbarMessage('Item group added successfully'));
        dispatch(setSnackbarOpen(true));
        dispatch(fetchPurchaseGroupItems());
        handleDialogClose();
      } catch (error: any) {
        const message = error.message?.includes('already exists')
          ? 'Item group name already exists (case-insensitive, spaces normalized)'
          : `Failed to add item group: ${error.message}`;
        dispatch(setSnackbarMessage(message));
        dispatch(setSnackbarOpen(true));
      }
    }
  };

  const handleEditItemGroup = (id: string) => {
    if (!canEdit) {
      dispatch(setSnackbarMessage('You do not have permission to edit item groups'));
      dispatch(setSnackbarOpen(true));
      return;
    }
    
    const item = purchaseGroupItems.find((groupitem) => groupitem.itemgroupId === id);
    if (item) {
      dispatch(
        setPurchaseGroupItemData({
          ...item,
          itemgroupName: item.itemgroupName ? item.itemgroupName.trim().replace(/\s+/g, ' ') : '',
        })
      );
      dispatch(setEditIndex(0));
      dispatch(setDialogOpen('edit'));
    }
  };

  const handleDeactivateItemGroup = (id: string) => {
    if (!canDelete) {
      dispatch(setSnackbarMessage('You do not have permission to deactivate item groups'));
      dispatch(setSnackbarOpen(true));
      return;
    }
    
    dispatch(deactivatePurchaseGroupItem(id))
      .unwrap()
      .then(() => {
        dispatch(setSnackbarMessage('Item group deactivated successfully'));
        dispatch(setSnackbarOpen(true));
        dispatch(fetchPurchaseGroupItems());
      })
      .catch((error) => {
        dispatch(setSnackbarMessage(`Failed to deactivate item group: ${error.message}`));
        dispatch(setSnackbarOpen(true));
      });
  };

  const handleActivateItemGroup = (id: string) => {
    if (!canDelete) {
      dispatch(setSnackbarMessage('You do not have permission to activate item groups'));
      dispatch(setSnackbarOpen(true));
      return;
    }
    
    dispatch(activatePurchaseGroupItem(id))
      .unwrap()
      .then(() => {
        dispatch(setSnackbarMessage('Item group activated successfully'));
        dispatch(setSnackbarOpen(true));
        dispatch(fetchPurchaseGroupItems());
      })
      .catch((error) => {
        dispatch(setSnackbarMessage(`Failed to activate item group: ${error.message}`));
        dispatch(setSnackbarOpen(true));
      });
  };

  const toggleShowDeactivated = () => {
    dispatch(setShowDeactivated(!showDeactivated));
  };

  const filteredItems = showDeactivated
    ? deactivatedItems.map((item) => ({
        ...item,
        itemgroupName: item.itemgroupName ? item.itemgroupName.trim().replace(/\s+/g, ' ') : '',
      }))
    : purchaseGroupItems
        .filter((item) =>
          item.itemgroupName
            ? normalizeNameForComparison(item.itemgroupName).includes(normalizeNameForComparison(searchQuery || ''))
            : false
        )
        .map((item) => ({
          ...item,
          itemgroupName: item.itemgroupName ? item.itemgroupName.trim().replace(/\s+/g, ' ') : '',
        }));
// ✅ MODULE VISIBILITY CHECK
if (!isModuleVisible("yenerp", "itemgroup")) {
  return null;
}

  return (
    <Box>
      <ItemGroupActions
        searchQuery={searchQuery || ''}
        onSearchChange={(e) => dispatch(setSearchQuery(e.target.value || ''))}
        onDialogOpen={handleDialogOpen}
        onSampleCSV={handleSampleCSV}
        onImportCSV={handleImportCSV}
        onExportCSV={handleExportCSV}
        showDeactivated={showDeactivated}
        onToggleShowDeactivated={toggleShowDeactivated}
        importing={importing}
        exporting={exporting}
         permissions={{ 
          canAdd,
          canEdit, 
          canDelete,
        }}
      />
      <ItemGroupTable
        items={filteredItems}
        loading={importing || exporting}
        handleEdit={handleEditItemGroup}
        handleDeactivate={handleDeactivateItemGroup}
        handleActivate={handleActivateItemGroup}
        permissions={{ 
          canEdit,
          canDelete
        }}
      />
      <ItemGroupForm
        open={dialogOpen !== 'none'}
        onClose={handleDialogClose}
        onSubmit={handleAddUpdateItemGroup}
        initialValues={purchaseGroupItemData}
        editIndex={editIndex}
        loading={importing || exporting}
      />
      <CommonImportResultDialog
        open={showImportResultDialog}
        onClose={handleImportResultsClose}
        importResult={importResult}
        module="itemGroup"
      />
     <Snackbar
  open={snackbarOpen}
  autoHideDuration={6000}
  onClose={() => dispatch(setSnackbarOpen(false))}
  message={String(snackbarMessage)} 
/>
      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={importing || exporting}
      >
        <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
          <CircularProgress color="inherit" />
          <Typography>
            {importing ? 'Import is in progress, please wait...' : 'Export is in progress, please wait...'}
          </Typography>
        </Box>
      </Backdrop>
    </Box>
  );
};

export default ItemGroupPage;