<<<<<<< HEAD
'use client'
import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
=======
'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
>>>>>>> recover-branch
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
<<<<<<< HEAD
<<<<<<< HEAD
  DialogContent,
  DialogTitle,
  IconButton,
=======
  DialogTitle,
  DialogContent,
>>>>>>> d185c94 (Overall disocunt amount)
  Autocomplete,
  TextField,
  Card,
  CardContent,
<<<<<<< HEAD
} from "@mui/material";
=======
  DialogTitle,
  DialogContent,
  Autocomplete,
  TextField,
  Card,
  CardContent,
=======
>>>>>>> d185c94 (Overall disocunt amount)
  Container,
} from '@mui/material';
>>>>>>> recover-branch
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DownloadIcon from '@mui/icons-material/Download';
import DescriptionIcon from '@mui/icons-material/Description';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
<<<<<<< HEAD
import { ClearIcon } from "@mui/x-date-pickers/icons";
=======
import { ClearIcon } from '@mui/x-date-pickers/icons';
>>>>>>> recover-branch
import {
  setSelectedVendorName,
  resetLedgerData,
  fetchLedgerData,
  selectLedger,
  Transaction,
<<<<<<< HEAD
} from "../../../../features/yen-purchase/Outgoing/ledgerData";
import { AppDispatch } from "@/redux/store";
import { VendorDetail } from "@/Models/outgoingModel";
import { format, parseISO } from "date-fns";
import Papa from "papaparse";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import YenBookPage from "../../page";
import { fetchVendorDetails } from "@/features/yen-purchase/Outgoing/outgoingPaymentSlice";
import { fetchBusinesses } from "@/features/account-setting/businessSlice";
import moment from "moment";
import Link from "next/link";
=======
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
<<<<<<< HEAD
>>>>>>> recover-branch
=======
>>>>>>> d185c94 (Overall disocunt amount)

const LedgerPage = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { ledgerData, loading, error, selectedVendorName, transactions } = useSelector(selectLedger);
<<<<<<< HEAD
<<<<<<< HEAD
=======
  const { businesses } = useSelector((state: any) => state.business);
>>>>>>> recover-branch
=======
  const { businesses } = useSelector((state: any) => state.business);
>>>>>>> d185c94 (Overall disocunt amount)
  const [openDialog, setOpenDialog] = useState(false);
  const [outgoingVendor, setOutgoingVendor] = useState<VendorDetail[]>([]);
  const isFetchingRef = useRef(false);
  const isInitialLoad = useRef(true);
<<<<<<< HEAD
<<<<<<< HEAD
=======
  const today = new Date(); // Current date: September 15, 2025, 03:38 PM IST
>>>>>>> d185c94 (Overall disocunt amount)
  const [selectionRange, setSelectionRange] = useState({
    startDate: startOfMonth(today), // Start of current month: September 1, 2025
    endDate: endOfDay(today),      // End of today: September 15, 2025, 11:59 PM
    key: 'selection',
  });
<<<<<<< HEAD
=======

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

