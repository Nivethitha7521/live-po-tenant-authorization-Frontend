'use client';
import React, { useState, useEffect } from 'react';
import { setLoading } from '@/features/yen-purchase/GRN/grnSlice';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Alert,
} from '@mui/material';
import { AppDispatch, RootState } from '../../../redux/store';
import {
  fetchPurchaseItems,
  addPurchaseItem,
  updatePurchaseItem,
  deactivatePurchaseItem,
  activatePurchaseItem,
  selectPurchaseItems,
  fetchPurchaseGroupItems,
  fetchAllVendors,
  fetchPurchaseTaxes,
  fetchStorageLocationItems,
  fetchUom,
  fetchPurchaseItemtype,
  setActivateDialogOpen,
  setDeactivateDialogOpen,
  setDialogOpen,
  setEditIndex,
  setItemData,
  setItemToActivate,
  setItemToDeactivate,
  setShowDeactivated,
  setSnackbarMessage,
  setSnackbarOpen,
  selectCurrentPage,
  selectPageSize,
  selectTotalItems,
  setPagination,
  setFilters,
  clearFilters,
  exportPurchaseItemsToCSV,
  importPurchaseItems,
  exportPurchaseItems,
} from '../../../features/yen-purchase/PurchaseMaster/purchaseItemSlice';

// ✅ NEW: import fetchCategories from PurchaseCategorySlice
import { fetchCategories } from '../../../features/yen-purchase/PurchaseMaster/PurchaseCategorySlice';

import * as yup from 'yup';
import YenPurchasePage from '../page';
import PurchasePagination from '../../../components/yen-purchase/purchaseitem/purchaseItempagination';
import PurchaseTable from '../../../components/yen-purchase/purchaseitem/purchaseitemTable';
import PurchaseItemForm from '../../../components/yen-purchase/purchaseitem/purchaseitemForm';
import { exportCsv } from '@/utilities/csvUtils';
import ImportErrorDialog from '../../../components/yen-purchase/purchaseitem/importErrorDialog';
import PurchaseControls from '@/components/yen-purchase/purchaseitem/purchaseitemControlers';
import { ImportResponse } from '@/Models/purchaseitem';
import { usePermissions } from '@/hooks/usePermissions';

const validationSchema = yup.object({
  itemName: yup.string().required('Item Name is required'),
  purchasecategoryName: yup.string().required('Category is required'),
  itemgroupName: yup.string().required('Item Group is required'),
  purchasePrice: yup
    .number()
    .typeError('Purchase price must be a number')
    .required('Purchase price is required')
    .moreThan(0, 'Purchase price must be greater than 0'),
  uom: yup.string().required('UOM is required'),
  purchasetaxName: yup.number().required('Tax required'),
  purchasesubcategoryName: yup.string().required('Subcategory is required'),
});

const initialPurchaseState = {
  purchaseitemId: '',
  itemName: '',
  randomId: '',
  purchasecategoryName: '',
  purchasesubcategoryName: '',
  itemgroupName: '',
  uom: '',
  stockQuantity: 0,
  supplier: '',
  purchasePrice: 0,
  purchasetaxName: '',
  reorderLevel: 0,
  itemType: '',
  hsnCode: '',
  shelfLife: '',
  vendorTag: [],
  locationName: '',
  barcode: '',
  description: '',
  status: '',
  createdDate: null as any,
  lastUpdatedDate: null as any,
};

