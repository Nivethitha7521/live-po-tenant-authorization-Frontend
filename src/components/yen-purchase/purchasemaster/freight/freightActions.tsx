'use client';
import React, { useRef, useState } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Typography,
  Switch,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  CircularProgress,
} from '@mui/material';
import { Add as AddIcon, InsertDriveFile as InsertDriveFileIcon, GetApp as GetAppIcon, Upload as UploadIcon } from '@mui/icons-material';

interface FreightActionsProps {
  searchQuery: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDialogOpen: () => void;
  onSampleCSV: () => void;
  onImportCSV: (file: File) => Promise<any>;
  onExportCSV: () => void;
  showDeactivated: boolean;
  onToggleShowDeactivated: () => void;
  importing?: boolean;
  exporting?: boolean;
}

const FreightActions: React.FC<FreightActionsProps> = ({
  searchQuery,
  onSearchChange,
  onDialogOpen,
  onSampleCSV,
  onImportCSV,
  onExportCSV,
  showDeactivated,
  onToggleShowDeactivated,
  importing = false,
  exporting = false,
}) => {
  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
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
      setConfirmationDialogOpen(false);
      try {
        await onImportCSV(selectedFile);
      } catch (error) {
        // Errors handled by FreightPage
      } finally {
        setSelectedFile(null);
      }
    }
  };

  const handleCancelImport = () => {
    setConfirmationDialogOpen(false);
    setSelectedFile(null);
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <TextField
          className="some"
          autoComplete="off"
          label="Search"
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
              size="small"
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
              size="small"
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
              id="import-csv-file"
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleFileChange}
              disabled={importing}
              ref={fileInputRef}
            />
            <span>
              <IconButton
                color="primary"
                className="icon-button-outline"
                sx={{ p: 0.3 }}
                size="small"
                disabled={importing}
                onClick={handleImportClick}
              >
                {importing ? <CircularProgress size={16} /> : <GetAppIcon />}
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
                className="icon-button-outline"
                sx={{ p: 0.3 }}
                size="small"
                disabled={exporting}
              >
                {exporting ? <CircularProgress size={16} /> : <UploadIcon />}
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
              name="showDeactivated"
              size="small"
              sx={{ height: 24 }}
            />
          </Box>
        </Box>
      </Box>
      <Dialog
        open={confirmationDialogOpen}
        onClose={handleCancelImport}
        aria-labelledby="import-confirmation-dialog-title"
        aria-describedby="import-confirmation-dialog-description"
      >
        <DialogTitle id="import-confirmation-dialog-title">Confirm Import</DialogTitle>
        <DialogContent>
          <DialogContentText id="import-confirmation-dialog-description">
            Are you sure you want to import {selectedFile?.name}? This action may overwrite existing freight data.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelImport} color="primary">
            Cancel
          </Button>
          <Button onClick={handleConfirmImport} color="primary" variant="contained" autoFocus disabled={importing}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FreightActions;