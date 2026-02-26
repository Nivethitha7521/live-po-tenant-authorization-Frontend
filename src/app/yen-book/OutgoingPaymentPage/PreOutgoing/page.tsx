"use client";
import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Typography,
  Dialog,
  DialogContent,
  DialogActions,
  DialogTitle,
  TextField,
  Autocomplete,
  Grid,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  MenuItem,
} from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchVendorNames,
  selectVendorItems,
  setDialogOpen,
} from "../../../../features/yen-purchase/PurchaseMaster/vendorSlice";
import {
  fetchAdvances,
  createAdvancePayment,
  selectAdvances,
  setSnackbarMessage,
  setSnackbarOpen,
  clearSnackbarMessage,
} from "../../../../features/yen-purchase/Outgoing/advancePaymentSlice";
import { fetchVendorTypeItems } from "@/features/yen-purchase/PurchaseMaster/VendorTypeSlice";

import { AppDispatch, RootState } from "@/redux/store";
import { Formik, Form } from "formik";
import * as Yup from "yup";
import YenBookPage from "../../page";
import Link from "next/link";
import VendorDialog from "@/components/yen-purchase/vendorcomponent/vendorDialog";
import { VendorNameGet, AdvancePayment } from "@/Models/advanceModel";
import AddIcon from "@mui/icons-material/Add";
import { format } from "date-fns";
import { fetchBank } from "@/features/yen-purchase/Outgoing/outgoingPaymentSlice";
import { usePermissions } from "@/hooks/usePermissions";

const AdvancePaymentPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
   const { hasPermission, isModuleVisible } = usePermissions();

  const canRead = hasPermission("yenerp", "advancepayment", "read");
  const canAdd = hasPermission("yenerp", "advancepayment", "add");
  const isVisible = isModuleVisible("yenerp", "advancepayment");

  const { vendorName, loading: vendorLoading, dialogOpen } = useSelector(selectVendorItems);
  const { advances, loading: paymentLoading, snackbarMessage, snackbarOpen } = useSelector(selectAdvances);
  const [selectedVendor, setSelectedVendor] = useState<VendorNameGet | null>(null);
  const [openNewPaymentDialog, setOpenNewPaymentDialog] = useState(false);
  const { banks } = useSelector((state: RootState) => state.outgoingPayment);

  const uniqueVendorNames = Array.from(
    new Map(vendorName.map((item: VendorNameGet) => [item.vendorId, item])).values()
  );

  const uniqueBanks = Array.from(
    new Map(banks.map((bank: any) => [bank.bankMasterId, bank])).values()
  );

  // Improved unique advances with better duplicate detection
  const getUniqueAdvances = (advances: AdvancePayment[]) => {
    const seen = new Set();
    return advances.filter(payment => {
      const key = `${payment.advanceId}-${payment.vendorName}-${payment.createdDate}-${payment.amount}`;
      if (seen.has(key)) {
        console.warn(`Duplicate advance payment detected: ${key}`);
        return false;
      }
      seen.add(key);
      return true;
    });
  };

  const displayAdvances = getUniqueAdvances(advances);

  useEffect(() => {
    dispatch(fetchVendorNames());
  
    dispatch(
      fetchAdvances({
        filterBy: "createdDate",
      })
    );
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchBank());
  }, [dispatch]);

  const handleVendorSelect = (vendor: VendorNameGet | null) => {
    setSelectedVendor(vendor);
    if (vendor) {
      dispatch(
        fetchAdvances({
          filterBy: "createdDate",
          vendorName: vendor.vendorName,
        })
      );
    } else {
      dispatch(
        fetchAdvances({
          filterBy: "createdDate",
        })
      );
    }
  };

  const handleOpenNewPaymentDialog = () => {
    setOpenNewPaymentDialog(true);
  };

  const handleCloseNewPaymentDialog = () => {
    setOpenNewPaymentDialog(false);
  };

  const handleDialogOpen = () => {
    dispatch(setDialogOpen("edit"));
  };

  const validationSchema = Yup.object({
    vendor: Yup.object().required("Vendor is required").nullable(),
    amount: Yup.number()
      .required("Amount is required")
      .min(0.01, "Amount must be greater than 0"),
    paymentMode: Yup.string()
      .required("Payment Mode is required")
      .oneOf(["Cash", "Bank"], "Payment Mode must be Cash or Bank"),
    paymentMethod: Yup.string().when("paymentMode", {
      is: (paymentMode: string) => paymentMode === "Bank",
      then: (schema) =>
        schema
          .required("Payment Method is required")
          .oneOf(["neft", "rtgs", "imps", "upi"], "Invalid Payment Method"),
      otherwise: (schema) => schema.optional(),
    }),
    bankName: Yup.string().when("paymentMode", {
      is: (paymentMode: string) => paymentMode === "Bank",
      then: (schema) => schema.required("Bank Name is required for Bank payments"),
      otherwise: (schema) => schema.optional(),
    }),
    neftNo: Yup.string().when("paymentMethod", {
      is: (paymentMethod: string) => paymentMethod === "neft",
      then: (schema) => schema.required("NEFT Number is required"),
      otherwise: (schema) => schema.optional(),
    }),
    rtgsNo: Yup.string().when("paymentMethod", {
      is: (paymentMethod: string) => paymentMethod === "rtgs",
      then: (schema) => schema.required("RTGS Number is required"),
      otherwise: (schema) => schema.optional(),
    }),
    impsNo: Yup.string().when("paymentMethod", {
      is: (paymentMethod: string) => paymentMethod === "imps",
      then: (schema) => schema.required("IMPS Number is required"),
      otherwise: (schema) => schema.optional(),
    }),
    upi: Yup.string().when("paymentMethod", {
      is: (paymentMethod: string) => paymentMethod === "upi",
      then: (schema) => schema.required("UPI ID/Number is required"),
      otherwise: (schema) => schema.optional(),
    }),
    remarks: Yup.string().optional(),
  });

  const handleNewPaymentSubmit = async (values: any) => {
    const paymentData: Partial<AdvancePayment> = {
      vendorId: values.vendor.vendorId,
      vendorName: values.vendor.vendorName,
      amount: parseFloat(values.amount),
      paymentType: "advance",
      paymentMode: values.paymentMode,
      paymentMethod: values.paymentMode === "Cash" ? undefined : values.paymentMethod,
      bankName: values.paymentMode === "Bank" ? values.bankName : undefined,
      neftNo: values.paymentMethod === "neft" ? values.neftNo : undefined,
      rtgsNo: values.paymentMethod === "rtgs" ? values.rtgsNo : undefined,
      impsNo: values.paymentMethod === "imps" ? values.impsNo : undefined,
      upi: values.paymentMethod === "upi" ? values.upi : undefined,
      remarks: values.remarks || undefined,
      paymentHistory: [],
    };

    try {
      await dispatch(createAdvancePayment(paymentData)).unwrap();
      setOpenNewPaymentDialog(false);
      setSelectedVendor(values.vendor);
      dispatch(
        fetchAdvances({
          filterBy: "createdDate",
          vendorName: values.vendor.vendorName,
        })
      );
      dispatch(setSnackbarMessage("Advance payment created successfully"));
      dispatch(setSnackbarOpen(true));
    } catch (error: any) {
      dispatch(setSnackbarMessage(`Failed to create advance payment: ${error}`));
      dispatch(setSnackbarOpen(true));
    }
  };
 if (!canRead) {
    return (
      <Box p={2}>
        <Typography color="error">
          You do not have access to the Advance Payment module.
        </Typography>
      </Box>
    );
  }
  return (
    <Box sx={{ backgroundColor: "white" }}>
      <YenBookPage />
      <Box display="flex" alignItems="center" justifyContent="space-between" marginTop={1}>
        <Box display="flex" alignItems="center">
          {isModuleVisible("yenerp", "outgoingpayment") && (
            <Link href={"/yen-book/OutgoingPaymentPage"}>
              <Button
                variant="contained"
                color="primary"
                sx={{ mr: "5px", ml: "15px" }}
              >
                Outgoing Payment
              </Button>
            </Link>
          )}
        {isModuleVisible("yenerp", "advancepayment") && (
            <Link href={"/yen-book/OutgoingPaymentPage/PreOutgoing"}>
              <Button
                variant="contained"
                color="primary"
                sx={{
                  mr: "5px",
                  backgroundColor: "white",
                  color: "black",
                  "&:hover": { backgroundColor: "rgba(255, 255, 255, 0.8)" },
                }}
              >
                Advance Payment
              </Button>
            </Link>
          )}
         {isModuleVisible("yenerp", "partialpayment") && (
            <Link href={"/yen-book/OutgoingPaymentPage/PendingPayment"}>
              <Button variant="contained" sx={{ mr: "5px" }}>
                Partial Payment
              </Button>
            </Link>
          )}
         {isModuleVisible("yenerp", "paymentdone") && (
            <Link href={"/yen-book/OutgoingPaymentPage/PaidPayment"}>
              <Button variant="contained" color="primary" sx={{ mr: "5px" }}>
                Payment Done
              </Button>
            </Link>
          )}
           {isModuleVisible("yenerp", "ledger") && (
            <Link href={"/yen-book/OutgoingPaymentPage/Ledger"}>
              <Button variant="contained" color="primary" sx={{ mr: "5px" }}>
                Ledger
              </Button>
            </Link>
          )}
        {isModuleVisible("yenerp", "purchasereturn") && (
            <Link href={"/yen-book/OutgoingPaymentPage/PurchaseReturn"}>
              <Button variant="contained" color="primary" sx={{ mr: "5px" }}>
                Purchase Return
              </Button>
            </Link>
          )}
        </Box>
      </Box>

      <Box mt={2} ml={2} sx={{ maxWidth: 500 }} display="flex" justifyContent="space-between" alignItems="center">
        <Autocomplete
          key={`vendor-select-${uniqueVendorNames.length}`}
          options={uniqueVendorNames}
          getOptionLabel={(option: VendorNameGet) => option.vendorName || ""}
          isOptionEqualToValue={(option: VendorNameGet, value: VendorNameGet | null) =>
            option.vendorId === value?.vendorId
          }
          value={selectedVendor}
          onChange={(event, newValue) => handleVendorSelect(newValue)}
          renderInput={(params) => (
            <TextField {...params} label="Select Vendor" variant="outlined" size="small" sx={{ minWidth: 300 }} />
          )}
        />
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            size="small"
            onClick={handleDialogOpen}
            disabled={!canAdd}
          >
            Add Vendor
          </Button>
        </Box>
      </Box>

      <Box mt={2} ml={2} mr={2}>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleOpenNewPaymentDialog}
          sx={{ mb: 2 }}
        >
          Advance Payment
        </Button>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>No</TableCell>
                <TableCell>Advance ID</TableCell>
                <TableCell>Vendor Name</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Pending Amount</TableCell>
                <TableCell>Created Date</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayAdvances.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} style={{ textAlign: "center" }}>
                    No advance payments found
                  </TableCell>
                </TableRow>
              ) : (
                displayAdvances.map((payment: AdvancePayment, index: number) => (
                  <TableRow key={`${payment.advanceId}-${index}-${payment.createdDate}`}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{payment.randomId || "N/A"}</TableCell>
                    <TableCell>{payment.vendorName || "N/A"}</TableCell>
                    <TableCell>{(payment.amount || 0).toFixed(2)}</TableCell>
                    <TableCell>{(payment.pendingAmount || 0).toFixed(2)}</TableCell>
                    <TableCell>
                      {payment.createdDate ? format(new Date(payment.createdDate), "dd-MM-yyyy") : "N/A"}
                    </TableCell>
                    <TableCell>{payment.status || "N/A"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      <Dialog open={openNewPaymentDialog} onClose={handleCloseNewPaymentDialog} maxWidth="sm">
        <DialogTitle>Create New Advance Payment</DialogTitle>
        <DialogContent>
          <Formik
            initialValues={{
              vendor: selectedVendor || null,
              amount: "",
              paymentMode: "",
              paymentMethod: "",
              bankName: "",
              neftNo: "",
              rtgsNo: "",
              impsNo: "",
              upi: "",
              remarks: "",
            }}
            validationSchema={validationSchema}
            onSubmit={handleNewPaymentSubmit}
          >
            {({ values, handleChange, handleBlur, handleSubmit, errors, touched, setFieldValue }) => (
              <Form onSubmit={handleSubmit}>
                <Grid container spacing={2} mt={1}>
                  <Grid item xs={12}>
                    <Autocomplete
                      options={uniqueVendorNames}
                      getOptionLabel={(option: VendorNameGet) => option.vendorName || ""}
                      isOptionEqualToValue={(option: VendorNameGet, value: VendorNameGet | null) =>
                        option.vendorId === value?.vendorId
                      }
                      value={values.vendor}
                      onChange={(event, newValue) => setFieldValue("vendor", newValue)}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Select Vendor"
                          variant="outlined"
                          error={touched.vendor && !!errors.vendor}
                          helperText={touched.vendor && errors.vendor}
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Advance Amount"
                      type="number"
                      fullWidth
                      name="amount"
                      value={values.amount}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.amount && !!errors.amount}
                      helperText={touched.amount && errors.amount}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Payment Mode"
                      select
                      fullWidth
                      name="paymentMode"
                      value={values.paymentMode}
                      onChange={(e) => {
                        handleChange(e);
                        const mode = e.target.value;
                        setFieldValue("paymentMethod", mode === "Cash" ? "" : values.paymentMethod);
                        setFieldValue("bankName", "");
                        setFieldValue("neftNo", "");
                        setFieldValue("rtgsNo", "");
                        setFieldValue("impsNo", "");
                        setFieldValue("upi", "");
                      }}
                      onBlur={handleBlur}
                      error={touched.paymentMode && !!errors.paymentMode}
                      helperText={touched.paymentMode && errors.paymentMode}
                    >
                      <MenuItem value="Cash">Cash</MenuItem>
                      <MenuItem value="Bank">Bank</MenuItem>
                    </TextField>
                  </Grid>
                  {values.paymentMode === "Bank" && (
                    <>
                      <Grid item xs={12}>
                        <TextField
                          label="Payment Method"
                          select
                          fullWidth
                          name="paymentMethod"
                          value={values.paymentMethod}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          error={touched.paymentMethod && !!errors.paymentMethod}
                          helperText={touched.paymentMethod && errors.paymentMethod}
                        >
                          <MenuItem value="neft">NEFT</MenuItem>
                          <MenuItem value="rtgs">RTGS</MenuItem>
                          <MenuItem value="imps">IMPS</MenuItem>
                          <MenuItem value="upi">UPI</MenuItem>
                        </TextField>
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          select
                          name="bankName"
                          label="Bank Name"
                          value={values.bankName}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          fullWidth
                          error={touched.bankName && !!errors.bankName}
                          helperText={touched.bankName && errors.bankName}
                        >
                          {uniqueBanks.map((bank: any) => (
                            <MenuItem key={bank.bankMasterId} value={bank.bankName}>
                              {bank.bankName}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                      {values.paymentMethod === "neft" && (
                        <Grid item xs={12}>
                          <TextField
                            label="NEFT Number"
                            fullWidth
                            name="neftNo"
                            value={values.neftNo}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={touched.neftNo && !!errors.neftNo}
                            helperText={touched.neftNo && errors.neftNo}
                          />
                        </Grid>
                      )}
                      {values.paymentMethod === "rtgs" && (
                        <Grid item xs={12}>
                          <TextField
                            label="RTGS Number"
                            fullWidth
                            name="rtgsNo"
                            value={values.rtgsNo}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={touched.rtgsNo && !!errors.rtgsNo}
                            helperText={touched.rtgsNo && errors.rtgsNo}
                          />
                        </Grid>
                      )}
                      {values.paymentMethod === "imps" && (
                        <Grid item xs={12}>
                          <TextField
                            label="IMPS Number"
                            fullWidth
                            name="impsNo"
                            value={values.impsNo}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={touched.impsNo && !!errors.impsNo}
                            helperText={touched.impsNo && errors.impsNo}
                          />
                        </Grid>
                      )}
                      {values.paymentMethod === "upi" && (
                        <Grid item xs={12}>
                          <TextField
                            label="UPI ID/Number"
                            fullWidth
                            name="upi"
                            value={values.upi}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={touched.upi && !!errors.upi}
                            helperText={touched.upi && errors.upi}
                          />
                        </Grid>
                      )}
                    </>
                  )}
                  <Grid item xs={12}>
                    <TextField
                      label="Remarks"
                      fullWidth
                      name="remarks"
                      value={values.remarks}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.remarks && !!errors.remarks}
                      helperText={touched.remarks && errors.remarks}
                    />
                  </Grid>
                </Grid>
                <DialogActions sx={{ mt: 2 }}>
                  <Button onClick={handleCloseNewPaymentDialog}>Cancel</Button>
                  <Button type="submit" variant="contained" color="primary">
                    Submit
                  </Button>
                </DialogActions>
              </Form>
            )}
          </Formik>
        </DialogContent>
      </Dialog>

      <VendorDialog loading={vendorLoading} setLoading={() => { }} />

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => dispatch(clearSnackbarMessage())}
        message={snackbarMessage}
      />
    </Box>
  );
};

export default AdvancePaymentPage;