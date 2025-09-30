// "use client";
// import React, { useState, useEffect, useMemo } from "react";
// import {
//   Grid,
//   Typography,
//   TableContainer,
//   Paper,
//   Table,
//   TableHead,
//   TableRow,
//   TableCell,
//   TableBody,
//   Button,
//   Box,
//   Snackbar,
//   FormControl,
//   Dialog,
//   DialogActions,
//   DialogContent,
//   DialogTitle,
//   IconButton,
//   Tooltip,
//   AutocompleteChangeReason,
//   Autocomplete,
//   TextField,
//   MenuItem,
// } from "@mui/material";
// import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
// import DescriptionIcon from '@mui/icons-material/Description';
// import DownloadIcon from '@mui/icons-material/Download';
// import FilterAltIcon from '@mui/icons-material/FilterAlt';
// import Clear from '@mui/icons-material/Clear';
// import {
//   fetchAdvances,
//   selectAdvances,
//   setSnackbarMessage,
//   setSnackbarOpen,
//   clearSnackbarMessage,
//   selectCurrentPage,
//   selectPageSize,
//   selectTotalItems,
//   setPagination,
//   fetchVendorDetails,
//   createAdvancePayment,
// } from "../../../../features/yen-purchase/Outgoing/advancePaymentSlice";
// import { fetchVendorNames, selectVendorItems } from "../../../../features/yen-purchase/PurchaseMaster/vendorSlice";
// import { AppDispatch } from "@/redux/store";
// import YenBookPage from "../../page";
// import { fetchBusinesses, fetchPhoto, selectBusinesses } from '@/features/account-setting/businessSlice';
// import { AdvancePayment, VendorDetail, VendorNameGet, PaymentHistory } from "@/Models/advanceModel";
// import { format } from "date-fns";
// import Link from "next/link";
// import jsPDF from "jspdf";
// import "jspdf-autotable";
// import Papa from "papaparse";
// import { ChevronLeft, ChevronRight } from "@mui/icons-material";
// import DateRangeDialog from "@/components/dateRange";
// import 'react-date-range/dist/styles.css';
// import 'react-date-range/dist/theme/default.css';
// import moment from "moment";
// import { useDispatch, useSelector } from "react-redux";
// import { Formik, Form } from "formik";
// import * as Yup from "yup";

// const AdvancePaymentComponent = () => {
//   const dispatch = useDispatch<AppDispatch>();
//   const { advances, loading, snackbarMessage, snackbarOpen, advanceVendors } = useSelector(selectAdvances);
//   const { businesses } = useSelector(selectBusinesses);
//   const { vendorName } = useSelector(selectVendorItems);
//   const [loadingState, setLoadingState] = useState<'idle' | 'loading' | 'succeeded' | 'failed'>('idle');
//   const [fetchedBusinessIds, setFetchedBusinessIds] = useState(new Set());
//   const [selectedVendorName, setSelectedVendorName] = useState<VendorDetail | null>(null);
//   const [filteredAdvances, setFilteredAdvances] = useState<AdvancePayment[]>([]);
//   const [status, setStatus] = useState('Pending');
//   const [openDialog, setOpenDialog] = useState(false);
//   const [openCreateDialog, setOpenCreateDialog] = useState(false);
//   const currentPage = useSelector(selectCurrentPage);
//   const pageSize = useSelector(selectPageSize);
//   const totalItems = useSelector(selectTotalItems);
//   const [selectionRange, setSelectionRange] = useState({
//     startDate: new Date(),
//     endDate: new Date(),
//     key: 'selection',
//   });
//   const dateField = 'paymentDate';
//   const StartDate = moment().utc().startOf('day').toDate();
//   const EndDate = moment().utc().endOf('day').toDate();
//   const [shouldFetch, setShouldFetch] = useState(true);

//   useEffect(() => {
//     if (shouldFetch && loadingState === 'idle') {
//       dispatch(fetchAdvances({
//         page: currentPage,
//         size: pageSize,
//         status: status,
//         filterBy: dateField,
//         fromDate: StartDate,
//         toDate: EndDate,
//       }));
//       setShouldFetch(false);
//     }
//   }, [dispatch, currentPage, pageSize, status, loadingState, dateField, StartDate, EndDate, shouldFetch]);

//   useEffect(() => {
//     if (loadingState === 'idle') {
//       dispatch(fetchVendorDetails({ status: status }));
//       dispatch(fetchVendorNames());
//     }
//   }, [loadingState, status, dispatch]);

//   useEffect(() => {
//     dispatch(fetchBusinesses());
//   }, [dispatch]);

