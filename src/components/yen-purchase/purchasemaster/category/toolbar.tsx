'use client';
import { useDispatch, useSelector } from 'react-redux';
import {
  TextField,
  IconButton,
  Typography,
  Switch,
  Backdrop,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Box,
} from '@mui/material';
import {
  Add as AddIcon,
  GetApp as GetAppIcon,
  Upload as UploadIcon,
  InsertDriveFile as InsertDriveFileIcon,
} from '@mui/icons-material';
import {
  fetchCategories,
  fetchSubcategories,
  setDialogOpen,
  setSearchQuery,
  toggleShowDeactivated,
  exportPurchaseCategoriesCSV,
  importPurchaseCategoriesCSV,
  setShowImportResultDialog,
  resetImportResult,
  setSnackbarOpen,
  setSnackbarMessage,
} from '../../../../features/yen-purchase/PurchaseMaster/PurchaseCategorySlice';
import Papa from 'papaparse';
import { AppDispatch, RootState } from '@/redux/store';
import { useRef, useState } from 'react';
import CommonImportResultDialog from '../../CommonImportDialog';

interface SampleCategory {
  categoryName: string;
  subcategoryList: string[];
}

// ✅ UPDATED INTERFACE
interface SearchToolbarProps {
  onAddClick?: () => void;
  showAddButton: boolean;
  permissions?: {
    add?: boolean;
    edit?: boolean;
    delete?: boolean;
  };
}