const PurchasePage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { hasPermission, isModuleVisible } = usePermissions();
const [permissionLoading, setPermissionLoading] = useState(true);

  // ✅ FIX: Store permissions in state to prevent re-renders
  const [permissionState, setPermissionState] = useState({
    canAdd: false,
    canEdit: false,
    canDelete: false,
    moduleVisible: false
  });

  // ✅ FIX: Check permissions once on mount
  useEffect(() => {
    const moduleVisible = isModuleVisible('yenerp', 'purchaseitem');
    const canAdd = hasPermission('yenerp', 'purchaseitem', 'add');
    const canEdit = hasPermission('yenerp', 'purchaseitem', 'edit');
    const canDelete = hasPermission('yenerp', 'purchaseitem', 'delete');

    console.log('🎯 Purchase Item Action Permissions:', { canAdd, canEdit, canDelete });
    console.log('👁️ Module Visible:', moduleVisible);

    setPermissionState({
      canAdd,
      canEdit,
      canDelete,
      moduleVisible
    }); setPermissionLoading(false);
  }, []); // ✅ Empty dependency array - runs only once

  const { canAdd, canEdit, canDelete, moduleVisible } = permissionState;

  

  const {
    items,
    deactivatedItems,
    
    showDeactivated,
    snackbarMessage,
    snackbarOpen,
    loading,
    categories,
    uoms,
    groupitems,
    taxes,
    locations,
    vendors,
    itemtypes,
    
    itemToActivate,
    itemToDeactivate,
    dialogOpen,
    deactivateDialogOpen,
    activateDialogOpen,
    editIndex,
    
    filters,
  } = useSelector(selectPurchaseItems);

  const currentPage = useSelector(selectCurrentPage);
  const pageSize = useSelector(selectPageSize);
  const totalItems = useSelector(selectTotalItems);
  const newPage = useSelector(selectCurrentPage); 

  const [importResults, setImportResults] = useState<{
    successful: Array<{ row: number; data: Record<string, string> }>;
    updated: Array<{ row: number; data: Record<string, string>; error?: string }>;
    failed: Array<{ row: number; data: Record<string, string>; error: string; missingFields: string[] }>;
  }>({
    successful: [],
    updated: [],
    failed: [],
  });

  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'succeeded' | 'failed'>('idle');
 
  // 🔄 MASTER DATA – now using fetchCategories (NOT fetchPurchaseCategories)
    // ✅ FIX: Master Data - Run only when module becomes visible
  useEffect(() => {
    if (!moduleVisible) return;
    
    dispatch(fetchPurchaseGroupItems());
    dispatch(fetchPurchaseTaxes());
    dispatch(fetchStorageLocationItems());
    dispatch(fetchUom());
    dispatch(fetchCategories());
    dispatch(fetchPurchaseItemtype());
    dispatch(fetchAllVendors());
  }, [dispatch, moduleVisible]);

  // ITEMS
 // ITEMS
