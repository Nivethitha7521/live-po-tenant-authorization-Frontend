'use client';
import React, { useRef, useState } from 'react';
import {
  Box, TextField, IconButton, Tooltip, FormControlLabel, Switch,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button,
  CircularProgress, Snackbar, Alert, Backdrop, Typography
} from '@mui/material';
import {
  Add as AddIcon, InsertDriveFile as InsertDriveFileIcon, GetApp as GetAppIcon, Upload as UploadIcon
} from '@mui/icons-material';

interface PurchaseSubcategoryActionsProps {
  searchQuery: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDialogOpen: () => void;
  onSampleCSV: () => void;
  onImportCSV: (file: File) => Promise<any>;
  onExportCSV: () => void;
  showDeactivated: boolean;
  onToggleShowDeactivated: () => void;
  importStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  exportStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
}

const PurchaseSubcategoryActions: React.FC<PurchaseSubcategoryActionsProps> = ({
  searchQuery, onSearchChange, onDialogOpen, onSampleCSV, onImportCSV, onExportCSV,
  showDeactivated, onToggleShowDeactivated, importStatus, exportStatus
}) => {
  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [resultDialogOpen, setResultDialogOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info' | 'warning'>('info');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        setSnackbarMessage('Please select a CSV file');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
        return;
      }

      setSelectedFile(file);
      setConfirmationDialogOpen(true);
      e.target.value = '';
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleConfirmImport = async () => {
    if (selectedFile) {
      setConfirmationDialogOpen(false); // Close dialog immediately
      try {
        const result = await onImportCSV(selectedFile);
        setImportResult(result);
        setResultDialogOpen(true);
        setSnackbarMessage(
          `Import completed: ${result.new_count} new, ${result.updated_count} updated, ${result.duplicate_in_csv_count || 0} duplicates skipped`
        );
        setSnackbarSeverity('success');
        setSnackbarOpen(true);
      } catch (error: any) {
        console.error('Import failed:', error);
        setSnackbarMessage(error.message || 'Import failed. Please check file format and try again.');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      } finally {
        setSelectedFile(null);
      }
    } else {
      setConfirmationDialogOpen(false);
    }
  };

  const handleCancelImport = () => {
    setConfirmationDialogOpen(false);
    setSelectedFile(null);
  };

  const handleCloseResultDialog = () => {
    setResultDialogOpen(false);
  };

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <TextField
          autoComplete='off'
          label='Search'
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
              className="icon-button-outline"
              size='small'
              sx={{ p: 0.3 }}
            >
              <AddIcon />
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
              Add
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <IconButton
              color="primary"
              onClick={onSampleCSV}
              className="icon-button-outline"
              size='small'
              sx={{ p: 0.3 }}
            >
              <InsertDriveFileIcon />
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
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

            <input
              id="import-csv-file-tax"
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleFileChange}
              disabled={importStatus === 'loading'}
              ref={fileInputRef}
            />
            <span>
              <IconButton
                color="primary"
                className="icon-button-outline"
                sx={{ p: 0.3 }}
                size='small'
                disabled={importStatus === 'loading'}
                onClick={handleImportClick}
              >
                {importStatus === 'loading' ? <CircularProgress size={16} /> : <GetAppIcon />}
              </IconButton>
            </span>
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
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span>
              <IconButton
                color="primary"
                onClick={onExportCSV}
                size='small'
                className="icon-button-outline"
                sx={{ p: 0.3 }}
                disabled={exportStatus === 'loading'}
              >
                {exportStatus === 'loading' ? <CircularProgress size={16} /> : <UploadIcon />}
              </IconButton>
            </span>
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
              onChange={onToggleShowDeactivated}
              disabled={importStatus === 'loading' || exportStatus === 'loading'}
              size="small"
              sx={{ height: 24 }}
            />
          </Box>
        </Box>
      </Box>

      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.modal + 1 }}
        open={importStatus === 'loading'}
      >
        <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
          <CircularProgress color="inherit" />
          <Typography>Import is in progress, please wait...</Typography>
        </Box>
      </Backdrop>

      <Dialog
        open={confirmationDialogOpen}
        onClose={handleCancelImport}
        aria-labelledby="import-confirmation-dialog-title"
        aria-describedby="import-confirmation-dialog-description"
      >
        <DialogTitle id="import-confirmation-dialog-title">
          Confirm Import
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="import-confirmation-dialog-description">
            Are you sure you want to import {selectedFile?.name}? This action may overwrite existing data.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelImport} color="primary">
            Cancel
          </Button>
          <Button
            onClick={handleConfirmImport}
            color="primary"
            variant="contained"
            autoFocus
            disabled={importStatus === 'loading'}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PurchaseSubcategoryActions;