>>>>>>> d185c94 (Overall disocunt amount)
  // Format date helper
  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '';
    try {
<<<<<<< HEAD
      return format(parseISO(dateString), 'dd-MM-yyyy HH:mm:ss a');
    } catch (error) {
      return format(new Date(dateString), 'dd-MM-yyyy HH:mm:ss a');
=======
  const today = new Date(); // Current date: September 15, 2025, 03:38 PM IST
  const [selectionRange, setSelectionRange] = useState({
    startDate: startOfMonth(today), // Start of current month: September 1, 2025
    endDate: endOfDay(today),      // End of today: September 15, 2025, 11:59 PM
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
>>>>>>> recover-branch
=======
      return format(parseISO(dateString), 'MMM dd, yyyy');
    } catch (error) {
      return format(new Date(dateString), 'MMM dd, yyyy');
>>>>>>> d185c94 (Overall disocunt amount)
    }
  };

  // Format currency helper
  const formatCurrency = (amount: number): string => {
<<<<<<< HEAD
<<<<<<< HEAD
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  // Get transaction type display
  const getTransactionTypeDisplay = (type: string): string => {
    const typeMap: { [key: string]: string } = {
      'invoice': 'Invoice',
      'payment': 'Payment',
      'debit_note': 'Debit Note',
      'advance_payment': 'Advance Payment'
    };
    return typeMap[type] || type;
  };
  // Initial data fetching including vendors
  useEffect(() => {
    if (isInitialLoad.current) {
      console.log('Initial load: Fetching businesses and vendors');
=======
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
>>>>>>> recover-branch
=======
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
>>>>>>> d185c94 (Overall disocunt amount)
      dispatch(fetchBusinesses());
      dispatch(fetchVendorDetails({ fetchAll: true })).then((action) => {
        if (fetchVendorDetails.fulfilled.match(action)) {
          setOutgoingVendor(action.payload || []);
        }
      });
      isInitialLoad.current = false;
    }
  }, [dispatch]);

  // Fetch ledger data when vendor or date range changes
  useEffect(() => {
<<<<<<< HEAD
<<<<<<< HEAD
    console.log('useEffect for fetchLedgerData triggered with dependencies:', {
      selectedVendorName,
      selectionRange,
    });

    const fetchData = async () => {
      if (isFetchingRef.current || !selectedVendorName) {
        console.log('Fetch skipped: Already fetching or no vendor selected');
        return;
      }

      isFetchingRef.current = true;
      try {
        console.log('Starting fetchLedgerData for vendor:', selectedVendorName);
        const formattedStartDate = moment(selectionRange.startDate).startOf('day').toDate();
        const formattedEndDate = moment(selectionRange.endDate).endOf('day').toDate();

        await dispatch(fetchLedgerData(selectedVendorName));
        console.log('fetchLedgerData completed');
=======
    const fetchData = async () => {
      if (isFetchingRef.current || !selectedVendorName) return;
      isFetchingRef.current = true;
      try {
        const startDate = moment(selectionRange.startDate).format('YYYY-MM-DD');
        const endDate = moment(selectionRange.endDate).format('YYYY-MM-DD');
        await dispatch(fetchLedgerData({ vendorName: selectedVendorName, startDate, endDate }));
>>>>>>> recover-branch
=======
    const fetchData = async () => {
      if (isFetchingRef.current || !selectedVendorName) return;
      isFetchingRef.current = true;
      try {
        const startDate = moment(selectionRange.startDate).format('YYYY-MM-DD');
        const endDate = moment(selectionRange.endDate).format('YYYY-MM-DD');
        await dispatch(fetchLedgerData({ vendorName: selectedVendorName, startDate, endDate }));
>>>>>>> d185c94 (Overall disocunt amount)
      } catch (error) {
        console.error('Error fetching ledger data:', error);
      } finally {
        isFetchingRef.current = false;
<<<<<<< HEAD
<<<<<<< HEAD
        console.log('isFetchingRef reset');
=======
>>>>>>> d185c94 (Overall disocunt amount)
      }
    };

    fetchData();
  }, [dispatch, selectedVendorName, selectionRange.startDate, selectionRange.endDate]);


  // Get status color
  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'paid': return '#4caf50';
      case 'open': return '#ff9800';
      case 'partially paid': return '#2196f3';
      case 'fully paid': return '#4caf50';
      default: return '#757575';
    }
  };

=======
      }
    };
    fetchData();
  }, [dispatch, selectedVendorName, selectionRange.startDate, selectionRange.endDate]);

