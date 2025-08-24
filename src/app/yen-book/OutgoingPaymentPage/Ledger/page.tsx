'use client'
import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
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
  DialogContent,
  DialogTitle,
  IconButton,
  Autocomplete,
  TextField,
  FormControl,
  Card,
  CardContent,
} from "@mui/material";
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DownloadIcon from '@mui/icons-material/Download';
import DescriptionIcon from '@mui/icons-material/Description';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import { ClearIcon } from "@mui/x-date-pickers/icons";
import {
  setSelectedVendorName,
  resetLedgerData,
  fetchLedgerData,
  selectLedger,
  Transaction,
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

const LedgerPage = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { ledgerData, loading, error, selectedVendorName, transactions } = useSelector(selectLedger);
  const [openDialog, setOpenDialog] = useState(false);
  const [outgoingVendor, setOutgoingVendor] = useState<VendorDetail[]>([]);
  const isFetchingRef = useRef(false);
  const isInitialLoad = useRef(true);
  const [selectionRange, setSelectionRange] = useState({
    startDate: new Date(),
    endDate: new Date(),
    key: 'selection',
  });
  // Format date helper
  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'N/A';
    try {
      return format(parseISO(dateString), 'dd-MM-yyyy HH:mm:ss a');
    } catch (error) {
      return format(new Date(dateString), 'dd-MM-yyyy HH:mm:ss a');
    }
  };

  // Format currency helper
  const formatCurrency = (amount: number): string => {
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
      } catch (error) {
        console.error('Error fetching ledger data:', error);
      } finally {
        isFetchingRef.current = false;
        console.log('isFetchingRef reset');
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

  const handleVendorChange = (event: React.SyntheticEvent, newValue: VendorDetail | null) => {
    dispatch(setSelectedVendorName(newValue?.vendorName || null));
  };

  const handleFilterClick = () => {
    if (!selectedVendorName) {
      console.log('No vendor selected for filtering.');
      return;
    }
    dispatch(fetchLedgerData(selectedVendorName));
  };

  const handleFilterClose = () => {
    dispatch(resetLedgerData());
  };

  const generateLedgerPDF = () => {
    const doc = new jsPDF();

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
    ]);

    doc.autoTable({
      head: [columns],
      body: rows,
      startY: 60,
      headStyles: {
        fillColor: [0, 0, 128],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: "bold"
      },
      bodyStyles: { fontSize: 7, textColor: [0, 0, 0] },
    });

    doc.save(`${selectedVendorName || 'Vendor'}_Ledger_Report.pdf`);
    setOpenDialog(false);
  };

  const generateLedgerCSV = () => {
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

    const csvData = [columns, ...rows];
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${selectedVendorName || 'Vendor'}_Ledger_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setOpenDialog(false);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={2}>
        <Typography color="error">Error: {error}</Typography>
        <Button onClick={() => dispatch(resetLedgerData())} sx={{ mt: 1 }}>
          Reset
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      {/* Header Controls */}
      <YenBookPage />
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
              onChange={handleVendorChange}
              options={outgoingVendor}
              getOptionLabel={(option: VendorDetail) => option.vendorName || ''}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Vendor"
                  variant="outlined"
                  size="small"
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
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="success.main">
                  {formatCurrency(ledgerData.totalPaidAmount)}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Total Paid
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card>
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
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

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
        </DialogContent>
        <DialogActions>
          <Button
            onClick={generateLedgerPDF}
            variant="contained"
            color="primary"
            startIcon={<PictureAsPdfIcon />}
          >
            Download PDF
          </Button>
          <Button
            onClick={generateLedgerCSV}
            variant="contained"
            color="secondary"
            startIcon={<DescriptionIcon />}
          >
            Download CSV
          </Button>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
    </Box>
  );
};

export default LedgerPage;