'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Backdrop, Box, CircularProgress, Snackbar, Typography } from '@mui/material';
import { AppDispatch } from '@/redux/store';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchVendorTypeItems,
  updateVendorTypeItem,
  addVendorTypeItem,
  deactivateVendorTypeItem,
  activateVendorTypeItem,
  setVendorTypeData,
  setEditIndex,
  setDialogOpen,
  setSnackbarOpen,
  setSnackbarMessage,
  setShowDeactivated,
  selectVendorTypeItems,
  setSearchQuery,
} from '../../../../features/yen-purchase/PurchaseMaster/VendorTypeSlice';
import VendorToolbar from '../../../../components/yen-purchase/vendorcomponent/vendortypecomponent/vendorToolbar';
import VendorTable from '../../../../components/yen-purchase/vendorcomponent/vendortypecomponent/vendorTable';
import VendorTypeDialog from '../../../../components/yen-purchase/vendorcomponent/vendortypecomponent/vendortypedialog';
import MenuPage from '../page';

interface VendorType {
  vendortypeId: string;
  vendorType: string;
  status: string;
  randomId: string;
}

const initialVendorTypeState: VendorType = {
  vendortypeId: '',
  vendorType: '',
  status: 'active',
  randomId: '',
};

const VendorType: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const {
    vendoritems: vendorTypes,
    deactivatedItems,
    vendorTypeData,
    editIndex,
    dialogOpen,
    snackbarOpen,
    snackbarMessage,
    showDeactivated,
    searchQuery,
  } = useSelector(selectVendorTypeItems);
  const [loading, setLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [error, setError] = useState({ vendorType: '' });
  const abortController = useRef(new AbortController());

useEffect(() => {
  const controller = abortController.current; // Copy ref to a local variable
  dispatch(fetchVendorTypeItems({ signal: controller.signal })).catch(() => {
    // Ignore errors (e.g., AbortError) for simplicity
  });

  return () => {
    controller.abort(); // Use the copied variable in cleanup
  };
}, [dispatch]);
  const normalizeVendorType = (vendorType: string): string => {
    return vendorType.trim().replace(/\s+/g, '').toLowerCase();
  };

  const normalizeInput = (vendorType: string): string => {
    return vendorType.trimStart().replace(/\s+/g, ' ');
  };

  const hasLeadingSpaces = (value: string): boolean => {
    return value.startsWith(' ');
  };

  const handleDialogClose = () => {
    dispatch(setDialogOpen('none'));
    dispatch(setVendorTypeData(initialVendorTypeState));
    dispatch(setEditIndex(null));
    setError({ vendorType: '' });
  };

  const handleSubmit = async () => {
    const trimmedVendorType = vendorTypeData.vendorType.trim();
    if (trimmedVendorType === '') {
      setError({ vendorType: 'Vendor Type is required' });
      return;
    }
    if (trimmedVendorType.length < 3) {
      setError({ vendorType: 'Vendor Type must be at least 3 characters' });
      return;
    }
    if (hasLeadingSpaces(vendorTypeData.vendorType)) {
      setError({ vendorType: 'Leading spaces are not allowed' });
      return;
    }

    const sanitizedVendorType = normalizeInput(trimmedVendorType);
    const normalizedInput = normalizeVendorType(sanitizedVendorType);
    const isDuplicate = [...vendorTypes, ...deactivatedItems].some(
      (type: VendorType) =>
        type.vendortypeId !== vendorTypeData.vendortypeId &&
        normalizeVendorType(type.vendorType) === normalizedInput
    );
    if (isDuplicate) {
      setError({ vendorType: `Vendor type '${sanitizedVendorType}' already exists` });
      dispatch(setSnackbarMessage(`Vendor type '${sanitizedVendorType}' already exists`));
      dispatch(setSnackbarOpen(true));
      return;
    }

    setLoading(true);
    const updatedVendorTypeData = {
      ...vendorTypeData,
      vendorType: sanitizedVendorType,
    };

    try {
      if (vendorTypeData.vendortypeId) {
        await dispatch(
          updateVendorTypeItem({
            vendortypeId: vendorTypeData.vendortypeId,
            vendortype: updatedVendorTypeData,
            signal: abortController.current.signal,
          })
        ).unwrap();
        dispatch(setSnackbarMessage('Vendor type updated successfully'));
        dispatch(setSnackbarOpen(true));
        dispatch(fetchVendorTypeItems({ signal: abortController.current.signal }));
        handleDialogClose();
      } else {
        await dispatch(
          addVendorTypeItem({ data: updatedVendorTypeData, signal: abortController.current.signal })
        ).unwrap();
        dispatch(setSnackbarMessage('Vendor type added successfully'));
        dispatch(setSnackbarOpen(true));
        dispatch(fetchVendorTypeItems({ signal: abortController.current.signal }));
        handleDialogClose();
      }
    } catch (error: any) {
      if (error !== 'Request canceled') {
        setError({ vendorType: `Failed to ${vendorTypeData.vendortypeId ? 'update' : 'add'}: ${error}` });
        dispatch(setSnackbarMessage(`Failed to ${vendorTypeData.vendortypeId ? 'update' : 'add'} vendor type: ${error}`));
        dispatch(setSnackbarOpen(true));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (vendortypeId: string) => {
    const vendorType = vendorTypes.find((type) => type.vendortypeId === vendortypeId);
    if (vendorType) {
      dispatch(setVendorTypeData(vendorType));
      dispatch(setDialogOpen('edit'));
      setError({ vendorType: '' });
    }
  };

  const handleDeactivate = async (vendortypeId: string) => {
    try {
      await dispatch(
        deactivateVendorTypeItem({ vendortypeId, signal: abortController.current.signal })
      ).unwrap();
      dispatch(setSnackbarMessage('Vendor type deactivated successfully'));
      dispatch(setSnackbarOpen(true));
      dispatch(fetchVendorTypeItems({ signal: abortController.current.signal }));
    } catch (error: any) {
      if (error !== 'Request canceled') {
        dispatch(setSnackbarMessage(`Failed to deactivate vendor type: ${error}`));
        dispatch(setSnackbarOpen(true));
      }
    }
  };

  const handleActivate = async (vendortypeId: string) => {
    try {
      await dispatch(
        activateVendorTypeItem({ vendortypeId, signal: abortController.current.signal })
      ).unwrap();
      dispatch(setSnackbarMessage('Vendor type activated successfully'));
      dispatch(setSnackbarOpen(true));
      dispatch(fetchVendorTypeItems({ signal: abortController.current.signal }));
    } catch (error: any) {
      if (error !== 'Request canceled') {
        dispatch(setSnackbarMessage(`Failed to activate vendor type: ${error}`));
        dispatch(setSnackbarOpen(true));
      }
    }
  };

  const toggleShowDeactivated = () => {
    dispatch(setShowDeactivated(!showDeactivated));
  };

  const handleSearchChange = (query: string) => {
    dispatch(setSearchQuery(query));
  };

  const handleAddClick = () => {
    dispatch(setVendorTypeData(initialVendorTypeState));
    dispatch(setEditIndex(null));
    dispatch(setDialogOpen('add'));
  };

  const filteredVendorTypes = showDeactivated
    ? deactivatedItems.slice().reverse()
    : vendorTypes
        .filter((item) => item.vendorType.toLowerCase().includes(searchQuery.toLowerCase()))
        .reverse();

  return (
    <Box mx={1}>
      <MenuPage />
      <VendorToolbar
        searchQuery={searchQuery}
        showDeactivated={showDeactivated}
        onSearch={handleSearchChange}
        onAdd={handleAddClick}
        onToggleDeactivated={toggleShowDeactivated}
      />
      <VendorTable
        vendorTypes={filteredVendorTypes}
        onEdit={handleEdit}
        onDeactivate={handleDeactivate}
        onActivate={handleActivate}
      />
      <VendorTypeDialog
        handleSubmit={handleSubmit}
        loading={loading}
        error={error}
        existingVendorTypes={[...vendorTypes, ...deactivatedItems].map((item) => item.vendorType)}
      />
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => dispatch(setSnackbarOpen(false))}
        message={snackbarMessage}
      />
      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={importLoading}
      >
        <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
          <CircularProgress color="inherit" />
          <Typography>Import is in progress, please wait...</Typography>
        </Box>
      </Backdrop>
    </Box>
  );
};

export default VendorType;