//   useEffect(() => {
//     businesses.forEach((business) => {
//       if (!fetchedBusinessIds.has(business.businessId)) {
//         dispatch(fetchPhoto(business.businessId));
//         setFetchedBusinessIds(prevSet => new Set(prevSet).add(business.businessId));
//       }
//     });
//   }, [businesses, fetchedBusinessIds, dispatch]);

//   const handlePageChange = (newPage: number) => {
//     if (newPage < 1 || newPage > Math.ceil(totalItems / pageSize)) {
//       return;
//     }
//     const appliedFromDate = selectionRange?.startDate instanceof Date ? moment(selectionRange.startDate).startOf('day').toDate() : StartDate;
//     const appliedToDate = selectionRange?.endDate instanceof Date ? moment(selectionRange.endDate).endOf('day').toDate() : EndDate;
//     dispatch(setPagination({ page: newPage, size: pageSize }));
//     dispatch(fetchAdvances({
//       page: newPage,
//       size: pageSize,
//       status: status,
//       filterBy: dateField,
//       fromDate: appliedFromDate,
//       toDate: appliedToDate,
//       vendorName: selectedVendorName?.vendorName,
//     }));
//   };

//   const handleNextPage = () => {
//     if (currentPage * pageSize < totalItems) {
//       handlePageChange(currentPage + 1);
//     }
//   };

//   const handlePreviousPage = () => {
//     if (currentPage > 1) {
//       handlePageChange(currentPage - 1);
//     }
//   };

//   const handleOpenDialog = () => {
//     setOpenDialog(true);
//   };

//   const handleCloseDialog = () => {
//     setOpenDialog(false);
//   };

//   const handleOpenCreateDialog = () => {
//     setOpenCreateDialog(true);
//   };

//   const handleCloseCreateDialog = () => {
//     setOpenCreateDialog(false);
//   };

//   const handleVendorChange = (
//     event: React.SyntheticEvent,
//     newValue: VendorDetail | null,
//     reason: AutocompleteChangeReason
//   ) => {
//     setSelectedVendorName(newValue);
//   };

//   const validationSchema = Yup.object({
//     vendorId: Yup.string().required("Vendor is required"),
//     amount: Yup.number()
//       .required("Amount is required")
//       .min(0.01, "Amount must be greater than 0"),
//     paymentMethod: Yup.string().required("Payment Method is required"),
//     paymentMode: Yup.string()
//       .required("Payment Mode is required")
//       .oneOf(["Cash", "Bank"], "Payment Mode must be Cash or Bank"),
//     bankName: Yup.string().when("paymentMode", {
//       is: (value: string) => value === "Bank",
//       then: (schema) => schema.required("Bank Name is required for Bank payments"),
//       otherwise: (schema) => schema.optional(),
//     }),
//     neftNo: Yup.string().when("paymentMethod", {
//       is: (value: string) => value === "neft",
//       then: (schema) => schema.required("NEFT Number is required"),
//       otherwise: (schema) => schema.optional(),
//     }),
//     rtgsNo: Yup.string().when("paymentMethod", {
//       is: (value: string) => value === "rtgs",
//       then: (schema) => schema.required("RTGS Number is required"),
//       otherwise: (schema) => schema.optional(),
//     }),
//     impsNo: Yup.string().when("paymentMethod", {
//       is: (value: string) => value === "imps",
//       then: (schema) => schema.required("IMPS Number is required"),
//       otherwise: (schema) => schema.optional(),
//     }),
//     upi: Yup.string().when("paymentMethod", {
//       is: (value: string) => value === "upi",
//       then: (schema) => schema.required("UPI ID is required"),
//       otherwise: (schema) => schema.optional(),
//     }),
//     cashVoucherNo: Yup.string().when("paymentMethod", {
//       is: (value: string) => value === "cash",
//       then: (schema) => schema.required("Cash Voucher Number is required"),
//       otherwise: (schema) => schema.optional(),
//     }),
//     remarks: Yup.string().optional(),
//   });

//   const filteredAdvancesMemo = useMemo(() => {
//     return filteredAdvances.length > 0 ? filteredAdvances : advances || [];
//   }, [advances, filteredAdvances]);

//   const generateAdvanceInvoicePDF = () => {
//     const doc = new jsPDF();
//     let yOffset = 10;
//     const logoX = 14;
//     const titleX = 80;

//     const business = businesses.length > 0 ? businesses[0] : null;
//     if (business && business.imageUrl) {
//       try {
//         doc.addImage(business.imageUrl, 'JPEG', logoX, yOffset, 20, 20);
//       } catch (e) {
//         console.error("Image failed to load:", e);
//       }
//     }

//     doc.setFontSize(12);
//     doc.text("Advance Payment Summary", titleX, yOffset + 10);
//     const titleWidth = doc.getTextWidth("Advance Payment Summary");
//     doc.setLineWidth(0.5);
//     doc.line(titleX, yOffset + 12, titleX + titleWidth, yOffset + 12);

