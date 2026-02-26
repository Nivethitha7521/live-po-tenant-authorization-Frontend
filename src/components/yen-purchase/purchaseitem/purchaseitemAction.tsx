'use client';
import React, { useRef, useState } from 'react';
import {
  Grid, IconButton, Box, Switch, Typography,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button,
  Backdrop, CircularProgress
} from '@mui/material';
import { Add as AddIcon, GetApp as GetAppIcon, Upload as UploadIcon } from '@mui/icons-material';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';

interface PurchaseActionsProps {
  handleDialogOpen: () => void;
  handleDownloadSampleCSV: () => void;
  handleImportCSV: (file: File, mode: 'merge' | 'replace' | 'rollback') => Promise<void>;
  handleExportCSV: () => void;
  showDeactivated: boolean;
  setShowDeactivated: (value: boolean) => void;
}

const PurchaseActions: React.FC<PurchaseActionsProps> = ({
  handleDialogOpen,
  handleDownloadSampleCSV,
  handleImportCSV,
  handleExportCSV,
  showDeactivated,
  setShowDeactivated
}) => {
  const inputFileRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importModeDialogOpen, setImportModeDialogOpen] = useState(false);
  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'merge' | 'replace' | 'rollback'>('merge');
  const [loading, setLoading] = useState(false);

  const handleButtonClick = () => {
    if (inputFileRef.current) {
      inputFileRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setImportModeDialogOpen(true);
    }
  };

  const handleImportModeSelect = (mode: 'merge' | 'replace' | 'rollback') => {
    setSelectedMode(mode);
    setImportModeDialogOpen(false);
    setConfirmationDialogOpen(true);
  };

  const handleConfirmImport = async () => {
    if (!selectedFile) return;

    setLoading(true);
    try {
      await handleImportCSV(selectedFile, selectedMode);
    } catch (error) {
      // Error handling is managed by the parent component (PurchasePage)
    } finally {
      setLoading(false);
      setConfirmationDialogOpen(false);
      setImportModeDialogOpen(false);
      setSelectedFile(null);
      if (inputFileRef.current) {
        inputFileRef.current.value = ''; // Reset file input
      }
    }
  };

  const handleCancelImport = () => {
    setConfirmationDialogOpen(false);
    setImportModeDialogOpen(false);
    setSelectedFile(null);
    if (inputFileRef.current) {
      inputFileRef.current.value = ''; // Reset file input
    }
  };

  const getModeDescription = () => {
    switch (selectedMode) {
      case 'merge':
        return 'Merge will add new items and skip existing ones.';
      case 'replace':
        return 'Replace will delete all current items and import the new ones. A backup will be created automatically.';
      case 'rollback':
        return 'Rollback will restore the previous state from the last backup.';
      default:
        return '';
    }
  };

  return (
    <>
      <Grid container spacing={2} justifyContent='end' alignItems="center">
        <Grid item>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <IconButton
              color="primary"
              onClick={handleDialogOpen}
              className='icon-button-outline'
              disabled={loading}
            >
              <AddIcon />
            </IconButton>
            <Typography
              variant="caption"
              align="center"
              sx={{
                maxWidth: 80,
                wordBreak: 'break-word',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Add Purchase Item
            </Typography>
          </Box>
        </Grid>
        <Grid item>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <IconButton
              color="primary"
              onClick={handleDownloadSampleCSV}
              className='icon-button-outline'
              disabled={loading}
            >
              <InsertDriveFileIcon />
            </IconButton>
            <Typography
              variant="caption"
              align="center"
              sx={{
                maxWidth: 80,
                wordBreak: 'break-word',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Download Sample CSV
            </Typography>
          </Box>
        </Grid>
        <Grid item>
          <input
            type="file"
            accept=".csv"
            ref={inputFileRef}
            style={{ display: 'none' }}
            onChange={handleFileChange}
            id="import-csv"
          />
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <IconButton
              color="primary"
              className="icon-button-outline"
              onClick={handleButtonClick}
              disabled={loading}
            >
              <GetAppIcon />
            </IconButton>
            <Typography
              variant="caption"
              align="center"
              sx={{
                maxWidth: 80,
                wordBreak: 'break-word',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Import CSV
            </Typography>
          </Box>
        </Grid>
        <Grid item>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <IconButton
              color="primary"
              onClick={handleExportCSV}
              className='icon-button-outline'
              disabled={loading}
            >
              <UploadIcon />
            </IconButton>
            <Typography
              variant="caption"
              align="center"
              sx={{
                maxWidth: 80,
                wordBreak: 'break-word',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Export CSV
            </Typography>
          </Box>
        </Grid>
        <Grid item>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography sx={{ mr: 1 }}>Show Deactivated</Typography>
            <Switch
              checked={showDeactivated}
              onChange={(e) => setShowDeactivated(e.target.checked)}
              disabled={loading}
            />
          </Box>
        </Grid>
      </Grid>

      {/* Import Mode Selection Dialog */}
      <Dialog open={importModeDialogOpen} onClose={() => setImportModeDialogOpen(false)} disableEscapeKeyDown={loading}>
        <DialogTitle>Select Import Mode</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Choose how you want to import the data:
          </DialogContentText>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <Button
              variant={selectedMode === 'merge' ? 'contained' : 'outlined'}
              onClick={() => handleImportModeSelect('merge')}
              disabled={loading}
            >
              Merge
            </Button>
            <Button
              variant={selectedMode === 'replace' ? 'contained' : 'outlined'}
              onClick={() => handleImportModeSelect('replace')}
              color="warning"
              disabled={loading}
            >
              Replace
            </Button>
            <Button
              variant={selectedMode === 'rollback' ? 'contained' : 'outlined'}
              onClick={() => handleImportModeSelect('rollback')}
              color="secondary"
              disabled={loading}
            >
              Rollback
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportModeDialogOpen(false)} disabled={loading}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={confirmationDialogOpen} onClose={() => setConfirmationDialogOpen(false)} disableEscapeKeyDown={loading}>
        <DialogTitle>Confirm Import</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You selected <strong>{selectedMode}</strong> mode. {getModeDescription()}
          </DialogContentText>
          {selectedMode === 'replace' && (
            <DialogContentText color="warning.main" sx={{ mt: 1 }}>
              Warning: This will delete all existing items!
            </DialogContentText>
          )}
          {selectedMode === 'rollback' && (
            <DialogContentText color="secondary.main" sx={{ mt: 1 }}>
              Note: This will restore the last backup state.
            </DialogContentText>
          )}
          <DialogContentText sx={{ mt: 2 }}>
            Are you sure you want to proceed?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelImport} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmImport}
            color={selectedMode === 'replace' ? 'warning' : 'primary'}
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Loading Backdrop */}
      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 2 }}
        open={loading}
      >
        <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
          <CircularProgress color="inherit" />
          <Typography>Import is in progress, please wait...</Typography>
        </Box>
      </Backdrop>
    </>
  );
};

export default PurchaseActions;