// purchaseitem/page.tsx - ITEMS useEffect-// ✅ FIX: ITEMS useEffect - Remove hasPermission/isModuleVisible from dependencies
useEffect(() => {
  if (!moduleVisible) return;
  
  dispatch(
    fetchPurchaseItems({
      page: currentPage,
      size: pageSize,
      showDeactivated: showDeactivated,
      ...filters,
    })
  );
}, [dispatch, currentPage, pageSize, showDeactivated, moduleVisible]); 
// ✅ Removed: hasPermission, isModuleVisible, filters // Add showDeactivated to dependencies
  // ✅ FIX: Sync local state with Redux filters (ONE WAY)
  useEffect(() => {
    // Prevent infinite loop by checking if values are different
    if (filters.itemName !== itemName) {
      setItemName(filters.itemName || '');
    }
    if (filters.purchasecategoryName !== category) {
      setCategory(filters.purchasecategoryName || '');
    }
    if (filters.purchasesubcategoryName !== subcategory) {
      setSubcategory(filters.purchasesubcategoryName || '');
    }
  }, [filters]);

  const handleFilter = () => {
    const newFilters = {
      itemName,
      purchasecategoryName: category,
      purchasesubcategoryName: subcategory,
    };
    dispatch(setFilters(newFilters));
    dispatch(setPagination({ page: 1, size: pageSize }));
    dispatch(
      fetchPurchaseItems({
        page: 1,
        size: pageSize,
        ...newFilters,
      })
    );
  };

    const handleClearFilters = () => {
    setItemName('');
    setCategory('');
    setSubcategory('');
    dispatch(clearFilters());
    dispatch(setPagination({ page: 1, size: pageSize }));
    dispatch(
      fetchPurchaseItems({
        page: 1,
        size: pageSize,
        showDeactivated: showDeactivated, // Add this
      })
    );
  };

  const handlePageChange = (newPageVal: number) => {
    const maxPage = Math.ceil(totalItems / pageSize);
    if (newPageVal < 1 || newPageVal > maxPage) return;

    const currentFilters = {
      ...(filters.itemName && { itemName: filters.itemName }),
      ...(filters.purchasecategoryName && { purchasecategoryName: filters.purchasecategoryName }),
      ...(filters.purchasesubcategoryName && { purchasesubcategoryName: filters.purchasesubcategoryName }),
    };

    dispatch(setPagination({ page: newPageVal, size: pageSize }));
    dispatch(
      fetchPurchaseItems({
        page: newPageVal,
        size: pageSize,
        ...currentFilters,
      })
    );
  };

  const handleDialogOpen = () => dispatch(setDialogOpen('edit'));
  const handleDialogClose = () => {
    dispatch(setDialogOpen('none'));
    dispatch(setItemData(initialPurchaseState as any));
    dispatch(setEditIndex(null));
  };

  const handleEdit = (index: number) => {
    if (canEdit) {
      dispatch(setEditIndex(index));
      const itemToEdit = { ...items[index] };
      dispatch(setItemData(itemToEdit));
      handleDialogOpen();
    }
  };

  const handleDeactivateClick = (item: any) => {
    if (canDelete) {
      dispatch(setItemToDeactivate(item));
      dispatch(setDeactivateDialogOpen(true));
    }
  };

  const handleActivateClick = (item: any) => {
    if (canDelete) {
      dispatch(setItemToActivate(item));
      dispatch(setActivateDialogOpen(true));
    }
  };

  // Update your handleConfirmDeactivate function with detailed logging