//     yOffset += 25;

//     const filtered = filteredAdvancesMemo.filter((advance: AdvancePayment) => advance.status === 'Pending');
//     const totalAmount = filtered.reduce((sum: number, advance: AdvancePayment) => sum + (advance.amount || 0), 0);

//     const today = new Date();
//     const currentDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
//     doc.setFontSize(10);
//     doc.text(`Total Amount: ${totalAmount.toFixed(2)}`, 14, yOffset);
//     doc.text(`Date: ${currentDate}`, 140, yOffset);

//     yOffset += 7;

//     const headers = [
//       ["S.No", "Advance ID", "Vendor Name", "Amount", "Pending Amount", "Payment Date", "Status", "Payment History"]
//     ];

//     const rows = filtered.map((advance: AdvancePayment, index: number) => [
//       `${index + 1}`,
//       advance.randomId || "N/A",
//       advance.vendorName || "N/A",
//       (advance.amount || 0).toFixed(2),
//       (advance.pendingAmount || 0).toFixed(2),
//       advance.paymentDate ? format(new Date(advance.paymentDate), 'dd-MM-yyyy') : 'N/A',
//       advance.status || "N/A",
//       advance.paymentHistory
//         ? advance.paymentHistory.map((h: PaymentHistory) => `₹${h.amount.toFixed(2)} on ${format(new Date(h.paymentDate), 'dd-MM-yyyy')}`).join(', ')
//         : "N/A",
//     ]);

//     doc.autoTable({
//       head: headers,
//       body: rows,
//       startY: yOffset,
//       styles: {
//         fillColor: [255, 255, 255],
//         textColor: [0, 0, 0],
//         lineColor: [0, 0, 0],
//         fontSize: 8,
//       },
//       headStyles: {
//         fillColor: [0, 0, 128],
//         textColor: [255, 255, 255],
//       },
//       bodyStyles: {
//         fillColor: [255, 255, 255],
//         textColor: [0, 0, 0],
//       },
//       columnStyles: {
//         7: { cellWidth: 40 }, // Adjust width for Payment History
//       },
//     });

//     const totalPages = doc.getNumberOfPages();
//     for (let i = 1; i <= totalPages; i++) {
//       doc.setPage(i);
//       doc.setFontSize(8);
//       doc.text(`Page ${i} of ${totalPages}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
//     }

//     doc.save("Advance_Payment_Summary.pdf");
//     handleCloseDialog();
//   };

//   const generateAdvanceSummaryCSV = () => {
//     const headers = [
//       ["S.No", "Advance ID", "Vendor Name", "Amount", "Pending Amount", "Payment Date", "Status", "Payment History"]
//     ];

//     const rows = filteredAdvancesMemo.map((advance: AdvancePayment, index: number) => [
//       `${index + 1}`,
//       advance.randomId || "N/A",
//       advance.vendorName || "N/A",
//       (advance.amount || 0).toFixed(2),
//       (advance.pendingAmount || 0).toFixed(2),
//       advance.paymentDate ? format(new Date(advance.paymentDate), 'dd-MM-yyyy') : 'N/A',
//       advance.status || "N/A",
//       advance.paymentHistory
//         ? advance.paymentHistory.map((h: PaymentHistory) => `₹${h.amount.toFixed(2)} on ${format(new Date(h.paymentDate), 'dd-MM-yyyy')}`).join(', ')
//         : "N/A",
//     ]);

//     const csvData = [headers[0], ...rows];
//     const csv = Papa.unparse(csvData);
//     const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
//     const url = URL.createObjectURL(blob);
//     const link = document.createElement("a");
//     link.setAttribute("href", url);
//     link.setAttribute("download", "AdvancePaymentSummary.csv");
//     document.body.appendChild(link);
//     link.click();
//     document.body.removeChild(link);
//     handleCloseDialog();
//   };

//   const handleFilterClick = () => {
//     const appliedFromDate = selectionRange?.startDate instanceof Date ? moment(selectionRange.startDate).startOf('day').toDate() : StartDate;
//     const appliedToDate = selectionRange?.endDate instanceof Date ? moment(selectionRange.endDate).endOf('day').toDate() : EndDate;

//     dispatch(fetchAdvances({
//       page: currentPage,
//       size: pageSize,
//       status: status,
//       filterBy: dateField,
//       fromDate: appliedFromDate,
//       toDate: appliedToDate,
//       vendorName: selectedVendorName?.vendorName,
//     }))
//       .then((response) => {
//         const data = (response.payload as { data: AdvancePayment[]; totalItems: number })?.data || [];
//         if (data.length === 0) {
//           dispatch(setSnackbarMessage('No matching advance payments found.'));
//           dispatch(setSnackbarOpen(true));
//         } else {
//           setFilteredAdvances(data);
//         }
//       })
//       .catch((error) => {
//         dispatch(setSnackbarMessage(error.message || 'Error fetching advance payments'));
//         dispatch(setSnackbarOpen(true));
//       });
//   };

