'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '../../../../redux/store';
import {
  fetchUOMItems,
  addUOMItem,
  updateUOMItem,
  deactivateUOMItem,
  activateUOMItem,
  setSearchQuery,
  selectUOMItems,
  setDialogOpen,
  setUOMData,
  setSnackbarOpen,
  setSnackbarMessage,
  setShowDeactivated,
  setEditIndex,
  exportPurchaseUom,
  selectImportStatus,
  selectExportStatus,
  selectImportResult,
  selectShowImportResultDialog,
  setShowImportResultDialog,
  resetImportResult,
} from '../../../../features/yen-purchase/PurchaseMaster/PurchaseUomSlice';
import { Box, Snackbar,Typography, Paper } from '@mui/material';
import UOMActions from '../../../../components/yen-purchase/purchasemaster/uom/uomActions';
import UOMTable from '../../../../components/yen-purchase/purchasemaster/uom/uomTable';
import UOMForm from '../../../../components/yen-purchase/purchasemaster/uom/uomForm';
import { UOMItem } from '@/Models/uom';
import { usePermissions } from '@/hooks/usePermissions';
const normalizeUOMName = (name: string) => name.replace(/\s+/g, '').toLowerCase();

const initialUOMData: UOMItem = {
  purchaseuomId: '',
  uom: '',
  precisionValue: '',
  status: 'active',
  randomId: '',
};