const handleConfirmDeactivate = async () => {
  try {
    if (itemToDeactivate) {
      console.log('🔴 Starting deactivation process...');
      console.log('📋 Item to deactivate:', itemToDeactivate);
      console.log('🔄 Current active items before:', items);
      console.log('🔄 Current deactivated items before:', deactivatedItems);

      await dispatch(deactivatePurchaseItem(itemToDeactivate.purchaseitemId)).unwrap();
      
      console.log('✅ Deactivation API call completed');
      console.log('🔄 Current active items after:', items);
      console.log('🔄 Current deactivated items after:', deactivatedItems);

      dispatch(setSnackbarMessage('Purchase item deactivated successfully'));
      dispatch(setSnackbarOpen(true));
      dispatch(setDeactivateDialogOpen(false));

      // Force refresh the data
      console.log('🔄 Refreshing data after deactivation...');
      dispatch(fetchPurchaseItems({ page: currentPage, size: pageSize }));
    }
  } catch (error: any) {
    console.error('❌ Deactivation error:', error);
    dispatch(setSnackbarMessage(`Failed to deactivate purchase item: ${error.message}`));
    dispatch(setSnackbarOpen(true));
  }
};
  const handleConfirmActivate = async () => {
    try {
      if (itemToActivate) {
        await dispatch(activatePurchaseItem(itemToActivate.purchaseitemId)).unwrap();
        dispatch(setSnackbarMessage('Purchase item activated successfully'));
        dispatch(setSnackbarOpen(true));
        dispatch(setActivateDialogOpen(false));
      }
    } catch (error: any) {
      dispatch(setSnackbarMessage(`Failed to activate purchase item: ${error.message}`));
      dispatch(setSnackbarOpen(true));
    }
  };

  const handleImportCSV = async (file: File, mode: 'merge' | 'replace' | 'rollback') => {
    try {
      setLoading(true);
      const resultAction = await dispatch(importPurchaseItems({ file, mode }));

      if (importPurchaseItems.fulfilled.match(resultAction)) {
        const result = resultAction.payload as ImportResponse;
        setImportResults({
          successful: result.successful || [],
          updated: result.updated || [],
          failed: result.failed || [],
        });
        setErrorDialogOpen(true);
        dispatch(
          setSnackbarMessage(
            `Imported ${result.inserted_count || 0} items, updated ${result.updated_count || 0}`
          )
        );
        dispatch(fetchPurchaseItems({ page: currentPage, size: pageSize }));
      } else if (importPurchaseItems.rejected.match(resultAction)) {
        const errorPayload = resultAction.payload as any;
        const importResults = {
          successful: errorPayload?.successful || [],
          updated: errorPayload?.updated || [],
          failed: errorPayload?.failed || [],
        };

        if (errorPayload?.detail?.missing?.length > 0) {
          importResults.failed = [
            {
              row: 0,
              data: {},
              error: 'Missing required columns in CSV file',
              missingFields: errorPayload.detail.missing,
            },
          ];
        }

        setImportResults(importResults);
        setErrorDialogOpen(true);
        dispatch(
          setSnackbarMessage(
            errorPayload?.message || 'Import failed. Please check your file and try again.'
          )
        );
      }
    } catch (error: any) {
      dispatch(
        setSnackbarMessage(`Import error: ${error.message || 'Unknown error occurred'}`)
      );
    } finally {
      setLoading(false);
      dispatch(setSnackbarOpen(true));
    }
  };

  const handleExportCSV = () => {
    setExportStatus('loading');
    dispatch(exportPurchaseItems())
      .unwrap()
      .then(() => {
        setExportStatus('succeeded');
        dispatch(setSnackbarMessage('Export successful'));
        dispatch(setSnackbarOpen(true));
      })
      .catch(() => {
        setExportStatus('failed');
        dispatch(setSnackbarMessage('Export Failed'));
        dispatch(setSnackbarOpen(true));
      });
  };

  const handleDownloadSampleCSV = () => {
    const headers = [
      { label: 'Item Code (Required)', key: 'itemCode' },
      { label: 'Item Name (Required)', key: 'itemName' },
      { label: 'Category (Required)', key: 'purchasecategoryName' },
      { label: 'Subcategory (Required)', key: 'purchasesubcategoryName' },
      { label: 'Item Group (Required)', key: 'itemgroupName' },
      { label: 'UOM (Required)', key: 'uom' },
      { label: 'Stock Quantity (Required)', key: 'stockQuantity' },
      { label: 'Supplier (Required)', key: 'supplier' },
      { label: 'Purchase Price (Required)', key: 'purchasePrice' },
      { label: 'Tax Percentage (Required)', key: 'purchasetaxName' },
      { label: 'Reorder Level (Required)', key: 'reorderLevel' },
      { label: 'Item Type (Required)', key: 'itemType' },
      { label: 'HSN Code (Required)', key: 'hsnCode' },
      { label: 'Shelf Life (Required)', key: 'shelfLife' },
      { label: 'Vendor Tag (Required)', key: 'vendorTag' },
      { label: 'Storage Location (Required)', key: 'locationName' },
      { label: 'Barcode (Required)', key: 'barcode' },
      { label: 'Description (Required)', key: 'description' },
    ];

    const sampleData = [
      {
        itemCode: '678',
        itemName: 'Sample Item',
        purchasecategoryName: 'Sample Category',
        purchasesubcategoryName: 'Sample Subcategory',
        itemgroupName: 'Sample Group',
        uom: 'pcs',
        stockQuantity: '100.00',
        supplier: 'Sample Supplier',
        purchasePrice: 100,
        purchasetaxName: '18',
        reorderLevel: 10,
        itemType: 'Sample Type',
        hsnCode: '123456',
        shelfLife: '1 year',
        vendorTag: 'Vendor1,Vendor2',
        locationName: 'Sample Location',
        barcode: '1234567890123',
        description: 'Sample Description',
      },
    ];

    exportCsv(sampleData, headers, 'sample_purchase_items.csv');
  };

  function getChangedFields(initialValues: any, currentValues: any) {
    const changes: Record<string, any> = {};

    Object.keys(currentValues).forEach((key) => {
      if (Array.isArray(currentValues[key])) {
        if (JSON.stringify(initialValues[key]) !== JSON.stringify(currentValues[key])) {
          changes[key] = currentValues[key];
        }
      } else if (typeof currentValues[key] === 'number') {
        if (initialValues[key] !== currentValues[key]) {
          changes[key] = currentValues[key];
        }
      } else if (initialValues[key] !== currentValues[key]) {
        changes[key] = currentValues[key];
      }
    });

    return changes;
  }

 // Update your handleSubmit function in PurchasePage with detailed logging
