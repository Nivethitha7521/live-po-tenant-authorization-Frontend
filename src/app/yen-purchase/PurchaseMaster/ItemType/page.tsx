'use client';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/redux/store';
import {
  fetchPurchaseTypeItems,
  updatePurchaseTypeItem,
  addPurchaseTypeItem,
  deactivatePurchaseTypeItem,
  activatePurchaseTypeItem,
  setPurchaseTypeItemData,
  setEditIndex,
  setDialogOpen,
  setSnackbarOpen,
  setSnackbarMessage,
  setShowDeactivated,
  selectPurchaseTypeItems,
  setSearchQuery,
  selectImportStatus,
  selectExportStatus,
  resetExportStatus,
  resetImportStatus,
  importPurchaseTypeItem,
  exportPurchaseTypeItem,
  setShowImportResultDialog,
} from '../../../../features/yen-purchase/PurchaseMaster/itemTypeSlice';
import { Box, Snackbar, Alert } from '@mui/material';
import ItemTypeForm from '../../../../components/yen-purchase/purchasemaster/itemType/itemTypeForm';
import ItemTypeTable from '../../../../components/yen-purchase/purchasemaster/itemType/itemTypeTable';
import ItemTypeActions from '../../../../components/yen-purchase/purchasemaster/itemType/itemTypeActions';
import { PurchaseItemType } from '@/Models/itemType';
import CommonImportResultDialog from '@/components/yen-purchase/CommonImportDialog';
import { ImportResult } from '@/Models/importResult';
import { usePermissions } from '../../../../hooks/usePermissions';
const initialPurchaseItemState: PurchaseItemType = {
  itemtypeId: '',
  itemtypeName: '',
  status: 'active',
  randomId: '',
};

const normalizeNameForComparison = (name: string | undefined | null): string => {
  if (!name) return '';
  return name.trim().replace(/\s+/g, '').toLowerCase();
};

const ItemTypePage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const {
    items: purchaseItemTypes,
    deactivatedItems,
    purchaseItemTypeData,
    editIndex,
    dialogOpen,
    snackbarOpen,
    snackbarMessage,
    showDeactivated,
    searchQuery,
    importResult,
    showImportResultDialog,
  } = useSelector(selectPurchaseTypeItems);
  const importStatus = useSelector(selectImportStatus);
  const exportStatus = useSelector(selectExportStatus);
  const [loading, setLoading] = useState(false);
const { hasPermission, isModuleVisible } = usePermissions();

