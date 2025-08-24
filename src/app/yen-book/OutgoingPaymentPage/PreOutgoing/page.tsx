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
import Add from '@mui/icons-material/Add'; // Import Add icon
import * as Yup from 'yup'; // For validation
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
    paymentType: 'full' | 'partial' | 'advance'; // Use the exact types required
    amount: string;
    paymentMethod: string;
    chequeNo: number;
    neftNo: string;
    cashVoucherNo: string;
    rtgsNo: string;
    pettyCashAmount: number;
    hoCash: number,
    impsNo: string;
    upi: string;
    transactionNumber: string;
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


  const handleCreatePaymentOpen = () => {
    setOpenPayDialog(true);
    handlePayDialogClose(); // Close the pay dialog when opening create vendor dialog
  };

  const handleVendorSelect = (vendor: VendorNameGet) => {
    setSelectedVendor(vendor);
    setPayDialogOpen(true); // Set to true to open the payment dialog
  };
  // Close dialog for selected vendor without removing the vendor
  const handlePayDialogClose = () => {
    setPayDialogOpen(false); // Just close the dialog
    // Don't reset the selected vendor
  };
  // Validation Schema
  const validationSchema = Yup.object({
    vendorName: Yup.string().required('Vendor Name is required'),
    contactpersonPhone: Yup.string().required('Phone number is required'),
    address: Yup.string().required('Address is required'),
  });

  const handleDialogClose = () => {
    setSelectedVendor(null);
  };