// Update your handleSubmit function in PurchasePage with detailed logging
const handleSubmit = async (values: any) => {
  try {
    console.log('🔄 Submitting form data:', values);
    console.log('📝 Edit Index:', editIndex);

    // Check if editIndex is valid for edit mode
    if (editIndex !== null && (editIndex < 0 || editIndex >= items.length)) {
      console.error('❌ Invalid edit index:', editIndex);
      dispatch(setSnackbarMessage('Invalid item selection for editing'));
      dispatch(setSnackbarOpen(true));
      return;
    }
    // REMOVE THE handleRefresh FUNCTION FROM HERE

    const normalizedItemName = values.itemName.trim().toLowerCase();
    const isDuplicate = items.some(
      (item) =>
        item.purchaseitemId !== values.purchaseitemId &&
        item.itemName.trim().toLowerCase() === normalizedItemName
    );

    if (isDuplicate) {
      dispatch(setSnackbarMessage('Item name already exists.'));
      dispatch(setSnackbarOpen(true));
      return;
    }

    let dataToSend;

    if (editIndex !== null) {
      // EDIT MODE - Ensure we have a valid item to edit
      const itemToEdit = items[editIndex];
      if (!itemToEdit) {
        console.error('❌ No item found at edit index:', editIndex);
        dispatch(setSnackbarMessage('Item not found for editing'));
        dispatch(setSnackbarOpen(true));
        return;
      }

      console.log('✏️ Editing item:', itemToEdit);
      
      dataToSend = {
        ...getChangedFields(initialPurchaseState, values),
        purchaseitemId: itemToEdit.purchaseitemId,
        itemName: values.itemName.trim(),
      };

      console.log('📤 Update data being sent:', dataToSend);
      console.log('🆔 Item ID being updated:', itemToEdit.purchaseitemId);

    } else {
      // ADD MODE
      dataToSend = { 
        ...values, 
        itemName: values.itemName.trim(),
        status: 'active'
      };
      console.log('➕ Add data being sent:', dataToSend);
    }

    if (editIndex !== null) {
      console.log('✏️ Starting update process...');
      const result = await dispatch(updatePurchaseItem(dataToSend)).unwrap();
      console.log('✅ Update result:', result);
      dispatch(setSnackbarMessage('Item updated successfully'));
      
      // Refresh the data after update
      dispatch(fetchPurchaseItems({ page: currentPage, size: pageSize }));
    } else {
      const result = await dispatch(addPurchaseItem(dataToSend)).unwrap();
      console.log('✅ Add result:', result);
      dispatch(setSnackbarMessage('Item added successfully'));
      dispatch(fetchPurchaseItems({ page: newPage, size: pageSize }));
    }

    dispatch(setSnackbarOpen(true));
    handleDialogClose();
  } catch (error: any) {
    console.error('❌ Submission error:', error);
    
    let errorMessage = `Failed to ${editIndex !== null ? 'update' : 'add'} item`;
    
    if (error.payload) {
      console.error('📋 Error payload:', error.payload);
      errorMessage = error.payload.message || errorMessage;
    } else if (error.message) {
      errorMessage = error.message;
    }

    dispatch(setSnackbarMessage(errorMessage));
    dispatch(setSnackbarOpen(true));
  }
};