const SearchToolbar: React.FC<SearchToolbarProps> = ({ 
  onAddClick, 
  showAddButton = true,
  permissions = {
    add: true,
    edit: true,
    delete: true
  }
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const {
    categories,
    searchQuery,
    showDeactivated,
    importStatus,
    exportStatus,
    importResult,
    showImportResultDialog,
  } = useSelector((state: RootState) => state.purchaseCategory);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // ✅ DEFAULT PERMISSIONS IF NOT PROVIDED
  const {
    add = true,
    edit = true,
    delete: deletePerm = true
  } = permissions || {};

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setSearchQuery(e.target.value));
  };

  const handleExportCSV = () => {
    dispatch(exportPurchaseCategoriesCSV());
  };

  const handleSampleCSV = () => {
    const sampleData: SampleCategory[] = [
      { categoryName: 'Sample Category 1', subcategoryList: ['Sample Subcategory 1'] },
      { categoryName: 'Sample Category 2', subcategoryList: ['Sample Subcategory 2'] },
    ];
    const csvData = sampleData.map((item) => ({
      'Category Name': item.categoryName,
      Subcategories: item.subcategoryList.join(','),
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_purchase_categories.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (!file) {
      return;
    }
    if (!file.name.endsWith('.csv')) {
      dispatch(setSnackbarMessage('Please select a CSV file'));
      dispatch(setSnackbarOpen(true));
      return;
    }
    setSelectedFile(file);
    setConfirmationDialogOpen(true);
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleConfirmImport = () => {
    if (selectedFile) {
      dispatch(importPurchaseCategoriesCSV(selectedFile))
        .unwrap()
        .then(() => {
          dispatch(fetchCategories());
          dispatch(fetchSubcategories());
          dispatch(setShowImportResultDialog(true));
          dispatch(setSnackbarMessage('CSV import completed'));
          dispatch(setSnackbarOpen(true));
        })
        .catch((error) => {
          dispatch(setShowImportResultDialog(true));
          dispatch(setSnackbarMessage(`Import failed: ${error.message || 'Unknown error'}`));
          dispatch(setSnackbarOpen(true));
        })
        .finally(() => {
          setConfirmationDialogOpen(false);
          setSelectedFile(null);
        });
    }
  };

  const handleCancelImport = () => {
    setConfirmationDialogOpen(false);
    setSelectedFile(null);
  };

  const handleImportResultsClose = () => {
    dispatch(setShowImportResultDialog(false));
    dispatch(resetImportResult());
  };

  return (
    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
      <TextField
        autoComplete="off"
        label="Search"
        className="some"
        variant="outlined"
        value={searchQuery}
        onChange={handleSearch}
        sx={{ flex: 1 }}
      />
      <Box display="flex" alignItems="center" gap={1}>
        {/* ✅ ADD BUTTON WITH COMPLETE GREY OUT STYLING - FIXED */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <IconButton
            color="primary"
            onClick={onAddClick}
            className="icon-button-outline"
            size="small"
            sx={{ 
              p: 0.3,
  
            }}
            disabled={!showAddButton || !add}
          >
            <AddIcon fontSize="small" />
          </IconButton>
          <Typography
            variant="caption"
            align="center"
            sx={{
              maxWidth: 40,
              wordBreak: 'break-word',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.1,
              mt: 0.2,
              color: (showAddButton && add) ? 'text.primary' : 'grey.500',
              opacity: (showAddButton && add) ? 1 : 0.7,
            }}
          >
            Add
          </Typography>
        </Box>

        {/* ✅ SAMPLE BUTTON */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <IconButton
            color="primary"
            onClick={handleSampleCSV}
            className="icon-button-outline"
            size="small"
            sx={{ p: 0.3 }}
          >
            <InsertDriveFileIcon fontSize="small" />
          </IconButton>
          <Typography
            variant="caption"
            align="center"
            sx={{
              maxWidth: 40,
              wordBreak: 'break-word',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.1,
              mt: 0.2,
            }}
          >
            Sample
          </Typography>
        </Box>

        {/* ✅ IMPORT BUTTON */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <input
            id="import-csv-file"
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleImportCSV}
            ref={fileInputRef}
          />
          <label htmlFor="import-csv-file">
            <IconButton
              color="primary"
              component="span"
              className="icon-button-outline"
              disabled={importStatus === 'loading'}
              size="small"
              sx={{ p: 0.3 }}
            >
              {importStatus === 'loading' ? <CircularProgress size={16} /> : <GetAppIcon fontSize="small" />}
            </IconButton>
          </label>
          <Typography
            variant="caption"
            align="center"
            sx={{
              maxWidth: 40,
              wordBreak: 'break-word',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.1,
              mt: 0.2,
            }}
          >
            Import
          </Typography>
        </Box>

        {/* ✅ EXPORT BUTTON */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <IconButton
            color="primary"
            onClick={handleExportCSV}
            className="icon-button-outline"
            size="small"
            sx={{ p: 0.3 }}
          >
            {exportStatus === 'loading' ? <CircularProgress size={16} /> : <UploadIcon />}
          </IconButton>
          <Typography
            variant="caption"
            align="center"
            sx={{
              maxWidth: 40,
              wordBreak: 'break-word',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.1,
              mt: 0.2,
            }}
          >
            Export
          </Typography>
        </Box>

        {/* ✅ ACTIVATED/DEACTIVATED SWITCH */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Typography
            variant="caption"
            align="center"
            sx={{
              maxWidth: 60,
              wordBreak: 'break-word',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.1,
              mt: 0.2,
            }}
          >
            {showDeactivated ? 'Deactivated' : 'Activated'}
          </Typography>
          <Switch
            checked={showDeactivated}
            onChange={() => dispatch(toggleShowDeactivated())}
            size="small"
            sx={{ height: 24 }}
          />
        </Box>
      </Box>

      {/* DIALOGS */}
      <Dialog
        open={confirmationDialogOpen}
        onClose={handleCancelImport}
        aria-labelledby="import-confirmation-dialog-title"
      >
        <DialogTitle id="import-confirmation-dialog-title">Confirm Import</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to import {selectedFile?.name}? This action may overwrite existing data.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelImport} color="primary" disabled={importStatus === 'loading'}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmImport}
            color="primary"
            variant="contained"
            autoFocus
            disabled={importStatus === 'loading'}
          >
            {importStatus === 'loading' ? <CircularProgress size={24} /> : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
      
      <CommonImportResultDialog
        open={showImportResultDialog}
        onClose={handleImportResultsClose}
        importResult={importResult}
        module="category"
      />
    </Box>
  );
};

export default SearchToolbar;