const handleConfirmPayment = async (paymentData: any) => {
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
    };

    try {
      const actionResult = await dispatch(addNewVendorPayment(dataToPost));
      if (addNewVendorPayment.fulfilled.match(actionResult)) {
        setSnackbarMessage(`Payment processed successfully. Debit Note: ${actionResult.payload.selectedDebitNotes?.[0] || 'N/A'}`);
        setPaymentDetails({
          outgoingId: '',
          paymentType: 'full',
          amount: '',
          paymentMethod: '',
          chequeNo: 0,
          pettyCashAmount: 0,
          hoCash: 0,
          neftNo: '',
          cashVoucherNo: '',
          rtgsNo: '',
          impsNo: '',
          upi: '',
          transactionNumber: '',
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
      upi: ''
    });
  };

  { loading && <CircularProgress /> }
  { error && <Typography color="error">{error}</Typography> }

  return (
    <Box sx={{ backgroundColor: 'white' }}>
      <YenBookPage />
      {/* First Row - Outgoing Payment, Pre Outgoing, Advance Payment, Partial Payment, Payment Done, Ledger buttons, and Typography */}
      <Box display="flex" alignItems="center" justifyContent="space-between" marginTop={1}>
        {/* Buttons */}
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
                backgroundColor: 'white', // White background
                color: 'black', // Black text
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.8)', // Slightly darker on hover
                },
                mr: 0.5,
              }}

            >
              Pre Outgoing
            </Button>
          </Link>
          <Link href="/yen-book/OutgoingPaymentPage/AdvancePayment" passHref>
            <Button variant="contained" color="primary" sx={{ mr: '2px' }} >
              Advance Payment
            </Button>
          </Link>
          <Link href="/yen-book/OutgoingPaymentPage/PendingPayment" passHref>
            <Button variant="contained" color="primary" sx={{ mr: '2px' }} >
              Partial Payment
            </Button>
          </Link>
          <Link href="/yen-book/OutgoingPaymentPage/PaidPayment" passHref>
            <Button variant="contained" color="primary" sx={{ mr: '2px' }} >
              Payment Done
            </Button>
          </Link>
          <Link href="/yen-book/OutgoingPaymentPage/Ledger" passHref>
            <Button variant="contained" color="primary" sx={{ mr: '2px' }} >
              Ledger
            </Button>
          </Link>

          <Link href="/yen-book/OutgoingPaymentPage/PurchaseReturn" passHref>
            <Button variant="contained" color="primary">Purchase Return</Button>
          </Link>
        </Box>
      </Box>
      {/* Vendor Selection and Create Button */}
      <Box mt={2} ml={2} sx={{ maxWidth: 500 }} display="flex" justifyContent="space-between" alignItems="center">
        <Autocomplete
          options={vendorName}
          getOptionLabel={(option: VendorNameGet) => option.vendorName || ''}
          isOptionEqualToValue={(option: VendorNameGet, value: VendorNameGet | null) => option.vendorId === value?.vendorId}
          value={selectedVendor}
          onChange={(event, newValue) => {
            // Only call handleVendorSelect if newValue is not null
            if (newValue) {
              handleVendorSelect(newValue);
            } else {
              // Handle the case where no vendor is selected, if necessary
              // For example, you could clear the selected vendor
              setSelectedVendor(null);
            }
          }}
          filterOptions={(options, { inputValue }) => {
            const lowercasedInput = inputValue.toLowerCase();
            return options.filter(option => option.vendorName.toLowerCase().startsWith(lowercasedInput));
          }}
          // Use renderOption to ensure that keys are unique based on vendorId
          renderOption={(props, option) => (
            <li {...props} key={option.vendorId}> {/* Use vendorId as the key */}
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
      {/* Create Vendor Modal */}
      <VendorDialog
        loading={dialogLoading}
        setLoading={setDialogLoading}
      />
      {/* Dialog for selected vendor */}
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
        <DialogContent>
          <Formik
            initialValues={{
              paymentMode: 'Cash', // Default value is Cash
              paymentType: 'full', // Default payment type
              amount: 0, // Default amount
              paymentMethod: '', // Default payment method
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
            }}
            onSubmit={async (values) => {
              console.log('Submitting payment details:', values);
              await handleConfirmPayment(values); // Pass the form values to the payment function
            }}
          >
            {({ values, handleChange, handleBlur, handleSubmit }) => (
              <Form onSubmit={handleSubmit}>
                <Grid container spacing={2} mt={2}>
                  {/* Payment Mode (Cash or Bank) */}
                  <Grid item xs={12}>
                    <TextField
                      label="Payment Mode"
                      select
                      fullWidth
                      name="paymentMode"
                      value={values.paymentMode}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      sx={{ marginBottom: 2 }}
                    >
                      <MenuItem value="Cash">Cash</MenuItem>
                      <MenuItem value="Bank">Bank</MenuItem>
                    </TextField>
                  </Grid>

                  {/* Payment Type (Full, Partial, Advance) */}
                  <Grid item xs={12}>
                    <TextField
                      label="Payment Type"
                      select
                      fullWidth
                      name="paymentType"
                      value={values.paymentType}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      sx={{ marginBottom: 2 }}
                    >
                      <MenuItem value="partial">Partial Payment</MenuItem>
                      <MenuItem value="full">Full Payment</MenuItem>
                      <MenuItem value="advance">Advance Payment</MenuItem>
                    </TextField>
                  </Grid>

                  {/* Amount Field */}
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
                      sx={{ marginBottom: 2 }}
                    />
                  </Grid>

                  {/* Payment Method (Cash-specific options) */}
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
                        sx={{ marginBottom: 2 }}
                      >
                        <MenuItem value="pettyCash">Petty Cash</MenuItem>
                        <MenuItem value="hoCash">HO Cash</MenuItem>
                      </TextField>
                    </Grid>
                  )}

                  {/* Payment Method (Bank-specific options) */}
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

                      <Grid item xs={12}>
                        <TextField
                          label="Payment Method"
                          select
                          fullWidth
                          name="paymentMethod"
                          value={values.paymentMethod}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          sx={{ marginBottom: 2 }}
                        >
                          <MenuItem value="neft">NEFT</MenuItem>
                          <MenuItem value="rtgs">RTGS</MenuItem>
                          <MenuItem value="imps">IMPS</MenuItem>
                          <MenuItem value="upi">UPI</MenuItem>
                        </TextField>
                      </Grid>

                      {/* Conditional Fields for Bank Methods */}
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

                <DialogActions>
                  <Button onClick={handleClosePayDialog}>Cancel</Button>
                  <Button type="submit">Confirm Payment</Button>
                </DialogActions>
              </Form>
            )}
          </Formik>
        </DialogContent>
      </Dialog>

      {/* Snackbar for notifications */}
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
