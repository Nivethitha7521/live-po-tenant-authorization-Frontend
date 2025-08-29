'use client';
import React, { useRef, useState } from 'react';
import {
  Grid, TextField, IconButton, Box, Typography, Switch,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button,
  Backdrop, CircularProgress, Table, TableBody, TableCell, TableHead, TableRow, Snackbar, Alert
} from '@mui/material';
import { Add as AddIcon, GetApp as GetAppIcon, Upload as UploadIcon } from '@mui/icons-material';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import ClearIcon from '@mui/icons-material/Clear';

interface PurchaseItemData {
  itemName: string;
  purchasecategoryName: string;
  purchasesubcategoryName: string;
  itemgroupName: string;
  uom: string;
  stockQuantity: number;
  supplier: string;
  purchasePrice: number;
  purchasetaxName: number;
  reorderLevel: number;
  itemType: string;
  hsnCode: string;
  shelfLife: string;
  vendorTag: string;
  locationName: string;
  barcode: string;
  description: string;
  createdDate: string;
  lastUpdatedDate: string;
  status: string;
}

interface ImportResults {
  successful: Array<{ row: number; data: Record<string, string> }>;
  updated: Array<{ row: number; data: Record<string, string>; error?: string }>;
  failed: Array<{ row: number; data: Record<string, string>; error: string; missingFields: string[] }>;
}

interface PurchaseControlsProps {
  itemName: string;
  category: string;
  subcategory: string;
  setItemName: (value: string) => void;
  setCategory: (value: string) => void;
  setSubcategory: (value: string) => void;
  handleFilter: () => void;
  handleClearFilters: () => void;
  handleDialogOpen: () => void;
  handleDownloadSampleCSV: () => void;
  handleImportCSV: (file: File, mode: 'merge' | 'replace' | 'rollback') => Promise<any>;
  handleExportCSV: () => void;
  showDeactivated: boolean;
  setShowDeactivated: (value: boolean) => void;
  loading: boolean;
  exportStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
}

const HEADER_MAPPING: { [key: string]: string } = {
  randomId: "Item Code",
  itemName: "Item Name",
  purchasecategoryName: "Category",
  purchasesubcategoryName: "Subcategory",
  itemgroupName: "Item Group",
  uom: "Unit of Measure",
  stockQuantity: "Stock Quantity",
  supplier: "Supplier",
  purchasePrice: "Purchase Price",
  purchasetaxName: "Tax Rate",
  reorderLevel: "Reorder Level",
  itemType: "Item Type",
  hsnCode: "HSN Code",
  shelfLife: "Shelf Life",
  vendorTag: "Vendor Tags",
  locationName: "Location",
  barcode: "Barcode",
  description: "Description",
  createdDate: "Created Date",
  lastUpdatedDate: "Last Updated Date",
  status: "Status"
};

const REQUIRED_FIELDS = ['itemName', 'purchasecategoryName', 'purchasesubcategoryName', 'itemgroupName', 'purchasePrice', 'uom', 'purchasetaxName'];