const canAdd = hasPermission('yenerp', 'itemtype', 'add');
const canEdit = hasPermission('yenerp', 'itemtype', 'edit');
const canDelete = hasPermission('yenerp', 'itemtype', 'delete');


  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        await dispatch(fetchPurchaseTypeItems()).unwrap();
      } catch (error) {
        dispatch(setSnackbarMessage('Failed to fetch item types'));
        dispatch(setSnackbarOpen(true));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dispatch, showDeactivated]);

  useEffect(() => {
    if (importStatus === 'succeeded' || importStatus === 'failed') {
      const timer = setTimeout(() => {
        dispatch(resetImportStatus());
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [importStatus, dispatch]);

  useEffect(() => {
    if (exportStatus === 'succeeded' || exportStatus === 'failed') {
      const timer = setTimeout(() => {
        dispatch(resetExportStatus());
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [exportStatus, dispatch]);

  const handleDialogOpen = () => {
    if (canAdd){
    dispatch(setDialogOpen('edit'));
    }
  };

  const handleDialogClose = () => {
    dispatch(setDialogOpen('none'));
    dispatch(setPurchaseTypeItemData(initialPurchaseItemState));
    dispatch(setEditIndex(null));
  };

  const handleSampleCSV = () => {
    const sampleHeader = 'itemtypeName\n';
    const sampleRow = 'Sample Type';
    const csvContent = `${sampleHeader}${sampleRow}`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_item_types.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportCSV = async (file: File) => {
    try {
      const result = await dispatch(importPurchaseTypeItem(file)).unwrap();
      dispatch(setShowImportResultDialog(true)); 
      dispatch(fetchPurchaseTypeItems());
      return result;
    } catch (error: any) {
      const errorResult: ImportResult = {
        message: 'Import failed',
        detail: {
          message: error.message || 'An unexpected error occurred',
          missing: error.message?.includes('Missing') ? ['itemtypeName'] : undefined,
        },
        inserted_count: 0,
        updated_count: 0,
        successful: [],
        updated: [],
        failed: [],
        errorCount: 1,
      };
      dispatch(setShowImportResultDialog(true));
      return errorResult;
    }
  };

  const handleExportCSV = () => {
    dispatch(exportPurchaseTypeItem())
      .unwrap()
      .then(() => {
        dispatch(setSnackbarMessage('Export completed successfully'));
        dispatch(setSnackbarOpen(true));
      })
      .catch((error) => {
        dispatch(setSnackbarMessage(`Failed to export: ${error.message || error}`));
        dispatch(setSnackbarOpen(true));
      });
  };

  const handleAddUpdateItemType = (values: PurchaseItemType, { setFieldError }: any) => {
    const normalizedName = values.itemtypeName.trim().replace(/\s+/g, ' ');
    if (!normalizedName) {
      setFieldError('itemtypeName', 'Item type name cannot be empty');
      return;
    }

    const isDuplicate = [...purchaseItemTypes, ...deactivatedItems].some(
      (item) =>
        normalizeNameForComparison(item.itemtypeName) === normalizeNameForComparison(normalizedName) &&
        item.itemtypeId !== values.itemtypeId
    );

    if (isDuplicate) {
      setFieldError('itemtypeName', 'Item type name already exists (case-insensitive, spaces normalized)');
      return;
    }

    setLoading(true);
    const payload = { ...values, itemtypeName: normalizedName };
    if (editIndex !== null) {
      dispatch(updatePurchaseTypeItem({ ...payload, itemtypeId: purchaseItemTypeData.itemtypeId }))
        .unwrap()
        .then(() => {
          dispatch(setSnackbarMessage('Item type updated successfully'));
          dispatch(setSnackbarOpen(true));
          dispatch(fetchPurchaseTypeItems());
          handleDialogClose();
        })
        .catch((error) => {
          const message = error.message?.includes('already exists')
            ? 'Item type name already exists (case-insensitive, spaces normalized)'
            : `Failed to update item type: ${error.message || error}`;
          dispatch(setSnackbarMessage(message));
          dispatch(setSnackbarOpen(true));
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      dispatch(addPurchaseTypeItem(payload))
        .unwrap()
        .then(() => {
          dispatch(setSnackbarMessage('Item type added successfully'));
          dispatch(setSnackbarOpen(true));
          dispatch(fetchPurchaseTypeItems());
          handleDialogClose();
        })
        .catch((error) => {
          const message = error.message?.includes('already exists')
            ? 'Item type name already exists (case-insensitive, spaces normalized)'
            : `Failed to add item type: ${error.message || error}`;
          dispatch(setSnackbarMessage(message));
          dispatch(setSnackbarOpen(true));
        })
        .finally(() => {
          setLoading(false);
        });
    }
  };

  const handleEditItemType = (id: string) => {
     if (canEdit) {
    const item = purchaseItemTypes.find((item) => item.itemtypeId === id);
    if (item) {
      dispatch(setPurchaseTypeItemData({
        ...item,
        itemtypeName: item.itemtypeName ? item.itemtypeName.trim().replace(/\s+/g, ' ') : ''
      }));
      dispatch(setEditIndex(id));
      dispatch(setDialogOpen('edit'));
    }
  }
  };

  const handleDeactivateItemType = (itemtypeId: string) => {
     if (canDelete) { 
    dispatch(deactivatePurchaseTypeItem(itemtypeId))
      .unwrap()
      .then(() => {
        dispatch(setSnackbarMessage('Item type deactivated successfully'));
        dispatch(setSnackbarOpen(true));
        dispatch(fetchPurchaseTypeItems());
      })
      .catch((error) => {
        dispatch(setSnackbarMessage(`Failed to deactivate item type: ${error.message || error}`));
        dispatch(setSnackbarOpen(true));
      });
    }
  };

  const handleActivateItemType = (itemtypeId: string) => {
    if (canDelete) { 
    dispatch(activatePurchaseTypeItem(itemtypeId))
      .unwrap()
      .then(() => {
        dispatch(setSnackbarMessage('Item type activated successfully'));
        dispatch(setSnackbarOpen(true));
        dispatch(fetchPurchaseTypeItems());
      })
      .catch((error) => {
        dispatch(setSnackbarMessage(`Failed to activate item type: ${error.message || error}`));
        dispatch(setSnackbarOpen(true));
      });
    }
  };

  const handleSnackbarClose = () => {
    dispatch(setSnackbarOpen(false));
  };

  const handleImportResultsClose = () => {
    dispatch(setShowImportResultDialog(false));
    dispatch(resetImportStatus());
  };

  const toggleShowDeactivated = () => {
    dispatch(setShowDeactivated(!showDeactivated));
  };

  const filteredItems = showDeactivated
    ? deactivatedItems.map((item) => ({
        ...item,
        itemtypeName: item.itemtypeName ? item.itemtypeName.trim().replace(/\s+/g, ' ') : ''
      }))
    : purchaseItemTypes
        .filter((item) =>
          item.itemtypeName
            ? normalizeNameForComparison(item.itemtypeName).includes(normalizeNameForComparison(searchQuery || ''))
            : false
        )
        .map((item) => ({
          ...item,
          itemtypeName: item.itemtypeName ? item.itemtypeName.trim().replace(/\s+/g, ' ') : ''
        }));

  return (
    <Box>
      <ItemTypeActions
        searchQuery={searchQuery}
        onSearchChange={(e) => dispatch(setSearchQuery(e.target.value))}
        onDialogOpen={handleDialogOpen}
        onSampleCSV={handleSampleCSV}
        onImportCSV={handleImportCSV}
        onExportCSV={handleExportCSV}
        showDeactivated={showDeactivated}
        onToggleShowDeactivated={toggleShowDeactivated}
        importStatus={importStatus}
        exportStatus={exportStatus}
        canAdd={canAdd} 

      />
      <ItemTypeTable
        items={filteredItems}
        showDeactivated={showDeactivated}
        handleEdit={handleEditItemType}
        handleDeactivate={handleDeactivateItemType}
        handleActivate={handleActivateItemType}
         canEdit={canEdit} 
        canDelete={canDelete} 
      />
      <ItemTypeForm
        open={dialogOpen !== 'none'}
        onClose={handleDialogClose}
        onSubmit={handleAddUpdateItemType}
        initialValues={purchaseItemTypeData}
        editIndex={editIndex}
        loading={loading}
      />
      <CommonImportResultDialog
        open={showImportResultDialog}
        onClose={handleImportResultsClose}
        importResult={importResult}
        module="itemType"
      />
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        message={snackbarMessage}
      />
    </Box>
  );
};

export default ItemTypePage;