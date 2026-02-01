
'use client';
import React, { useState, useEffect, memo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Box, Snackbar, Alert } from '@mui/material';
import { AppDispatch } from '../../../../redux/store';
import {
  fetchVendors, fetchVendorTypeItems, setSnackbarOpen, fetchVendorAll, selectCurrentPage,
  selectPageSize, selectTotalVendors, setPagination, selectVendorItems,
} from '../../../../features/yen-purchase/PurchaseMaster/vendorSlice';
import { fetchBank } from '@/features/yen-purchase/Outgoing/outgoingPaymentSlice';
import MenuPage from '../page';
import VendorToolbar from '../../../../components/yen-purchase/vendorcomponent/vendorToolbar';
import VendorPagination from '../../../../components/yen-purchase/vendorcomponent/vendorPagination';
import VendorTable from '../../../../components/yen-purchase/vendorcomponent/vendorTable';
import VendorDialog from '../../../../components/yen-purchase/vendorcomponent/vendorDialog';
import VendorDeactivateDialog from '../../../../components/yen-purchase/vendorcomponent/vendorDeactivate';
import VendorActivateDialog from '@/components/yen-purchase/vendorcomponent/vendorActivate';
import { usePermissions } from '../../../../hooks/usePermissions'; 
const Vendor = memo(() => {
  const dispatch = useDispatch<AppDispatch>();
  const { hasPermission, isModuleVisible } = usePermissions(); 
  const canAdd = hasPermission('yenerp', 'vendors', 'add');
  const canEdit = hasPermission('yenerp', 'vendors', 'edit');
  const canDelete = hasPermission('yenerp', 'vendors', 'delete');
  const canImport = hasPermission('yenerp', 'vendors', 'import');
  const canExport = hasPermission('yenerp', 'vendors', 'export');
  // ✅ MODULE VISIBILITY CHECK
if (!isModuleVisible("yenerp", "vendors")) {
  return null;
  // or show message:
  // return (
  //   <Box p={3}>
  //     <Alert severity="error">You do not have access to Vendors module.</Alert>
  //   </Box>
  // );
}


  console.log('🎯 Vendor Action Permissions:', { canAdd, canEdit, canDelete, canImport, canExport });
  const {
    items, deactivatedItems, dialogOpen, vendorTypeItems,
    showDeactivated, snackbarMessage, snackbarOpen, exportStatus,
    itemToActivate, itemToDeactivate, activateDialogOpen, deactivateDialogOpen,selectedHeaders
  } = useSelector(selectVendorItems);
  const currentPage = useSelector(selectCurrentPage);
  const pageSize = useSelector(selectPageSize);
  const totalVendors = useSelector(selectTotalVendors);

  const [loading, setLoading] = useState(false);
  const [searchInputValue, setSearchInputValue] = useState('');
  const [vendorName, setVendorName] = useState('');
  

  useEffect(() => {
    dispatch(fetchVendorTypeItems());
    dispatch(fetchBank());
  }, [dispatch]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        await dispatch(fetchVendorAll({ page: currentPage, size: pageSize }));
        setLoading(false);
      } catch (error) {
        setLoading(false);
        dispatch(setSnackbarOpen(true));
      }
    };
    fetchData();
  }, [dispatch, currentPage, pageSize]);

  const handlePageChange = (newPage: number) => {
    const maxPage = Math.ceil(totalVendors / pageSize);
    if (newPage < 1 || newPage > maxPage) return;
    dispatch(setPagination({ page: newPage, size: pageSize }));
    dispatch(fetchVendorAll({
      page: newPage,
      size: pageSize,
      vendorName: vendorName.trim() !== '' ? vendorName : undefined
    }));
  };

  const handleSearch = () => {
    setVendorName(searchInputValue);
    dispatch(setPagination({ page: 1, size: pageSize }));
    dispatch(fetchVendorAll({
      page: 1,
      size: pageSize,
      vendorName: searchInputValue.trim() !== '' ? searchInputValue : undefined
    }));
  };

  return (
    <Box>
      <MenuPage />
      <Box sx={{ px: 2 }}>
        <VendorToolbar
          searchInputValue={searchInputValue}
          setSearchInputValue={setSearchInputValue}
          handleSearch={handleSearch}
          showDeactivated={showDeactivated}
          loading={loading}
          exportStatus={exportStatus}
          selectedHeaders={selectedHeaders} // Pass selectedHeaders
          canAdd={canAdd} 
          canImport={canImport}
          canExport={canExport} 
        />
        <VendorTable
          items={items}
          deactivatedItems={deactivatedItems}
          showDeactivated={showDeactivated}
          loading={loading}
          currentPage={currentPage}
          pageSize={pageSize}
          canEdit={canEdit} 
          canDelete={canDelete} 
        />
        <VendorPagination
          currentPage={currentPage}
          totalVendors={totalVendors}
          pageSize={pageSize}
          handlePageChange={handlePageChange}
        />
        <VendorDialog loading={loading} setLoading={setLoading} />
        <VendorDeactivateDialog canDelete={canDelete}/>
        <VendorActivateDialog canDelete={canDelete} />
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={6000}
          onClose={() => dispatch(setSnackbarOpen(false))}
          message={snackbarMessage}
        >
        </Snackbar>
      </Box>
    </Box>
  );
});
Vendor.displayName = 'Vendor';
export default Vendor;