//   const handleFilterClose = () => {
//     setSelectionRange({
//       startDate: new Date(),
//       endDate: new Date(),
//       key: 'selection',
//     });
//     setStatus('');
//     setSelectedVendorName(null);
//     dispatch(fetchAdvances({
//       page: 1,
//       size: pageSize,
//       status: '',
//       filterBy: dateField,
//       fromDate: StartDate,
//       toDate: EndDate,
//     }));
//   };

//   const handleDownload = (advanceId: string) => {
//     const advance = advances.find((a: AdvancePayment) => a.advanceId === advanceId);
//     if (!advance) {
//       dispatch(setSnackbarMessage('Advance payment not found!'));
//       dispatch(setSnackbarOpen(true));
//       return;
//     }

//     const business = businesses.length > 0 ? businesses[0] : null;
//     const doc = new jsPDF();
//     let yOffset = 10;

//     doc.setFontSize(12);
//     doc.setFont('helvetica', 'bold');
//     doc.setTextColor(0, 0, 128);
//     doc.text('Advance Payment Details', 90, yOffset + 5);
//     const textWidth = doc.getTextWidth('Advance Payment Details');
//     doc.setDrawColor(0, 0, 128);
//     doc.line(90, yOffset + 7, 90 + textWidth, yOffset + 7);

//     yOffset += 10;

//     if (business && business.imageUrl) {
//       try {
//         doc.addImage(business.imageUrl, 'JPEG', 20, yOffset, 20, 20);
//       } catch (e) {
//         console.error("Image failed to load:", e);
//       }
//     }

//     yOffset += 20;

//     const paymentMethod = advance.paymentMethod || 'N/A';
//     let paymentDetails = '';
//   if (paymentMethod === 'neft') {
//       paymentDetails = `NEFT No: ${advance.neftNo || 'N/A'}`;
//     } else if (paymentMethod === 'rtgs') {
//       paymentDetails = `RTGS No: ${advance.rtgsNo || 'N/A'}`;
//     } else if (paymentMethod === 'imps') {
//       paymentDetails = `IMPS No: ${advance.impsNo || 'N/A'}`;
//     } else if (paymentMethod === 'upi') {
//       paymentDetails = `UPI ID: ${advance.upi || 'N/A'}`;
//     }

//     doc.setFontSize(10);
//     doc.text(`Payment Method: ${paymentMethod}`, 14, yOffset + 10);
//     doc.text(paymentDetails, 14, yOffset + 20);

//     yOffset += 30;

//     const vendorDetailsRows = [
//       [
//         `Vendor Name: ${advance.vendorName || 'N/A'}\n` +
//         `Advance ID: ${advance.randomId || 'N/A'}\n` +
//         `Amount: ${(advance.amount || 0).toFixed(2)}\n` +
//         `Pending Amount: ${(advance.pendingAmount || 0).toFixed(2)}\n` +
//         `Payment Date: ${advance.paymentDate ? format(new Date(advance.paymentDate), 'dd-MM-yyyy') : 'N/A'}\n` +
//         `Status: ${advance.status || 'N/A'}\n` +
//         `Remarks: ${advance.remarks || 'N/A'}\n` +
//         `Payment History: ${advance.paymentHistory
//           ? advance.paymentHistory.map((h: PaymentHistory) => `₹${h.amount.toFixed(2)} on ${format(new Date(h.paymentDate), 'dd-MM-yyyy')}`).join(', ')
//           : 'N/A'}`,
//         `Business Name: ${business?.companyName || 'N/A'}\n` +
//         `GSTIN: ${business?.gstIn || 'N/A'}\n` +
//         `Address: ${business?.address1 || 'N/A'}\n` +
//         `Phone: ${business?.phoneNo || 'N/A'}\n` +
//         `Email: ${business?.emailId || 'N/A'}`,
//       ]
//     ];

//     doc.autoTable({
//       head: [['Advance Details', 'Business Details']],
//       body: vendorDetailsRows,
//       startY: yOffset,
//       theme: 'grid',
//       styles: { fontSize: 8, cellPadding: 4, halign: 'left', valign: 'top', overflow: 'linebreak' },
//       columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 90 } },
//       headStyles: { fillColor: [0, 0, 128], textColor: [255, 255, 255], fontStyle: 'bold' },
//       bodyStyles: { lineWidth: 0.1, lineColor: [0, 0, 0], textColor: [0, 0, 0], minCellHeight: 15 },
//       tableLineColor: [0, 0, 0],
//       tableLineWidth: 0.1,
//     });

