 'use client';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/redux/store';
import {
  fetchStorageLocations,
  updateStorageLocation,
  addStorageLocation,
  deactivateStorageLocation,
  activateStorageLocation,
  setStorageLocationData,
  setEditIndex,
  setDialogOpen,
  setSnackbarOpen,
  setSnackbarMessage,
  setShowDeactivated,
  selectStorageLocations,
  setSearchQuery,
  setLocationNameTouched,
  importStorageLocation,
  exportStorageLocation,
  resetImportState,
  resetExportState,
  setShowImportResultDialog,
} from '../../../../features/yen-purchase/PurchaseMaster/StorageLocationSlice';
import { Box, Snackbar, Alert, Backdrop, CircularProgress,Typography } from '@mui/material';
import StorageLocationActions from '../../../../components/yen-purchase/purchasemaster/storagelocation/searchtoolbar';
import StorageLocationTable from '../../../../components/yen-purchase/purchasemaster/storagelocation/storagetable';
import StorageLocationForm from '../../../../components/yen-purchase/purchasemaster/storagelocation/addeditdialog';
import ImportResultDialog from '../../../../components/yen-purchase/CommonImportDialog';
import { StorageLocationItem } from '@/Models/storagelocation';
import { usePermissions } from '../../../../hooks/usePermissions';

const initialStorageLocationState: StorageLocationItem = {
  storageLocationId: '',
  locationName: '',
  status: 'active',
  randomId: '',
  createdDate: null,
  lastUpdatedDate: null,
};

const normalizeNameForComparison = (name: string | undefined | null): string => {
  if (!name) return '';
  return name.trim().replace(/\s+/g, '').toLowerCase();
};

const StorageLocationPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { hasPermission, isModuleVisible } = usePermissions();
  const {
    items: storageLocations,
    deactivatedItems,
    storageLocationData,
    editIndex,
    dialogOpen,
    snackbarOpen,
    snackbarMessage,
    showDeactivated,
    searchQuery,
    locationNameTouched,
    importResult,
    showImportResultDialog,
    importing,
    exporting,
    importSuccess,
    exportSuccess,
    importError,
    exportError,
  } = useSelector(selectStorageLocations);
  const [loading, setLoading] = useState(false);

  const canAdd = hasPermission('yenerp', 'storagelocation', 'add');
  const canEdit = hasPermission('yenerp', 'storagelocation', 'edit');
  const canDelete = hasPermission('yenerp', 'storagelocation', 'delete');

  console.log('🎯 Storage Location Action Permissions:', { canAdd, canEdit, canDelete });


  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        await dispatch(fetchStorageLocations()).unwrap();
      } catch (error) {
        dispatch(setSnackbarMessage('Failed to fetch storage locations'));
        dispatch(setSnackbarOpen(true));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dispatch, showDeactivated]);

  useEffect(() => {
    if (importSuccess || importError) {
      const timer = setTimeout(() => {
        dispatch(resetImportState());
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [importSuccess, importError, dispatch]);

  useEffect(() => {
    if (exportSuccess || exportError) {
      const timer = setTimeout(() => {
        dispatch(resetExportState());
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [exportSuccess, exportError, dispatch]);

  const handleDialogOpen = () => {
    if (canAdd) {
    dispatch(setStorageLocationData(initialStorageLocationState));
    dispatch(setEditIndex(null));
    dispatch(setDialogOpen('edit'));
    dispatch(setLocationNameTouched(false));
    }
  };

  const handleDialogClose = () => {
    dispatch(setDialogOpen('none'));
    dispatch(setStorageLocationData(initialStorageLocationState));
    dispatch(setEditIndex(null));
    dispatch(setLocationNameTouched(false));
  };

  const handleSampleCSV = () => {
    const sampleHeader = 'Location ID,Location,Status,Created Date,Updated Date\n';
    const sampleRow = 'ST001,Sample Location,active,01-01-2025,01-01-2025';
    const csvContent = `${sampleHeader}${sampleRow}`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_storage_locations.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportCSV = (file: File | null) => {
    if (!file) {
      dispatch(setSnackbarMessage('Please select a file to import'));
      dispatch(setSnackbarOpen(true));
      return;
    }
    dispatch(importStorageLocation(file))
      .unwrap()
      .then(() => {
        dispatch(fetchStorageLocations());
      })
      .catch((error) => {
        dispatch(setSnackbarMessage(`Failed to import: ${error?.detail?.message || error?.detail || 'Unknown error'}`));
        dispatch(setSnackbarOpen(true));
      });
  };

  const handleExportCSV = () => {
    dispatch(exportStorageLocation())
      .unwrap()
      .then(() => {
        dispatch(setSnackbarMessage('Export completed successfully'));
        dispatch(setSnackbarOpen(true));
      })
      .catch((error) => {
        dispatch(setSnackbarMessage(`Failed to export: ${error?.detail?.message || error?.detail || 'Unknown error'}`));
        dispatch(setSnackbarOpen(true));
      });
  };

  const resetForm = () => {
    dispatch(setStorageLocationData(initialStorageLocationState));
    dispatch(setLocationNameTouched(false));
  };

  const handleSubmit = (formData: StorageLocationItem) => {
    const normalizedName = formData.locationName.trim().replace(/\s+/g, ' ');
    const isDuplicate = [...storageLocations, ...deactivatedItems].some(
      (loc) =>
        normalizeNameForComparison(loc.locationName) === normalizeNameForComparison(normalizedName) &&
        loc.storageLocationId !== formData.storageLocationId
    );

    if (isDuplicate) {
      dispatch(setSnackbarMessage('Storage Location Name already exists (case-insensitive, spaces normalized)'));
      dispatch(setSnackbarOpen(true));
      return;
    }

    setLoading(true);
    const payload = { ...formData, locationName: normalizedName };
    if (formData.storageLocationId) {
      dispatch(updateStorageLocation(payload))
        .unwrap()
        .then(() => {
          dispatch(setSnackbarMessage('Storage location updated successfully'));
          dispatch(setSnackbarOpen(true));
          dispatch(fetchStorageLocations());
          handleDialogClose();
        })
        .catch((error) => {
          dispatch(setSnackbarMessage(`Failed to update storage location: ${error?.detail?.message || error?.detail || error}`));
          dispatch(setSnackbarOpen(true));
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      dispatch(addStorageLocation(payload))
        .unwrap()
        .then(() => {
          dispatch(setSnackbarMessage('Storage location added successfully'));
          dispatch(setSnackbarOpen(true));
          dispatch(fetchStorageLocations());
          resetForm();
          handleDialogClose();
        })
        .catch((error) => {
          dispatch(setSnackbarMessage(`Failed to add storage location: ${error?.detail?.message || error?.detail || error}`));
          dispatch(setSnackbarOpen(true));
        })
        .finally(() => {
          setLoading(false);
        });
    }
  };

  const handleEdit = (id: string) => {
    if (canEdit) { 
    const storageLocation = storageLocations.find((location) => location.storageLocationId === id);
    if (storageLocation) {
      dispatch(setStorageLocationData({
        ...storageLocation,
        locationName: storageLocation.locationName ? storageLocation.locationName.trim().replace(/\s+/g, ' ') : ''
      }));
      dispatch(setEditIndex(id));
      dispatch(setDialogOpen('edit'));
    }
  }
  };

  const handleDeactivate = (storageLocationId: string) => {
    if (canDelete){
    dispatch(deactivateStorageLocation(storageLocationId))
      .unwrap()
      .then(() => {
        dispatch(setSnackbarMessage('Storage location deactivated successfully'));
        dispatch(setSnackbarOpen(true));
        dispatch(fetchStorageLocations());
      })
      .catch((error) => {
        dispatch(setSnackbarMessage(`Failed to deactivate storage location: ${error?.detail?.message || error?.detail || error}`));
        dispatch(setSnackbarOpen(true));
      });
    }
  };

  const handleActivate = (storageLocationId: string) => {
        if (canDelete) { 

    dispatch(activateStorageLocation(storageLocationId))
      .unwrap()
      .then(() => {
        dispatch(setSnackbarMessage('Storage location activated successfully'));
        dispatch(setSnackbarOpen(true));
        dispatch(fetchStorageLocations());
      })
      .catch((error) => {
        dispatch(setSnackbarMessage(`Failed to activate storage location: ${error?.detail?.message || error?.detail || error}`));
        dispatch(setSnackbarOpen(true));
      });
    }
  };

  const handleSnackbarClose = () => {
    dispatch(setSnackbarOpen(false));
    dispatch(setSnackbarMessage(''));
  };

  const handleImportResultsClose = () => {
    dispatch(setShowImportResultDialog(false));
    dispatch(resetImportState());
  };

  const toggleShowDeactivated = () => {
    dispatch(setShowDeactivated(!showDeactivated));
  };

  const filteredStorageLocations = (showDeactivated ? deactivatedItems : storageLocations)
    .filter((loc) =>
      loc.locationName
        ? normalizeNameForComparison(loc.locationName).includes(normalizeNameForComparison(searchQuery || ''))
        : false
    )
    .map((loc) => ({
      ...loc,
      locationName: loc.locationName ? loc.locationName.trim().replace(/\s+/g, ' ') : ''
    }))
    .slice()
    .reverse();
if (loading) return <Typography>Loading...</Typography>;

  return (
    <Box>
      <StorageLocationActions
        searchQuery={searchQuery}
        onSearchChange={(e) => dispatch(setSearchQuery(e.target.value))}
        onDialogOpen={handleDialogOpen}
        onSampleCSV={handleSampleCSV}
        onImportCSV={handleImportCSV}
        onExportCSV={handleExportCSV}
        showDeactivated={showDeactivated}
        onToggleShowDeactivated={toggleShowDeactivated}
        importStatus={importing ? 'loading' : importSuccess ? 'succeeded' : importError ? 'failed' : 'idle'}
        exportStatus={exporting ? 'loading' : exportSuccess ? 'succeeded' : exportError ? 'failed' : 'idle'}
        showAddButton={canAdd} 
      />
      <StorageLocationTable
        items={filteredStorageLocations}
        handleEdit={handleEdit}
        handleDeactivate={handleDeactivate}
        handleActivate={handleActivate}
        canEdit={canEdit}
        canDelete={canDelete}
      />
      <StorageLocationForm
        open={dialogOpen === 'edit'}
        onClose={handleDialogClose}
        onSubmit={handleSubmit}
        initialValues={storageLocationData}
        editIndex={editIndex}
        loading={loading}
        locationNameTouched={locationNameTouched}
        resetForm={resetForm}
      />
      <ImportResultDialog
        open={showImportResultDialog}
        onClose={handleImportResultsClose}
        importResult={importResult}
        module="storagelocation"
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

export default StorageLocationPage;