<<<<<<< HEAD
>>>>>>> recover-branch
=======
>>>>>>> d185c94 (Overall disocunt amount)
  const handleVendorChange = (event: React.SyntheticEvent, newValue: VendorDetail | null) => {
    dispatch(setSelectedVendorName(newValue?.vendorName || null));
  };

  const handleFilterClick = () => {
<<<<<<< HEAD
<<<<<<< HEAD
    if (!selectedVendorName) {
      console.log('No vendor selected for filtering.');
      return;
    }
    dispatch(fetchLedgerData(selectedVendorName));
=======
=======
>>>>>>> d185c94 (Overall disocunt amount)
    if (!selectedVendorName) return;
    const startDate = moment(selectionRange.startDate).format('YYYY-MM-DD');
    const endDate = moment(selectionRange.endDate).format('YYYY-MM-DD');
    dispatch(fetchLedgerData({ vendorName: selectedVendorName, startDate, endDate }));
<<<<<<< HEAD
>>>>>>> recover-branch
=======
>>>>>>> d185c94 (Overall disocunt amount)
  };

  const handleFilterClose = () => {
    dispatch(resetLedgerData());
  };

  const generateLedgerPDF = () => {
    const doc = new jsPDF();
<<<<<<< HEAD
<<<<<<< HEAD

    // Header
    doc.setFontSize(16);
    doc.text('Vendor Ledger Report', 105, 20, { align: 'center' });

    if (selectedVendorName) {
      doc.setFontSize(12);
      doc.text(`Vendor: ${selectedVendorName}`, 20, 30);
    }

    // Summary section
    if (ledgerData) {
      doc.setFontSize(10);
      doc.text(`Total Payable: ${formatCurrency(ledgerData.totalPayableAmount)}`, 20, 40);
      doc.text(`Total Paid: ${formatCurrency(ledgerData.totalPaidAmount)}`, 20, 45);
      doc.text(`Outstanding: ${formatCurrency(ledgerData.outstandingAmount)}`, 20, 50);
    }

    // Transaction table
    const columns = ["S.No", "Date", "Type", "Reference", "Description", "Debit", "Credit", "Balance"];

    const rows = transactions.map((transaction: Transaction, index: number) => [
      `${index + 1}`,
      formatDate(transaction.date),
      getTransactionTypeDisplay(transaction.type),
      transaction.reference_id || 'N/A',
      transaction.description || 'N/A',
      transaction.debit_amount ? formatCurrency(transaction.debit_amount) : '-',
      transaction.credit_amount ? formatCurrency(transaction.credit_amount) : '-',
      formatCurrency(transaction.balance),
=======
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

    // Add opening balance note
    const openingBalance = ledgerData?.outstandingAmount || 0;
    doc.text(
      `Opening Balance as of ${startDate}: ${formatCurrency(Math.abs(openingBalance))} ${openingBalance >= 0 ? 'Dr' : 'Cr'}`,
      20,
      54
    );

    // Table
    const columns = ['Date', 'Particulars', 'Debit', 'Credit', 'Balance'];
    const rows = transactions?.map((transaction: Transaction) => [
      formatDate(transaction.date),
=======
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

    // Add opening balance note
    const openingBalance = ledgerData?.outstandingAmount || 0;
    doc.text(
      `Opening Balance as of ${startDate}: ${formatCurrency(Math.abs(openingBalance))} ${openingBalance >= 0 ? 'Dr' : 'Cr'}`,
      20,
      54
    );

    // Table
    const columns = ['Date', 'Particulars', 'Debit', 'Credit', 'Balance'];
    const rows = transactions?.map((transaction: Transaction) => [
      formatDate(transaction.date),
>>>>>>> d185c94 (Overall disocunt amount)
      `${transaction.description}${transaction.notes ? `\n${transaction.notes}` : ''}`,
      transaction.debit_amount > 0 ? formatAmount(transaction.debit_amount) : '0.00',
      transaction.credit_amount > 0 ? formatAmount(transaction.credit_amount) : '0.00',
      transaction.balance === 0 
        ? '0.00'
        : `${formatAmount(Math.abs(transaction.balance))} ${transaction.balance >= 0 ? 'Dr' : 'Cr'}`,
    ]) || [];

    // Add totals
    const totalDebit = transactions?.reduce((sum, t) => sum + t.debit_amount, 0) || 0;
    const totalCredit = transactions?.reduce((sum, t) => sum + t.credit_amount, 0) || 0;
    const finalBalance = transactions?.[transactions.length - 1]?.balance || openingBalance;

    rows.push([
      '',
      'Total',
      formatAmount(totalDebit),
      formatAmount(totalCredit),
      finalBalance === 0 
        ? '0.00'
        : `${formatAmount(Math.abs(finalBalance))} ${finalBalance >= 0 ? 'Dr' : 'Cr'}`,
<<<<<<< HEAD
>>>>>>> recover-branch
=======
>>>>>>> d185c94 (Overall disocunt amount)
    ]);

    doc.autoTable({
      head: [columns],
      body: rows,
      startY: 60,
<<<<<<< HEAD
<<<<<<< HEAD
      headStyles: {
        fillColor: [0, 0, 128],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: "bold"
      },
      bodyStyles: { fontSize: 7, textColor: [0, 0, 0] },
    });

    doc.save(`${selectedVendorName || 'Vendor'}_Ledger_Report.pdf`);
=======
=======
>>>>>>> d185c94 (Overall disocunt amount)
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
<<<<<<< HEAD
>>>>>>> recover-branch
=======
>>>>>>> d185c94 (Overall disocunt amount)
    setOpenDialog(false);
  };

  const generateLedgerCSV = () => {
<<<<<<< HEAD
<<<<<<< HEAD
    const columns = ["S.No", "Date", "Type", "Reference", "Description", "Debit", "Credit", "Balance"];

    const rows = transactions.map((transaction: Transaction, index: number) => [
      `${index + 1}`,
      formatDate(transaction.date),
      getTransactionTypeDisplay(transaction.type),
      transaction.reference_id || 'N/A',
      transaction.description || 'N/A',
      transaction.debit_amount || 0,
      transaction.credit_amount || 0,
      transaction.balance,
    ]);
=======
    const columns = ['Date', 'Particulars', 'Debit', 'Credit', 'Balance'];
    const rows = transactions?.map((transaction: Transaction) => [
      formatDate(transaction.date),
      `${transaction.description}${transaction.notes ? ` - ${transaction.notes}` : ''}`,
      transaction.debit_amount || '0.00',
      transaction.credit_amount || '0.00',
      transaction.balance === 0 
        ? '0.00'
        : `${formatAmount(Math.abs(transaction.balance))} ${transaction.balance >= 0 ? 'Dr' : 'Cr'}`,
    ]) || [];
>>>>>>> d185c94 (Overall disocunt amount)

    const csvData = [columns, ...rows];
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
<<<<<<< HEAD
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${selectedVendorName || 'Vendor'}_Ledger_Report.csv`);
=======
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${selectedVendorName}_Ledger.csv`);
>>>>>>> d185c94 (Overall disocunt amount)
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setOpenDialog(false);
  };

  // Calculate totals
  const totalDebit = transactions?.reduce((sum, t) => sum + t.debit_amount, 0) || 0;
  const totalCredit = transactions?.reduce((sum, t) => sum + t.credit_amount, 0) || 0;
  const finalBalance = transactions?.[transactions.length - 1]?.balance || ledgerData?.outstandingAmount || 0;
  const openingBalance = ledgerData?.outstandingAmount || 0;

  if (loading) {
    return (
<<<<<<< HEAD
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <CircularProgress />
      </Box>
=======
    const columns = ['Date', 'Particulars', 'Debit', 'Credit', 'Balance'];
    const rows = transactions?.map((transaction: Transaction) => [
      formatDate(transaction.date),
      `${transaction.description}${transaction.notes ? ` - ${transaction.notes}` : ''}`,
      transaction.debit_amount || '0.00',
      transaction.credit_amount || '0.00',
      transaction.balance === 0 
        ? '0.00'
        : `${formatAmount(Math.abs(transaction.balance))} ${transaction.balance >= 0 ? 'Dr' : 'Cr'}`,
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

  // Calculate totals
  const totalDebit = transactions?.reduce((sum, t) => sum + t.debit_amount, 0) || 0;
  const totalCredit = transactions?.reduce((sum, t) => sum + t.credit_amount, 0) || 0;
  const finalBalance = transactions?.[transactions.length - 1]?.balance || ledgerData?.outstandingAmount || 0;
  const openingBalance = ledgerData?.outstandingAmount || 0;

  if (loading) {
    return (
=======
>>>>>>> d185c94 (Overall disocunt amount)
      <Container maxWidth="lg">
        <Box display="flex" justifyContent="center" alignItems="center" height="50vh">
          <CircularProgress size={60} />
        </Box>
      </Container>
<<<<<<< HEAD
>>>>>>> recover-branch
=======
>>>>>>> d185c94 (Overall disocunt amount)
    );
  }

  if (error) {
    return (
<<<<<<< HEAD
<<<<<<< HEAD
      <Box p={2}>
        <Typography color="error">Error: {error}</Typography>
        <Button onClick={() => dispatch(resetLedgerData())} sx={{ mt: 1 }}>
          Reset
        </Button>
      </Box>
=======
=======
>>>>>>> d185c94 (Overall disocunt amount)
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
<<<<<<< HEAD
>>>>>>> recover-branch
=======
>>>>>>> d185c94 (Overall disocunt amount)
    );
  }

  return (
<<<<<<< HEAD
<<<<<<< HEAD
    <Box>
            <YenBookPage />
<Box sx={{ px: 1 }}>
      {/* Header Controls */}

      <Box sx={{ p: 1, backgroundColor: "white" }}>
          <Grid container alignItems="center" justifyContent="flex-start">
            {/* Navigation Buttons */}
            <Grid item>
              <Link href="/yen-book/OutgoingPaymentPage" passHref>
                <Button variant="contained" color="primary" sx={{ mr: 1 }}>
                  Outgoing Payment
                </Button>
              </Link>
            </Grid>
            <Grid item>
              <Link href="/yen-book/OutgoingPaymentPage/PreOutgoing" passHref>
                <Button variant="contained" color="primary" sx={{ mr: 1 }}>
                  Pre Outgoing
                </Button>
              </Link>
            </Grid>
            <Grid item>
              <Link href="/yen-book/OutgoingPaymentPage/AdvancePayment" passHref>
                <Button variant="contained" color="primary" sx={{ mr: 1 }}>
                  Advance Payment
                </Button>
              </Link>
            </Grid>
            <Grid item>
              <Link href="/yen-book/OutgoingPaymentPage/PendingPayment" passHref>
                <Button variant="contained" color="primary" sx={{ mr: 1 }}>
                  Partial Payment
                </Button>
              </Link>
            </Grid>
            <Grid item>
              <Link href="/yen-book/OutgoingPaymentPage/PaidPayment" passHref>
                <Button variant="contained" color="primary" sx={{ mr: 1 }}>
                  Payment Done
                </Button>
              </Link>
            </Grid>
            <Grid item>
              <Link href="/yen-book/OutgoingPaymentPage/Ledger" passHref>
                <Button variant="contained" sx={{
                  backgroundColor: 'white',
                  color: 'black',
                  '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.8)' },
                  mr: 1
                }}>
                  Ledger
                </Button>
              </Link>
            </Grid>
            <Grid item>
              <Link href="/yen-book/OutgoingPaymentPage/PurchaseReturn" passHref>
                <Button variant="contained" color="primary">Purchase Return</Button>
              </Link>
            </Grid>
</Grid>
      <Grid container spacing={2} alignItems="center" sx={{ mb: 2,mt:2}}>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth>
            <Autocomplete
              value={outgoingVendor.find(v => v.vendorName === selectedVendorName) || null}
=======
=======
>>>>>>> d185c94 (Overall disocunt amount)
    <Box maxWidth="xl" sx={{ py: 2 }}>
      {/* Navigation Buttons */}
      <YenBookPage />
      <Paper sx={{ pl: 2, mb: 2 }}>
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
                Pre Outgoing
              </Button>
            </Link>
          </Grid>
          <Grid item>
            <Link href="/yen-book/OutgoingPaymentPage/AdvancePayment" passHref>
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
            <Button variant="outlined" size="small"  sx={{
                      backgroundColor: 'white', // White background
                      color: 'black', // Black text
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.8)', // Slightly darker on hover
                      },
                      mr: 1,
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
<<<<<<< HEAD
>>>>>>> recover-branch
=======
>>>>>>> d185c94 (Overall disocunt amount)
              onChange={handleVendorChange}
              options={outgoingVendor}
              getOptionLabel={(option: VendorDetail) => option.vendorName || ''}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Vendor"
                  variant="outlined"
                  size="small"
<<<<<<< HEAD
<<<<<<< HEAD
                />
              )}
            />
          </FormControl>
        </Grid>

        <Grid item>
          <Button
            variant="contained"
            startIcon={<FilterAltIcon />}
            onClick={handleFilterClick}
            disabled={!selectedVendorName}
          >
            Filter
          </Button>
        </Grid>

        <Grid item>
          <Button
            variant="outlined"
            startIcon={<ClearIcon />}
            onClick={handleFilterClose}
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
          >
            Download
          </Button>
        </Grid>
      </Grid>

      {/* Summary Cards */}
      {ledgerData && (
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="primary">
                  {formatCurrency(ledgerData.totalPayableAmount)}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Total Payable
=======
                  fullWidth
                />
              )}
            />
=======
                  fullWidth
                />
              )}
            />
>>>>>>> d185c94 (Overall disocunt amount)
          </Grid>
          <Grid item xs={12} md={4}>
            <DateRangeDialog
              selectionRange={selectionRange}
              setSelectionRange={setSelectionRange}
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

     
      {/* Summary Cards */}
      {selectedVendorName && (
        <Grid container spacing={2} mb={2}>
          <Grid item xs={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h6" color="primary.main">
                  {formatCurrency(Math.abs(openingBalance))}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Opening Balance {openingBalance >= 0 ? '(Dr)' : '(Cr)'}
<<<<<<< HEAD
>>>>>>> recover-branch
=======
>>>>>>> d185c94 (Overall disocunt amount)
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card>
<<<<<<< HEAD
<<<<<<< HEAD
              <CardContent>
                <Typography variant="h6" color="success.main">
                  {formatCurrency(ledgerData.totalPaidAmount)}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Total Paid
=======
=======
>>>>>>> d185c94 (Overall disocunt amount)
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h6" color="error.main">
                  {formatCurrency(totalDebit)}
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
                  {formatCurrency(totalCredit)}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Total Bills/Invoices
<<<<<<< HEAD
>>>>>>> recover-branch
=======
>>>>>>> d185c94 (Overall disocunt amount)
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card>
<<<<<<< HEAD
<<<<<<< HEAD
              <CardContent>
                <Typography variant="h6" color="info.main">
                  {formatCurrency(ledgerData.totalDebitAmount)}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Total Debit Notes
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="warning.main">
                  {formatCurrency(ledgerData.outstandingAmount)}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Outstanding
=======
=======
>>>>>>> d185c94 (Overall disocunt amount)
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h6" color="warning.main">
                  {formatCurrency(Math.max(0, finalBalance))}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Outstanding Amount
<<<<<<< HEAD
>>>>>>> recover-branch
=======
>>>>>>> d185c94 (Overall disocunt amount)
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

<<<<<<< HEAD
<<<<<<< HEAD
      {/* Transactions Table */}
      <TableContainer component={Paper} sx={{ maxHeight: '60vh' }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>S.No</TableCell>
              <TableCell>Date & Time</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Reference</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="right">Debit (₹)</TableCell>
              <TableCell align="right">Credit (₹)</TableCell>
              <TableCell align="right">Balance (₹)</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {transactions && transactions.length > 0 ? (
              transactions.map((transaction: Transaction, index: number) => (
                <TableRow key={`${transaction.reference_id}-${index}`} hover>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(transaction.date)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {getTransactionTypeDisplay(transaction.type)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="primary">
                      {transaction.reference_id || 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {transaction.description || 'N/A'}
                    </Typography>
                    {transaction.notes && (
                      <Typography variant="caption" color="textSecondary" display="block">
                        {transaction.notes}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      color={transaction.debit_amount > 0 ? "error.main" : "textSecondary"}
                      fontWeight={transaction.debit_amount > 0 ? "medium" : "normal"}
                    >
                      {transaction.debit_amount > 0 ? formatCurrency(transaction.debit_amount) : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      color={transaction.credit_amount > 0 ? "success.main" : "textSecondary"}
                      fontWeight={transaction.credit_amount > 0 ? "medium" : "normal"}
                    >
                      {transaction.credit_amount > 0 ? formatCurrency(transaction.credit_amount) : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="medium">
                      {formatCurrency(transaction.balance)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="caption"
                      sx={{
                        color: getStatusColor(transaction.status),
                        fontWeight: 'medium'
                      }}
                    >
                      {transaction.status}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <Typography variant="body2" color="textSecondary">
                    {selectedVendorName
                      ? 'No transactions found for the selected vendor'
                      : 'Please select a vendor to view ledger data'
                    }
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Download Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>Choose Download Format</DialogTitle>
        <DialogContent>
          <Typography>Select the file format you want to download:</Typography>
=======
=======
>>>>>>> d185c94 (Overall disocunt amount)
      {/* Ledger Table */}
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
                          : `${formatAmount(Math.abs(transaction.balance))} ${transaction.balance >= 0 ? 'Dr' : 'Cr'}`}
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
                        : `${formatAmount(Math.abs(finalBalance))} ${finalBalance >= 0 ? 'Dr' : 'Cr'}`}
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
                    {selectedVendorName && openingBalance !== 0 && (
                      <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                        Opening Balance: {formatCurrency(Math.abs(openingBalance))} {openingBalance >= 0 ? 'Dr' : 'Cr'}
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
<<<<<<< HEAD
>>>>>>> recover-branch
=======
>>>>>>> d185c94 (Overall disocunt amount)
        </DialogContent>
        <DialogActions>
          <Button
            onClick={generateLedgerPDF}
            variant="contained"
<<<<<<< HEAD
<<<<<<< HEAD
            color="primary"
            startIcon={<PictureAsPdfIcon />}
          >
            Download PDF
=======
=======
>>>>>>> d185c94 (Overall disocunt amount)
            startIcon={<PictureAsPdfIcon />}
            color="primary"
          >
            PDF
<<<<<<< HEAD
>>>>>>> recover-branch
=======
>>>>>>> d185c94 (Overall disocunt amount)
          </Button>
          <Button
            onClick={generateLedgerCSV}
            variant="contained"
<<<<<<< HEAD
<<<<<<< HEAD
            color="secondary"
            startIcon={<DescriptionIcon />}
          >
            Download CSV
=======
=======
>>>>>>> d185c94 (Overall disocunt amount)
            startIcon={<DescriptionIcon />}
            color="secondary"
          >
            CSV
<<<<<<< HEAD
>>>>>>> recover-branch
=======
>>>>>>> d185c94 (Overall disocunt amount)
          </Button>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
<<<<<<< HEAD
    </Box>
    </Box>
    
=======
>>>>>>> recover-branch
  );
};

export default LedgerPage;