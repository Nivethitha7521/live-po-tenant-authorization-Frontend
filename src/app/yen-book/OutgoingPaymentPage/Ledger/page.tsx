'use client';
import React, { useEffect, useRef, useState } from 'react';
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
  Dialog,
  DialogActions,
  DialogTitle,
  DialogContent,
  Autocomplete,
  TextField,
  Card,
  CardContent,
  Container,
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DownloadIcon from '@mui/icons-material/Download';
import DescriptionIcon from '@mui/icons-material/Description';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import { ClearIcon } from '@mui/x-date-pickers/icons';
import {
  setSelectedVendorName,
  resetLedgerData,
  fetchLedgerData,
  selectLedger,
  Transaction,
} from '../../../../features/yen-purchase/Outgoing/ledgerData';
import { AppDispatch } from '@/redux/store';
import { VendorDetail } from '@/Models/outgoingModel';
import { format, parseISO, startOfMonth, endOfDay } from 'date-fns';
import Papa from 'papaparse';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { fetchVendorDetails } from '@/features/yen-purchase/Outgoing/outgoingPaymentSlice';
import { fetchBusinesses } from '@/features/account-setting/businessSlice';
import moment from 'moment';
import Link from 'next/link';
import DateRangeDialog from '@/components/dateRange';
import YenBookPage from '../../page';
import 'react-date-range/dist/styles.css'; // main style file
import 'react-date-range/dist/theme/default.css'; // theme css file

