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
import { fetchBusinesses, selectBusinesses } from '@/features/account-setting/businessSlice';
import moment from 'moment';
import Link from 'next/link';
import DateRangeDialog from '@/components/dateRange';
import YenBookPage from '../../page';
import 'react-date-range/dist/styles.css';

const LedgerPage = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { ledgerData, loading, error, selectedVendorName, transactions } = useSelector(selectLedger);
  const { businesses } = useSelector(selectBusinesses);
  const [openDialog, setOpenDialog] = useState(false);
  const [outgoingVendor, setOutgoingVendor] = useState<VendorDetail[]>([]);
  const isFetchingRef = useRef(false);
  const isInitialLoad = useRef(true);
  const today = new Date();
  const [selectionRange, setSelectionRange] = useState({
    startDate: startOfMonth(today),
    endDate: endOfDay(today), 
    key: 'selection',
  });

  // Get business address dynamically
  const getBusinessAddress = () => {
    if (businesses && businesses.length > 0) {
      const business = businesses[0];
      return `${business.companyName || ''}\n${business.address1 || ''}${business.address2 ? `, ${business.address2}` : ''}\n${business.address1 || ''}, ${business.address2 || ''}\nGSTIN: ${business.gstIn || ''}\nPhone: ${business.phoneNo || ''}`;
    }
    return "Your Company Address & Contact Details";
  };

  // Format date helper
  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '';
    try {
      return format(parseISO(dateString), 'dd-MM-yyyy');
    } catch (error) {
      return format(new Date(dateString), 'dd-MM-yyyy');
    }
  };

  // Format currency helper
  const formatCurrency = (amount: number): string => {
    return '₹ ' + formatAmount(amount);
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

  // Main PDF generation function with violet theme
  // Main PDF generation function with violet theme
const generateLedgerPDF = async () => {
  const doc = new jsPDF();
  
  // Load and add business logo
  try {
    const business = businesses.length > 0 ? businesses[0] : null;
    if (business && business.imageUrl) {
      const logoImg = new Image();
      logoImg.src = business.imageUrl;
      
      await new Promise((resolve, reject) => {
        logoImg.onload = () => {
          doc.addImage(logoImg, 'JPEG', 20, 15, 25, 25);
          resolve(true);
        };
        logoImg.onerror = reject;
      });
    }
  } catch (error) {
    console.log('Logo not available, proceeding without logo');
  }
  
  // Violet header background
  doc.setFillColor(138, 43, 226); // Violet color
  doc.rect(0, 0, 210, 50, 'F');
  
  // Header text
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("LEDGER STATEMENT", 105, 35, { align: 'center' });
  
  // Business info
  doc.setFontSize(9);
  const businessAddress = getBusinessAddress();
  const addressLines = businessAddress.split('\n');
  addressLines.forEach((line: string, index: number) => {
    doc.text(line, 105, 42 + (index * 4), { align: 'center' });
  });

  // Reset text color
  doc.setTextColor(0, 0, 0);
  
  // Vendor and period info section with light violet background
  doc.setFillColor(240, 235, 255);
  doc.rect(15, 55, 180, 40, 'F');
  
  doc.setDrawColor(138, 43, 226);
  doc.setLineWidth(0.5);
  doc.rect(15, 55, 180, 40);
  
  // Vendor details
  doc.setFontSize(11);
  doc.setTextColor(75, 0, 130);
  doc.setFont("helvetica", "bold");
  
  let currentY = 65;
  
  // Vendor information
  if (selectedVendorName) {
    doc.text(`Vendor: ${selectedVendorName}`, 20, currentY);
    currentY += 6;
    
    // Get vendor details from outgoingVendor array - using safe property access
    const vendor = outgoingVendor.find(v => v.vendorName === selectedVendorName);
    if (vendor) {
      // Use optional chaining and type-safe property access
      const vendorGst = (vendor as any).gstNumber || (vendor as any).gstin;
      if (vendorGst) {
        doc.text(`GSTIN: ${vendorGst}`, 20, currentY);
        currentY += 6;
      }
      
      const vendorAddress = (vendor as any).address || (vendor as any).vendorAddress;
      if (vendorAddress) {
        const addressLines = vendorAddress.split('\n');
        addressLines.forEach((line: string, index: number) => {
          if (index === 0) {
            doc.text(`Address: ${line}`, 20, currentY);
          } else {
            doc.text(line, 27, currentY);
          }
          currentY += 4;
        });
      }
    }
  }
  
  // Period information
  const startDate = moment(selectionRange.startDate).format('DD-MM-YYYY');
  const endDate = moment(selectionRange.endDate).format('DD-MM-YYYY');
  doc.text(`Period: ${startDate} to ${endDate}`, 20, currentY);
  currentY += 6;

  // Opening balance
  const periodOpeningTransaction = transactions?.find(t => t.type === 'opening_balance');
  const periodOpeningBalance = periodOpeningTransaction?.balance || ledgerData?.openingBalance || 0;
  doc.text(
    `Opening Balance: ${formatCurrency(Math.abs(periodOpeningBalance))} ${periodOpeningBalance >= 0 ? 'Cr' : 'Dr'}`,
    20,
    currentY
  );

  // Prepare table data
  const columns = [
    { header: 'Date', dataKey: 'date' },
    { header: 'Particulars', dataKey: 'particulars' },
    { header: 'Debit (₹)', dataKey: 'debit' },
    { header: 'Credit (₹)', dataKey: 'credit' },
    { header: 'Balance (₹)', dataKey: 'balance' }
  ];

  const rows = transactions?.map((transaction) => ({
    date: formatDate(transaction.date),
    particulars: `${transaction.description}${transaction.notes ? `\n${transaction.notes}` : ''}`,
    debit: transaction.debit_amount > 0 ? formatAmount(transaction.debit_amount) : '0.00',
    credit: transaction.credit_amount > 0 ? formatAmount(transaction.credit_amount) : '0.00',
    balance: transaction.balance === 0 
      ? '0.00' 
      : `${formatAmount(Math.abs(transaction.balance))} ${transaction.balance >= 0 ? 'Cr' : 'Dr'}`
  })) || [];

  // Calculate totals
  const totalDebit = transactions?.reduce((sum, t) => sum + t.debit_amount, 0) || 0;
  const totalCredit = transactions?.reduce((sum, t) => sum + t.credit_amount, 0) || 0;
  const periodFinalBalance = transactions?.[transactions.length - 1]?.balance || periodOpeningBalance;

  // Add totals row
  rows.push({
    date: '',
    particulars: 'TOTAL',
    debit: formatAmount(totalDebit),
    credit: formatAmount(totalCredit),
    balance: periodFinalBalance === 0 
      ? '0.00' 
      : `${formatAmount(Math.abs(periodFinalBalance))} ${periodFinalBalance >= 0 ? 'Cr' : 'Dr'}`
  });

  // Store the final Y position before table
  const startY = 100;

  // Generate table and get the final Y position
  const tableResult = doc.autoTable({
    columns: columns,
    body: rows,
    startY: startY,
    styles: { 
      fontSize: 9, 
      cellPadding: 4, 
      overflow: 'linebreak', 
      lineWidth: 0.3, 
      lineColor: [75, 0, 130],
      textColor: [0, 0, 0],
      font: 'helvetica'
    },
    headStyles: { 
      fillColor: [138, 43, 226],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      lineWidth: 0.3,
      lineColor: [75, 0, 130],
      fontSize: 10
    },
    bodyStyles: {
      lineWidth: 0.3,
      lineColor: [200, 200, 200]
    },
    alternateRowStyles: {
      fillColor: [248, 246, 255]
    },
    columnStyles: {
      date: { cellWidth: 22, halign: 'center' },
      particulars: { cellWidth: 75 },
      debit: { cellWidth: 25, halign: 'right' },
      credit: { cellWidth: 25, halign: 'right' },
      balance: { cellWidth: 28, halign: 'right', fontStyle: 'bold' }
    },
    margin: { top: startY },
    // Add page break handling
    didDrawPage: (data:any) => {
      // Add footer to each page
      const pageHeight = doc.internal.pageSize.height;
      
      // Violet footer background
      doc.setFillColor(138, 43, 226);
      doc.rect(0, pageHeight - 20, 210, 20, 'F');
      
      // Footer text
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      
      // Get current page number - use the pageNumber from autoTable data
      const currentPage = data.pageNumber;
      const totalPages = (doc as any).internal.getNumberOfPages();
      
      doc.text(`Page ${currentPage}`, 105, pageHeight - 12, { align: 'center' });
      doc.text(`Generated on ${moment().format('DD-MM-YYYY HH:mm')}`, 105, pageHeight - 6, { align: 'center' });
    }
  });

  // Alternative method to add footer if autoTable doesn't provide page numbers correctly
  // Get total pages using the internal method
  const totalPages = (doc as any).internal.getNumberOfPages();
  
  // Add footer to all pages
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.height;
    
    // Violet footer background
    doc.setFillColor(138, 43, 226);
    doc.rect(0, pageHeight - 20, 210, 20, 'F');
    
    // Footer text
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Page ${i} of ${totalPages}`, 105, pageHeight - 12, { align: 'center' });
    doc.text(`Generated on ${moment().format('DD-MM-YYYY HH:mm')}`, 105, pageHeight - 6, { align: 'center' });
  }

  // Save PDF
  const fileName = `${selectedVendorName || 'Ledger'}_Statement_${moment().format('DDMMYYYY_HHmm')}.pdf`;
  doc.save(fileName);
  setOpenDialog(false);
};
  const generateLedgerCSV = () => {
    const columns = ['Date', 'Particulars', 'Debit', 'Credit', 'Balance'];
    const rows = transactions?.map((transaction: Transaction) => [
      formatDate(transaction.date),
      `${transaction.description}${transaction.notes ? ` - ${transaction.notes}` : ''}`,
      transaction.debit_amount > 0 ? formatAmount(transaction.debit_amount) : '0.00',
      transaction.credit_amount > 0 ? formatAmount(transaction.credit_amount) : '0.00',
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
    link.setAttribute('download', `${selectedVendorName || 'Ledger'}_Statement_${moment().format('DDMMYYYY_HHmm')}.csv`);
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
    <Box sx={{ p: 1, backgroundColor: 'white' }}>
      <YenBookPage />
      
      {/* Navigation Buttons */}
      <Box>
        <Box sx={{ pl: 2, mb: 2, mt: 1 }}>
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
        </Box>

        {/* Filters */}
        <Box sx={{ p: 2, mb: 2 }}>
          <Grid container spacing={2} alignItems="center">
            {/* Vendor Selection */}
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

            {/* Date Range */}
            <Grid item xs={12} md={4}>
              <DateRangeDialog
                selectionRange={selectionRange}
                setSelectionRange={setSelectionRange}
                onApply={handleFilterClick}
              />
            </Grid>

            {/* Filter Button */}
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

            {/* Clear Button */}
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

            {/* Download Button */}
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
        </Box>

        {/* Summary Cards - All-time */}
        {selectedVendorName && (
          <Grid container spacing={2} mb={2} mx={0.5}>
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
        <Paper sx={{ mb: 2,mx:1}}>
          <TableContainer sx={{
            maxHeight: 'calc(100vh - 400px)',
            overflowY: 'auto',
          }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>Particulars</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>Debit (₹)</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>Credit (₹)</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>Balance (₹)</TableCell>
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
                        }}
                      >
                        <TableCell>{formatDate(transaction.date)}</TableCell>
                        <TableCell>
                          {transaction.description}
                          {transaction.notes && (
                            <Typography variant="caption" color="textSecondary" display="block">
                              {transaction.notes}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {transaction.debit_amount > 0 ? formatAmount(transaction.debit_amount) : '0.00'}
                        </TableCell>
                        <TableCell align="right">
                          {transaction.credit_amount > 0 ? formatAmount(transaction.credit_amount) : '0.00'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'medium' }}>
                          {transaction.balance === 0
                            ? '0.00'
                            : `${formatAmount(Math.abs(transaction.balance))} ${transaction.balance >= 0 ? 'Cr' : 'Dr'}`}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ backgroundColor: '#f8f9fa' }}>
                      <TableCell colSpan={2} sx={{ fontWeight: 'bold' }}>TOTAL</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                        {formatAmount(totalDebit)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                        {formatAmount(totalCredit)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                        {finalBalance === 0
                          ? '0.00'
                          : `${formatAmount(Math.abs(finalBalance))} ${finalBalance >= 0 ? 'Cr' : 'Dr'}`}
                      </TableCell>
                    </TableRow>
                  </>
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                      <Typography variant="h6" color="textSecondary">
                        {selectedVendorName
                          ? 'No transactions found for this vendor in the selected date range'
                          : 'Please select a vendor to view ledger'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Download Dialog */}
        <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ backgroundColor: '#8a2be2', color: 'white' }}>
            Download Ledger Statement
          </DialogTitle>
          <DialogContent sx={{ p: 3 }}>
            <Typography variant="body1" gutterBottom>
              Choose the format to download the ledger statement for <strong>{selectedVendorName}</strong>
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Period: {moment(selectionRange.startDate).format('DD-MM-YYYY')} to {moment(selectionRange.endDate).format('DD-MM-YYYY')}
            </Typography>
          </DialogContent>
          <DialogActions sx={{ p: 2, gap: 1 }}>
            <Button
              onClick={generateLedgerPDF}
              variant="contained"
              startIcon={<PictureAsPdfIcon />}
              color="primary"
              size="large"
              sx={{ flex: 1, backgroundColor: '#8a2be2' }}
            >
              Download PDF
            </Button>
            <Button
              onClick={generateLedgerCSV}
              variant="outlined"
              startIcon={<DescriptionIcon />}
              color="primary"
              size="large"
              sx={{ flex: 1 }}
            >
              Download CSV
            </Button>
            <Button 
              onClick={() => setOpenDialog(false)} 
              variant="text"
              sx={{ ml: 1 }}
            >
              Cancel
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
};

export default LedgerPage;