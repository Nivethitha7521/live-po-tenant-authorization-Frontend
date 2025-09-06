'use client';
import React, { useRef, useState, ChangeEvent } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Typography,
  Switch,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Button,
  Backdrop,
  CircularProgress,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Menu,
  MenuItem,
  Checkbox,
  TablePagination,
} from '@mui/material';
import {
  Add as AddIcon,
  GetApp as GetAppIcon,
  Upload as UploadIcon,
  InsertDriveFile as InsertDriveFileIcon,
  FilterList as FilterListIcon,
} from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import {
  importVendorsCsv,
  setDialogOpen,
  setShowDeactivated,
  setSelectedHeaders,
  fetchVendors,
  exportVendorsCsv,
  setSnackbarOpen,
  setSnackbarMessage,
  clearImportResults,
} from '../../../features/yen-purchase/PurchaseMaster/vendorSlice';
import { AppDispatch, RootState } from '@/redux/store';
import { Vendor } from '@/Models/vendor';

// Header mapping (aligned with backend)
const HEADER_MAPPING: { [key: string]: string } = {
  vendorId: 'Vendor ID',
  randomId: 'Vendor Code',
  vendorName: 'Vendor Name',
  contactpersonName: 'Contact Person',
  contactpersonPhone: 'Contact Phone',
  contactpersonEmail: 'Contact Email',
  address: 'Address',
  country: 'Country',
  state: 'State',
  city: 'City',
  postalCode: 'Postal Code',
  website: 'Website',
  vendorType: 'Vendor Type',
  gstNumber: 'GST Number',
  paymentTerms: 'Payment Terms',
  creditLimit: 'Credit Limit',
  preferredpaymentMethod: 'Preferred Payment Method',
  status: 'Status',
  notes: 'Notes',
  bankName: 'Bank Name',
  accountNumber: 'Account Number',
  ifscCode: 'IFSC Code',
  createdDate: 'Created Date',
  updatedDate: 'Updated Date',
};

// Required fields (aligned with backend)
const REQUIRED_FIELDS = ['vendorName', 'vendorType', 'contactpersonPhone', 'paymentTerms'];

// Header mapping for filter menu
const headerNameMap: Record<string, string> = {
  vendorId: 'S.No',
  randomId: 'Vendor ID',
  vendorName: 'Vendor Name',
  contactpersonName: 'Contact Person',
  contactpersonPhone: 'Phone',
  contactpersonEmail: 'Email',
  city: 'City',
  country: 'Country',
  createdDate: 'Created Date',
  updatedDate: 'Updated Date',
};

// All headers for filter menu
const allHeaders = [
  'vendorId',
  'randomId',
  'vendorName',
  'contactpersonName',
  'contactpersonPhone',
  'contactpersonEmail',
  'city',
  'country',
  'createdDate',
  'updatedDate',
];

interface VendorToolbarProps {
  searchInputValue: string;
  setSearchInputValue: (value: string) => void;
  handleSearch: () => void;
  showDeactivated: boolean;
  loading: boolean;
  exportStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  selectedHeaders: string[];
}

