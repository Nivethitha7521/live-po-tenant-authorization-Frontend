'use client';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '@/redux/store';
import {
  fetchPurchaseTaxes,
  updatePurchaseTax,
  addPurchaseTax,
  deactivatePurchaseTax,
  activatePurchaseTax,
  setTaxData,
  setEditIndex,
  setDialogOpen,
  setSnackbarOpen,
  setSnackbarMessage,
  setShowDeactivated,
  selectPurchaseTaxes,
  setSearchQuery,
  importPurchaseTaxes,
  exportPurchaseTaxes,
  selectImportStatus,
  selectExportStatus,
} from '../../../../features/yen-purchase/PurchaseMaster/purchaseTaxSlice';
import { Box, Snackbar } from '@mui/material';
import PurchaseTaxTable from '../../../../components/yen-purchase/purchasemaster/tax/purchaseTaxTable';
import PurchaseTaxActions from '../../../../components/yen-purchase/purchasemaster/tax/purchaseTaxActions';
import PurchaseTaxForm from '../../../../components/yen-purchase/purchasemaster/tax/purchaseTaxForm';
import { PurchaseTax } from '@/Models/purchasetax';

const initialTaxState: PurchaseTax = {
  purchasetaxId: '',
  purchasetaxName: '',
  purchasetaxPercentage: 0,
  status: 'active',
  randomId: '',
};

const PurchaseTaxPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const {
    items: purchaseTaxes,
    deactivatedItems,
    taxData,
    editIndex,
    dialogOpen,
    snackbarOpen,
    snackbarMessage,
    showDeactivated,
    searchQuery,
    importResult,
    showImportResultDialog,
  } = useSelector(selectPurchaseTaxes);
  const importStatus = useSelector(selectImportStatus);
  const exportStatus = useSelector(selectExportStatus);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    dispatch(fetchPurchaseTaxes());
  }, [dispatch]);

  const handleDialogOpen = () => {
    dispatch(setDialogOpen('edit'));
  };

  const handleDialogClose = () => {
    dispatch(setDialogOpen('none'));
    dispatch(setTaxData(initialTaxState));
    dispatch(setEditIndex(null));
  };

  const handleSubmit = (values: PurchaseTax, { setFieldError }: any) => {
    const allTaxes = [...purchaseTaxes, ...deactivatedItems];
    const isDuplicateName = allTaxes.some(
      (tax) =>
        tax.purchasetaxName.toLowerCase().replace(/\s+/g, '') ===
        values.purchasetaxName.toLowerCase().replace(/\s+/g, '') &&
        tax.purchasetaxId !== values.purchasetaxId,
    );
    const isDuplicatePercentage = allTaxes.some(
      (tax) =>
        tax.purchasetaxPercentage === values.purchasetaxPercentage &&
        tax.purchasetaxId !== values.purchasetaxId,
    );
    if (isDuplicateName) {
      setFieldError('purchasetaxName', 'Tax name already exists');
      return;
    }
    if (isDuplicatePercentage) {
      setFieldError('purchasetaxPercentage', 'This tax percentage is already assigned to another tax');
      return;
    }
    setLoading(true);
    if (taxData.purchasetaxId) {
      dispatch(updatePurchaseTax(values))
        .unwrap()
        .then(() => {
          dispatch(setSnackbarMessage('Purchase tax updated successfully'));
          dispatch(setSnackbarOpen(true));
          dispatch(fetchPurchaseTaxes());
          handleDialogClose();
        })
        .catch((err) => {
          dispatch(setSnackbarMessage(`Failed to update purchase tax: ${err.message}`));
          dispatch(setSnackbarOpen(true));
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      dispatch(addPurchaseTax(values))
        .unwrap()
        .then(() => {
          dispatch(setSnackbarMessage('Purchase tax added successfully'));
          dispatch(setSnackbarOpen(true));
          dispatch(fetchPurchaseTaxes());
          handleDialogClose();
        })
        .catch((error) => {
          dispatch(setSnackbarMessage(`Failed to add purchase tax: ${error.message}`));
          dispatch(setSnackbarOpen(true));
        })
        .finally(() => {
          setLoading(false);
        });
    }
  };

  const handleEdit = (id: string) => {
    const tax = purchaseTaxes.find((tax) => tax.purchasetaxId === id);
    if (tax) {
      dispatch(setTaxData(tax));
      dispatch(setEditIndex(purchaseTaxes.indexOf(tax)));
    }
    handleDialogOpen();
  };

  const handleDeactivate = (purchasetaxId: string) => {
    dispatch(deactivatePurchaseTax(purchasetaxId))
      .unwrap()
      .then(() => {
        dispatch(setSnackbarMessage('Purchase tax deactivated successfully'));
        dispatch(setSnackbarOpen(true));
        dispatch(fetchPurchaseTaxes());
      })
      .catch((error) => {
        dispatch(setSnackbarMessage(`Failed to deactivate purchase tax: ${error.message}`));
        dispatch(setSnackbarOpen(true));
      });
  };

  const handleActivate = (purchasetaxId: string) => {
    dispatch(activatePurchaseTax(purchasetaxId))
      .unwrap()
      .then(() => {
        dispatch(setSnackbarMessage('Purchase tax activated successfully'));
        dispatch(setSnackbarOpen(true));
        dispatch(fetchPurchaseTaxes());
      })
      .catch((error) => {
        dispatch(setSnackbarMessage(`Failed to activate purchase tax: ${error.message}`));
        dispatch(setSnackbarOpen(true));
      });
  };

  const toggleShowDeactivated = () => {
    dispatch(setShowDeactivated(!showDeactivated));
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setSearchQuery(e.target.value));
  };

  return (
    <Box>
      <PurchaseTaxActions
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onDialogOpen={handleDialogOpen}
        showDeactivated={showDeactivated}
        onToggleShowDeactivated={toggleShowDeactivated}
      />
      <PurchaseTaxTable
        purchaseTaxes={showDeactivated ? deactivatedItems : purchaseTaxes}
        showDeactivated={showDeactivated}
        searchQuery={searchQuery}
        handleEdit={handleEdit}
        handleDeactivate={handleDeactivate}
        handleActivate={handleActivate}
      />
      <PurchaseTaxForm
        open={dialogOpen === 'edit'}
        onClose={handleDialogClose}
        onSubmit={handleSubmit}
        initialValues={taxData}
        editIndex={editIndex}
        loading={loading}
      />
  
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => dispatch(setSnackbarOpen(false))}
        message={snackbarMessage}
      />
    </Box>
  );
};

export default PurchaseTaxPage;