//     const totalPages = doc.getNumberOfPages();
//     for (let i = 1; i <= totalPages; i++) {
//       doc.setPage(i);
//       doc.setFontSize(8);
//       doc.text(`Page ${i} of ${totalPages}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
//     }

//     doc.save(`${advance.vendorName || 'Advance'}_PaymentDetails.pdf`);
//   };

//   return (
//     <Box>
//       <YenBookPage />
//       <Box sx={{ p: 1, backgroundColor: "white", m: 1 }}>
//         <Box display="flex" alignItems="center" mb={2}>
//           <Grid container spacing={1} alignItems="center" justifyContent="space-between">
//             <Grid container alignItems="center" gap={1} ml={1}>
//               <Grid item>
//                 <Link href="/yen-book/AdvancePaymentPage" passHref>
//                   <Button variant="contained" sx={{
//                     backgroundColor: 'white',
//                     color: 'black',
//                     '&:hover': {
//                       backgroundColor: 'rgba(255, 255, 255, 0.8)',
//                     },
//                   }}>
//                     Advance Payment
//                   </Button>
//                 </Link>
//               </Grid>
//               <Grid item>
//                 <Button
//                   variant="contained"
//                   onClick={handleOpenCreateDialog}
//                   sx={{
//                     backgroundColor: 'primary.main',
//                     color: 'white',
//                     '&:hover': {
//                       backgroundColor: 'primary.dark',
//                     },
//                   }}
//                 >
//                   Create Advance Payment
//                 </Button>
//               </Grid>
//             </Grid>

//             <Grid container spacing={2} alignItems="center" sx={{ mt: 1 }}>
//               <Grid item xs="auto">
//                 <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', ml: 1 }}>
//                   <DateRangeDialog
//                     selectionRange={selectionRange}
//                     setSelectionRange={setSelectionRange}
//                   />
//                 </Box>
//               </Grid>

//               <Grid item xs={6} sm={4} md={2}>
//                 <FormControl fullWidth>
//                   <Autocomplete
//                     value={selectedVendorName}
//                     onChange={handleVendorChange}
//                     options={advanceVendors}
//                     getOptionLabel={(option: VendorDetail) => option.vendorName || ''}
//                     renderInput={(params) => (
//                       <TextField
//                         {...params}
//                         label="All Vendors"
//                         variant="outlined"
//                         size="small"
//                         InputProps={{
//                           ...params.InputProps,
//                           style: { fontSize: '12px' },
//                         }}
//                       />
//                     )}
//                     sx={{
//                       fontSize: '12px',
//                     }}
//                   />
//                 </FormControl>
//               </Grid>

//               <Grid item xs="auto">
//                 <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
//                   <IconButton
//                     onClick={handleFilterClick}
//                     className="icon-button-outline"
//                     color="primary"
//                     size="small"
//                     sx={{ p: 0.3 }}
//                   >
//                     <FilterAltIcon fontSize="small" />
//                   </IconButton>
//                   <Typography
//                     variant="caption"
//                     align="center"
//                     sx={{
//                       maxWidth: 60,
//                       wordBreak: 'break-word',
//                       display: '-webkit-box',
//                       WebkitLineClamp: 2,
//                       WebkitBoxOrient: 'vertical',
//                       overflow: 'hidden',
//                       textOverflow: 'ellipsis',
//                       lineHeight: 1.1,
//                       mt: 0.2,
//                     }}
//                   >
//                     Filter
//                   </Typography>
//                 </Box>
//               </Grid>

//               <Grid item xs="auto">
//                 <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
//                   <IconButton
//                     onClick={handleFilterClose}
//                     className="icon-button-outline"
//                     color="primary"
//                     size="small"
//                     sx={{ p: 0.3 }}
//                   >
//                     <Clear fontSize="small" />
//                   </IconButton>
//                   <Typography
//                     variant="caption"
//                     align="center"
//                     sx={{
//                       maxWidth: 60,
//                       wordBreak: 'break-word',
//                       display: '-webkit-box',
//                       WebkitLineClamp: 2,
//                       WebkitBoxOrient: 'vertical',
//                       overflow: 'hidden',
//                       textOverflow: 'ellipsis',
//                       lineHeight: 1.1,
//                       mt: 0.2,
//                     }}
//                   >
//                     Clear
//                   </Typography>
//                 </Box>
//               </Grid>

//               <Grid item xs sx={{ flexGrow: 1 }} />