const VendorToolbar: React.FC<VendorToolbarProps> = ({
  searchInputValue,
  setSearchInputValue,
  handleSearch,
  showDeactivated,
  loading,
  exportStatus,
  selectedHeaders,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const inputFileRef = useRef<HTMLInputElement | null>(null);
  const [filterAnchorEl, setFilterAnchorEl] = useState<null | HTMLElement>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [formatDialogOpen, setFormatDialogOpen] = useState(false);
  const [viewSampleOpen, setViewSampleOpen] = useState(false);
  const [importResultsDialogOpen, setImportResultsDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [errorPage, setErrorPage] = useState(0);
  const [errorsPerPage, setErrorsPerPage] = useState(10);

  const { snackbarOpen, snackbarMessage, importErrors, importDuplicates, insertedCount, updatedCount } = useSelector(
    (state: RootState) => state.vendor
  );

  const handleDialogOpen = () => {
    dispatch(setDialogOpen('edit'));
  };

  const handleSearchInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchInputValue(e.target.value);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleShowDeactivated = () => {
    dispatch(setShowDeactivated(!showDeactivated));
  };

  const handleImportClick = () => {
    setFormatDialogOpen(true);
  };

  const handleFormatDialogConfirm = () => {
    setFormatDialogOpen(false);
    if (inputFileRef.current) inputFileRef.current.click();
  };

  const handleFormatDialogCancel = () => {
    setFormatDialogOpen(false);
  };

  const handleViewSample = () => {
    setViewSampleOpen(true);
  };

  const handleFileSelect = (file: File | null) => {
    if (!file) {
      dispatch(setSnackbarMessage('Please select a CSV file'));
      dispatch(setSnackbarOpen(true));
      return;
    }
    if (!file.name.endsWith('.csv')) {
      dispatch(setSnackbarMessage('Please upload a valid CSV file'));
      dispatch(setSnackbarOpen(true));
      return;
    }
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_FILE_SIZE) {
      dispatch(setSnackbarMessage('File size exceeds 5MB limit'));
      dispatch(setSnackbarOpen(true));
      return;
    }
    setSelectedFile(file);
    setConfirmDialogOpen(true);
  };

  const handleConfirmImport = async () => {
    if (!selectedFile) return;
    setConfirmDialogOpen(false);
    setImportLoading(true);
    try {
      await dispatch(importVendorsCsv(selectedFile)).unwrap();
      setImportResultsDialogOpen(true);
      await dispatch(fetchVendors());
    } catch (error: any) {
      console.error('CSV import failed:', error);
      dispatch(setSnackbarMessage(`CSV import failed: ${error.message || error}`));
      dispatch(setSnackbarOpen(true));
    } finally {
      setImportLoading(false);
      setSelectedFile(null);
      if (inputFileRef.current) inputFileRef.current.value = '';
    }
  };

  const handleCancelImport = () => {
    setConfirmDialogOpen(false);
    setSelectedFile(null);
    if (inputFileRef.current) inputFileRef.current.value = '';
  };

  const handleExportCsv = async () => {
    try {
      await dispatch(exportVendorsCsv()).unwrap();
    } catch (error) {
      console.error('CSV export failed:', error);
      dispatch(setSnackbarMessage('CSV export failed'));
      dispatch(setSnackbarOpen(true));
    }
  };

  const handleDownloadSampleCSV = () => {
    const sampleData: Partial<Vendor>[] = [
      {
        vendorName: 'Sample Vendor',
        contactpersonName: 'Sample Person',
        contactpersonPhone: '1234567890',
        contactpersonEmail: 'sample@vendor.com',
        address: '123 Main St',
        website: 'www.samplevendor.com',
        vendorType: 'Supplier',
        gstNumber: '27AAACA1234A1Z5',
        paymentTerms: 'Net 30',
        creditLimit: 5000,
        preferredpaymentMethod: 'Bank Transfer',
        notes: 'Sample note',
        country: 'India',
        state: 'Gujarat',
        city: 'Ahmedabad',
        postalCode: 380001,
        bankName: 'ICICI Bank',
        accountNumber: 123456789012,
        ifscCode: 'ICIC0001234',
      },
    ];

    const headers = Object.keys(HEADER_MAPPING).map((field) => HEADER_MAPPING[field]);
    let csvContent = headers.join(',') + '\n';
    sampleData.forEach((row) => {
      const values = Object.keys(HEADER_MAPPING).map((field) => {
        const value = row[field as keyof Vendor] ?? '';
        const escaped = ('' + value).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvContent += values.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'sample_vendor.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadErrorReport = () => {
    let csvContent = 'Row,Error,Vendor Name,Vendor Code\n';
    importErrors.forEach((error) => {
      const escapedError = (error.error || '').replace(/"/g, '""');
      csvContent += `${error.row},"${escapedError}",${error.vendorName || 'N/A'},${error.randomId || 'N/A'}\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'import_errors.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCloseSnackbar = () => {
    dispatch(setSnackbarOpen(false));
  };

  const handleCloseImportResultsDialog = () => {
    setImportResultsDialogOpen(false);
    setErrorPage(0);
    dispatch(clearImportResults());
  };

  const handleFilterClick = (event: React.MouseEvent<HTMLElement>) => {
    setFilterAnchorEl(event.currentTarget);
  };

  const handleFilterClose = () => {
    setFilterAnchorEl(null);
  };

  const handleHeaderToggle = (header: string) => {
    let updatedHeaders: string[];
    if (selectedHeaders.includes(header)) {
      if (selectedHeaders.length === 1) {
        dispatch(setSnackbarMessage('At least one column must be selected.'));
        dispatch(setSnackbarOpen(true));
        return;
      }
      updatedHeaders = selectedHeaders.filter((h) => h !== header);
    } else {
      updatedHeaders = [...selectedHeaders, header];
    }
    dispatch(setSelectedHeaders(updatedHeaders));
  };

  const handleChangeErrorPage = (event: unknown, newPage: number) => {
    setErrorPage(newPage);
  };

  const handleChangeErrorsPerPage = (event: ChangeEvent<HTMLInputElement>) => {
    setErrorsPerPage(parseInt(event.target.value, 10));
    setErrorPage(0);
  };

  return (
    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1} ml={0.5} mt={0.5}>
      <TextField
        autoComplete="off"
        label="Vendor Name"
        variant="outlined"
        value={searchInputValue}
        onChange={handleSearchInputChange}
        onKeyPress={handleKeyPress}
        sx={{ flex: 1 }}
      />
      <Box display="flex" alignItems="center" gap={1}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <IconButton
            color="primary"
            onClick={handleDialogOpen}
            size="small"
            sx={{ p: 0.3 }}
            disabled={loading || importLoading || exportStatus === 'loading'}
          >
            <AddIcon fontSize="small" />
          </IconButton>
          <Typography variant="caption" align="center" sx={{ maxWidth: 40, wordBreak: 'break-word', mt: 0.2 }}>
            Add
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <IconButton
            color="primary"
            onClick={handleDownloadSampleCSV}
            size="small"
            sx={{ p: 0.3 }}
            disabled={loading || importLoading || exportStatus === 'loading'}
          >
            <InsertDriveFileIcon fontSize="small" />
          </IconButton>
          <Typography variant="caption" align="center" sx={{ maxWidth: 40, wordBreak: 'break-word', mt: 0.2 }}>
            Sample
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <input
            accept=".csv"
            style={{ display: 'none' }}
            id="import-csv"
            type="file"
            ref={inputFileRef}
            onChange={(e) => handleFileSelect(e.target.files ? e.target.files[0] : null)}
            disabled={loading || importLoading}
          />
          <IconButton
            color="primary"
            onClick={handleImportClick}
            size="small"
            sx={{ p: 0.3 }}
            disabled={loading || importLoading || exportStatus === 'loading'}
          >
            {importLoading ? <CircularProgress size={16} /> : <GetAppIcon fontSize="small" />}
          </IconButton>
          <Typography variant="caption" align="center" sx={{ maxWidth: 40, wordBreak: 'break-word', mt: 0.2 }}>
            Import
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <IconButton
            color="primary"
            onClick={handleExportCsv}
            size="small"
            sx={{ p: 0.3 }}
            disabled={loading || importLoading || exportStatus === 'loading'}
          >
            {exportStatus === 'loading' ? <CircularProgress size={16} /> : <UploadIcon fontSize="small" />}
          </IconButton>
          <Typography variant="caption" align="center" sx={{ maxWidth: 40, wordBreak: 'break-word', mt: 0.2 }}>
            Export
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <IconButton
            color="primary"
            onClick={handleFilterClick}
            size="small"
            sx={{ p: 0.3 }}
            disabled={loading || importLoading || exportStatus === 'loading'}
          >
            <FilterListIcon fontSize="small" />
          </IconButton>
          <Typography variant="caption" align="center" sx={{ maxWidth: 40, wordBreak: 'break-word', mt: 0.2 }}>
            Filter
          </Typography>
        </Box>
      </Box>
      <Menu
        anchorEl={filterAnchorEl}
        open={Boolean(filterAnchorEl)}
        onClose={handleFilterClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {allHeaders.map((header) => (
          <MenuItem key={header} onClick={() => handleHeaderToggle(header)}>
            <Checkbox checked={selectedHeaders.includes(header)} />
            <Typography variant="body2">{headerNameMap[header]}</Typography>
          </MenuItem>
        ))}
      </Menu>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', ml: 0.5 }}>
        <Typography variant="caption" align="center" sx={{ maxWidth: 60, wordBreak: 'break-word', mt: 0.2 }}>
          {showDeactivated ? 'Deactivated' : 'Activated'}
        </Typography>
        <Switch
          checked={showDeactivated}
          onChange={handleShowDeactivated}
          disabled={loading || importLoading || exportStatus === 'loading'}
          size="small"
          sx={{ height: 24 }}
        />
      </Box>
      <Dialog open={formatDialogOpen} onClose={handleFormatDialogCancel} disableEscapeKeyDown={importLoading}>
        <DialogTitle>CSV Format Requirement</DialogTitle>
        <DialogContent>
          <DialogContentText>
            To ensure a successful import, your CSV file must follow the required format. Please review the sample format before proceeding.
          </DialogContentText>
          <Button variant="contained" color="primary" onClick={handleViewSample} sx={{ mt: 2 }}>
            View Sample CSV
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleFormatDialogCancel} disabled={importLoading}>
            Cancel
          </Button>
          <Button onClick={handleFormatDialogConfirm} disabled={importLoading}>
            OK
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={viewSampleOpen} onClose={() => setViewSampleOpen(false)} disableEscapeKeyDown={importLoading}>
        <DialogTitle>Sample CSV Format</DialogTitle>
        <DialogContent>
          <DialogContentText>The CSV file must include the following required fields:</DialogContentText>
          <Box component="ul" sx={{ mt: 2, mb: 1 }}>
            {REQUIRED_FIELDS.map((field) => (
              <Typography key={field} component="li" sx={{ mb: 0.5 }}>
                {HEADER_MAPPING[field]}
              </Typography>
            ))}
          </Box>
          <DialogContentText>
            Optional fields:{' '}
            {Object.keys(HEADER_MAPPING)
              .filter((field) => !REQUIRED_FIELDS.includes(field))
              .map((field) => HEADER_MAPPING[field])
              .join(', ')}
            .
          </DialogContentText>
          <Button variant="contained" color="primary" onClick={handleDownloadSampleCSV} sx={{ mt: 2 }}>
            Download Sample CSV
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewSampleOpen(false)} disabled={importLoading}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={confirmDialogOpen} onClose={handleCancelImport}>
        <DialogTitle>Confirm CSV Import</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to import {selectedFile?.name}? This action may overwrite existing data for duplicate vendors.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelImport} color="primary">
            Cancel
          </Button>
          <Button onClick={handleConfirmImport} color="primary" variant="contained">
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={importResultsDialogOpen} onClose={handleCloseImportResultsDialog} maxWidth="md" fullWidth>
        <DialogTitle>CSV Import Results</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Import Summary: {insertedCount} vendors imported, {updatedCount} vendors updated,{' '}
            {importErrors.length + importDuplicates.length} issues found
          </Typography>
          {importErrors.length > 0 && (
            <>
              <Typography variant="subtitle1" color="error" gutterBottom>
                Import Errors
              </Typography>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Row</TableCell>
                    <TableCell>Error</TableCell>
                    <TableCell>Vendor Name</TableCell>
                    <TableCell>Vendor Code</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {importErrors
                    .slice(errorPage * errorsPerPage, errorPage * errorsPerPage + errorsPerPage)
                    .map((error, idx) => (
                      <TableRow key={idx} sx={{ backgroundColor: '#ffe6e6' }}>
                        <TableCell>{error.row}</TableCell>
                        <TableCell>{error.error}</TableCell>
                        <TableCell>{error.vendorName || 'N/A'}</TableCell>
                        <TableCell>{error.randomId || 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              <TablePagination
                rowsPerPageOptions={[10, 25, 50]}
                component="div"
                count={importErrors.length}
                rowsPerPage={errorsPerPage}
                page={errorPage}
                onPageChange={handleChangeErrorPage}
                onRowsPerPageChange={handleChangeErrorsPerPage}
              />
            </>
          )}
          {importDuplicates.length > 0 && (
            <>
              <Typography variant="subtitle1" sx={{ mt: 2, color: '#d4a017' }} gutterBottom>
                Duplicates (Updated)
              </Typography>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Row</TableCell>
                    <TableCell>Vendor Name</TableCell>
                    <TableCell>Contact Phone</TableCell>
                    <TableCell>Existing Vendor ID</TableCell>
                    <TableCell>Message</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {importDuplicates.map((dup, idx) => (
                    <TableRow key={idx} sx={{ backgroundColor: '#fff9e6' }}>
                      <TableCell>{dup.row}</TableCell>
                      <TableCell>{dup.vendorName}</TableCell>
                      <TableCell>{dup.contactpersonPhone}</TableCell>
                      <TableCell>{dup.existingId}</TableCell>
                      <TableCell>{dup.error}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
          {importErrors.length === 0 && importDuplicates.length === 0 && (
            <Typography variant="body1">No issues found during import.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          {importErrors.length > 0 && (
            <Button onClick={handleDownloadErrorReport} color="primary">
              Download Error Report
            </Button>
          )}
          <Button onClick={handleCloseImportResultsDialog} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>
      <Backdrop sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }} open={importLoading || exportStatus === 'loading'}>
        <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
          <CircularProgress color="inherit" />
          <Typography variant="body1">
            {importLoading ? 'Import is processing, please wait...' : 'Export is processing, please wait...'}
          </Typography>
        </Box>
      </Backdrop>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        message={snackbarMessage}
      />
    </Box>
  );
};

export default VendorToolbar;