// ✅ ADD handleRefresh FUNCTION HERE - after handleSubmit and before paginatedItems
const handleRefresh = () => {
  console.log('🔄 Manual refresh triggered');
  
  const currentFilters = {
    ...(filters.itemName && { itemName: filters.itemName }),
    ...(filters.purchasecategoryName && { purchasecategoryName: filters.purchasecategoryName }),
    ...(filters.purchasesubcategoryName && { purchasesubcategoryName: filters.purchasesubcategoryName }),
  };

  // Force refresh both active and deactivated data
  dispatch(
    fetchPurchaseItems({
      page: currentPage,
      size: pageSize,
      ...currentFilters,
    })
  );
  
  dispatch(setSnackbarMessage('Data refreshed successfully'));
  dispatch(setSnackbarOpen(true));
};
const paginatedItems = showDeactivated ? deactivatedItems : items;

// ✅ FIX: Use local state for module visibility check
if (permissionLoading) {
  return (
    <Box p={3}>
      <Typography>Loading permissions...</Typography>
    </Box>
  );
}

if (!moduleVisible) {
  return (
    <Box p={3}>
      <Alert severity="error">
        You do not have access to the Purchase Item module.
      </Alert>
    </Box>
  );
}

  return (
    <Box>
      <YenPurchasePage />
      <Box sx={{ pt: 1, pl: 2, pr: 1 }}>
        <PurchaseControls
          handleDialogOpen={canAdd ? handleDialogOpen : undefined}
          itemName={itemName}
          category={category}
          subcategory={subcategory}
          setItemName={setItemName}
          setCategory={setCategory}
          setSubcategory={setSubcategory}
          handleFilter={handleFilter}
          handleClearFilters={handleClearFilters}
          handleDownloadSampleCSV={handleDownloadSampleCSV}
          handleImportCSV={handleImportCSV}
          handleExportCSV={handleExportCSV}
          showDeactivated={showDeactivated}
          setShowDeactivated={(value) => dispatch(setShowDeactivated(value))}
          loading={loading}
          exportStatus={exportStatus}
          canAdd={canAdd}
            handleRefresh={handleRefresh} // Add this line

        />

        <PurchaseTable
          items={paginatedItems}
          loading={loading}
          showDeactivated={showDeactivated}
          handleEdit={handleEdit}
          handleDeactivate={handleDeactivateClick}
          handleActivate={handleActivateClick}
          canEdit={canEdit}
          canDelete={canDelete}
        />

        <PurchasePagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={totalItems}
          handlePageChange={handlePageChange}
        />

        <PurchaseItemForm
          open={dialogOpen === 'edit'}
          onClose={handleDialogClose}
          initialValues={editIndex !== null ? { ...items[editIndex] } : initialPurchaseState}
          validationSchema={validationSchema}
          onSubmit={handleSubmit}
          editIndex={editIndex}
          categories={categories}
          uoms={uoms}
          groupitems={groupitems}
          taxes={taxes}
          locations={locations}
          itemtypes={itemtypes}
          existingItems={items}
        />

        <Dialog
          open={deactivateDialogOpen}
          onClose={() => dispatch(setDeactivateDialogOpen(false))}
        >
          <DialogTitle>Confirm Deactivation</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to deactivate {itemToDeactivate?.itemName}?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => dispatch(setDeactivateDialogOpen(false))} color="primary">
              Cancel
            </Button>
            <Button onClick={handleConfirmDeactivate} color="primary">
              Confirm Deactivate
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={activateDialogOpen}
          onClose={() => dispatch(setActivateDialogOpen(false))}
        >
          <DialogTitle>Confirm Activation</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to activate {itemToActivate?.itemName}?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => dispatch(setActivateDialogOpen(false))} color="primary">
              Cancel
            </Button>
            <Button onClick={handleConfirmActivate} color="primary">
              Confirm Activate
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={snackbarOpen}
          autoHideDuration={6000}
          onClose={() => dispatch(setSnackbarOpen(false))}
          message={snackbarMessage}
        />

        <ImportErrorDialog
          open={errorDialogOpen}
          onClose={() => setErrorDialogOpen(false)}
          importResults={importResults}
        />
      </Box>
    </Box>
  );
};

export default PurchasePage;