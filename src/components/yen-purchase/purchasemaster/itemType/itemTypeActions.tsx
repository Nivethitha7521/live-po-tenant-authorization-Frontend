'use client';
import React, { useRef, useState } from 'react';
import {
  Box,
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
} from '@mui/material';
import {
  Add as AddIcon,
  InsertDriveFile as InsertDriveFileIcon,
  GetApp as GetAppIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/redux/store';
import { setShowImportResultDialog } from '../../../../features/yen-purchase/PurchaseMaster/itemTypeSlice';
import { ImportResult } from '@/Models/importResult';


interface ItemTypeActionsProps {
  searchQuery: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDialogOpen: () => void;
  onSampleCSV: () => void;
  onImportCSV: (file: File) => Promise<ImportResult>;
  onExportCSV: () => void;
  showDeactivated: boolean;
  onToggleShowDeactivated: () => void;
  importStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  exportStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
}

const ItemTypeActions: React.FC<ItemTypeActionsProps> = ({
  searchQuery,
  onSearchChange,
  onDialogOpen,
  onSampleCSV,
  onImportCSV,
  onExportCSV,
  showDeactivated,
  onToggleShowDeactivated,
  importStatus,
  exportStatus,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<'import' | 'export' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setConfirmationDialogOpen(true);
      e.target.value = ''; // Reset the input
    }
  };

  const handleConfirmImport = async () => {
    if (selectedFile) {
      setIsLoading(true);
      setLoadingType('import');
      setConfirmationDialogOpen(false);
      try {
        const result = await onImportCSV(selectedFile);
        dispatch(setShowImportResultDialog(true)); // Show dialog via Redux
        setSelectedFile(null);
      } catch (error) {
        // Error is handled in ItemTypePage's handleImportCSV
        setSelectedFile(null);
      } finally {
        setIsLoading(false);
        setLoadingType(null);
      }
    }
  };

  const handleCancelImport = () => {
    setConfirmationDialogOpen(false);
    setSelectedFile(null);
  };

  const handleExportCSV = async () => {
    setIsLoading(true);
    setLoadingType('export');
    try {
      await onExportCSV();
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsLoading(false);
      setLoadingType(null);
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <TextField
          autoComplete="off"
          label="Search"
          className='some'
          variant="outlined"
          value={searchQuery}
          onChange={onSearchChange}
          sx={{ flex: 1 }}
        />
        <Box display="flex" alignItems="center" gap={1}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <IconButton
              color="primary"
              onClick={onDialogOpen}
              size="small"
              className='icon-button-outline'
              sx={{ p: 0.3 }}
              disabled={isLoading}
            >
              <AddIcon fontSize="small" />
            </IconButton>
            <Typography variant="caption" align="center" sx={{ maxWidth: 40, mt: 0.2 }}>
              Add
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <IconButton
              color="primary"
              onClick={onSampleCSV}
              size="small"
              sx={{ p: 0.3 }}
              className='icon-button-outline'
              disabled={isLoading}
            >
              <InsertDriveFileIcon fontSize="small" />
            </IconButton>
            <Typography variant="caption" align="center" sx={{ maxWidth: 40, mt: 0.2 }}>
              Sample
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <input
              id="import-csv-file-itemtype"
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleFileChange}
              disabled={isLoading}
              ref={fileInputRef}
            />
            <label htmlFor="import-csv-file-itemtype">
              <IconButton
                color="primary"
                component="span"
                size="small"
                className='icon-button-outline'
                sx={{ p: 0.3 }}
                disabled={isLoading}
              >
                {isLoading && loadingType === 'import' ? <CircularProgress size={16} /> : <GetAppIcon fontSize="small" />}
              </IconButton>
            </label>
            <Typography variant="caption" align="center" sx={{ maxWidth: 40, mt: 0.2 }}>
              Import
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <IconButton
              color="primary"
              onClick={handleExportCSV}
              size="small"
              sx={{ p: 0.3 }}
              className='icon-button-outline'
              disabled={isLoading}
            >
              {isLoading && loadingType === 'export' ? <CircularProgress size={16} /> : <UploadIcon fontSize="small" />}
            </IconButton>
            <Typography variant="caption" align="center" sx={{ maxWidth: 40, mt: 0.2 }}>
              Export
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Typography variant="caption" align="center" sx={{ maxWidth: 60, mt: 0.2 }}>
              {showDeactivated ? 'Deactivated' : 'Activated'}
            </Typography>
            <Switch
              checked={showDeactivated}
              onChange={onToggleShowDeactivated}
              disabled={isLoading}
              size="small"
              sx={{ height: 24 }}
            />
          </Box>
        </Box>
      </Box>

      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={isLoading}
      >
        <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
          <CircularProgress color="inherit" />
          <Typography>
            {loadingType === 'import' ? 'Import is in progress, please wait...' : 'Export is in progress, please wait...'}
          </Typography>
        </Box>
      </Backdrop>

      <Dialog open={confirmationDialogOpen} onClose={handleCancelImport}>
        <DialogTitle>Confirm CSV Import</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to import the file &quot;{selectedFile?.name}&quot;? This action will process the CSV file and may add or update item types.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelImport} color="secondary">
            Cancel
          </Button>
          <Button onClick={handleConfirmImport} color="primary" variant="contained">
            Import
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ItemTypeActions;