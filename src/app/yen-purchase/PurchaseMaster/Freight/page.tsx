'use client';
import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/redux/store';
import {
  fetchFreightItems,
  updateFreightItem,
  addFreightItem,
  deactivateFreightItem,
  activateFreightItem,
  setFreightData,
  setEditIndex,
  setDialogOpen,
  setShowDeactivated,
  selectFreightItems,
  setSearchQuery,
  setSnackbarMessage,
  setSnackbarOpen,
  resetImportState,
  importCSV,
  exportCSV,
  setShowImportResultDialog,
} from '../../../../features/yen-purchase/PurchaseMaster/FreightMasterSlice';
import { Box, Snackbar, Backdrop, CircularProgress, Typography,Alert } from '@mui/material';
import FreightActions from '../../../../components/yen-purchase/purchasemaster/freight/freightActions';
import FreightForm from '../../../../components/yen-purchase/purchasemaster/freight/freightForm';
import FreightTable from '../../../../components/yen-purchase/purchasemaster/freight/freightTable';
import CommonImportResultDialog from '@/components/yen-purchase/CommonImportDialog';
import { Freight } from '../../../../Models/freightModel';
import { FormikHelpers } from 'formik';
import { usePermissions } from '../../../../hooks/usePermissions'; // ✅ ADD PERMISSIONS HOOK
const initialFreightState: Freight = {
  freightId: '',
  freightName: '',
  status: 'active',
  randomId: '',
};

const normalizeNameForComparison = (name: string | undefined | null): string => {
  if (!name) return '';
  return name
    .trim() // Remove leading/trailing spaces
    .replace(/\s+/g, '') // Remove ALL whitespace between words
    .toLowerCase(); // Convert to lowercase
};

const FreightPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const {
    items: freightItems,
    deactivatedItems,
    freightData,
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
  } = useSelector(selectFreightItems);
   
  const { hasPermission, isModuleVisible } = usePermissions();
  const canAdd = hasPermission('yenerp', 'freight', 'add');
  const canEdit = hasPermission('yenerp', 'freight', 'edit');
  const canDelete = hasPermission('yenerp', 'freight', 'delete');
  const canRead = hasPermission('yenerp', 'freight', 'read');



  // ❌ READ permission – page blocked
  if (!canRead) {
    return (
      <Box p={3}>
        <Alert severity="error">
          You do not have permission to view this page
        </Alert>
      </Box>
    );
  }

  useEffect(() => {
    dispatch(fetchFreightItems());
  }, [dispatch, showDeactivated]);

  useEffect(() => {
    if (importSuccess) {
      dispatch(fetchFreightItems());
    }
  }, [importSuccess, dispatch]);

  const handleDialogOpen = () => {
    if (canAdd) {
    dispatch(setDialogOpen('edit'));
    }
  };

  const handleDialogClose = () => {
    dispatch(setDialogOpen('none'));
    dispatch(setFreightData(initialFreightState));
    dispatch(setEditIndex(null));
  };

  const handleExportCSV = () => {
    dispatch(exportCSV());
  };

  const handleSampleCSV = () => {
    const sampleHeader = 'Freight,Status,Created Date,Updated Date\n';
    const sampleRows = 'Sample Freight 1,active,13-06-2025,13-06-2025\nSample Freight 2,active,13-06-2025,13-06-2025\n';
    const csvContent = `${sampleHeader}${sampleRows}`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_freights.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportCSV = (file: File): Promise<any> => {
    return new Promise((resolve, reject) => {
      dispatch(importCSV(file))
        .unwrap()
        .then((response) => {
          resolve(response);
        })
        .catch((error) => {
          reject(error);
        });
    });
  };

  const handleImportResultsClose = () => {
    dispatch(resetImportState());
  };

  const handleAddUpdateFreight = async (
    values: Freight,
    { setFieldError }: FormikHelpers<Freight>
  ): Promise<void> => {
    const normalizedName = values.freightName.trim().replace(/\s+/g, ' ');
    if (!normalizedName) {
      setFieldError('freightName', 'Freight name cannot be empty');
      return;
    }

    const isDuplicate = [...freightItems, ...deactivatedItems].some(
      (freight) =>
        normalizeNameForComparison(freight.freightName) === normalizeNameForComparison(normalizedName) &&
        freight.freightId !== values.freightId
    );

    if (isDuplicate) {
      setFieldError('freightName', 'Freight name already exists (case-insensitive, spaces normalized)');
      return;
    }

    const payload = { ...values, freightName: normalizedName };
    if (editIndex !== null) {
      try {
        await dispatch(updateFreightItem({ ...payload, freightId: freightData.freightId }))
          .unwrap();
        dispatch(setSnackbarMessage('Freight updated successfully'));
        dispatch(setSnackbarOpen(true));
        dispatch(fetchFreightItems());
        handleDialogClose();
      } catch (error: any) {
        const message = error.message?.includes('already exists')
          ? 'Freight name already exists (case-insensitive, spaces normalized)'
          : `Failed to update freight: ${error.message}`;
        dispatch(setSnackbarMessage(message));
        dispatch(setSnackbarOpen(true));
      }
    } else {
      try {
        await dispatch(addFreightItem(payload))
          .unwrap();
        dispatch(setSnackbarMessage('Freight added successfully'));
        dispatch(setSnackbarOpen(true));
        dispatch(fetchFreightItems());
        handleDialogClose();
      } catch (error: any) {
        const message = error.message?.includes('already exists')
          ? 'Freight name already exists (case-insensitive, spaces normalized)'
          : `Failed to add freight: ${error.message}`;
        dispatch(setSnackbarMessage(message));
        dispatch(setSnackbarOpen(true));
      }
    }
  };

  const handleEditFreight = (id: string) => {
    if (canEdit) {
    const item = freightItems.find((freight) => freight.freightId === id);
    if (item) {
      dispatch(
        setFreightData({
          ...item,
          freightName: item.freightName ? item.freightName.trim().replace(/\s+/g, ' ') : '',
        })
      );
      dispatch(setEditIndex(0));
      dispatch(setDialogOpen('edit'));
    }
  }
  };

  const handleDeactivateFreight = (id: string) => {
        if (canDelete) { 

    dispatch(deactivateFreightItem(id))
      .unwrap()
      .then(() => {
        dispatch(setSnackbarMessage('Freight deactivated successfully'));
        dispatch(setSnackbarOpen(true));
        dispatch(fetchFreightItems());
      })
      .catch((error) => {
        dispatch(setSnackbarMessage(`Failed to deactivate freight: ${error.message}`));
        dispatch(setSnackbarOpen(true));
      });
    }
  };

  const handleActivateFreight = (id: string) => {
    if (canDelete) {
    dispatch(activateFreightItem(id))
      .unwrap()
      .then(() => {
        dispatch(setSnackbarMessage('Freight activated successfully'));
        dispatch(setSnackbarOpen(true));
        dispatch(fetchFreightItems());
      })
      .catch((error) => {
        dispatch(setSnackbarMessage(`Failed to activate freight: ${error.message}`));
        dispatch(setSnackbarOpen(true));
      });
    }
  };

  const toggleShowDeactivated = () => {
    dispatch(setShowDeactivated(!showDeactivated));
  };

  const filteredItems = showDeactivated
    ? deactivatedItems.map((item) => ({
        ...item,
        freightName: item.freightName ? item.freightName.trim().replace(/\s+/g, ' ') : '',
      }))
    : freightItems
        .filter((item) =>
          item.freightName
            ? normalizeNameForComparison(item.freightName).includes(normalizeNameForComparison(searchQuery || ''))
            : false
        )
        .map((item) => ({
          ...item,
          freightName: item.freightName ? item.freightName.trim().replace(/\s+/g, ' ') : '',
        }));
// ❌ If module is hidden, do NOT render page
if (!isModuleVisible('yenerp', 'freight')) {
  return null;
}

  return (
    <Box>
      <FreightActions
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
        canAdd={canAdd}
      />
      <FreightTable
        items={filteredItems}
        loading={importing || exporting}
        handleEdit={handleEditFreight}
        handleDeactivate={handleDeactivateFreight}
        handleActivate={handleActivateFreight}
        canEdit={canEdit} 
        canDelete={canDelete} 
      />
      <FreightForm
        open={dialogOpen !== 'none'}
        onClose={handleDialogClose}
        onSubmit={handleAddUpdateFreight}
        initialValues={freightData}
        editIndex={editIndex}
        loading={importing || exporting}
      />
      <CommonImportResultDialog
        open={showImportResultDialog}
        onClose={handleImportResultsClose}
        importResult={importResult}
        module="freight"
      />
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => dispatch(setSnackbarOpen(false))}
        message={snackbarMessage}
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

export default FreightPage;