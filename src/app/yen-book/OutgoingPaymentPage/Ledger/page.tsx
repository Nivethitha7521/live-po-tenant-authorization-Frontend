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
import { usePermissions } from "@/hooks/usePermissions";

import {
  setSelectedVendorName,
  resetLedgerData,
  fetchLedgerData,
  selectLedger,
  Transaction,
} from '../../../../features/yen-purchase/Outgoing/ledgerData';
import { AppDispatch } from '@/redux/store';
import { format, parseISO, startOfMonth, endOfDay } from 'date-fns';
import Papa from 'papaparse';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { fetchBusinesses, selectBusinesses } from '@/features/account-setting/businessSlice';
import moment from 'moment';
import Link from 'next/link';
import DateRangeDialog from '@/components/dateRange';
import YenBookPage from '../../page';
import 'react-date-range/dist/styles.css';
import { fetchVendorNames } from '@/features/yen-purchase/PurchaseMaster/vendorSlice';

// Define the interface (assuming it's not imported; add it here or import from appropriate file)
export interface VendorNameGet {
  vendorId: string;
  vendorName: string;
}

const LedgerPage = () => {
  const dispatch = useDispatch<AppDispatch>();
   const { hasPermission, isModuleVisible } = usePermissions();
  const canReadLedger = hasPermission("yenerp", "ledger", "read");

  if (!canReadLedger) {
    return (
      <Box p={2}>
        <Typography color="error">
          You do not have access to the Ledger module.
        </Typography>
      </Box>
    );
  }
  const { ledgerData, loading, error, selectedVendorName, transactions } = useSelector(selectLedger);
  const { businesses } = useSelector(selectBusinesses);
  const [openDialog, setOpenDialog] = useState(false);
  const [outgoingVendor, setOutgoingVendor] = useState<VendorNameGet[]>([]); // Changed type to VendorNameGet[]
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
      return `${business.companyName || ''}\n${business.address1 || ''}${business.address2 ? `, ${business.address2}` : ''}\nGSTIN: ${business.gstIn || ''}\nPhone: ${business.phoneNo || ''}`;
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

  // Initial data fetching - Changed to use fetchVendorNames
  useEffect(() => {
    if (isInitialLoad.current) {
      dispatch(fetchBusinesses());
      dispatch(fetchVendorNames()).then((action) => {
        if (fetchVendorNames.fulfilled.match(action)) {
          setOutgoingVendor(action.payload || []);
        }
      });
      isInitialLoad.current = false;
    }
  }, [dispatch]);

  const handleVendorChange = (event: React.SyntheticEvent, newValue: VendorNameGet | null) => { // Changed type to VendorNameGet
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

  const generateLedgerPDF = async () => {
    const doc = new jsPDF();
 
    // Header - white background (drawn first to avoid overwriting the logo)
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 210, 50, 'F');
 
    // Load and add business logo - Added AFTER white background to ensure it's visible on top
    try {
      const business = businesses.length > 0 ? businesses[0] : null;
      if (business && business.imageUrl) {
        doc.addImage(business.imageUrl, 'JPEG', 20, 15, 25, 25); // Direct addImage with URL
      }
    } catch (error) {
      console.log('Logo not available, proceeding without logo');
    }
 
    // Header text
    doc.setTextColor(0, 0, 0);
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
 
    // Calculate vendor section height dynamically based on content
    let vendorSectionHeight = 25; // Minimum height
 
    // Calculate additional height needed for vendor details
    if (selectedVendorName) {
      const vendor = outgoingVendor.find(v => v.vendorName === selectedVendorName);
      if (vendor) {
        // Note: VendorNameGet only has vendorId and vendorName, so no address/GST
        // vendorSectionHeight remains minimal; address/GST sections skipped below
      }
    }
 
    // Vendor and period info section with consistent border
    const vendorSectionY = 55;
    const vendorSectionWidth = 180;
 
    doc.setFillColor(255, 255, 255);
    doc.rect(15, vendorSectionY, vendorSectionWidth, vendorSectionHeight, 'F');
 
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    doc.rect(15, vendorSectionY, vendorSectionWidth, vendorSectionHeight);
 
    // Vendor details
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
 
    let currentY = vendorSectionY + 10;
 
    // Vendor information
    if (selectedVendorName) {
      doc.text(`Vendor: ${selectedVendorName}`, 20, currentY);
      currentY += 6;
     
      const vendor = outgoingVendor.find(v => v.vendorName === selectedVendorName);
      if (vendor) {
        // GSTIN: Skipped as not available in VendorNameGet
        // Address: Skipped as not available in VendorNameGet
      }
    }
 
    // Period information
    const startDate = moment(selectionRange.startDate).format('DD-MM-YYYY');
    const endDate = moment(selectionRange.endDate).format('DD-MM-YYYY');
    doc.text(`Period: ${startDate} to ${endDate}`, 20, currentY);
    currentY += 6;
 
    // Table section with same border width as vendor section
    const tableSectionY = vendorSectionY + vendorSectionHeight + 10;
    const tableSectionWidth = vendorSectionWidth; // Same width as vendor section
 
    // Prepare table data - SHOW NEGATIVE VALUES PROPERLY
    const columns = [
      { header: 'Date', dataKey: 'date' },
      { header: 'Particulars', dataKey: 'particulars' },
      { header: 'Status', dataKey: 'status' },
      { header: 'Debit (Rs.)', dataKey: 'debit' },
      { header: 'Credit (Rs.)', dataKey: 'credit' },
      { header: 'Balance (Rs.)', dataKey: 'balance' }
    ];
    // Use balance directly from API response - SHOW NEGATIVE VALUES
    const rows = transactions?.map((transaction) => {
      let balanceDisplay = '0.00';
      if (transaction.balance !== 0) {
        if (transaction.balance < 0) {
          balanceDisplay = `-${formatAmount(Math.abs(transaction.balance))} Dr`;
        } else {
          balanceDisplay = `${formatAmount(transaction.balance)} Cr`;
        }
      }
      return {
        date: formatDate(transaction.date),
        particulars: `${transaction.description}${transaction.notes ? `\n${transaction.notes}` : ''}`,
        status: transaction.status || 'N/A',
        debit: transaction.debit_amount > 0 ? formatAmount(transaction.debit_amount) : '0.00',
        credit: transaction.credit_amount > 0 ? formatAmount(transaction.credit_amount) : '0.00',
        balance: balanceDisplay
      };
    }) || [];
    // Calculate totals from actual transactions
    const totalDebit = transactions?.reduce((sum, t) => sum + t.debit_amount, 0) || 0;
    const totalCredit = transactions?.reduce((sum, t) => sum + t.credit_amount, 0) || 0;
 
    // Use the final balance from the last transaction
    const periodFinalBalance = transactions?.[transactions.length - 1]?.balance || 0;
    // Format final balance with negative sign
    let finalBalanceDisplay = '0.00';
    if (periodFinalBalance !== 0) {
      if (periodFinalBalance < 0) {
        finalBalanceDisplay = `-${formatAmount(Math.abs(periodFinalBalance))} Dr`;
      } else {
        finalBalanceDisplay = `${formatAmount(periodFinalBalance)} Cr`;
      }
    }
    // Add totals row
    rows.push({
      date: '',
      particulars: 'TOTAL',
      status: '',
      debit: formatAmount(totalDebit),
      credit: formatAmount(totalCredit),
      balance: finalBalanceDisplay
    });
    // Generate table and get the final Y position
    const tableResult = doc.autoTable({
      columns: columns,
      body: rows,
      startY: tableSectionY,
      margin: { left: 15, right: 15 },
      tableWidth: tableSectionWidth,
      styles: {
        fontSize: 9,
        cellPadding: 3, // Reduced padding to fit better
        overflow: 'linebreak',
        lineWidth: 0.2,
        lineColor: [0, 0, 0],
        textColor: [0, 0, 0],
        font: 'helvetica'
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        lineWidth: 0.2,
        lineColor: [0, 0, 0],
        fontSize: 9 // Slightly smaller header font
      },
      bodyStyles: {
        lineWidth: 0.2,
        lineColor: [0, 0, 0]
      },
      alternateRowStyles: {
        fillColor: [248, 248, 248]
      },
      // Adjusted column widths to fill entire table width (180mm)
      columnStyles: {
        date: { cellWidth: 25, halign: 'center' },
        particulars: { cellWidth: 67, halign: 'left' }, // Adjusted for new status column
        status: { cellWidth: 16, halign: 'center' },
        debit: { cellWidth: 22, halign: 'right' },
        credit: { cellWidth: 22, halign: 'right' },
        balance: { cellWidth: 28, halign: 'right', fontStyle: 'bold' }
      },
      // Remove horizontal scaling to use exact widths
      horizontalPageBreak: false,
      tableLineWidth: 0.2,
      // Add borders around the entire table
      didDrawPage: (data: any) => {
        // Draw border around the entire table section
        const tableHeight = data.cursor?.y ? data.cursor.y - tableSectionY : 100;
       
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.2);
        doc.rect(15, tableSectionY, tableSectionWidth, tableHeight);
       
        // Footer
        const pageHeight = doc.internal.pageSize.height;
        doc.setFillColor(255, 255, 255);
        doc.rect(0, pageHeight - 20, 210, 20, 'F');
       
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
       
        const currentPage = data.pageNumber;
        const totalPages = (doc as any).internal.getNumberOfPages();
       
        doc.text(`Page ${currentPage}`, 105, pageHeight - 12, { align: 'center' });
        doc.text(`Generated on ${moment().format('DD-MM-YYYY HH:mm')}`, 105, pageHeight - 6, { align: 'center' });
      }
    });
    // Alternative method to add footer and table borders to all pages
    const totalPages = (doc as any).internal.getNumberOfPages();
 
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      const pageHeight = doc.internal.pageSize.height;
     
      // White footer background
      doc.setFillColor(255, 255, 255);
      doc.rect(0, pageHeight - 20, 210, 20, 'F');
     
      // Footer text
      doc.setTextColor(0, 0, 0);
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
    const columns = ['Date', 'Particulars', 'Status', 'Debit', 'Credit', 'Balance'];
   
    // Use balance directly from API - SHOW NEGATIVE VALUES
    const rows = transactions?.map((transaction: Transaction) => {
      let balanceDisplay = '0.00';
      if (transaction.balance !== 0) {
        if (transaction.balance < 0) {
          balanceDisplay = `-${formatAmount(Math.abs(transaction.balance))} Dr`;
        } else {
          balanceDisplay = `${formatAmount(transaction.balance)} Cr`;
        }
      }

      return [
        formatDate(transaction.date),
        `${transaction.description}${transaction.notes ? ` - ${transaction.notes}` : ''}`,
        transaction.status || 'N/A',
        transaction.debit_amount > 0 ? formatAmount(transaction.debit_amount) : '0.00',
        transaction.credit_amount > 0 ? formatAmount(transaction.credit_amount) : '0.00',
        balanceDisplay,
      ];
    }) || [];

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

  // FIX: Debug transactions to see what's coming from API
  useEffect(() => {
    if (transactions && transactions.length > 0) {
      console.log('Transactions from API:', transactions);
      console.log('Transaction types:', transactions.map(t => ({
        type: t.type,
        description: t.description,
        amount: t.credit_amount > 0 ? t.credit_amount : t.debit_amount,
        balance: t.balance
      })));
    }
  }, [transactions]);

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

  // FIX: Check if we have invoice transactions
  const hasInvoices = transactions?.some(t => t.type === 'invoice');
  console.log('Has invoice transactions:', hasInvoices);

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
             {isModuleVisible("yenerp", "outgoingpayment") && (
              <Grid item>
                <Link href="/yen-book/OutgoingPaymentPage" passHref>
                  <Button variant="contained" size="small">
                    Outgoing Payment
                  </Button>
                </Link>
              </Grid>
            )}
            <Grid item>
              {isModuleVisible("yenerp", "advancepayment") && (
                <Link href="/yen-book/OutgoingPaymentPage/PreOutgoing" passHref>
                  <Button variant="contained" size="small">
                    Advance Payment
                  </Button>
                </Link>
              )}
            </Grid>
            {isModuleVisible("yenerp", "partialpayment") && (
              <Grid item>
                <Link
                  href="/yen-book/OutgoingPaymentPage/PendingPayment"
                  passHref
                >
                  <Button variant="contained" size="small">
                    Partial Payment
                  </Button>
                </Link>
              </Grid>
            )}
             <Grid item>
              {isModuleVisible("yenerp", "paymentdone") && (
                <Link href="/yen-book/OutgoingPaymentPage/PaidPayment" passHref>
                  <Button variant="contained" size="small">
                    Payment Done
                  </Button>
                </Link>
              )}
            </Grid>
            {isModuleVisible("yenerp", "ledger") && (
              <Grid item>
                <Button
                  variant="contained"
                  size="small"
                  sx={{
                    backgroundColor: "white",
                    color: "black",
                    "&:hover": { backgroundColor: "rgba(255, 255, 255, 0.8)" },
                  }}
                >
                  Ledger
                </Button>
              </Grid>
            )}
            <Grid item>
              {isModuleVisible("yenerp", "purchasereturn") && (
                <Link
                  href="/yen-book/OutgoingPaymentPage/PurchaseReturn"
                  passHref
                >
                  <Button variant="contained" size="small">
                    Purchase Return
                  </Button>
                </Link>
              )}
            </Grid>
          </Grid>
        </Box>

        {/* Filters */}
        <Box sx={{ p: 2, mb: 2 }}>
          <Grid container spacing={2} alignItems="center">
            {/* Vendor Selection - Updated for VendorNameGet */}
            <Grid item xs={12} md={4}>
              <Autocomplete
                value={outgoingVendor.find((v) => v.vendorName === selectedVendorName) || null}
                onChange={handleVendorChange}
                options={outgoingVendor}
                getOptionLabel={(option: VendorNameGet) => option.vendorName || ''} // Updated type
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

        {/* FIX: Debug information - remove in production
        {transactions && transactions.length > 0 && (
          <Box sx={{ p: 1, backgroundColor: '#f5f5f5', mb: 2, borderRadius: 1 }}>
            <Typography variant="caption" color="textSecondary">
              Debug: {transactions.length} transactions found. Types: {[...new Set(transactions.map(t => t.type))].join(', ')}
            </Typography>
          </Box>
        )} */}

        {/* Summary Cards - All-time */}
        {selectedVendorName && (
          <Grid container spacing={2} mb={2} mx={0.5}>
            <Grid item xs={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h6" color={allTimeOpeningBalance >= 0 ? 'primary.main' : 'error.main'}>
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
                  <Typography variant="h6" color={finalBalance > 0 ? 'warning.main' : 'info.main'}>
                    {formatCurrency(Math.abs(finalBalance))}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {finalBalance >= 0 ? 'We Owe Vendor' : 'Vendor Owes Us'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Ledger Table - Filtered */}
        <Paper sx={{ mb: 2,mx:1}}>
          <TableContainer sx={{
            maxHeight: 'calc(100vh - 370px)',
            overflowY: 'auto',
          }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>S.No</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>Particulars</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>Status</TableCell>
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
                        key={`${transaction.reference_id}-${index}-${transaction.type}`}
                        hover
                        sx={{
                          backgroundColor: transaction.type === 'opening_balance' ? '#e3f2fd' : 
                                         transaction.type === 'invoice' ? '#f3e5f5' : 'inherit',
                        }}
                      >
                      <TableCell>{index +1}</TableCell>
                        <TableCell>{formatDate(transaction.date)}</TableCell>
                        <TableCell>
                          {transaction.description}
                          {transaction.notes && (
                            <Typography variant="caption" color="textSecondary" display="block">
                              {transaction.notes}
                            </Typography>
                          )}
                          {/* FIX: Show transaction type for debugging */}
                          <Typography variant="caption" color="textSecondary" display="block">
                            Type: {transaction.type}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 'medium' }}>{transaction.status || 'N/A'}</TableCell>
                        <TableCell align="right">
                          {transaction.debit_amount > 0 ? formatAmount(transaction.debit_amount) : '0.00'}
                        </TableCell>
                        <TableCell align="right">
                          {transaction.credit_amount > 0 ? formatAmount(transaction.credit_amount) : '0.00'}
                        </TableCell>
                        <TableCell 
                          align="right" 
                          sx={{ 
                            fontWeight: 'medium',
                            color: transaction.balance < 0 ? '#d32f2f' : transaction.balance > 0 ? '#2e7d32' : 'inherit'
                          }}
                        >
                          {/* Show negative values properly */}
                          {transaction.balance === 0
                            ? '0.00'
                            : transaction.balance < 0
                              ? `-${formatAmount(Math.abs(transaction.balance))} Dr`
                              : `${formatAmount(transaction.balance)} Cr`}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ backgroundColor: '#f8f9fa' }}>
                      <TableCell colSpan={4} sx={{ fontWeight: 'bold' }}>TOTAL</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                        {formatAmount(totalDebit)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                        {formatAmount(totalCredit)}
                      </TableCell>
                      <TableCell 
                        align="right" 
                        sx={{ 
                          fontWeight: 'bold',
                          color: finalBalance < 0 ? '#d32f2f' : finalBalance > 0 ? '#2e7d32' : 'inherit'
                        }}
                      >
                        {/* Show final balance with proper negative sign */}
                        {finalBalance === 0
                          ? '0.00'
                          : finalBalance < 0
                            ? `-${formatAmount(Math.abs(finalBalance))} Dr`
                            : `${formatAmount(finalBalance)} Cr`}
                      </TableCell>
                    </TableRow>
                  </>
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
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
        <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm">
          <DialogTitle>
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
              sx={{ flex: 1, backgroundColor: '1976d2' }}
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