//               <Grid item xs="auto">
//                 <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
//                   <IconButton
//                     onClick={handleOpenDialog}
//                     color="primary"
//                     className="icon-button-outline"
//                     size="small"
//                     sx={{ p: 0.3 }}
//                     disabled={!filteredAdvancesMemo || filteredAdvancesMemo.length === 0}
//                   >
//                     <DownloadIcon fontSize="small" />
//                   </IconButton>
//                   <Typography
//                     variant="caption"
//                     align="center"
//                     sx={{
//                       maxWidth: 60,
//                       wordBreak: 'break-word',
//                       display: '-webkit-box',
//                       WebkitLineClamp: 2,
//                       WebkitBoxOrient: 'vertical',
//                       overflow: 'hidden',
//                       textOverflow: 'ellipsis',
//                       lineHeight: 1.1,
//                       mt: 0.2,
//                     }}
//                   >
//                     Download
//                   </Typography>
//                 </Box>
//               </Grid>
//             </Grid>
//           </Grid>
//         </Box>

//         <Grid container spacing={2}>
//           <Grid item xs={12}>
//             <TableContainer
//               component={Paper}
//               sx={{
//                 maxHeight: 'calc(100vh - 230px)',
//                 overflowY: 'auto',
//                 width: '100%',
//               }}
//             >
//               <Table stickyHeader>
//                 <TableHead>
//                   <TableRow>
//                     <TableCell>No</TableCell>
//                     <TableCell>Advance ID</TableCell>
//                     <TableCell>Vendor Name</TableCell>
//                     <TableCell>Amount</TableCell>
//                     <TableCell>Pending Amount</TableCell>
//                     <TableCell>Payment Date</TableCell>
//                     <TableCell>Status</TableCell>
//                     <TableCell>Payment History</TableCell>
//                     <TableCell>Action</TableCell>
//                   </TableRow>
//                 </TableHead>
//                 <TableBody>
//                   {filteredAdvancesMemo.length === 0 ? (
//                     <TableRow>
//                       <TableCell colSpan={9} style={{ textAlign: 'center' }}>
//                         No advance payments available
//                       </TableCell>
//                     </TableRow>
//                   ) : (
//                     filteredAdvancesMemo.map((payment: AdvancePayment, index: number) => (
//                       <TableRow key={payment.advanceId}>
//                         <TableCell>{index + 1}</TableCell>
//                         <TableCell>{payment.randomId || "N/A"}</TableCell>
//                         <TableCell>{payment.vendorName || "N/A"}</TableCell>
//                         <TableCell>{(payment.amount || 0).toFixed(2)}</TableCell>
//                         <TableCell>{(payment.pendingAmount || 0).toFixed(2)}</TableCell>
//                         <TableCell>
//                           {payment.paymentDate ? format(new Date(payment.paymentDate), 'dd-MM-yyyy') : 'N/A'}
//                         </TableCell>
//                         <TableCell>{payment.status || "N/A"}</TableCell>
//                         <TableCell>
//                           {payment.paymentHistory
//                             ? payment.paymentHistory.map((h: PaymentHistory) => `₹${h.amount.toFixed(2)} on ${format(new Date(h.paymentDate), 'dd-MM-yyyy')}`).join(', ')
//                             : "N/A"}
//                         </TableCell>
//                         <TableCell>
//                           <Tooltip title='PDF Download'>
//                             <IconButton
//                               color="primary"
//                               sx={{ ml: 0.1 }}
//                               onClick={() => handleDownload(payment.advanceId ?? '')}
//                             >
//                               <PictureAsPdfIcon />
//                             </IconButton>
//                           </Tooltip>
//                         </TableCell>
//                       </TableRow>
//                     ))
//                   )}
//                 </TableBody>
//               </Table>
//             </TableContainer>
//             <Grid item xs={12}>
//               <Box sx={{ display: 'flex', justifyContent: 'end', alignItems: 'center' }}>
//                 <IconButton
//                   onClick={handlePreviousPage}
//                   disabled={currentPage === 1}
//                   aria-label="Previous Page"
//                 >
//                   <ChevronLeft />
//                 </IconButton>
//                 <Typography variant="body1" sx={{ mx: 2 }}>
//                   Page {currentPage}
//                 </Typography>
//                 <IconButton
//                   onClick={handleNextPage}
//                   disabled={currentPage * pageSize >= totalItems}
//                   aria-label="Next Page"
//                 >
//                   <ChevronRight />
//                 </IconButton>
//               </Box>
//             </Grid>
//           </Grid>
//         </Grid>

//         <Dialog open={openDialog} onClose={handleCloseDialog}>
//           <DialogTitle>Choose a file format</DialogTitle>
//           <DialogContent>
//             <p>Select the file format you want to download:</p>
//           </DialogContent>
//           <DialogActions>
//             <Button
//               onClick={generateAdvanceInvoicePDF}
//               variant="contained"
//               color="primary"
//               startIcon={<PictureAsPdfIcon />}
//             >
//               Download PDF
//             </Button>
//             <Button
//               onClick={generateAdvanceSummaryCSV}
//               variant="contained"
//               color="secondary"
//               startIcon={<DescriptionIcon />}
//             >
//               Download CSV
//             </Button>
//             <Button onClick={handleCloseDialog}>
//               Cancel
//             </Button>
//           </DialogActions>
//         </Dialog>