const LedgerPage = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { ledgerData, loading, error, selectedVendorName, transactions } = useSelector(selectLedger);
  const { businesses } = useSelector((state: any) => state.business);
  const [openDialog, setOpenDialog] = useState(false);
  const [outgoingVendor, setOutgoingVendor] = useState<VendorDetail[]>([]);
  const isFetchingRef = useRef(false);
  const isInitialLoad = useRef(true);
  const today = new Date(); // Current date: October 01, 2025, 03:38 PM IST
  const [selectionRange, setSelectionRange] = useState({
    startDate: startOfMonth(today), // Start of current month: October 1, 2025
    endDate: endOfDay(today),      // End of today: October 1, 2025, 11:59 PM
    key: 'selection',
  });

  // Get business address dynamically
  const getBusinessAddress = () => {
    if (businesses && businesses.length > 0) {
      const business = businesses[0];
      const addressParts = [business.address, business.city, business.state, business.pincode].filter(part => part && part.trim() !== '');
      if (addressParts.length === 0) {
        return 'Your Company Address & Contact Details';
      }
      return addressParts.join(', ');
    }
    return 'Your Company Address & Contact Details';
  };

  // Format date helper
  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '';
    try {
      return format(parseISO(dateString), 'MMM dd, yyyy');
    } catch (error) {
      return format(new Date(dateString), 'MMM dd, yyyy');
    }
  };

  // Format currency helper
  const formatCurrency = (amount: number): string => {
    return 'Rs. ' + formatAmount(amount);
  };

  // Format amount without symbol
  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Initial data fetching
  useEffect(() => {
    if (isInitialLoad.current) {
      dispatch(fetchBusinesses());
      dispatch(fetchVendorDetails({ fetchAll: true })).then((action) => {
        if (fetchVendorDetails.fulfilled.match(action)) {
          setOutgoingVendor(action.payload || []);
        }
      });
      isInitialLoad.current = false;
    }
  }, [dispatch]);

  const handleVendorChange = (event: React.SyntheticEvent, newValue: VendorDetail | null) => {
    dispatch(setSelectedVendorName(newValue?.vendorName || null));
  };

  const handleFilterClick = () => {
    if (!selectedVendorName) return;
    const startDate = moment(selectionRange.startDate).format('YYYY-MM-DD');
    const endDate = moment(selectionRange.endDate).format('YYYY-MM-DD');
    dispatch(fetchLedgerData({ vendorName: selectedVendorName, startDate, endDate }));
  };

  const handleFilterClose = () => {
    dispatch(resetLedgerData());
  };

  const generateLedgerPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(`LEDGER`, 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text(getBusinessAddress(), 105, 28, { align: 'center' });
    doc.setFontSize(12);
    if (selectedVendorName) {
      doc.text(`Vendor: ${selectedVendorName}`, 20, 40);
    }
    const startDate = moment(selectionRange.startDate).format('DD-MM-YYYY');
    const endDate = moment(selectionRange.endDate).format('DD-MM-YYYY');
    doc.text(`Period: ${startDate} to ${endDate}`, 20, 47);

    // Period opening balance for PDF
    const periodOpeningTransaction = transactions?.find(t => t.type === 'opening_balance');
    const periodOpeningBalance = periodOpeningTransaction?.balance || 0;
    doc.text(
      `Opening Balance as of ${startDate}: ${formatCurrency(Math.abs(periodOpeningBalance))} ${periodOpeningBalance >= 0 ? 'Cr' : 'Dr'}`,
      20,
      54
    );

    // Table
    const columns = ['Date', 'Particulars', 'Debit', 'Credit', 'Balance'];
    const rows = transactions?.map((transaction: Transaction) => [
      formatDate(transaction.date),
      `${transaction.description}${transaction.notes ? `\n${transaction.notes}` : ''}`,
      transaction.debit_amount > 0 ? formatAmount(transaction.debit_amount) : '0.00',
      transaction.credit_amount > 0 ? formatAmount(transaction.credit_amount) : '0.00',
      transaction.balance === 0 
        ? '0.00'
        : `${formatAmount(Math.abs(transaction.balance))} ${transaction.balance >= 0 ? 'Cr' : 'Dr'}`,
    ]) || [];

    // Add totals (period)
    const totalDebit = transactions?.reduce((sum, t) => sum + t.debit_amount, 0) || 0;
    const totalCredit = transactions?.reduce((sum, t) => sum + t.credit_amount, 0) || 0;
    const periodFinalBalance = transactions?.[transactions.length - 1]?.balance || periodOpeningBalance;

    rows.push([
      '',
      'Total',
      formatAmount(totalDebit),
      formatAmount(totalCredit),
      periodFinalBalance === 0 
        ? '0.00'
        : `${formatAmount(Math.abs(periodFinalBalance))} ${periodFinalBalance >= 0 ? 'Cr' : 'Dr'}`,
    ]);

    doc.autoTable({
      head: [columns],
      body: rows,
      startY: 60,
      styles: { fontSize: 10, cellPadding: 2, overflow: 'linebreak', lineWidth: 0.1, lineColor: [0, 0, 0] },
      headStyles: { fillColor: [240, 240, 240], lineWidth: 0.1, lineColor: [0, 0, 0] },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 60 },
        2: { cellWidth: 25, halign: 'right' },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 30, halign: 'right' },
      },
    });

    doc.save(`${selectedVendorName}_Ledger.pdf`);
    setOpenDialog(false);
  };

  const generateLedgerCSV = () => {
    const columns = ['Date', 'Particulars', 'Debit', 'Credit', 'Balance'];
    const rows = transactions?.map((transaction: Transaction) => [
      formatDate(transaction.date),
      `${transaction.description}${transaction.notes ? ` - ${transaction.notes}` : ''}`,
      transaction.debit_amount || '0.00',
      transaction.credit_amount || '0.00',
      transaction.balance === 0 
        ? '0.00'
        : `${formatAmount(Math.abs(transaction.balance))} ${transaction.balance >= 0 ? 'Cr' : 'Dr'}`,
    ]) || [];

    const csvData = [columns, ...rows];
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${selectedVendorName}_Ledger.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setOpenDialog(false);
  };

  // All-time summary values from ledgerData
  const allTimeOpeningBalance = ledgerData?.openingBalance || 0;
  const totalPayableAll = ledgerData?.totalPayableAmount || 0;
  const totalPaidAll = ledgerData?.totalPaidAmount || 0;
  const totalDebitAll = ledgerData?.totalDebitAmount || 0;
  const totalCreditAll = ledgerData?.totalCreditAmount || 0;
  const outstandingAll = ledgerData?.outstandingAmount || 0;

  // Period opening balance
  const periodOpeningTransaction = transactions?.find((t: Transaction) => t.type === 'opening_balance');
  const periodOpeningBalance = periodOpeningTransaction?.balance || 0;

  // Period values for table
  const totalDebit = transactions?.reduce((sum, t) => sum + t.debit_amount, 0) || 0;
  const totalCredit = transactions?.reduce((sum, t) => sum + t.credit_amount, 0) || 0;
  const finalBalance = transactions?.[transactions.length - 1]?.balance || periodOpeningBalance;

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box display="flex" justifyContent="center" alignItems="center" height="50vh">
          <CircularProgress size={60} />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg">
        <Box p={4} textAlign="center">
          <Typography color="error" variant="h6" gutterBottom>
            Error: {error}
          </Typography>
          <Button onClick={() => dispatch(resetLedgerData())} variant="contained" color="primary">
            Reset and Try Again
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Box maxWidth="xl" sx={{ py: 2 }}>
      {/* Navigation Buttons */}
      <YenBookPage />
      <Paper sx={{ pl: 2, mb: 2,mt:1 }}>
        <Grid container spacing={1} alignItems="center">
          <Grid item>
            <Link href="/yen-book/OutgoingPaymentPage" passHref>
              <Button variant="contained" size="small">
                Outgoing Payment
              </Button>
            </Link>
          </Grid>
          <Grid item>
            <Link href="/yen-book/OutgoingPaymentPage/PreOutgoing" passHref>
              <Button variant="contained" size="small">
                Advance Payment
              </Button>
            </Link>
          </Grid>
          <Grid item>
            <Link href="/yen-book/OutgoingPaymentPage/PendingPayment" passHref>
              <Button variant="contained" size="small">
                Partial Payment
              </Button>
            </Link>
          </Grid>
          <Grid item>
            <Link href="/yen-book/OutgoingPaymentPage/PaidPayment" passHref>
              <Button variant="contained" size="small">
                Payment Done
              </Button>
            </Link>
          </Grid>
          <Grid item>
            <Button variant="contained" size="small" sx={{ 
              mr: "5px",
              backgroundColor: 'white',
              color: 'black',
              '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.8)' },
            }}>
              Ledger
            </Button>
          </Grid>
          <Grid item>
            <Link href="/yen-book/OutgoingPaymentPage/PurchaseReturn" passHref>
              <Button variant="contained" size="small">
                Purchase Return
              </Button>
            </Link>
          </Grid>
        </Grid>
      </Paper>

      {/* Filters */}
      <Paper sx={{ pl: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <Autocomplete
              value={outgoingVendor.find((v) => v.vendorName === selectedVendorName) || null}
              onChange={handleVendorChange}
              options={outgoingVendor}
              getOptionLabel={(option: VendorDetail) => option.vendorName || ''}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Vendor"
                  variant="outlined"
                  size="small"
                  fullWidth
                />
              )}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <DateRangeDialog
              selectionRange={selectionRange}
              setSelectionRange={setSelectionRange}
              onApply={handleFilterClick}
            />
          </Grid>
          <Grid item>
            <Button
              variant="contained"
              startIcon={<FilterAltIcon />}
              onClick={handleFilterClick}
              disabled={!selectedVendorName}
              size="medium"
            >
              Filter
            </Button>
          </Grid>
          <Grid item>
            <Button
              variant="outlined"
              startIcon={<ClearIcon />}
              onClick={handleFilterClose}
              size="medium"
            >
              Clear
            </Button>
          </Grid>
          <Grid item sx={{ ml: 'auto' }}>
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={() => setOpenDialog(true)}
              disabled={!transactions || transactions.length === 0}
              size="medium"
              color="secondary"
            >
              Download
            </Button>
          </Grid>
        </Grid>
      </Paper>

     
      {/* Summary Cards - All-time */}
      {selectedVendorName && (
        <Grid container spacing={2} mb={2}>
          <Grid item xs={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h6" color="primary.main">
                  {formatCurrency(Math.abs(allTimeOpeningBalance))}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Opening Balance {allTimeOpeningBalance >= 0 ? '(Cr)' : '(Dr)'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h6" color="error.main">
                  {formatCurrency(totalPaidAll)}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Total Payments Made
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h6" color="success.main">
                  {formatCurrency(totalPayableAll)}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Total Bills/Invoices
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h6" color="warning.main">
                  {formatCurrency(Math.max(0, outstandingAll))}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Outstanding Amount
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Ledger Table - Filtered */}
      <Paper sx={{ mb: 2,ml:2}}>
        <TableContainer sx={{ maxHeight: 500 }}>
          <Table stickyHeader sx={{ border: '1px solid #ddd' }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f5f5f5', border: '1px solid #ddd' }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f5f5f5', border: '1px solid #ddd' }}>Particulars</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: '#f5f5f5', border: '1px solid #ddd' }}>
                  Debit
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: '#f5f5f5', border: '1px solid #ddd' }}>
                  Credit
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: '#f5f5f5', border: '1px solid #ddd' }}>
                  Balance
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {transactions && transactions.length > 0 ? (
                <>
                  {transactions.map((transaction: Transaction, index: number) => (
                    <TableRow
                      key={`${transaction.reference_id}-${index}`}
                      hover
                      sx={{
                        backgroundColor: transaction.type === 'opening_balance' ? '#e3f2fd' : 'inherit',
                        '&:hover': { backgroundColor: transaction.type === 'opening_balance' ? '#bbdefb' : '#f5f5f5' },
                        border: '1px solid #ddd',
                      }}
                    >
                      <TableCell sx={{ fontSize: '14px', fontWeight: transaction.type === 'opening_balance' ? 'bold' : 'normal', border: '1px solid #ddd' }}>
                        {formatDate(transaction.date)}
                      </TableCell>
                      <TableCell sx={{ fontSize: '14px', fontWeight: transaction.type === 'opening_balance' ? 'bold' : 'normal', border: '1px solid #ddd' }}>
                        {transaction.description}
                        {transaction.notes && (
                          <Typography variant="caption" color="textSecondary" display="block">
                            {transaction.notes}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '14px', fontWeight: transaction.type === 'opening_balance' ? 'bold' : 'normal', border: '1px solid #ddd' }}>
                        {transaction.debit_amount > 0 ? formatAmount(transaction.debit_amount) : '0.00'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '14px', fontWeight: transaction.type === 'opening_balance' ? 'bold' : 'normal', border: '1px solid #ddd' }}>
                        {transaction.credit_amount > 0 ? formatAmount(transaction.credit_amount) : '0.00'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '14px', fontWeight: 'medium', border: '1px solid #ddd' }}>
                        {transaction.balance === 0 
                          ? '0.00'
                          : `${formatAmount(Math.abs(transaction.balance))} ${transaction.balance >= 0 ? 'Cr' : 'Dr'}`}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow sx={{ backgroundColor: '#f8f9fa', border: '1px solid #ddd' }}>
                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd' }}></TableCell>
                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd' }}>Total</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', border: '1px solid #ddd' }}>
                      {formatAmount(totalDebit)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', border: '1px solid #ddd' }}>
                      {formatAmount(totalCredit)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', border: '1px solid #ddd' }}>
                      {finalBalance === 0 
                        ? '0.00'
                        : `${formatAmount(Math.abs(finalBalance))} ${finalBalance >= 0 ? 'Cr' : 'Dr'}`}
                    </TableCell>
                  </TableRow>
                </>
              ) : (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4, border: '1px solid #ddd' }}>
                    <Typography variant="h6" color="textSecondary">
                      {selectedVendorName
                        ? 'No transactions found for this vendor in the selected date range'
                        : 'Please select a vendor to view ledger'}
                    </Typography>
                    {Math.abs(periodOpeningBalance) > 0 && (
                      <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                        Opening Balance: {formatCurrency(Math.abs(periodOpeningBalance))} {periodOpeningBalance >= 0 ? 'Cr' : 'Dr'}
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Download Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>Download Ledger</DialogTitle>
        <DialogContent>
          <Typography>Choose format to download the ledger:</Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={generateLedgerPDF}
            variant="contained"
            startIcon={<PictureAsPdfIcon />}
            color="primary"
          >
            PDF
          </Button>
          <Button
            onClick={generateLedgerCSV}
            variant="contained"
            startIcon={<DescriptionIcon />}
            color="secondary"
          >
            CSV
          </Button>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LedgerPage;