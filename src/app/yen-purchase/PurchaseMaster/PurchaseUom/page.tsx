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
  importPurchaseUom,
  selectImportStatus,
  selectExportStatus,
  selectImportResult,
  selectShowImportResultDialog,
  setShowImportResultDialog,
  resetImportResult,
} from '../../../../features/yen-purchase/PurchaseMaster/PurchaseUomSlice';
import { Box, Snackbar } from '@mui/material';
import UOMActions from '../../../../components/yen-purchase/purchasemaster/uom/uomActions';
import UOMTable from '../../../../components/yen-purchase/purchasemaster/uom/uomTable';
import UOMForm from '../../../../components/yen-purchase/purchasemaster/uom/uomForm';
import { UOMItem } from '@/Models/uom';

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

  const handleDialogOpen = () => {
    dispatch(setDialogOpen('edit'));
  };

  const handleDialogClose = () => {
    dispatch(setDialogOpen('none'));
    dispatch(setUOMData(initialUOMData));
    dispatch(setEditIndex(null));
  };

  const handleSubmit = (values: UOMItem) => {
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
    const item = items.find((item) => item.purchaseuomId === id);
    if (item) {
      dispatch(setUOMData({ ...item, precisionValue: String(item.precisionValue) }));
      dispatch(setEditIndex(id));
      handleDialogOpen();
    }
  };

  const handleDeactivate = async (purchaseuomId: string) => {
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

  return (
    <Box>
      <UOMActions
        searchQuery={searchQuery}
        onSearchChange={(e) => dispatch(setSearchQuery(e.target.value))}
        onDialogOpen={handleDialogOpen}
        showDeactivated={showDeactivated}
        onToggleShowDeactivated={toggleShowDeactivated}
      />

      <UOMTable
        items={filteredItems}
        showDeactivated={showDeactivated}
        handleEdit={handleEdit}
        handleDeactivate={handleDeactivate}
        handleActivate={handleActivate}
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