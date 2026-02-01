'use client';
import React, { useRef } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Typography,
  Switch,
  Backdrop,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  InsertDriveFile as InsertDriveFileIcon,
  GetApp as GetAppIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import { ConfirmationDialog } from '../tax/confirmationDialog';

interface StorageLocationActionsProps {
  searchQuery: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDialogOpen: () => void;
  onSampleCSV: () => void;
  onImportCSV: (file: File | null) => void;
  onExportCSV: () => void;
  showDeactivated: boolean;
  onToggleShowDeactivated: () => void;
  importStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  exportStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  showAddButton: boolean; // ✅ ADD PERMISSION PROP
}

const StorageLocationActions: React.FC<StorageLocationActionsProps> = ({
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
  showAddButton, 
}) => {
  const [confirmationDialogOpen, setConfirmationDialogOpen] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
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

  const handleConfirmImport = () => {
    if (selectedFile) {
      onImportCSV(selectedFile);
    }
    setConfirmationDialogOpen(false);
    setSelectedFile(null);
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Add Storage Location Button */}
         <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <IconButton
              color="primary"
              onClick={onDialogOpen}
              className="icon-button-outline"
              size="small"
              sx={{ 
                p: 0.3,
                opacity: showAddButton ? 1 : 0.5,
                '&.Mui-disabled': {
                  opacity: 0.5,
                  color: 'text.disabled'
                }
              }}
              disabled={!showAddButton}
            >
              <AddIcon fontSize="small" />
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
                lineHeight: 1.2,
                mt: 0.2,
                color: showAddButton ? 'text.primary' : 'grey.500',
                opacity: showAddButton ? 1 : 0.7,
              }}
            >
              Add
            </Typography>
          </Box>

          {/* Sample CSV Button */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <IconButton
              color="primary"
              onClick={onSampleCSV}
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
                maxWidth: 80,
                wordBreak: 'break-word',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: 1.2,
                mt: 0.2,
              }}
            >
              Sample
            </Typography>
          </Box>

          {/* Import CSV Button */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <input
              id="import-csv-file-location"
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleFileChange}
              ref={fileInputRef}
            />
            <label htmlFor="import-csv-file-location">
              <IconButton
                color="primary"
                component="span"
                className="icon-button-outline"
                size="small"
                sx={{ p: 0.3 }}
              >
                <GetAppIcon fontSize="small" />
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
                lineHeight: 1.2,
                mt: 0.2,
              }}
            >
              Import
            </Typography>
          </Box>

          {/* Export CSV Button */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <IconButton
              color="primary"
              onClick={onExportCSV}
              className="icon-button-outline"
              size="small"
              sx={{ p: 0.3 }}
            >
              <UploadIcon fontSize="small" />
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
                lineHeight: 1.2,
                mt: 0.2,
              }}
            >
              Export
            </Typography>
          </Box>

          {/* Show Deactivated Toggle */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
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
                lineHeight: 1.2,
                mt: 0.2,
              }}
            >
              {showDeactivated ? 'Deactivated' : 'Activated'}
            </Typography>
            <Switch
              checked={showDeactivated}
              onChange={onToggleShowDeactivated}
              size="small"
              sx={{ height: 24 }}
            />
          </Box>
        </Box>
      </Box>

      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={importStatus === 'loading' || exportStatus === 'loading'}
      >
        <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
          <CircularProgress color="inherit" />
          <Typography>
            {importStatus === 'loading' ? 'Import is in progress, please wait...' : 'Export is in progress, please wait...'}
          </Typography>
        </Box>
      </Backdrop>
      <ConfirmationDialog
        open={confirmationDialogOpen}
        title="Confirm Import"
        message="Are you sure you want to import this CSV file? All new storage locations will be added with active status."
        onConfirm={handleConfirmImport}
        onCancel={() => {
          setConfirmationDialogOpen(false);
          setSelectedFile(null);
        }}
      />
    </Box>
  );
};

export default StorageLocationActions;