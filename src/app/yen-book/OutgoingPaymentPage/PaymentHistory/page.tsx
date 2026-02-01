'use client';
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import {
  Grid,
  Typography,
  TableContainer,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button,
  Box,
  CircularProgress,
  Container,
  Pagination,
  TextField,
  Alert,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DescriptionIcon from '@mui/icons-material/Description';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import moment from 'moment';
import { useRouter } from 'next/navigation';
import { AppDispatch } from '@/redux/store';
import {
  fetchPaymentsById,
  exportPaymentsCSV,
  exportPaymentsPDF,
  selectPayments,
  resetExport,
} from '@/features/yen-purchase/Outgoing/paymentHistory';

const PaymentHistoryPage = () => {
  const searchParams = useSearchParams();
  const paymentIdFilter = searchParams?.get('payment_id') || ''; // Optional filter from query param
  const currentPageParam = searchParams?.get('page') || '1';
  const currentPage = parseInt(currentPageParam, 10) || 1;
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { data, loading, error, exportLoading, exportError } = useSelector(selectPayments);
  const [openDialog, setOpenDialog] = useState(false);
  const [localFilter, setLocalFilter] = useState(paymentIdFilter); // Local state for input
  const limit = 10;

  // Check if any payment has paymentId (for conditional column)
  const hasPaymentId = data?.payments.some(p => p.paymentId) || false;

  // Fetch data on mount, filter change, or page change
  useEffect(() => {
    console.log('useEffect triggered. Filter:', paymentIdFilter, 'Page:', currentPage);
    const effectivePaymentId = paymentIdFilter || undefined; // Undefined for "all"
    console.log('Dispatching fetchPaymentsById with:', { paymentId: effectivePaymentId, page: currentPage, limit });
    dispatch(fetchPaymentsById({ paymentId: effectivePaymentId || '', page: currentPage, limit })); // Pass empty string for all
  }, [dispatch, paymentIdFilter, currentPage]);

  // Debug log for state changes
  useEffect(() => {
    console.log('Redux state updated - data:', data, 'loading:', loading, 'error:', error);
  }, [data, loading, error]);

  // Reset export state when dialog closes
  const handleCloseDialog = () => {
    setOpenDialog(false);
    dispatch(resetExport());
  };

  // Handle CSV export
  const handleCSVExport = () => {
    const effectivePaymentId = paymentIdFilter || undefined;
    dispatch(exportPaymentsCSV({ paymentId: effectivePaymentId || '', date: undefined })).then((action) => {
      if (exportPaymentsCSV.fulfilled.match(action)) {
        const blob = action.payload as Blob;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const fileName = paymentIdFilter ? `${paymentIdFilter}_filtered_payments.csv` : 'all_payments_history.csv';
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
        handleCloseDialog();
      }
    });
  };

  // Handle PDF export
  const handlePDFExport = () => {
    const effectivePaymentId = paymentIdFilter || undefined;
    dispatch(exportPaymentsPDF({ paymentId: effectivePaymentId || '', date: undefined })).then((action) => {
      if (exportPaymentsPDF.fulfilled.match(action)) {
        const blob = action.payload as Blob;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const fileName = paymentIdFilter ? `${paymentIdFilter}_filtered_payments.pdf` : 'all_payments_history.pdf';
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
        handleCloseDialog();
      }
    });
  };

  // Handle filter apply
  const handleFilterApply = () => {
    const newParams = new URLSearchParams(searchParams || '');
    if (localFilter) {
      newParams.set('payment_id', localFilter);
    } else {
      newParams.delete('payment_id');
    }
    newParams.set('page', '1'); // Reset to page 1 on filter
    router.push(`?${newParams.toString()}`);
  };

  // Handle clear filter
  const handleClearFilter = () => {
    setLocalFilter('');
    const newParams = new URLSearchParams();
    newParams.set('page', '1');
    router.push(`?${newParams.toString()}`);
  };

  // Format helpers (unchanged)
  const formatDate = (dateString: string): string => {
    return moment(dateString).format('DD-MM-YYYY');
  };

  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatCurrency = (amount: number): string => {
    return '₹ ' + formatAmount(amount);
  };

  // Handle pagination
  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    const newParams = new URLSearchParams(searchParams || '');
    newParams.set('page', value.toString());
    router.push(`?${newParams.toString()}`);
  };

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box display="flex" justifyContent="center" alignItems="center" height="50vh">
          <CircularProgress />
          <Typography ml={2}>Loading payment history...</Typography>
        </Box>
      </Container>
    );
  }

  if (error || !data) {
    return (
      <Container maxWidth="lg">
        <Box p={4} textAlign="center">
          <Typography color="error" variant="h6" gutterBottom>
            {error || 'No data found'}
          </Typography>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Filter: {paymentIdFilter || 'All'} | Page: {currentPage}
          </Typography>
          <Button
            onClick={() => dispatch(fetchPaymentsById({ paymentId: paymentIdFilter || '', page: currentPage, limit }))}
            variant="contained"
          >
            Retry Fetch
          </Button>
        </Box>
      </Container>
    );
  }

  const title = paymentIdFilter ? `Payment History (Filtered: ${paymentIdFilter})` : 'All Payment History';

  return (
    <Container maxWidth="lg">
      <Box sx={{ p: 2 }}>
        <Typography variant="h4" gutterBottom>
          {title}
        </Typography>

        {/* Filter Section */}
        <Paper sx={{ mb: 2, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                label="Filter by Payment ID (leave empty for all)"
                value={localFilter}
                onChange={(e) => setLocalFilter(e.target.value)}
                fullWidth
                size="small"
                variant="outlined"
              />
            </Grid>
            <Grid item>
              <Button
                variant="contained"
                startIcon={<FilterAltIcon />}
                onClick={handleFilterApply}
              >
                Apply Filter
              </Button>
            </Grid>
            <Grid item>
              <Button
                variant="outlined"
                onClick={handleClearFilter}
                disabled={!paymentIdFilter}
              >
                Clear Filter
              </Button>
            </Grid>
            {/* Download Button */}
            <Grid item>
              <Button
                variant="contained"
                onClick={() => setOpenDialog(true)}
                disabled={!data || data.payments.length === 0 || exportLoading || loading || !paymentIdFilter}
              >
                {exportLoading ? <CircularProgress size={20} /> : <DownloadIcon />}
                {exportLoading ? 'Exporting...' : 'Download Report'}
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Export Error Alert */}
        {exportError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {exportError}
          </Alert>
        )}

        {/* Payments Table */}
        <Paper sx={{ mb: 4 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>S.No</TableCell>
                  <TableCell>Date</TableCell>
                  {hasPaymentId && <TableCell>Payment ID</TableCell>}
                  <TableCell>Payment Type</TableCell>
                  <TableCell>Method</TableCell>
                  <TableCell>Mode</TableCell>
                  <TableCell align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.payments.map((payment, index) => (
                  <TableRow key={index}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{formatDate(payment.date)}</TableCell>
                    {hasPaymentId && <TableCell>{payment.paymentId || 'N/A'}</TableCell>}
                    <TableCell>{payment.paymentType}</TableCell>
                    <TableCell>{payment.paymentMethod}</TableCell>
                    <TableCell>{payment.paymentMode}</TableCell>
                    <TableCell align="right">{formatCurrency(payment.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Pagination */}
        {data.totalPages > 1 && (
          <Box display="flex" justifyContent="center" sx={{ mb: 2 }}>
            <Pagination
              count={data.totalPages}
              page={currentPage}
              onChange={handlePageChange}
              color="primary"
            />
          </Box>
        )}

        {/* Download Dialog */}
        <Dialog open={openDialog} onClose={handleCloseDialog}>
          <DialogTitle>Download Options</DialogTitle>
          <DialogContent>
            <Typography>
              Choose format for {paymentIdFilter ? `filtered (${paymentIdFilter})` : 'all'} payments
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={handlePDFExport} startIcon={<PictureAsPdfIcon />} disabled={exportLoading}>
              PDF
            </Button>
            <Button onClick={handleCSVExport} startIcon={<DescriptionIcon />} disabled={exportLoading}>
              CSV
            </Button>
            <Button onClick={handleCloseDialog} disabled={exportLoading}>Cancel</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
};

export default PaymentHistoryPage;