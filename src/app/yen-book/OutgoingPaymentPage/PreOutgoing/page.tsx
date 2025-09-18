"use client";
import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Modal,
  CircularProgress,
  TextField,
  Autocomplete,
  Grid,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
  DialogContent,
  DialogActions,
  Dialog,
  DialogTitle,
  IconButton,
} from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchVendorNames,
  selectVendorItems,
  addVendor,
  setDialogOpen,
  fetchVendorTypeItems
} from '../../../../features/yen-purchase/PurchaseMaster/vendorSlice';
import { AppDispatch } from '@/redux/store';
import { addNewVendorPayment, selectOutgoings } from '@/features/yen-purchase/Outgoing/outgoingPaymentSlice';
import { Formik, Form } from 'formik';
<<<<<<< HEAD
<<<<<<< HEAD
import Add from '@mui/icons-material/Add'; // Import Add icon
import * as Yup from 'yup'; // For validation
=======
import Add from '@mui/icons-material/Add';
import * as Yup from 'yup';
>>>>>>> recover-branch
=======
import Add from '@mui/icons-material/Add';
import * as Yup from 'yup';
>>>>>>> d185c94 (Overall disocunt amount)
import YenBookPage from '../../page';
import Link from 'next/link';
import VendorDialog from '@/components/yen-purchase/vendorcomponent/vendorDialog';
import { VendorNameGet } from '@/Models/vendor';

const VendorPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { items, loading, error, vendorName, vendorData, dialogOpen } = useSelector(selectVendorItems);
  const { banks } = useSelector(selectOutgoings);
  const [createVendorOpen, setCreateVendorOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<VendorNameGet | null>(null);
  const [dialogPayOpen, setPayDialogOpen] = useState(false);
  const [openPayDialog, setOpenPayDialog] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<{
    outgoingId: string;
<<<<<<< HEAD
<<<<<<< HEAD
    paymentType: 'full' | 'partial' | 'advance'; // Use the exact types required
=======
    paymentType: 'full' | 'partial' | 'advance';
>>>>>>> recover-branch
=======
    paymentType: 'full' | 'partial' | 'advance';
>>>>>>> d185c94 (Overall disocunt amount)
    amount: string;
    paymentMethod: string;
    chequeNo: number;
    neftNo: string;
    cashVoucherNo: string;
    rtgsNo: string;
    pettyCashAmount: number;
<<<<<<< HEAD
<<<<<<< HEAD
    hoCash: number,
    impsNo: string;
    upi: string;
    transactionNumber: string;
=======
    hoCash: number;
    impsNo: string;
    upi: string;
    transactionNumber: string;
    remarks: string;
>>>>>>> recover-branch
=======
    hoCash: number;
    impsNo: string;
    upi: string;
    transactionNumber: string;
    remarks: string;
>>>>>>> d185c94 (Overall disocunt amount)
  }>({
    outgoingId: '',
    paymentType: 'full',
    amount: '',
    paymentMethod: '',
    pettyCashAmount: 0,
    hoCash: 0,
    chequeNo: 0,
    neftNo: '',
    impsNo: '',
    upi: '',
    cashVoucherNo: '',
    rtgsNo: '',
    transactionNumber: '',
<<<<<<< HEAD
<<<<<<< HEAD
=======
    remarks: '',
>>>>>>> recover-branch
=======
    remarks: '',
>>>>>>> d185c94 (Overall disocunt amount)
  });

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [dialogLoading, setDialogLoading] = useState(false);

  useEffect(() => {
    dispatch(fetchVendorNames());
    dispatch(fetchVendorTypeItems());
  }, [dispatch]);

  const handleDialogOpen = () => {
    dispatch(setDialogOpen('edit'));
  };

<<<<<<< HEAD
<<<<<<< HEAD

  const handleCreatePaymentOpen = () => {
    setOpenPayDialog(true);
    handlePayDialogClose(); // Close the pay dialog when opening create vendor dialog
=======
  const handleCreatePaymentOpen = () => {
    setOpenPayDialog(true);
    handlePayDialogClose();
>>>>>>> recover-branch
=======
  const handleCreatePaymentOpen = () => {
    setOpenPayDialog(true);
    handlePayDialogClose();
>>>>>>> d185c94 (Overall disocunt amount)
  };

  const handleVendorSelect = (vendor: VendorNameGet) => {
    setSelectedVendor(vendor);
<<<<<<< HEAD
<<<<<<< HEAD
    setPayDialogOpen(true); // Set to true to open the payment dialog
=======
    setPayDialogOpen(true);
>>>>>>> d185c94 (Overall disocunt amount)
  };

  const handlePayDialogClose = () => {
    setPayDialogOpen(false);
  };
<<<<<<< HEAD
  // Validation Schema
  const validationSchema = Yup.object({
    vendorName: Yup.string().required('Vendor Name is required'),
    contactpersonPhone: Yup.string().required('Phone number is required'),
    address: Yup.string().required('Address is required'),
  });
=======
    setPayDialogOpen(true);
  };

  const handlePayDialogClose = () => {
    setPayDialogOpen(false);
  };
>>>>>>> recover-branch
=======
>>>>>>> d185c94 (Overall disocunt amount)

  const handleDialogClose = () => {
    setSelectedVendor(null);
  };
<<<<<<< HEAD
<<<<<<< HEAD
const handleConfirmPayment = async (paymentData: any) => {
=======
=======
>>>>>>> d185c94 (Overall disocunt amount)

  const validationSchema = Yup.object({
    vendorName: Yup.string().required('Vendor Name is required'),
    contactpersonPhone: Yup.string().required('Phone number is required'),
    address: Yup.string().required('Address is required'),
    paymentMode: Yup.string().required('Payment Mode is required'),
    paymentType: Yup.string().required('Payment Type is required'),
    amount: Yup.number().required('Amount is required').min(0.01, 'Amount must be greater than 0'),
    paymentMethod: Yup.string().required('Payment Method is required'),
    remarks: Yup.string().required('Remarks is required').min(1, 'Remarks cannot be empty'),
  });

  const handleConfirmPayment = async (paymentData: any) => {
<<<<<<< HEAD
>>>>>>> recover-branch
=======
>>>>>>> d185c94 (Overall disocunt amount)
    if (!selectedVendor) {
      setSnackbarMessage('No vendor selected.');
      setSnackbarOpen(true);
      return;
    }

    const amount = parseFloat(paymentData.amount) || 0;
    if (amount <= 0) {
      setSnackbarMessage('Invalid payment amount.');
      setSnackbarOpen(true);
      return;
    }

    const dataToPost = {
      vendorName: selectedVendor.vendorName,
      paymentType: paymentData.paymentType,
      paymentMode: paymentData.paymentMode,
      paymentMethod: paymentData.paymentMethod,
      bankName: paymentData.bankName || '',
      neftNo: paymentData.neftNo || '',
      rtgsNo: paymentData.rtgsNo || '',
      impsNo: paymentData.impsNo || '',
      upi: paymentData.upi || '',
      pettyCashAmount: paymentData.paymentMethod === 'pettyCash' ? amount : 0,
      hoCash: paymentData.paymentMethod === 'hoCash' ? amount : 0,
      fullPaymentAmount: paymentData.paymentType === 'full' ? amount : 0,
      partialAmount: paymentData.paymentType === 'partial' ? amount : 0,
      advanceAmount: paymentData.paymentType === 'advance' ? amount : 0,
      poId: paymentData.poId || null,
      grnId: paymentData.grnId || null,
      isPreOutgoing: !paymentData.poId,
<<<<<<< HEAD
<<<<<<< HEAD
=======
      remarks: paymentData.remarks,
      paymentDate: new Date().toISOString(), // Set current date in ISO format
>>>>>>> recover-branch
=======
      remarks: paymentData.remarks,
      paymentDate: new Date().toISOString(), // Set current date in ISO format
>>>>>>> d185c94 (Overall disocunt amount)
    };

    try {
      const actionResult = await dispatch(addNewVendorPayment(dataToPost));
      if (addNewVendorPayment.fulfilled.match(actionResult)) {
<<<<<<< HEAD
<<<<<<< HEAD
        setSnackbarMessage(`Payment processed successfully. Debit Note: ${actionResult.payload.selectedDebitNotes?.[0] || 'N/A'}`);
=======
        setSnackbarMessage(`Payment processed successfully. Advance ID: ${actionResult.payload.randomId}`);
>>>>>>> recover-branch
=======
        setSnackbarMessage(`Payment processed successfully. Advance ID: ${actionResult.payload.randomId}`);
>>>>>>> d185c94 (Overall disocunt amount)
        setPaymentDetails({
          outgoingId: '',
          paymentType: 'full',
          amount: '',
          paymentMethod: '',
          chequeNo: 0,
          pettyCashAmount: 0,
          hoCash: 0,
          neftNo: '',
<<<<<<< HEAD
<<<<<<< HEAD
          cashVoucherNo: '',
          rtgsNo: '',
=======
>>>>>>> d185c94 (Overall disocunt amount)
          impsNo: '',
          upi: '',
          cashVoucherNo: '',
          rtgsNo: '',
          transactionNumber: '',
<<<<<<< HEAD
=======
          impsNo: '',
          upi: '',
          cashVoucherNo: '',
          rtgsNo: '',
          transactionNumber: '',
          remarks: '',
>>>>>>> recover-branch
=======
          remarks: '',
>>>>>>> d185c94 (Overall disocunt amount)
        });
        setSelectedVendor(null);
        setOpenPayDialog(false);
      } else {
        setSnackbarMessage(`Payment failed: ${actionResult.payload || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      setSnackbarMessage(`An unexpected error occurred: ${error}`);
    }
    setSnackbarOpen(true);
  };

  const handleClosePayDialog = () => {
    setOpenPayDialog(false);
    setPaymentDetails({
      outgoingId: '',
      paymentMethod: '',
      chequeNo: 0,
      transactionNumber: '',
      pettyCashAmount: 0,
      hoCash: 0,
      neftNo: '',
      impsNo: '',
      cashVoucherNo: '',
      amount: '',
      paymentType: 'full',
      rtgsNo: '',
<<<<<<< HEAD
<<<<<<< HEAD
      upi: ''
=======
      upi: '',
      remarks: '',
>>>>>>> d185c94 (Overall disocunt amount)
    });
  };

  return (
    <Box sx={{ backgroundColor: 'white' }}>
      <YenBookPage />
      <Box display="flex" alignItems="center" justifyContent="space-between" marginTop={1}>
<<<<<<< HEAD
        {/* Buttons */}
=======
      upi: '',
      remarks: '',
    });
  };

  return (
    <Box sx={{ backgroundColor: 'white' }}>
      <YenBookPage />
      <Box display="flex" alignItems="center" justifyContent="space-between" marginTop={1}>
>>>>>>> recover-branch
=======
>>>>>>> d185c94 (Overall disocunt amount)
        <Box display="flex" alignItems="center">
          <Link href="/yen-book/OutgoingPaymentPage" passHref>
            <Button variant="contained" color="primary" sx={{ mr: '5px', ml: '15px' }}>
              Outgoing Payment
            </Button>
          </Link>
          <Link href="/yen-book/OutgoingPaymentPage/PreOutgoing" passHref>
            <Button
              variant="contained"
              sx={{
<<<<<<< HEAD
<<<<<<< HEAD
                backgroundColor: 'white', // White background
                color: 'black', // Black text
=======
                backgroundColor: 'white',
                color: 'black',
>>>>>>> d185c94 (Overall disocunt amount)
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                },
                mr: 0.5,
              }}
<<<<<<< HEAD

=======
                backgroundColor: 'white',
                color: 'black',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                },
                mr: 0.5,
              }}
>>>>>>> recover-branch
=======
>>>>>>> d185c94 (Overall disocunt amount)
            >
              Pre Outgoing
            </Button>
          </Link>
          <Link href="/yen-book/OutgoingPaymentPage/AdvancePayment" passHref>
<<<<<<< HEAD
<<<<<<< HEAD
            <Button variant="contained" color="primary" sx={{ mr: '2px' }} >
=======
            <Button variant="contained" color="primary" sx={{ mr: '2px' }}>
>>>>>>> recover-branch
=======
            <Button variant="contained" color="primary" sx={{ mr: '2px' }}>
>>>>>>> d185c94 (Overall disocunt amount)
              Advance Payment
            </Button>
          </Link>
          <Link href="/yen-book/OutgoingPaymentPage/PendingPayment" passHref>
<<<<<<< HEAD
<<<<<<< HEAD
            <Button variant="contained" color="primary" sx={{ mr: '2px' }} >
=======
            <Button variant="contained" color="primary" sx={{ mr: '2px' }}>
>>>>>>> recover-branch
=======
            <Button variant="contained" color="primary" sx={{ mr: '2px' }}>
>>>>>>> d185c94 (Overall disocunt amount)
              Partial Payment
            </Button>
          </Link>
          <Link href="/yen-book/OutgoingPaymentPage/PaidPayment" passHref>
<<<<<<< HEAD
<<<<<<< HEAD
            <Button variant="contained" color="primary" sx={{ mr: '2px' }} >
=======
            <Button variant="contained" color="primary" sx={{ mr: '2px' }}>
>>>>>>> recover-branch
=======
            <Button variant="contained" color="primary" sx={{ mr: '2px' }}>
>>>>>>> d185c94 (Overall disocunt amount)
              Payment Done
            </Button>
          </Link>
          <Link href="/yen-book/OutgoingPaymentPage/Ledger" passHref>
<<<<<<< HEAD
<<<<<<< HEAD
            <Button variant="contained" color="primary" sx={{ mr: '2px' }} >
              Ledger
            </Button>
          </Link>

=======
            <Button variant="contained" color="primary" sx={{ mr: '2px' }}>
              Ledger
            </Button>
          </Link>
>>>>>>> recover-branch
=======
            <Button variant="contained" color="primary" sx={{ mr: '2px' }}>
              Ledger
            </Button>
          </Link>
>>>>>>> d185c94 (Overall disocunt amount)
          <Link href="/yen-book/OutgoingPaymentPage/PurchaseReturn" passHref>
            <Button variant="contained" color="primary">Purchase Return</Button>
          </Link>
        </Box>
      </Box>
<<<<<<< HEAD
<<<<<<< HEAD
      {/* Vendor Selection and Create Button */}
=======
>>>>>>> recover-branch
=======
>>>>>>> d185c94 (Overall disocunt amount)
      <Box mt={2} ml={2} sx={{ maxWidth: 500 }} display="flex" justifyContent="space-between" alignItems="center">
        <Autocomplete
          options={vendorName}
          getOptionLabel={(option: VendorNameGet) => option.vendorName || ''}
          isOptionEqualToValue={(option: VendorNameGet, value: VendorNameGet | null) => option.vendorId === value?.vendorId}
          value={selectedVendor}
          onChange={(event, newValue) => {
<<<<<<< HEAD
<<<<<<< HEAD
            // Only call handleVendorSelect if newValue is not null
            if (newValue) {
              handleVendorSelect(newValue);
            } else {
              // Handle the case where no vendor is selected, if necessary
              // For example, you could clear the selected vendor
=======
            if (newValue) {
              handleVendorSelect(newValue);
            } else {
>>>>>>> recover-branch
=======
            if (newValue) {
              handleVendorSelect(newValue);
            } else {
>>>>>>> d185c94 (Overall disocunt amount)
              setSelectedVendor(null);
            }
          }}
          filterOptions={(options, { inputValue }) => {
            const lowercasedInput = inputValue.toLowerCase();
            return options.filter(option => option.vendorName.toLowerCase().startsWith(lowercasedInput));
          }}
<<<<<<< HEAD
<<<<<<< HEAD
          // Use renderOption to ensure that keys are unique based on vendorId
          renderOption={(props, option) => (
            <li {...props} key={option.vendorId}> {/* Use vendorId as the key */}
=======
          renderOption={(props, option) => (
            <li {...props} key={option.vendorId}>
>>>>>>> recover-branch
=======
          renderOption={(props, option) => (
            <li {...props} key={option.vendorId}>
>>>>>>> d185c94 (Overall disocunt amount)
              {option.vendorName}
            </li>
          )}
          renderInput={(params) => (
            <TextField {...params} label="Available Vendors" variant="outlined" size='small' sx={{ minWidth: 300 }} />
          )}
        />
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <IconButton color="primary" className='icon-button-outline' onClick={handleDialogOpen} size='small' sx={{ p: 0.3 }}>
            <Add />
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
            Add Vendor
          </Typography>
        </Box>
      </Box>
<<<<<<< HEAD
<<<<<<< HEAD
      {/* Create Vendor Modal */}
=======
>>>>>>> recover-branch
=======
>>>>>>> d185c94 (Overall disocunt amount)
      <VendorDialog
        loading={dialogLoading}
        setLoading={setDialogLoading}
      />
<<<<<<< HEAD
<<<<<<< HEAD
      {/* Dialog for selected vendor */}
=======
>>>>>>> recover-branch
=======
>>>>>>> d185c94 (Overall disocunt amount)
      <Modal open={dialogPayOpen} onClose={handlePayDialogClose}>
        <Box
          sx={{
            p: 4,
            backgroundColor: 'white',
            margin: 'auto',
            mt: 10,
            maxWidth: '400px',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: 24,
            borderRadius: 1,
          }}
        >
          <Typography variant="h6" gutterBottom>
            Selected Vendor
          </Typography>
          {selectedVendor && (
            <Typography variant="body1">{selectedVendor.vendorName}</Typography>
          )}
          <Box mt={2}>
            <Button variant="contained" color="primary" onClick={handleCreatePaymentOpen}>
              Pay
            </Button>
          </Box>
        </Box>
      </Modal>
      <Dialog open={openPayDialog} onClose={handleClosePayDialog}>
        <DialogTitle>Process Payment</DialogTitle>
<<<<<<< HEAD
<<<<<<< HEAD
        <DialogContent>
          <Formik
            initialValues={{
              paymentMode: 'Cash', // Default value is Cash
              paymentType: 'full', // Default payment type
              amount: 0, // Default amount
              paymentMethod: '', // Default payment method
=======
        <DialogContent sx={{ width: '500px', maxHeight: '600px' }}>
          <Formik
            initialValues={{
=======
        <DialogContent sx={{ width: '500px', maxHeight: '600px' }}>
          <Formik
            initialValues={{
>>>>>>> d185c94 (Overall disocunt amount)
              paymentMode: 'Cash',
              paymentType: 'full',
              amount: 0,
              paymentMethod: '',
<<<<<<< HEAD
>>>>>>> recover-branch
=======
>>>>>>> d185c94 (Overall disocunt amount)
              pettyCashAmount: 0,
              hoCashAmount: 0,
              chequeNo: 0,
              neftNo: '',
              cashVoucherNo: '',
              rtgsNo: '',
              transactionNumber: '',
              bankName: '',
              impsNo: '',
              upi: '',
<<<<<<< HEAD
<<<<<<< HEAD
=======
              remarks: '',
>>>>>>> d185c94 (Overall disocunt amount)
            }}
            validationSchema={Yup.object({
              paymentMode: Yup.string().required('Payment Mode is required'),
              paymentType: Yup.string().required('Payment Type is required'),
              amount: Yup.number().required('Amount is required').min(0.01, 'Amount must be greater than 0'),
              paymentMethod: Yup.string().required('Payment Method is required'),
              remarks: Yup.string().required('Remarks is required').min(1, 'Remarks cannot be empty'),
            })}
            onSubmit={async (values) => {
              console.log('Submitting payment details:', values);
              await handleConfirmPayment(values);
            }}
          >
            {({ values, handleChange, handleBlur, handleSubmit, errors, touched }) => (
              <Form onSubmit={handleSubmit}>
                <Grid container spacing={2} mt={2}>
<<<<<<< HEAD
                  {/* Payment Mode (Cash or Bank) */}
=======
              remarks: '',
            }}
            validationSchema={Yup.object({
              paymentMode: Yup.string().required('Payment Mode is required'),
              paymentType: Yup.string().required('Payment Type is required'),
              amount: Yup.number().required('Amount is required').min(0.01, 'Amount must be greater than 0'),
              paymentMethod: Yup.string().required('Payment Method is required'),
              remarks: Yup.string().required('Remarks is required').min(1, 'Remarks cannot be empty'),
            })}
            onSubmit={async (values) => {
              console.log('Submitting payment details:', values);
              await handleConfirmPayment(values);
            }}
          >
            {({ values, handleChange, handleBlur, handleSubmit, errors, touched }) => (
              <Form onSubmit={handleSubmit}>
                <Grid container spacing={2} mt={2}>
>>>>>>> recover-branch
=======
>>>>>>> d185c94 (Overall disocunt amount)
                  <Grid item xs={12}>
                    <TextField
                      label="Payment Mode"
                      select
                      fullWidth
                      name="paymentMode"
                      value={values.paymentMode}
                      onChange={handleChange}
                      onBlur={handleBlur}
<<<<<<< HEAD
<<<<<<< HEAD
=======
                      error={touched.paymentMode && !!errors.paymentMode}
                      helperText={touched.paymentMode && errors.paymentMode}
>>>>>>> recover-branch
=======
                      error={touched.paymentMode && !!errors.paymentMode}
                      helperText={touched.paymentMode && errors.paymentMode}
>>>>>>> d185c94 (Overall disocunt amount)
                      sx={{ marginBottom: 2 }}
                    >
                      <MenuItem value="Cash">Cash</MenuItem>
                      <MenuItem value="Bank">Bank</MenuItem>
                    </TextField>
                  </Grid>
<<<<<<< HEAD
<<<<<<< HEAD

                  {/* Payment Type (Full, Partial, Advance) */}
=======
>>>>>>> recover-branch
=======
>>>>>>> d185c94 (Overall disocunt amount)
                  <Grid item xs={12}>
                    <TextField
                      label="Payment Type"
                      select
                      fullWidth
                      name="paymentType"
                      value={values.paymentType}
                      onChange={handleChange}
                      onBlur={handleBlur}
<<<<<<< HEAD
<<<<<<< HEAD
=======
                      error={touched.paymentType && !!errors.paymentType}
                      helperText={touched.paymentType && errors.paymentType}
>>>>>>> recover-branch
=======
                      error={touched.paymentType && !!errors.paymentType}
                      helperText={touched.paymentType && errors.paymentType}
>>>>>>> d185c94 (Overall disocunt amount)
                      sx={{ marginBottom: 2 }}
                    >
                      <MenuItem value="partial">Partial Payment</MenuItem>
                      <MenuItem value="full">Full Payment</MenuItem>
                      <MenuItem value="advance">Advance Payment</MenuItem>
                    </TextField>
                  </Grid>
<<<<<<< HEAD
<<<<<<< HEAD

                  {/* Amount Field */}
=======
>>>>>>> recover-branch
=======
>>>>>>> d185c94 (Overall disocunt amount)
                  <Grid item xs={12}>
                    <TextField
                      label="Amount"
                      type="number"
                      fullWidth
                      name="amount"
                      autoComplete='off'
                      value={values.amount}
                      onChange={handleChange}
                      onBlur={handleBlur}
<<<<<<< HEAD
<<<<<<< HEAD
                      sx={{ marginBottom: 2 }}
                    />
                  </Grid>

                  {/* Payment Method (Cash-specific options) */}
=======
                      error={touched.amount && !!errors.amount}
                      helperText={touched.amount && errors.amount}
                      sx={{ marginBottom: 2 }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Remarks"
                      fullWidth
                      name="remarks"
                      autoComplete='off'
                      value={values.remarks}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.remarks && !!errors.remarks}
                      helperText={touched.remarks && errors.remarks}
                      sx={{ marginBottom: 2 }}
                    />
                  </Grid>
>>>>>>> recover-branch
=======
                      error={touched.amount && !!errors.amount}
                      helperText={touched.amount && errors.amount}
                      sx={{ marginBottom: 2 }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Remarks"
                      fullWidth
                      name="remarks"
                      autoComplete='off'
                      value={values.remarks}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.remarks && !!errors.remarks}
                      helperText={touched.remarks && errors.remarks}
                      sx={{ marginBottom: 2 }}
                    />
                  </Grid>
>>>>>>> d185c94 (Overall disocunt amount)
                  {values.paymentMode === 'Cash' && (
                    <Grid item xs={12}>
                      <TextField
                        label="Payment Method"
                        select
                        fullWidth
                        name="paymentMethod"
                        autoComplete='off'
                        value={values.paymentMethod}
                        onChange={handleChange}
                        onBlur={handleBlur}
<<<<<<< HEAD
<<<<<<< HEAD
=======
                        error={touched.paymentMethod && !!errors.paymentMethod}
                        helperText={touched.paymentMethod && errors.paymentMethod}
>>>>>>> recover-branch
=======
                        error={touched.paymentMethod && !!errors.paymentMethod}
                        helperText={touched.paymentMethod && errors.paymentMethod}
>>>>>>> d185c94 (Overall disocunt amount)
                        sx={{ marginBottom: 2 }}
                      >
                        <MenuItem value="pettyCash">Petty Cash</MenuItem>
                        <MenuItem value="hoCash">HO Cash</MenuItem>
                      </TextField>
                    </Grid>
                  )}
<<<<<<< HEAD
<<<<<<< HEAD

                  {/* Payment Method (Bank-specific options) */}
=======
>>>>>>> recover-branch
=======
>>>>>>> d185c94 (Overall disocunt amount)
                  {values.paymentMode === 'Bank' && (
                    <>
                      <Grid item xs={12}>
                        <TextField
                          label="Bank Name"
                          select
                          fullWidth
                          name="bankName"
                          value={values.bankName}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          sx={{ marginBottom: 2 }}
                        >
                          {banks.map((bank) => (
                            <MenuItem key={bank.bankMasterId} value={bank.bankName}>
                              {bank.bankName}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>
<<<<<<< HEAD
<<<<<<< HEAD

=======
>>>>>>> recover-branch
=======
>>>>>>> d185c94 (Overall disocunt amount)
                      <Grid item xs={12}>
                        <TextField
                          label="Payment Method"
                          select
                          fullWidth
                          name="paymentMethod"
                          value={values.paymentMethod}
                          onChange={handleChange}
                          onBlur={handleBlur}
<<<<<<< HEAD
<<<<<<< HEAD
=======
                          error={touched.paymentMethod && !!errors.paymentMethod}
                          helperText={touched.paymentMethod && errors.paymentMethod}
>>>>>>> recover-branch
=======
                          error={touched.paymentMethod && !!errors.paymentMethod}
                          helperText={touched.paymentMethod && errors.paymentMethod}
>>>>>>> d185c94 (Overall disocunt amount)
                          sx={{ marginBottom: 2 }}
                        >
                          <MenuItem value="neft">NEFT</MenuItem>
                          <MenuItem value="rtgs">RTGS</MenuItem>
                          <MenuItem value="imps">IMPS</MenuItem>
                          <MenuItem value="upi">UPI</MenuItem>
                        </TextField>
                      </Grid>
<<<<<<< HEAD
<<<<<<< HEAD

                      {/* Conditional Fields for Bank Methods */}
=======
>>>>>>> recover-branch
=======
>>>>>>> d185c94 (Overall disocunt amount)
                      {values.paymentMethod === 'neft' && (
                        <Grid item xs={12}>
                          <TextField
                            label="NEFT Number"
                            fullWidth
                            name="neftNo"
                            value={values.neftNo}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            sx={{ marginBottom: 2 }}
                          />
                        </Grid>
                      )}
<<<<<<< HEAD
<<<<<<< HEAD

=======
>>>>>>> recover-branch
=======
>>>>>>> d185c94 (Overall disocunt amount)
                      {values.paymentMethod === 'rtgs' && (
                        <Grid item xs={12}>
                          <TextField
                            label="RTGS Number"
                            fullWidth
                            name="rtgsNo"
                            value={values.rtgsNo}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            sx={{ marginBottom: 2 }}
                          />
                        </Grid>
                      )}
<<<<<<< HEAD
<<<<<<< HEAD

=======
>>>>>>> recover-branch
=======
>>>>>>> d185c94 (Overall disocunt amount)
                      {values.paymentMethod === 'imps' && (
                        <Grid item xs={12}>
                          <TextField
                            label="IMPS Number"
                            fullWidth
                            name="impsNo"
                            value={values.impsNo}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            sx={{ marginBottom: 2 }}
                          />
                        </Grid>
                      )}
<<<<<<< HEAD
<<<<<<< HEAD

=======
>>>>>>> recover-branch
=======
>>>>>>> d185c94 (Overall disocunt amount)
                      {values.paymentMethod === 'upi' && (
                        <Grid item xs={12}>
                          <TextField
                            label="UPI ID"
                            fullWidth
                            name="upi"
                            value={values.upi}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            sx={{ marginBottom: 2 }}
                          />
                        </Grid>
                      )}
                    </>
                  )}
                </Grid>
<<<<<<< HEAD
<<<<<<< HEAD

=======
>>>>>>> recover-branch
=======
>>>>>>> d185c94 (Overall disocunt amount)
                <DialogActions>
                  <Button onClick={handleClosePayDialog}>Cancel</Button>
                  <Button type="submit">Confirm Payment</Button>
                </DialogActions>
              </Form>
            )}
          </Formik>
        </DialogContent>
      </Dialog>
<<<<<<< HEAD
<<<<<<< HEAD

      {/* Snackbar for notifications */}
=======
>>>>>>> recover-branch
=======
>>>>>>> d185c94 (Overall disocunt amount)
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
      />
    </Box>
  );
};

export default VendorPage;
