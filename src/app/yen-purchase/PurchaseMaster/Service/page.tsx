'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/redux/store';
import {
  fetchServiceItems,
  updateServiceItem,
  addServiceItem,
  deactivateServiceItem,
  activateServiceItem,
  setServiceData,
  setEditIndex,
  setDialogOpen,
  selectServiceItems,
  setSearchQuery,
  setSnackbarMessage,
  setSnackbarOpen,
  resetImportState,
  importCSV,
  exportCSV,
  setShowImportResultDialog,
  setCurrentPage,
} from '../Service/Features/ServiceSlice';
import { Box, Snackbar, Backdrop, CircularProgress, Typography } from '@mui/material';
import ServiceActions from '../Service/Components/ServiceActions';
import ServiceForm from '../Service/Components/ServiceForm';
import ServiceTable from '../Service/Components/ServiceTable';
import CommonImportResultDialog from '@/components/yen-purchase/CommonImportDialog';
import { FormikHelpers } from 'formik';
import { Service } from './Models/Service';

type FormValues = {
  serviceName: string;
  saccode?: number;
};

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

const initialServiceState: Service = {
  mongoId:'',
  serviceId:'',
  serviceName: '',
  saccode: 0,
  status: 'active',
};

const ServicePage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const {
    displayItems,
    serviceData,
    editIndex,
    dialogOpen,
    currentViewStatus,
    searchQuery,
    importing,
    exporting,
    importSuccess,
    importResult,
    showImportResultDialog,
    snackbarOpen,
    snackbarMessage,
    currentPage,
    pageSize,
    loading,
  } = useSelector(selectServiceItems);

  const showDeactivated = currentViewStatus === 'deactivated';

  // Local state for immediate input
  const [inputSearch, setInputSearch] = useState(searchQuery || '');

  // Debounced search
  const debouncedSearch = useDebounce(
    useMemo(() => inputSearch.trim().replace(/\s+/g, ' '), [inputSearch]),
    500
  );

  useEffect(() => {
    dispatch(fetchServiceItems({ page: 1, limit: 50, status: 'active', search: '' }));
  }, [dispatch]);

  useEffect(() => {
    if (importSuccess) {
      dispatch(fetchServiceItems({ 
        page: currentPage, 
        limit: pageSize, 
        status: currentViewStatus, 
        search: searchQuery || '' 
      }));
    }
  }, [importSuccess, dispatch, currentPage, pageSize, currentViewStatus, searchQuery]);

  // Update Redux searchQuery when debounced value changes
  useEffect(() => {
    const normalizedSearch = debouncedSearch.trim().replace(/\s+/g, ' ');
    if (normalizedSearch !== searchQuery) {
      dispatch(setSearchQuery(normalizedSearch));
      dispatch(setCurrentPage(1));
      dispatch(fetchServiceItems({ 
        page: 1, 
        limit: pageSize, 
        status: currentViewStatus, 
        search: normalizedSearch 
      }));
    }
  }, [debouncedSearch, dispatch, pageSize, currentViewStatus, searchQuery]);

  const handleSearchChange = (value: string) => {
    setInputSearch(value);
  };

  const toggleShowDeactivated = () => {
    const newStatus = showDeactivated ? 'active' : 'deactivated';
    dispatch(setCurrentPage(1));
    dispatch(fetchServiceItems({ 
      page: 1, 
      limit: pageSize, 
      status: newStatus, 
      search: searchQuery || '' 
    }));
  };

  const handleDialogOpen = () => {
    dispatch(setDialogOpen('edit'));
  };

  const handleDialogClose = () => {
    dispatch(setDialogOpen('none'));
    dispatch(setServiceData(initialServiceState));
    dispatch(setEditIndex(null));
  };

  const handleExportCSV = () => {
    dispatch(exportCSV());
  };

  const handleSampleCSV = () => {
    const sampleHeader = 'Service,SAC Code';
    const sampleRows = 'Sample Service 1';
    const csvContent = `${sampleHeader}${sampleRows}`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_services.csv';
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

  const handleAddUpdateService = async (
    values: FormValues,
    { setFieldError }: FormikHelpers<FormValues>
  ): Promise<void> => {
    const normalizedName = values.serviceName.trim().replace(/\s+/g, ' ');
    if (!normalizedName) {
      setFieldError('serviceName', 'Service name cannot be empty');
      throw new Error('Service name cannot be empty');
    }
    try {
      let result;
      if (editIndex !== null && serviceData) {
        const payload: Service = { 
          ...serviceData, 
          serviceName: normalizedName,
          saccode: values.saccode ?? serviceData.saccode 
        };
        result = await dispatch(updateServiceItem(payload)).unwrap();
        dispatch(setSnackbarMessage('Service updated successfully'));
      } else {
        const payload: Service = { 
          serviceName: normalizedName, 
          status: 'active' as const,
          saccode: values.saccode ?? null
        };
        result = await dispatch(addServiceItem(payload)).unwrap();
        dispatch(setSnackbarMessage('Service added successfully'));
      }
      dispatch(setSnackbarOpen(true));
      dispatch(fetchServiceItems({ 
        page: currentPage, 
        limit: pageSize, 
        status: currentViewStatus, 
        search: searchQuery || '' 
      }));
      handleDialogClose();
    } catch (error: any) {
      let fieldMsg = `Failed to ${editIndex !== null ? 'update' : 'add'} service: ${error.message || error}`;
      let snackMsg = fieldMsg;
      if ((error.message || error).includes('already exists')) {
        fieldMsg = 'Service name already exists (case-insensitive, spaces normalized)';
        snackMsg = fieldMsg;
      }
      setFieldError('serviceName', fieldMsg);
      dispatch(setSnackbarMessage(snackMsg));
      dispatch(setSnackbarOpen(true));
      throw new Error(error.message || error);
    }
  };

  const handleEditService = (mongoId: string) => {
    const item = displayItems.find((service) => service.mongoId === mongoId);
    if (item) {
      dispatch(
        setServiceData({
          ...item,
          serviceName: item.serviceName ? item.serviceName.trim().replace(/\s+/g, ' ') : '',
        })
      );
      dispatch(setEditIndex(0));
      dispatch(setDialogOpen('edit'));
    }
  };

  const handleDeactivateService = (mongoId: string) => {
    dispatch(deactivateServiceItem(mongoId))
      .unwrap()
      .then(() => {
        dispatch(setSnackbarMessage('Service deactivated successfully'));
        dispatch(setSnackbarOpen(true));
        dispatch(fetchServiceItems({ 
          page: currentPage, 
          limit: pageSize, 
          status: currentViewStatus, 
          search: searchQuery || '' 
        }));
      })
      .catch((error) => {
        dispatch(setSnackbarMessage(`Failed to deactivate service: ${error.message}`));
        dispatch(setSnackbarOpen(true));
      });
  };

  const handleActivateService = (mongoId: string) => {
    dispatch(activateServiceItem(mongoId))
      .unwrap()
      .then(() => {
        dispatch(setSnackbarMessage('Service activated successfully'));
        dispatch(setSnackbarOpen(true));
        dispatch(fetchServiceItems({ 
          page: currentPage, 
          limit: pageSize, 
          status: currentViewStatus, 
          search: searchQuery || '' 
        }));
      })
      .catch((error) => {
        dispatch(setSnackbarMessage(`Failed to activate service: ${error.message}`));
        dispatch(setSnackbarOpen(true));
      });
  };

  const defaultInitialValues: Service = {
    ...initialServiceState,
    serviceName: serviceData?.serviceName || '',
    saccode: serviceData?.saccode || 0,
  };

  return (
    <Box>
      <ServiceActions
        searchQuery={inputSearch}
        onSearchChange={(e) => handleSearchChange(e.target.value || '')}
        onDialogOpen={handleDialogOpen}
        onSampleCSV={handleSampleCSV}
        onImportCSV={handleImportCSV}
        onExportCSV={handleExportCSV}
        showDeactivated={showDeactivated}
        onToggleShowDeactivated={toggleShowDeactivated}
        importing={importing}
        exporting={exporting}
      />
      <ServiceTable
        handleEdit={handleEditService}
        handleDeactivate={handleDeactivateService}
        handleActivate={handleActivateService}
      />
      <ServiceForm
        open={dialogOpen !== 'none'}
        onClose={handleDialogClose}
        onSubmit={handleAddUpdateService}
        initialValues={defaultInitialValues}
        editIndex={editIndex}
        loading={importing || exporting}
      />
      <CommonImportResultDialog
        open={showImportResultDialog}
        onClose={handleImportResultsClose}
        importResult={importResult}
        module="service"
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

export default ServicePage;