const PurchaseControls: React.FC<PurchaseControlsProps> = ({
  itemName,
  category,
  subcategory,
  setItemName,
  setCategory,
  setSubcategory,
  handleFilter,
  handleClearFilters,
  handleDialogOpen,
  handleDownloadSampleCSV,
  handleImportCSV,
  handleExportCSV,
  showDeactivated,
  setShowDeactivated,
  loading,
  exportStatus
}) => {
  const inputFileRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importModeDialogOpen, setImportModeDialogOpen] = useState(false);
  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false);
  const [formatDialogOpen, setFormatDialogOpen] = useState(false);
  const [viewSampleOpen, setViewSampleOpen] = useState(false);
  const [importResultsDialogOpen, setImportResultsDialogOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'merge' | 'replace' | 'rollback'>('merge');
  const [importLoading, setImportLoading] = useState(false);
  const [importResults, setImportResults] = useState<ImportResults>({
    successful: [],
    updated: [],
    failed: []
  });
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const handleButtonClick = () => {
    setFormatDialogOpen(true);
  };

  const handleFormatDialogConfirm = () => {
    setFormatDialogOpen(false);
    if (inputFileRef.current) {
      inputFileRef.current.click();
    }
  };

  const handleFormatDialogCancel = () => {
    setFormatDialogOpen(false);
  };

  const handleViewSample = () => {
    setViewSampleOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.endsWith('.csv')) {
        setSnackbarMessage('Please upload a valid CSV file');
        setSnackbarOpen(true);
        return;
      }
      const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
      if (file.size > MAX_FILE_SIZE) {
        setSnackbarMessage('File size exceeds 5MB limit');
        setSnackbarOpen(true);
        return;
      }
      setSelectedFile(file);
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

    setImportLoading(true);
    try {
      const result = await handleImportCSV(selectedFile, selectedMode);
      setImportResults({
        successful: result.successful || [],
        updated: result.updated || [],
        failed: result.failed || []
      });
      setImportResultsDialogOpen(true);
      setSnackbarMessage(`Imported ${result.inserted_count} items, updated ${result.updated_count}`);
      setSnackbarOpen(true);
    } catch (error: any) {
      setSnackbarMessage(`CSV import failed: ${error.message || error}`);
      setSnackbarOpen(true);
    } finally {
      setImportLoading(false);
      setConfirmationDialogOpen(false);
      setImportModeDialogOpen(false);
      setSelectedFile(null);
      if (inputFileRef.current) {
        inputFileRef.current.value = '';
      }
    }
  };

  const handleCancelImport = () => {
    setConfirmationDialogOpen(false);
    setImportModeDialogOpen(false);
    setFormatDialogOpen(false);
    setSelectedFile(null);
    if (inputFileRef.current) {
      inputFileRef.current.value = '';
    }
  };

  const handleClear = () => {
    setItemName('');
    setCategory('');
    setSubcategory('');
    handleClearFilters();
  };

  const handleCloseImportResultsDialog = () => {
    setImportResultsDialogOpen(false);
    setImportResults({ successful: [], updated: [], failed: [] });
  };

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  const getModeDescription = () => {
    switch (selectedMode) {
      case 'merge':
        return 'Merge will add new items and update existing ones.';
      case 'replace':
        return 'Replace will delete all current items and import the new ones. A backup will be created automatically.';
      case 'rollback':
        return 'Rollback will restore the previous state from the last backup.';
      default:
        return '';
    }
  };

  const handleDownloadSampleCSVInternal = () => {
    const sampleData: Partial<PurchaseItemData>[] = [
      {
        itemName: "Sample Item",
        purchasecategoryName: "Sample Category",
        purchasesubcategoryName: "Sample Subcategory",
        itemgroupName: "Sample Group",
        uom: "Unit",
        stockQuantity: 100,
        supplier: "Sample Supplier",
        purchasePrice: 50.00,
        purchasetaxName: 18,
        reorderLevel: 10,
        itemType: "Sample Type",
        hsnCode: "123456",
        shelfLife: "12 months",
        vendorTag: "Tag1,Tag2",
        locationName: "Warehouse 1",
        barcode: "123456789",
        description: "Sample description",
        createdDate: "09/06/2025",
        lastUpdatedDate: "",
        status: "active"
      }
    ];

    const headers = Object.keys(HEADER_MAPPING)
      .filter(field => field !== 'purchaseitemId')
      .map(field => HEADER_MAPPING[field]);
    let csvContent = headers.join(',') + '\n';
    sampleData.forEach(row => {
      const values = Object.keys(HEADER_MAPPING)
        .filter(field => field !== 'purchaseitemId')
        .map(field => {
          const value = row[field as keyof PurchaseItemData] ?? '';
          const escaped = ('' + value).replace(/"/g, '""');
          return `"${escaped}"`;
        });
      csvContent += values.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'sample_purchase_item.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Box sx={{ px: 1 }}>
      <Grid container spacing={1} alignItems="center" wrap="nowrap">
        {/* Search Fields and Filter/Clear Buttons */}
        <Grid item xs={6} sx={{ display: 'flex', alignItems: 'center' }}>
          <Grid container spacing={0.5} alignItems="center">
            <Grid item xs={3.5}>
              <TextField
                autoComplete="off"
                label="Item Name"
                variant="outlined"
                fullWidth
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                disabled={loading || importLoading || exportStatus === 'loading'}
                size="small"
              />
            </Grid>
            <Grid item xs={3.5}>
              <TextField
                autoComplete="off"
                label="Category"
                variant="outlined"
                fullWidth
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={loading || importLoading || exportStatus === 'loading'}
                size="small"
              />
            </Grid>
            <Grid item xs={3.5}>
              <TextField
                label="Subcategory"
                variant="outlined"
                fullWidth
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                disabled={loading || importLoading || exportStatus === 'loading'}
                size="small"
              />
            </Grid>
            <Grid item xs={0.75}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <IconButton
                  color="primary"
                  className="icon-button-outline"
                  onClick={handleFilter}
                  disabled={loading || importLoading || exportStatus === 'loading'}
                  size="small"
                  sx={{ p: 0.2 }}
                >
                  <FilterAltIcon fontSize="small" />
                </IconButton>
                <Typography
                  variant="caption"
                  align="center"
                  sx={{
                    maxWidth: 30,
                    wordBreak: 'break-word',
                    lineHeight: 1.1,
                    mt: 0.1,
                  }}
                >
                  Filter
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={0.75}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <IconButton
                  className="icon-button-outline"
                  color="primary"
                  onClick={handleClear}
                  disabled={loading || importLoading || exportStatus === 'loading'}
                  size="small"
                  sx={{ p: 0.2 }}
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
                <Typography
                  variant="caption"
                  align="center"
                  sx={{
                    maxWidth: 30,
                    wordBreak: 'break-word',
                    lineHeight: 1.1,
                    mt: 0.1,
                  }}
                >
                  Clear
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Grid>

        {/* Action Buttons and Toggle */}
        <Grid item xs={6} sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Grid container spacing={1} alignItems="center" justifyContent="flex-end" wrap="nowrap">
            <Grid item>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <IconButton
                  color="primary"
                  onClick={handleDialogOpen}
                  className="icon-button-outline"
                  disabled={loading || importLoading || exportStatus === 'loading'}
                  size="small"
                  sx={{ p: 0.3 }}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
                <Typography
                  variant="caption"
                  align="center"
                  sx={{
                    maxWidth: 40,
                    wordBreak: 'break-word',
                    lineHeight: 1.1,
                    mt: 0.2,
                  }}
                >
                  Add
                </Typography>
              </Box>
            </Grid>
            <Grid item>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <IconButton
                  color="primary"
                  onClick={handleDownloadSampleCSVInternal}
                  className="icon-button-outline"
                  disabled={loading || importLoading || exportStatus === 'loading'}
                  size="small"
                  sx={{ p: 0.3 }}
                >
                  <InsertDriveFileIcon fontSize="small" />
                </IconButton>
                <Typography
                  variant="caption"
                  align="center"
                  sx={{
                    maxWidth: 70,
                    wordBreak: 'break-word',
                    lineHeight: 1.1,
                    mt: 0.2,
                  }}
                >
                  Sample
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
                  disabled={loading || importLoading || exportStatus === 'loading'}
                  size="small"
                  sx={{ p: 0.3 }}
                >
                  {importLoading ? <CircularProgress size={16} /> : <GetAppIcon fontSize="small" />}
                </IconButton>
                <Typography
                  variant="caption"
                  align="center"
                  sx={{
                    maxWidth: 40,
                    wordBreak: 'break-word',
                    lineHeight: 1.1,
                    mt: 0.2,
                  }}
                >
                  Import
                </Typography>
              </Box>
            </Grid>
            <Grid item>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <IconButton
                  color="primary"
                  onClick={handleExportCSV}
                  className="icon-button-outline"
                  disabled={loading || importLoading || exportStatus === 'loading'}
                  size="small"
                  sx={{ p: 0.3 }}
                >
                  {exportStatus === 'loading' ? <CircularProgress size={16} /> : <UploadIcon fontSize="small" />}
                </IconButton>
                <Typography
                  variant="caption"
                  align="center"
                  sx={{
                    maxWidth: 40,
                    wordBreak: 'break-word',
                    lineHeight: 1.1,
                    mt: 0.2,
                  }}
                >
                  Export
                </Typography>
              </Box>
            </Grid>
            <Grid item>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Typography
                  variant="caption"
                  align="center"
                  sx={{
                    maxWidth: 60,
                    wordBreak: 'break-word',
                    lineHeight: 1.1,
                    mt: 0.2,
                  }}
                >
                  {showDeactivated ? 'Deactivated' : 'Activated'}
                </Typography>
                <Switch
                  checked={showDeactivated}
                  onChange={(e) => setShowDeactivated(e.target.checked)}
                  disabled={loading || importLoading || exportStatus === 'loading'}
                  size="small"
                  sx={{ height: 24 }}
                />
              </Box>
            </Grid>
          </Grid>
        </Grid>
      </Grid>

      {/* Format Requirement Dialog */}
      <Dialog open={formatDialogOpen} onClose={handleFormatDialogCancel} disableEscapeKeyDown={importLoading}>
        <DialogTitle>CSV Format Requirement</DialogTitle>
        <DialogContent>
          <DialogContentText>
            To ensure a successful import, your CSV file must follow the required format.
            Please review the sample format before proceeding.
          </DialogContentText>
          <Button variant="contained" color="primary" onClick={handleViewSample} sx={{ mt: 2 }}>
            View Sample CSV
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleFormatDialogCancel} disabled={importLoading}>Cancel</Button>
          <Button onClick={handleFormatDialogConfirm} disabled={importLoading}>OK</Button>
        </DialogActions>
      </Dialog>

      {/* View Sample Dialog */}
      <Dialog open={viewSampleOpen} onClose={() => setViewSampleOpen(false)} disableEscapeKeyDown={importLoading}>
        <DialogTitle>Sample CSV Format</DialogTitle>
        <DialogContent>
          <DialogContentText>
            The CSV file must include the following required fields:
          </DialogContentText>
          <Box component="ul" sx={{ mt: 2, mb: 1 }}>
            {REQUIRED_FIELDS.map(field => (
              <Typography key={field} component="li" sx={{ mb: 0.5 }}>
                {HEADER_MAPPING[field]}
              </Typography>
            ))}
          </Box>
          <DialogContentText>
            Optional fields: {Object.keys(HEADER_MAPPING)
              .filter(field => !REQUIRED_FIELDS.includes(field) && field !== 'purchaseitemId')
              .map(field => HEADER_MAPPING[field])
              .join(', ')}.
          </DialogContentText>
          <Button variant="contained" color="primary" onClick={handleDownloadSampleCSVInternal} sx={{ mt: 2 }}>
            Download Sample CSV
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewSampleOpen(false)} disabled={importLoading}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Import Mode Dialog */}
      <Dialog open={importModeDialogOpen} onClose={() => setImportModeDialogOpen(false)} disableEscapeKeyDown={importLoading}>
        <DialogTitle>Select Import Mode</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Choose how you want to import the data:
          </DialogContentText>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <Button
              variant={selectedMode === 'merge' ? 'contained' : 'outlined'}
              onClick={() => handleImportModeSelect('merge')}
              disabled={importLoading}
            >
              Merge
            </Button>
            <Button
              variant={selectedMode === 'replace' ? 'contained' : 'outlined'}
              onClick={() => handleImportModeSelect('replace')}
              color="warning"
              disabled={importLoading}
            >
              Replace
            </Button>
            <Button
              variant={selectedMode === 'rollback' ? 'contained' : 'outlined'}
              onClick={() => handleImportModeSelect('rollback')}
              color="primary"
              disabled={importLoading}
            >
              Rollback
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportModeDialogOpen(false)} disabled={importLoading}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={confirmationDialogOpen} onClose={() => setConfirmationDialogOpen(false)} disableEscapeKeyDown={importLoading}>
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
            <DialogContentText color="primary.main" sx={{ mt: 1 }}>
              Note: This will restore the last backup state.
            </DialogContentText>
          )}
          <DialogContentText sx={{ mt: 2 }}>
            Are you sure you want to proceed?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelImport} disabled={importLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmImport}
            color={selectedMode === 'replace' ? 'warning' : 'primary'}
            disabled={importLoading}
          >
            {importLoading ? 'Processing...' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import Results Dialog */}
      <Dialog open={importResultsDialogOpen} onClose={handleCloseImportResultsDialog} maxWidth="md" fullWidth>
        <DialogTitle>CSV Import Results</DialogTitle>
        <DialogContent>
          {importResults.successful.length > 0 && (
            <>
              <Typography variant="subtitle1" gutterBottom>
                Successfully Inserted Rows
              </Typography>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Row</TableCell>
                    <TableCell>Item Name</TableCell>
                    <TableCell>Category</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {importResults.successful.map((entry, idx) => (
                    <TableRow key={idx} sx={{ backgroundColor: '#e6ffe6' }}>
                      <TableCell>{entry.row}</TableCell>
                      <TableCell>{entry.data.itemName}</TableCell>
                      <TableCell>{entry.data.purchasecategoryName}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
          {importResults.updated.length > 0 && (
            <>
              <Typography variant="subtitle1" sx={{ mt: 2, color: '#d4a017' }} gutterBottom>
                Updated Rows (Duplicates)
              </Typography>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Row</TableCell>
                    <TableCell>Item Name</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Reason</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {importResults.updated.map((entry, idx) => (
                    <TableRow key={idx} sx={{ backgroundColor: '#fff9e6' }}>
                      <TableCell>{entry.row}</TableCell>
                      <TableCell>{entry.data.itemName}</TableCell>
                      <TableCell>{entry.data.purchasecategoryName}</TableCell>
                      <TableCell>{entry.error || 'Duplicate item'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
          {importResults.failed.length > 0 && (
            <>
              <Typography variant="subtitle1" color="error" gutterBottom sx={{ mt: 2 }}>
                Failed Rows
              </Typography>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Row</TableCell>
                    <TableCell>Item Name</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Error</TableCell>
                    <TableCell>Missing Fields</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {importResults.failed.map((entry, idx) => (
                    <TableRow key={idx} sx={{ backgroundColor: '#ffe6e6' }}>
                      <TableCell>{entry.row}</TableCell>
                      <TableCell>{entry.data.itemName || '-'}</TableCell>
                      <TableCell>{entry.data.purchasecategoryName || '-'}</TableCell>
                      <TableCell>{entry.error}</TableCell>
                      <TableCell>{entry.missingFields.join(', ')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
          {importResults.successful.length === 0 && importResults.updated.length === 0 && importResults.failed.length === 0 && (
            <Typography variant="body1">No results to display.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseImportResultsDialog} color="primary">Close</Button>
        </DialogActions>
      </Dialog>

      {/* Loading Backdrop */}
      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 2 }}
        open={importLoading || exportStatus === 'loading'}
      >
        <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
          <CircularProgress color="inherit" />
          <Typography>{importLoading ? 'Import is in progress, please wait...' : 'Export is in progress, please wait...'}</Typography>
        </Box>
      </Backdrop>
{/* 
      Snackbar for Feedback
      <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={handleCloseSnackbar}>
      
      </Snackbar> */}
    </Box>
  );
};

export default PurchaseControls;