const UOMPage: React.FC = () => {
   
  const dispatch: AppDispatch = useDispatch();
   const { hasPermission, isModuleVisible } = usePermissions(); 
  const canAdd = hasPermission('yenerp', 'purchaseuom', 'add');
  const canEdit = hasPermission('yenerp', 'purchaseuom', 'edit');
  const canDelete = hasPermission('yenerp', 'purchaseuom','delete');


  const {
    items,
    deactivatedItems,
    snackbarOpen,
    snackbarMessage,
    searchQuery,
    editIndex,
    dialogOpen,
    showDeactivated,
    uomData,
  } = useSelector(selectUOMItems);
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    dispatch(fetchUOMItems());
  }, [dispatch]);

  const handleDialogOpen = (action: 'add' | 'edit' = 'add') => {
    if (action === 'add' && !canAdd) {
      dispatch(setSnackbarMessage('You do not have permission to add UOM'));
      dispatch(setSnackbarOpen(true));
      return;
    }
    if (action === 'edit' && !canEdit) {
      dispatch(setSnackbarMessage('You do not have permission to edit UOM'));
      dispatch(setSnackbarOpen(true));
      return;
    }
    dispatch(setDialogOpen('edit'));
  };

  const handleDialogClose = () => {
    dispatch(setDialogOpen('none'));
    dispatch(setUOMData(initialUOMData));
    dispatch(setEditIndex(null));
  };

  const handleSubmit = (values: UOMItem) => {
    
    if (editIndex !== null && !canEdit) {
      dispatch(setSnackbarMessage('You do not have permission to edit UOM'));
      dispatch(setSnackbarOpen(true));
      return;
    }
    if (editIndex === null && !canAdd) {
      dispatch(setSnackbarMessage('You do not have permission to add UOM'));
      dispatch(setSnackbarOpen(true));
      return;
    }

    const trimmedValues = {
      ...values,
      uom: values.uom.trim(),
      precisionValue: String(values.precisionValue),
    };

    const duplicateItem = items.find(
      (item) =>
        normalizeUOMName(item.uom) === normalizeUOMName(trimmedValues.uom) &&
        item.purchaseuomId !== trimmedValues.purchaseuomId
    );

    if (duplicateItem && editIndex === null) {
      dispatch(setSnackbarMessage('UOM already exists'));
      dispatch(setSnackbarOpen(true));
      return;
    }

    setLoading(true);
    if (trimmedValues.purchaseuomId) {
      dispatch(updateUOMItem(trimmedValues))
        .unwrap()
        .then(() => {
          dispatch(setSnackbarMessage('UOM updated successfully'));
          dispatch(setSnackbarOpen(true));
          dispatch(fetchUOMItems());
          handleDialogClose();
        })
        .catch((error) => {
          dispatch(setSnackbarMessage(`Failed to update UOM: ${error.message}`));
          dispatch(setSnackbarOpen(true));
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      dispatch(addUOMItem(trimmedValues))
        .unwrap()
        .then(() => {
          dispatch(setSnackbarMessage('UOM added successfully'));
          dispatch(setSnackbarOpen(true));
          dispatch(fetchUOMItems());
          handleDialogClose();
        })
        .catch((error) => {
          dispatch(setSnackbarMessage(`Failed to add UOM: ${error.message}`));
          dispatch(setSnackbarOpen(true));
        })
        .finally(() => {
          setLoading(false);
        });
    }
  };

  const handleEdit = (id: string) => {
     if (!canEdit) {
      dispatch(setSnackbarMessage('You do not have permission to edit UOM'));
      dispatch(setSnackbarOpen(true));
      return;
    }
    const item = items.find((item) => item.purchaseuomId === id);
    if (item) {
      dispatch(setUOMData({ ...item, precisionValue: String(item.precisionValue) }));
      dispatch(setEditIndex(id));
      handleDialogOpen('edit');
    }
  };

  const handleDeactivate = async (purchaseuomId: string) => {
     if (!canDelete) {
      dispatch(setSnackbarMessage('You do not have permission to deactivate UOM'));
      dispatch(setSnackbarOpen(true));
      return;
    }console.log('🎯 Starting deactivate for ID:', purchaseuomId);
    try {
       await dispatch(deactivateUOMItem(purchaseuomId)).unwrap();
      dispatch(setSnackbarMessage('UOM deactivated successfully'));
      dispatch(setSnackbarOpen(true));
      await dispatch(fetchUOMItems()).unwrap();
    } catch (error: any) {
      dispatch(setSnackbarMessage(error.message));
      dispatch(setSnackbarOpen(true));
    }
  };

  const handleActivate = async (purchaseuomId: string) => {
    if (!canDelete) {
      dispatch(setSnackbarMessage('You do not have permission to activate UOM'));
      dispatch(setSnackbarOpen(true));
      return;
    }
    try {
      await dispatch(activateUOMItem(purchaseuomId)).unwrap();
      dispatch(setSnackbarMessage('UOM activated successfully'));
      dispatch(setSnackbarOpen(true));
      await dispatch(fetchUOMItems()).unwrap();
    } catch (error: any) {
      dispatch(setSnackbarMessage(error.message));
      dispatch(setSnackbarOpen(true));
    }
  };

  const toggleShowDeactivated = () => {
    dispatch(setShowDeactivated(!showDeactivated));
  };

  const filteredItems = useMemo(() => {
    const source = showDeactivated ? deactivatedItems : items;
    const filtered = source.filter((uom) =>
      uom.uom?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return [...filtered].reverse();
  }, [items, deactivatedItems, showDeactivated, searchQuery]);
  // ✅ MODULE VISIBILITY CHECK
if (!isModuleVisible("yenerp", "purchaseuom")) {
  return null;
  // or show Alert if you want:
  // return (
  //   <Box p={3}>
  //     <Alert severity="error">No access to Purchase UOM module</Alert>
  //   </Box>
  // );
}


  return (
    <Box>
      <UOMActions
        searchQuery={searchQuery}
        onSearchChange={(e) => dispatch(setSearchQuery(e.target.value))}
        onDialogOpen={handleDialogOpen}
        showDeactivated={showDeactivated}
        onToggleShowDeactivated={toggleShowDeactivated}
        permissions={{ add: canAdd, edit: canEdit, delete: canDelete }} 
      />

      <UOMTable
        items={filteredItems}
        showDeactivated={showDeactivated}
        handleEdit={handleEdit}
        handleDeactivate={handleDeactivate}
        handleActivate={handleActivate}
        canEdit={canEdit} 
        canDelete={canDelete} 
      />

      <UOMForm
        open={dialogOpen === 'edit'}
        onClose={handleDialogClose}
        onSubmit={handleSubmit}
        initialValues={uomData}
        editIndex={editIndex}
        loading={loading}
        existingUOMItems={items}
      />

      <Snackbar
        open={snackbarOpen}
        message={snackbarMessage}
        autoHideDuration={4000}
        onClose={() => dispatch(setSnackbarOpen(false))}
      />
    </Box>
  );
};

export default UOMPage;