//         <Dialog open={openCreateDialog} onClose={handleCloseCreateDialog}>
//           <DialogTitle>Create Advance Payment</DialogTitle>
//           <DialogContent sx={{ width: "500px" }}>
//             <Formik
//               initialValues={{
//                 vendorId: "",
//                 vendorName: "",
//                 amount: "",
//                 paymentMethod: "",
//                 paymentMode: "",
//                 bankName: "",
//                 neftNo: "",
//                 rtgsNo: "",
//                 impsNo: "",
//                 upi: "",
//                 cashVoucherNo: "",
//                 remarks: "",
//               }}
//               validationSchema={validationSchema}
//               onSubmit={async (values) => {
//                 const paymentData: Partial<AdvancePayment> = {
//                   vendorId: values.vendorId,
//                   vendorName: values.vendorName,
//                   amount: parseFloat(values.amount),
//                   paymentType: "advance",
//                   paymentMethod: values.paymentMethod,
//                   paymentMode: values.paymentMode as 'Cash' | 'Bank',
//                   bankName: values.paymentMode === "Bank" ? values.bankName : undefined,
//                   neftNo: values.paymentMethod === "neft" ? values.neftNo : undefined,
//                   rtgsNo: values.paymentMethod === "rtgs" ? values.rtgsNo : undefined,
//                   impsNo: values.paymentMethod === "imps" ? values.impsNo : undefined,
//                   upi: values.paymentMethod === "upi" ? values.upi : undefined,
//                   remarks: values.remarks,
//                   paymentDate: new Date(),
//                 };

//                 try {
//                   await dispatch(createAdvancePayment(paymentData)).unwrap();
//                   dispatch(fetchAdvances({
//                     page: currentPage,
//                     size: pageSize,
//                     status: status,
//                     filterBy: dateField,
//                     fromDate: StartDate,
//                     toDate: EndDate,
//                   }));
//                   handleCloseCreateDialog();
//                 } catch (error: any) {
//                   dispatch(setSnackbarMessage(error.message || 'Error creating advance payment'));
//                   dispatch(setSnackbarOpen(true));
//                 }
//               }}
//             >
//               {({ values, handleChange, handleBlur, handleSubmit, errors, touched }) => (
//                 <Form onSubmit={handleSubmit}>
//                   <Grid container spacing={2} mt={1}>
//                     <Grid item xs={12}>
//                       <FormControl fullWidth>
//                         <Autocomplete
//                           options={vendorName}
//                           getOptionLabel={(option: VendorNameGet) => option.vendorName || ''}
//                           isOptionEqualToValue={(option: VendorNameGet, value: VendorNameGet) => option.vendorId === value.vendorId}
//                           onChange={(event, newValue) => {
//                             handleChange({
//                               target: {
//                                 name: 'vendorId',
//                                 value: newValue?.vendorId || '',
//                               },
//                             });
//                             handleChange({
//                               target: {
//                                 name: 'vendorName',
//                                 value: newValue?.vendorName || '',
//                               },
//                             });
//                           }}
//                           renderInput={(params) => (
//                             <TextField
//                               {...params}
//                               label="Vendor"
//                               variant="outlined"
//                               size="small"
//                               error={touched.vendorId && !!errors.vendorId}
//                               helperText={touched.vendorId && errors.vendorId}
//                             />
//                           )}
//                         />
//                       </FormControl>
//                     </Grid>
//                     <Grid item xs={12}>
//                       <TextField
//                         fullWidth
//                         label="Amount"
//                         type="number"
//                         name="amount"
//                         value={values.amount}
//                         onChange={handleChange}
//                         onBlur={handleBlur}
//                         error={touched.amount && !!errors.amount}
//                         helperText={touched.amount && errors.amount}
//                         size="small"
//                       />
//                     </Grid>
//                     <Grid item xs={12}>
//                       <TextField
//                         select
//                         fullWidth
//                         label="Payment Mode"
//                         name="paymentMode"
//                         value={values.paymentMode}
//                         onChange={handleChange}
//                         onBlur={handleBlur}
//                         error={touched.paymentMode && !!errors.paymentMode}
//                         helperText={touched.paymentMode && errors.paymentMode}
//                         size="small"
//                       >
//                         <MenuItem value="Cash">Cash</MenuItem>
//                         <MenuItem value="Bank">Bank</MenuItem>
//                       </TextField>
//                     </Grid>
//                     <Grid item xs={12}>
//                       <TextField
//                         select
//                         fullWidth
//                         label="Payment Method"
//                         name="paymentMethod"
//                         value={values.paymentMethod}
//                         onChange={handleChange}
//                         onBlur={handleBlur}
//                         error={touched.paymentMethod && !!errors.paymentMethod}
//                         helperText={touched.paymentMethod && errors.paymentMethod}
//                         size="small"
//                       >
//                         <MenuItem value="cash">Cash</MenuItem>
//                         <MenuItem value="neft">NEFT</MenuItem>
//                         <MenuItem value="rtgs">RTGS</MenuItem>
//                         <MenuItem value="imps">IMPS</MenuItem>
//                         <MenuItem value="upi">UPI</MenuItem>
//                       </TextField>
//                     </Grid>
//                     {values.paymentMode === "Bank" && (
//                       <>
//                         <Grid item xs={12}>
//                           <TextField
//                             fullWidth
//                             label="Bank Name"
//                             name="bankName"
//                             value={values.bankName}
//                             onChange={handleChange}
//                             onBlur={handleBlur}
//                             error={touched.bankName && !!errors.bankName}
//                             helperText={touched.bankName && errors.bankName}
//                             size="small"
//                           />
//                         </Grid>
//                         {values.paymentMethod === "neft" && (
//                           <Grid item xs={12}>
//                             <TextField
//                               fullWidth
//                               label="NEFT Number"
//                               name="neftNo"
//                               value={values.neftNo}
//                               onChange={handleChange}
//                               onBlur={handleBlur}
//                               error={touched.neftNo && !!errors.neftNo}
//                               helperText={touched.neftNo && errors.neftNo}
//                               size="small"
//                             />
//                           </Grid>
//                         )}
//                         {values.paymentMethod === "rtgs" && (
//                           <Grid item xs={12}>
//                             <TextField
//                               fullWidth
//                               label="RTGS Number"
//                               name="rtgsNo"
//                               value={values.rtgsNo}
//                               onChange={handleChange}
//                               onBlur={handleBlur}
//                               error={touched.rtgsNo && !!errors.rtgsNo}
//                               helperText={touched.rtgsNo && errors.rtgsNo}
//                               size="small"
//                             />
//                           </Grid>
//                         )}
//                         {values.paymentMethod === "imps" && (
//                           <Grid item xs={12}>
//                             <TextField
//                               fullWidth
//                               label="IMPS Number"
//                               name="impsNo"
//                               value={values.impsNo}
//                               onChange={handleChange}
//                               onBlur={handleBlur}
//                               error={touched.impsNo && !!errors.impsNo}
//                               helperText={touched.impsNo && errors.impsNo}
//                               size="small"
//                             />
//                           </Grid>
//                         )}
//                         {values.paymentMethod === "upi" && (
//                           <Grid item xs={12}>
//                             <TextField
//                               fullWidth
//                               label="UPI ID"
//                               name="upi"
//                               value={values.upi}
//                               onChange={handleChange}
//                               onBlur={handleBlur}
//                               error={touched.upi && !!errors.upi}
//                               helperText={touched.upi && errors.upi}
//                               size="small"
//                             />
//                           </Grid>
//                         )}
//                       </>
//                     )}
//                     {values.paymentMethod === "cash" && (
//                       <Grid item xs={12}>
//                         <TextField
//                           fullWidth
//                           label="Cash Voucher Number"
//                           name="cashVoucherNo"
//                           value={values.cashVoucherNo}
//                           onChange={handleChange}
//                           onBlur={handleBlur}
//                           error={touched.cashVoucherNo && !!errors.cashVoucherNo}
//                           helperText={touched.cashVoucherNo && errors.cashVoucherNo}
//                           size="small"
//                         />
//                       </Grid>
//                     )}
//                     <Grid item xs={12}>
//                       <TextField
//                         fullWidth
//                         label="Remarks"
//                         name="remarks"
//                         value={values.remarks}
//                         onChange={handleChange}
//                         onBlur={handleBlur}
//                         error={touched.remarks && !!errors.remarks}
//                         helperText={touched.remarks && errors.remarks}
//                         size="small"
//                       />
//                     </Grid>
//                   </Grid>
//                   <DialogActions>
//                     <Button onClick={handleCloseCreateDialog}>Cancel</Button>
//                     <Button type="submit" variant="contained" color="primary">
//                       Create
//                     </Button>
//                   </DialogActions>
//                 </Form>
//               )}
//             </Formik>
//           </DialogContent>
//         </Dialog>

//         <Snackbar
//           open={snackbarOpen}
//           message={snackbarMessage}
//           autoHideDuration={3000}
//           onClose={() => dispatch(clearSnackbarMessage())}
//         />
//       </Box>
//     </Box>
//   );
// };

// export default AdvancePaymentComponent;
