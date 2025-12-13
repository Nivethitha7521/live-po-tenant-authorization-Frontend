// "use client";
// import React, { useCallback, useEffect, useMemo, useState } from "react";
// import { useDispatch, useSelector } from "react-redux";
// import {
//   Box,
//   TextField,
//   Button,
//   Typography,
//   Grid,
//   Paper,
//   TableContainer,
//   Table,
//   TableHead,
//   TableRow,
//   TableCell,
//   TableBody,
//   CircularProgress,
//   Dialog,
//   DialogTitle,
//   DialogContent,
//   DialogContentText,
//   DialogActions,
//   IconButton,
//   Snackbar,
//   Menu,
//   MenuItem,
//   Tooltip,
//   Switch,
//   TableFooter,
//   TablePagination,
// } from "@mui/material";
// import FilterAltIcon from "@mui/icons-material/FilterAlt";
// import ClearIcon from "@mui/icons-material/Clear";
// import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
// import DownloadIcon from "@mui/icons-material/Download";
// import DescriptionIcon from "@mui/icons-material/Description";
// import VisibilityIcon from "@mui/icons-material/Visibility";
// import FullscreenIcon from '@mui/icons-material/Fullscreen';
// import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
// import InfoIcon from '@mui/icons-material/Info';
// import { ChevronLeft, ChevronRight, Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon } from "@mui/icons-material";
// import Link from "next/link";
// import { format, startOfDay } from "date-fns";
// import jsPDF from "jspdf";
// import "jspdf-autotable";
// import Papa from "papaparse";
// import moment from "moment";
// import {
//   selectServiceListState,
//   updateServiceToAP,
//   updateServiceOrderStatusToPending,
//   fetchServiceOrders,
//   clearSnackbarMessage,
//   setSearchQuery,
//   selectCurrentPage,
//   selectPageSize,
//   selectTotalItems,
//   setPagination,
//   fetchServiceInvoiceNumbers,
//   calculateServiceOverallDiscount,
// } from "../Features/servicepo";
// import { AppDispatch } from "@/redux/store";
// import ServicePage from "../../page";
// import {
//   fetchBusinesses,
//   fetchPhoto,
//   selectBusinesses,
// } from "@/features/account-setting/businessSlice";
// import { ServiceItemSearch } from "@/features/service/serviceSlice";
// import { toWords } from "number-to-words";
// import DateRangeDialog from "@/components/dateRange";
// import VendorSearchAutocomplete from "../../../../components/vendorsearchautocomplete";
// import ServiceOrderRandomIdSearch from "../../../../components/service/approvedservice/infiniteScroll";
// import { ServiceOrderData, ServiceDescription, ServiceTaxDetails } from "@/Models/serviceModel";
// import { VendorSearch } from "@/Models/vendor";
// import ConfirmationDialog from "@/components/confirmationDialog";
// import { isValid } from "date-fns";
// import SaveIcon from '@mui/icons-material/Save';
// import { ExportProps, ServiceDescriptionWithCalculations, OverallDiscountServiceResponse, ServiceOrderWithDescriptions } from "../Models/servicecalculation";
// import FreightSelectionDialog, { FreightData } from "../Component/freightSelectionDialog";

// const parseLocalDate = (dateStr: string | null | undefined): Date | null => {
//   if (!dateStr) return null;
//   const localStr = dateStr.split('T')[0];
//   const date = new Date(localStr + 'T00:00:00');
//   return isNaN(date.getTime()) ? null : date;
// };

// const customRoundDigit = (value: number): number => Math.round(value * 100) / 100;

// interface ServiceDescriptionRowProps {
//   description: ServiceDescriptionWithCalculations;
//   index: number;
//   touched: Record<number, Record<string, boolean>>;
//   errors: Record<number, Record<string, string>>;
//   handleFeeChange: (id: string, value: string) => void;
//   handleDiscountChange: (id: string, value: string) => void;
//   handleFromDateChange: (id: string, value: Date | null) => void;
//   handleToDateChange: (id: string, value: Date | null) => void;
//   discountType: 'before' | 'after';
//   applyingDiscount: boolean;
// }

// const ServiceDescriptionRowMemo: React.FC<ServiceDescriptionRowProps> = React.memo(
//   ({
//     description,
//     index,
//     touched,
//     errors,
//     handleFeeChange,
//     handleDiscountChange,
//     handleFromDateChange,
//     handleToDateChange,
//     discountType,
//     applyingDiscount,
//   }) => (
//     <TableRow>
//       <TableCell className='table-number-right'>{index + 1}</TableCell>
//       <TableCell>{description.sacCode || 'N/A'}</TableCell>
//       <TableCell>{description.description}</TableCell>
//       <TableCell>
//         <TextField
//           label="From Date"
//           type="date"
//           value={description.from_date && isValid(description.from_date) ? format(description.from_date, 'yyyy-MM-dd') : ''}
//           onChange={(e) => handleFromDateChange(description.id || '', e.target.value ? new Date(e.target.value) : null)}
//           InputLabelProps={{ shrink: true }}
//           error={touched[index]?.from_date && !!errors[index]?.from_date}
//           helperText={touched[index]?.from_date && errors[index]?.from_date}
//         />
//       </TableCell>
//       <TableCell>
//         <TextField
//           label="To Date"
//           type="date"
//           value={description.to_date && isValid(description.to_date) ? format(description.to_date, 'yyyy-MM-dd') : ''}
//           onChange={(e) => handleToDateChange(description.id || '', e.target.value ? new Date(e.target.value) : null)}
//           InputLabelProps={{ shrink: true }}
//           inputProps={{
//             min: description.from_date ? format(description.from_date, 'yyyy-MM-dd') : undefined,
//           }}
//           error={touched[index]?.to_date && !!errors[index]?.to_date}
//           helperText={touched[index]?.to_date && errors[index]?.to_date}
//         />
//       </TableCell>
//       <TableCell className='table-number-right'>
//         <TextField
//           type="number"
//           autoComplete="off"
//           value={description.fee ?? ""}
//           onChange={(e) => handleFeeChange(description.id || '', e.target.value)}
//           inputProps={{ step: "0.01" }}
//           sx={{ width: "100px" }}
//           error={touched[index]?.fee && !!errors[index]?.fee}
//           helperText={touched[index]?.fee && errors[index]?.fee}
//         />
//       </TableCell>
//       <TableCell className='table-number-right'>
//         <TextField
//           autoComplete="off"
//           type="number"
//           value={description.discountAmount === 0 || description.discountAmount === undefined ? "" : description.discountAmount}
//           onChange={(e) => handleDiscountChange(description.id || '', e.target.value)}
//           error={touched[index]?.discountAmount && !!errors[index]?.discountAmount}
//           helperText={touched[index]?.discountAmount && errors[index]?.discountAmount}
//           inputProps={{ step: "0.01" }}
//           sx={{ width: "100px" }}
//           disabled={applyingDiscount}
//         />
//       </TableCell>
//       <TableCell className='table-number-right'>{description.tax_per || 0}%</TableCell>
//       <TableCell className='table-number-right'>{description.tax_type === 'cgst_sgst' ? 'CGST/SGST' : 'IGST'}</TableCell>
//       <TableCell className='table-number-right'>{(description.calculatedTotal || 0).toFixed(2)}</TableCell>
//     </TableRow>
//   )
// );

// ServiceDescriptionRowMemo.displayName = "ServiceDescriptionRowMemo";

// interface ServiceOrderDetailsDialogProps {
//   open: boolean;
//   onClose: () => void;
//   selectedOrder: ServiceOrderWithDescriptions | null;
//   updatedDescriptions: ServiceDescriptionWithCalculations[];
//   setUpdatedDescriptions: React.Dispatch<React.SetStateAction<ServiceDescriptionWithCalculations[]>>;
//   invoiceNumber: string;
//   setInvoiceNumber: React.Dispatch<React.SetStateAction<string>>;
//   invoiceDate: Date | null;
//   setInvoiceDate: React.Dispatch<React.SetStateAction<Date | null>>;
//   apDate: Date | null;
//   setApDate: React.Dispatch<React.SetStateAction<Date | null>>;
//   isInvoiceDuplicate: boolean;
//   isTouched: boolean;
//   setIsTouched: React.Dispatch<React.SetStateAction<boolean>>;
//   taxDetails: ServiceTaxDetails;
//   totalOrderAmount: number;
//   totalDiscountAmount: number;
//   handleSaveChanges: () => void;
//   handleOpenRevertDialog: () => void;
//   isProcessing: boolean;
//   touched: Record<number, Record<string, boolean>>;
//   setTouched: React.Dispatch<React.SetStateAction<Record<number, Record<string, boolean>>>>;
//   errors: Record<number, Record<string, string>> & { roundOff?: string };
//   setErrors: React.Dispatch<React.SetStateAction<Record<number, Record<string, string>> & { roundOff?: string }>>;
//   handleFeeChange: (id: string, value: string) => void;
//   handleDiscountChange: (id: string, value: string) => void;
//   handleFromDateChange: (id: string, value: Date | null) => void;
//   handleToDateChange: (id: string, value: Date | null) => void;
//   calculatedDescriptions: ServiceDescriptionWithCalculations[];
//   roundOffAmount: number;
//   setRoundOffAmount: React.Dispatch<React.SetStateAction<number>>;
//   overallDiscountAmount: number;
//   setOverallDiscountAmount: React.Dispatch<React.SetStateAction<number>>;
//   discountType: 'before' | 'after';
//   setDiscountType: React.Dispatch<React.SetStateAction<'before' | 'after'>>;
//   originalDescriptionDiscounts: Record<string, { discountAmount: number }>;
//   setOriginalDescriptionDiscounts: React.Dispatch<React.SetStateAction<Record<string, { discountAmount: number }>>>;
//   handleApplyDiscount: () => void;
//   removeOverallDiscount: () => void;
//   applyingDiscount: boolean;
//   freights?: FreightData[];
//   onEditFreights?: (freights: FreightData[]) => void;
// }

// const ServiceOrderDetailsDialog: React.FC<ServiceOrderDetailsDialogProps> = ({
//   open,
//   onClose,
//   selectedOrder,
//   updatedDescriptions,
//   setUpdatedDescriptions,
//   invoiceNumber,
//   setInvoiceNumber,
//   invoiceDate,
//   setInvoiceDate,
//   apDate,
//   setApDate,
//   isInvoiceDuplicate,
//   isTouched,
//   setIsTouched,
//   taxDetails,
//   totalOrderAmount,
//   totalDiscountAmount,
//   handleSaveChanges,
//   handleOpenRevertDialog,
//   isProcessing,
//   touched,
//   setTouched,
//   errors,
//   setErrors,
//   handleFeeChange,
//   handleDiscountChange,
//   handleFromDateChange,
//   handleToDateChange,
//   calculatedDescriptions,
//   roundOffAmount,
//   setRoundOffAmount,
//   overallDiscountAmount,
//   setOverallDiscountAmount,
//   discountType,
//   setDiscountType,
//   originalDescriptionDiscounts,
//   setOriginalDescriptionDiscounts,
//   handleApplyDiscount,
//   removeOverallDiscount,
//   applyingDiscount,
//   freights = [],
//   onEditFreights,
// }) => {
//   const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
//   const [isFullScreen, setIsFullScreen] = useState(false);
//   const [openFreightDialog, setOpenFreightDialog] = useState(false);
  
//   const toggleFullScreen = () => {
//     setIsFullScreen(!isFullScreen);
//   };

//   const handleOpenConfirmDialog = () => {
//     const finalTotal = totalOrderAmount + roundOffAmount;
//     if (finalTotal < 0) {
//       setErrors((prev) => ({
//         ...prev,
//         roundOff: "Round off amount cannot make total negative"
//       }));
//       return;
//     }
//     setOpenConfirmDialog(true);
//   };

//   const handleCloseConfirmDialog = () => {
//     setOpenConfirmDialog(false);
//   };

//   const handleConfirmSave = () => {
//     setOpenConfirmDialog(false);
//     handleSaveChanges();
//   };

//   const getCurrentDate = () => {
//     return format(new Date(), 'yyyy-MM-dd');
//   };

//   const getOrderDateMin = () => {
//     return selectedOrder?.workOrderDate ? format(startOfDay(new Date(selectedOrder.workOrderDate)), 'yyyy-MM-dd') : getCurrentDate();
//   };

//   const handleRoundOffChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const value = e.target.value;
//     if (value === '') {
//       setRoundOffAmount(0);
//       setErrors((prev) => ({ ...prev, roundOff: "" }));
//       return;
//     }

//     if (/^-?\d*\.?\d{0,2}$/.test(value)) {
//       const parsedValue = parseFloat(value) || 0;
//       if (Math.abs(parsedValue) > 2) {
//         setErrors((prev) => ({
//           ...prev,
//           roundOff: "Value must be between -2.00 and +2.00",
//         }));
//       } else {
//         setErrors((prev) => ({ ...prev, roundOff: "" }));
//       }
//       setRoundOffAmount(parsedValue);
//     } else {
//       setErrors((prev) => ({
//         ...prev,
//         roundOff: "Enter a number between -2.00 and +2.00 with up to 2 decimals",
//       }));
//     }
//   };

//   const handleRoundOffBlur = () => {
//     let currentValue = roundOffAmount;
//     currentValue = Math.round(currentValue * 100) / 100;
//     let errorMsg = "";

//     if (currentValue > 2) {
//       currentValue = 2;
//       errorMsg = "Capped at +2.00";
//     } else if (currentValue < -2) {
//       currentValue = -2;
//       errorMsg = "Capped at -2.00";
//     }

//     const finalTotal = totalOrderAmount + currentValue;
//     if (finalTotal < 0) {
//       setErrors((prev) => ({
//         ...prev,
//         roundOff: `Cannot make total negative (would be ${finalTotal.toFixed(2)}). Reset to 0.`,
//       }));
//       setRoundOffAmount(0);
//       return;
//     }

//     if (errorMsg) {
//       setErrors((prev) => ({ ...prev, roundOff: errorMsg }));
//     } else {
//       setErrors((prev) => ({ ...prev, roundOff: "" }));
//     }
//     setRoundOffAmount(currentValue);
//   };

//   const roundOffSuggestion = useMemo(() => {
//     const fractional = totalOrderAmount % 1;
//     if (fractional !== 0) {
//       return (Math.round(totalOrderAmount) - totalOrderAmount).toFixed(2);
//     }
//     return '0.00';
//   }, [totalOrderAmount]);

//   const finalTotalAmount = totalOrderAmount + roundOffAmount;

//   const handleOverallDiscountBlur = useCallback(() => {
//     const num = Number(overallDiscountAmount);
//     if (num > 0 && num <= totalOrderAmount) {
//       handleApplyDiscount();
//     } else if (num > totalOrderAmount) {
//       setOverallDiscountAmount(0);
//     }
//   }, [overallDiscountAmount, totalOrderAmount, handleApplyDiscount, setOverallDiscountAmount]);

//   const freightTotalAmount = useMemo(() => freights.reduce((sum, freight) => sum + freight.totalAmt, 0), [freights]);
//   const freightTaxTotal = useMemo(() => freights.reduce((sum, freight) => sum + freight.tAmt, 0), [freights]);

//   return (
//     <>
//       <Dialog
//         open={open}
//         onClose={isProcessing ? undefined : onClose}
//         fullWidth={true}
//         fullScreen={isFullScreen}
//         container={document.body}
//         disablePortal={false}
//         sx={isFullScreen ? {
//           '& .MuiDialog-container': {
//             position: 'fixed !important',
//             top: '0 !important',
//             left: '0 !important',
//             right: '0 !important',
//             bottom: '0 !important',
//             width: '100vw !important',
//             height: '100vh !important',
//             maxWidth: 'none !important',
//             maxHeight: 'none !important',
//             margin: '0 !important',
//             zIndex: 9999,
//           },
//           '& .MuiDialog-paper': {
//             width: '100vw !important',
//             height: '100vh !important',
//             maxWidth: 'none !important',
//             maxHeight: 'none !important',
//             margin: '0 !important',
//             borderRadius: '0 !important',
//           }
//         } : {}}
//         PaperProps={{
//           style: {
//             height: isFullScreen ? '100vh' : 'auto',
//             width: isFullScreen ? '100vw' : '90vw',
//             maxWidth: isFullScreen ? 'none' : 'none',
//             margin: isFullScreen ? 0 : 'auto',
//             borderRadius: isFullScreen ? 0 : undefined,
//           },
//         }}
//       >
//         <DialogTitle sx={{
//           fontWeight: 'bold',
//           display: 'flex',
//           justifyContent: 'space-between',
//           alignItems: 'center',
//           padding: isFullScreen ? '16px 24px' : '16px'
//         }}>
//           <span>Service Order Details {selectedOrder?.randomId || ''}</span>
//           <span>Vendor Name: {selectedOrder?.vendorName || 'Unknown Vendor'}</span>
//           <IconButton onClick={toggleFullScreen} color="primary" edge="end">
//             {isFullScreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
//           </IconButton>
//         </DialogTitle>
//         <DialogContent sx={{
//           padding: isFullScreen ? '0 24px 24px' : '24px',
//           display: 'flex',
//           flexDirection: 'column',
//           height: isFullScreen ? 'calc(100vh - 64px)' : 'auto',
//           overflow: 'hidden'
//         }}>
//           <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2, flexShrink: 0 }}>
//             <Box display="flex" gap={2} mt={1} mb={2}>
//               <TextField
//                 label="Invoice Number"
//                 autoComplete="off"
//                 value={invoiceNumber}
//                 onChange={(e) => {
//                   setInvoiceNumber(e.target.value);
//                   setIsTouched(true);
//                 }}
//                 error={isTouched && (isInvoiceDuplicate || !invoiceNumber)}
//                 helperText={
//                   isTouched && !invoiceNumber
//                     ? 'Invoice number is required!'
//                     : isTouched && isInvoiceDuplicate
//                       ? 'Invoice number already exists!'
//                       : ''
//                 }
//               />
//               <TextField
//                 label="Invoice Date"
//                 type="date"
//                 value={invoiceDate ? format(invoiceDate, 'yyyy-MM-dd') : getCurrentDate()}
//                 onChange={(e) => setInvoiceDate(e.target.value ? new Date(e.target.value) : new Date())}
//                 disabled={!selectedOrder?.workOrderDate}
//                 inputProps={{
//                   min: getOrderDateMin(),
//                   max: getCurrentDate(),
//                 }}
//                 InputLabelProps={{ shrink: true }}
//               />
//               <TextField
//                 label="AP Date"
//                 type="date"
//                 value={apDate ? format(apDate, 'yyyy-MM-dd') : getCurrentDate()}
//                 onChange={(e) => setApDate(e.target.value ? new Date(e.target.value) : new Date())}
//                 disabled={true}
//                 inputProps={{
//                   min: getOrderDateMin(),
//                   max: getCurrentDate(),
//                 }}
//                 InputLabelProps={{ shrink: true }}
//               />
//             </Box>
//           </Box>
//           <TableContainer component={Paper} sx={{ flex: 1, overflow: 'auto' }}>
//             <Table stickyHeader>
//               <TableHead>
//                 <TableRow>
//                   <TableCell className='table-number-right'>S.No</TableCell>
//                   <TableCell>SAC Code</TableCell>
//                   <TableCell>Description</TableCell>
//                   <TableCell>From Date</TableCell>
//                   <TableCell>To Date</TableCell>
//                   <TableCell className='table-number-right'>Fee</TableCell>
//                   <TableCell className='table-number-right'>Discount</TableCell>
//                   <TableCell className='table-number-right'>Tax %</TableCell>
//                   <TableCell className='table-number-right'>Tax Type</TableCell>
//                   <TableCell className='table-number-right'>Total</TableCell>
//                 </TableRow>
//               </TableHead>
//               <TableBody>
//                 {calculatedDescriptions.length === 0 ? (
//                   <TableRow>
//                     <TableCell colSpan={10} align="center">
//                       No service descriptions available
//                     </TableCell>
//                   </TableRow>
//                 ) : (
//                   calculatedDescriptions.map((description, index) => (
//                     <ServiceDescriptionRowMemo
//                       key={description.id || index}
//                       description={description}
//                       index={index}
//                       touched={touched}
//                       errors={errors}
//                       handleFeeChange={handleFeeChange}
//                       handleDiscountChange={handleDiscountChange}
//                       handleFromDateChange={handleFromDateChange}
//                       handleToDateChange={handleToDateChange}
//                       discountType={discountType}
//                       applyingDiscount={applyingDiscount}
//                     />
//                   ))
//                 )}
//                 {/* Subtotal */}
//                 {calculatedDescriptions.length > 0 && (
//                   <TableRow sx={{ fontWeight: 'bold', backgroundColor: '#e8f5e8' }}>
//                     <TableCell colSpan={8} />
//                     <TableCell><strong>Sub Total :</strong></TableCell>
//                     <TableCell className='table-number-right'>
//                       {customRoundDigit(
//                         calculatedDescriptions
//                           .reduce((sum, desc) => sum + (desc.calculatedTaxableAmount || 0), 0)
//                       ).toFixed(2)}
//                     </TableCell>
//                   </TableRow>
//                 )}
//                 {/* Tax Details */}
//                 {Object.entries(taxDetails).map(([key, tax]: [string, { amount: number; percentage: number; type: string }]) => (
//                   <TableRow key={key}>
//                     <TableCell colSpan={8} />
//                     <TableCell>
//                       <strong>{tax.type} ({tax.percentage.toFixed(2)}%):</strong>
//                     </TableCell>
//                     <TableCell className='table-number-right'>{tax.amount.toFixed(2)}</TableCell>
//                   </TableRow>
//                 ))}
//                 {/* Freight Charges */}
//                 <TableRow>
//                   <TableCell colSpan={8} />
//                   <TableCell>
//                     <strong>Freight Amount:</strong>
//                   </TableCell>
//                   <TableCell className='table-number-right'>
//                     {freightTotalAmount.toFixed(2)}
//                   </TableCell>
//                 </TableRow>
//                 <TableRow sx={{ fontWeight: 'bold', backgroundColor: '#f0f8ff' }}>
//                   <TableCell colSpan={8} />
//                   <TableCell>
//                     <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
//                       <strong>Freight Tax:</strong>
//                       <Button
//                         variant="outlined"
//                         color="primary"
//                         onClick={() => setOpenFreightDialog(true)}
//                         startIcon={freights.length > 0 ? <EditIcon /> : <AddIcon />}
//                         size="small"
//                         sx={{ ml: 2 }}
//                       >
//                       </Button>
//                     </Box>
//                   </TableCell>
//                   <TableCell className='table-number-right'>
//                     {freightTaxTotal.toFixed(2)}
//                   </TableCell>
//                 </TableRow>
//                 {/* Discount Section */}
//                 <TableRow sx={{ fontWeight: 'bold' }}>
//                   <TableCell colSpan={8} />
//                   <TableCell>
//                     <strong>Discount:</strong>
//                   </TableCell>
//                   <TableCell className='table-number-right'>
//                     <Box sx={{ display: 'flex', alignItems: 'center' }}>
//                       <TextField
//                         autoComplete='off'
//                         value={overallDiscountAmount === 0 ? '' : overallDiscountAmount}
//                         onChange={(e) => setOverallDiscountAmount(Number(e.target.value) || 0)}
//                         onBlur={handleOverallDiscountBlur}
//                         size="small"
//                         type="number"
//                         label="₹"
//                         inputProps={{
//                           min: '0',
//                           max: totalOrderAmount.toString(),
//                           step: '0.01',
//                         }}
//                         sx={{ width: 150 }}
//                         error={overallDiscountAmount > totalOrderAmount}
//                         helperText={overallDiscountAmount > totalOrderAmount ? 'Cannot exceed total' : ''}
//                         disabled={applyingDiscount}
//                       />
//                       <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
//                         <Typography variant="body2" sx={{ fontSize: '0.60rem', textAlign: 'center' }}>
//                           {discountType === 'before' ? 'Before' : 'After'} Tax
//                         </Typography>
//                         <Switch
//                           checked={discountType === 'after'}
//                           onChange={(e) => {
//                             const newDiscountType = e.target.checked ? 'after' : 'before';
//                             setOverallDiscountAmount(0);
//                             setDiscountType(newDiscountType);
//                           }}
//                           disabled={applyingDiscount}
//                           size="small"
//                         />
//                       </Box>
//                       <Tooltip title="Apply Overall Discount">
//                         <span>
//                           <IconButton
//                             onClick={handleApplyDiscount}
//                             size="small"
//                             disabled={applyingDiscount || overallDiscountAmount <= 0}
//                             sx={{ color: 'success.main' }}
//                           >
//                             {applyingDiscount ? <CircularProgress size={20} /> : <SaveIcon />}
//                           </IconButton>
//                         </span>
//                       </Tooltip>
//                       {overallDiscountAmount > 0 && (
//                         <IconButton
//                           onClick={removeOverallDiscount}
//                           size="small"
//                           color="error"
//                         >
//                           <ClearIcon />
//                         </IconButton>
//                       )}
//                     </Box>
//                   </TableCell>
//                 </TableRow>
//                 {/* Before RoundOff */}
//                 <TableRow>
//                   <TableCell colSpan={8} />
//                   <TableCell>
//                     <strong>Before RoundOff:</strong>
//                   </TableCell>
//                   <TableCell className='table-number-right'>{totalOrderAmount.toFixed(2)}</TableCell>
//                 </TableRow>
//                 {/* Round Off */}
//                 <TableRow sx={{ fontWeight: 'bold' }}>
//                   <TableCell colSpan={8} />
//                   <TableCell>
//                     <strong>Round Off Amount:</strong>
//                   </TableCell>
//                   <TableCell className='table-number-right'>
//                     <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
//                       <TextField
//                         autoComplete='off'
//                         value={roundOffAmount === 0 ? '' : roundOffAmount}
//                         onChange={handleRoundOffChange}
//                         onBlur={handleRoundOffBlur}
//                         size="small"
//                         type="number"
//                         label="₹"
//                         inputProps={{
//                           min: '-2',
//                           max: '2',
//                           step: '0.01',
//                         }}
//                         placeholder={roundOffSuggestion}
//                         sx={{ width: 150 }}
//                         error={!!errors.roundOff}
//                         helperText={errors.roundOff}
//                       />
//                     </Box>
//                   </TableCell>
//                 </TableRow>
//                 {/* Tax Amount */}
//                 <TableRow sx={{
//                   backgroundColor: '#f5f5f5',
//                   '& td': {
//                     fontWeight: 'bold',
//                     fontSize: '1.1em'
//                   }
//                 }}>
//                   <TableCell colSpan={8} />
//                   <TableCell>
//                     <strong>Tax Amount:</strong>
//                   </TableCell>
//                   <TableCell className='table-number-right'>
//                     {Object.values(taxDetails).reduce((sum, tax) => sum + tax.amount, 0).toFixed(2)}
//                   </TableCell>
//                 </TableRow>
//                 {/* Final Total */}
//                 <TableRow sx={{
//                   backgroundColor: '#f5f5f5',
//                   '& td': {
//                     fontWeight: 'bold',
//                     fontSize: '1.1em'
//                   }
//                 }}>
//                   <TableCell colSpan={8} />
//                   <TableCell>
//                     <strong>Final Amount:</strong>
//                   </TableCell>
//                   <TableCell className='table-number-right'
//                     sx={{
//                       color: finalTotalAmount < 0 ? 'error.main' : 'inherit'
//                     }}>
//                     {finalTotalAmount.toFixed(2)}
//                   </TableCell>
//                 </TableRow>
//               </TableBody>
//             </Table>
//           </TableContainer>
//           <FreightSelectionDialog
//             open={openFreightDialog}
//             onClose={() => setOpenFreightDialog(false)}
//             onAddFreights={(newFreights) => {
//               if (onEditFreights) {
//                 onEditFreights(newFreights);
//               }
//               setOpenFreightDialog(false);
//             }}
//             existingFreights={freights || []}
//           />
//         </DialogContent>
//         <DialogActions>
//           <Box display="flex" justifyContent="flex-end" mt={2}>
//             <Button variant="contained" onClick={handleOpenRevertDialog} disabled={isProcessing} sx={{ mr: 2 }}>
//               Revert Service Order
//             </Button>
//             <Tooltip
//               title={
//                 finalTotalAmount >= 0
//                   ? "Convert this service order to Accounts Payable (AP)"
//                   : "Cannot convert to AP: Round off amount makes total negative."
//               }
//             >
//               <span>
//                 <Button
//                   variant="contained"
//                   color="success"
//                   onClick={handleOpenConfirmDialog}
//                   disabled={
//                     isProcessing ||
//                     isInvoiceDuplicate ||
//                     !invoiceNumber ||
//                     finalTotalAmount < 0
//                   }
//                 >
//                   Convert to AP
//                 </Button>
//               </span>
//             </Tooltip>
//           </Box>
//         </DialogActions>
//       </Dialog>
//       <ConfirmationDialog
//         open={openConfirmDialog}
//         onClose={handleCloseConfirmDialog}
//         onConfirm={handleConfirmSave}
//         title="Confirm Conversion to AP"
//         description={
//           <Box>
//             <Typography>Are you sure you want to convert this service order to Accounts Payable (AP)?</Typography>
//             <Box sx={{ mt: 1 }}>
//               <Typography variant="body2">
//                 <strong>Total Before Round Off:</strong> {totalOrderAmount.toFixed(2)}
//               </Typography>
//               <Typography variant="body2">
//                 <strong>Round Off Amount:</strong> {roundOffAmount.toFixed(2)}
//               </Typography>
//               <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
//                 <strong>Final Total:</strong> {finalTotalAmount.toFixed(2)}
//               </Typography>
//             </Box>
//           </Box>
//         }
//         confirmText="Convert to AP"
//         cancelText="Cancel"
//       />
//     </>
//   );
// };

// const ApprovedService: React.FC = () => {
//   const dispatch = useDispatch<AppDispatch>();
//   const { serviceList, serviceInvoices, error, snackbarOpen, snackbarMessage, searchQuery } = useSelector(selectServiceListState);
//   const { businesses } = useSelector(selectBusinesses);
//   const currentPage = useSelector(selectCurrentPage);
//   const pageSize = useSelector(selectPageSize);
//   const totalItems = useSelector(selectTotalItems);
  
//   const [selectedOrder, setSelectedOrder] = useState<ServiceOrderWithDescriptions | null>(null);
//   const [openDialog, setOpenDialog] = useState(false);
//   const [openRevertDialog, setOpenRevertDialog] = useState(false);
//   const [updatedDescriptions, setUpdatedDescriptions] = useState<ServiceDescriptionWithCalculations[]>([]);
//   const [invoiceNumber, setInvoiceNumber] = useState("");
//   const [isInvoiceDuplicate, setIsInvoiceDuplicate] = useState(false);
//   const [isTouched, setIsTouched] = useState(false);
//   const [invoiceDate, setInvoiceDate] = useState<Date | null>(null);
//   const [apDate, setApDate] = useState<Date | null>(null);
//   const [isProcessing, setIsProcessing] = useState(false);
//   const [roundOffAmount, setRoundOffAmount] = useState(0);
//   const [overallDiscountAmount, setOverallDiscountAmount] = useState(0);
//   const [discountType, setDiscountType] = useState<'before' | 'after'>('after');
//   const [originalDescriptionDiscounts, setOriginalDescriptionDiscounts] = useState<Record<string, { discountAmount: number }>>({});
//   const [applyingDiscount, setApplyingDiscount] = useState(false);
//   const [loading, setLoading] = useState(false);
  
//   const [selectionRange, setSelectionRange] = useState({
//     startDate: new Date(),
//     endDate: new Date(),
//     key: "selection",
//   });
//   const [selectedVendor, setSelectedVendor] = useState<VendorSearch | null>(null);
//   const [selectedRandomId, setSelectedRandomId] = useState("");
//   const [dialogDownloadOpen, setDialogDownloadOpen] = useState(false);
//   const [dialogSummaryOpen, setDialogSummaryOpen] = useState(false);
//   const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
//   const [snackbarInvoiceOpen, setSnackbarInvoiceOpen] = useState(false);
//   const [snackbarInvoiceMessage, setSnackbarInvoiceMessage] = useState("");
//   const [touched, setTouched] = useState<Record<number, Record<string, boolean>>>({});
//   const [errors, setErrors] = useState<Record<number, Record<string, string>> & { roundOff?: string }>({});
//   const [newItem, setNewItem] = useState<ServiceItemSearch | null>(null);
//   const [freights, setFreights] = useState<FreightData[]>([]);

//   const handleCloseDialogs = useCallback(() => {
//     setOpenDialog(false);
//     setOpenRevertDialog(false);
//     setDialogDownloadOpen(false);
//     setDialogSummaryOpen(false);
//     setSelectedOrder(null);
//     setUpdatedDescriptions([]);
//     setInvoiceNumber("");
//     setInvoiceDate(null);
//     setApDate(null);
//     setIsTouched(false);
//     setIsInvoiceDuplicate(false);
//     setTouched({});
//     setErrors({});
//     setRoundOffAmount(0);
//     setOverallDiscountAmount(0);
//     setDiscountType('after');
//     setOriginalDescriptionDiscounts({});
//     setFreights([]);
//     console.log("Dialogs closed, states reset");
//   }, []);

//   const calculatedDescriptions = useMemo(() => {
//     if (!selectedOrder || updatedDescriptions.length === 0) return [];
    
//     return updatedDescriptions.map((desc) => {
//       const fee = Number(desc.fee) || 0;
//       const discountAmount = Number(desc.discountAmount) || 0;
//       const taxPer = desc.tax_per || 0;
//       const taxType = desc.tax_type || 'cgst_sgst';
      
//       // Service calculations (simpler than items)
//       const taxableAmount = fee - discountAmount;
//       let taxAmount = 0;
      
//       if (taxType === 'cgst_sgst') {
//         taxAmount = (taxPer / 100) * taxableAmount;
//       } else if (taxType === 'igst') {
//         taxAmount = (taxPer / 100) * taxableAmount;
//       }
      
//       const finalTotal = taxableAmount + taxAmount;
      
//       return {
//         ...desc,
//         calculatedTaxableAmount: taxableAmount,
//         calculatedTaxAmount: taxAmount,
//         calculatedTotal: finalTotal,
//       };
//     });
//   }, [updatedDescriptions, selectedOrder]);

//   const taxDetails = useMemo(() => {
//     const details: Record<string, { amount: number; percentage: number; type: string }> = {};
    
//     calculatedDescriptions.forEach((desc) => {
//       const taxAmount = desc.calculatedTaxAmount || 0;
//       const taxPercentage = desc.tax_per || 0;
//       const taxType = desc.tax_type;
      
//       if (taxType === 'igst') {
//         const igstKey = `igst-${taxPercentage}`;
//         if (details[igstKey]) {
//           details[igstKey].amount += taxAmount;
//         } else {
//           details[igstKey] = { amount: taxAmount, percentage: taxPercentage, type: "IGST" };
//         }
//       } else if (taxType === 'cgst_sgst') {
//         const sgst = taxAmount / 2;
//         const cgst = taxAmount / 2;
//         const sgstKey = `sgst-${taxPercentage / 2}`;
//         if (details[sgstKey]) {
//           details[sgstKey].amount += sgst;
//         } else {
//           details[sgstKey] = { amount: sgst, percentage: taxPercentage / 2, type: "SGST" };
//         }
//         const cgstKey = `cgst-${taxPercentage / 2}`;
//         if (details[cgstKey]) {
//           details[cgstKey].amount += cgst;
//         } else {
//           details[cgstKey] = { amount: cgst, percentage: taxPercentage / 2, type: "CGST" };
//         }
//       }
//     });
    
//     return details;
//   }, [calculatedDescriptions]);

//   const totalOrderAmount = useMemo(() => {
//     const servicesTotal = customRoundDigit(
//       calculatedDescriptions.reduce((sum, desc) => sum + (desc.calculatedTotal || 0), 0)
//     );
//     const freightTotal = customRoundDigit(
//       freights.reduce((sum, freight) => sum + freight.totalAmt, 0)
//     );
//     return servicesTotal + freightTotal;
//   }, [calculatedDescriptions, freights]);

//   const totalTaxAmount = useMemo(
//     () => customRoundDigit(Object.values(taxDetails).reduce((acc, tax) => acc + tax.amount, 0)),
//     [taxDetails]
//   );

//   const totalDiscountAmount = useMemo(
//     () =>
//       customRoundDigit(
//         calculatedDescriptions.reduce(
//           (sum, desc) => sum + (Number(desc.discountAmount) || 0),
//           0
//         )
//       ),
//     [calculatedDescriptions]
//   );

//   useEffect(() => {
//     if (selectedOrder) {
//       setInvoiceNumber(selectedOrder.invoiceNo || "");
//       const currentDate = new Date();
//       setInvoiceDate(currentDate);
//       setApDate(currentDate);
      
//       const initializedDescriptions = (selectedOrder.descriptions || []).map((desc: any) => {
//         const fromDate = desc.from_date ? new Date(desc.from_date) : null;
//         const toDate = desc.to_date ? new Date(desc.to_date) : null;
        
//         return {
//           ...desc,
//           id: desc.id || Math.random().toString(36).substr(2, 9),
//           fee: desc.fee || 0,
//           discountAmount: desc.discountAmount || 0,
//           from_date: fromDate,
//           to_date: toDate,
//         };
//       });
      
//       setUpdatedDescriptions(initializedDescriptions);
      
//       setOriginalDescriptionDiscounts(
//         initializedDescriptions.reduce((acc, desc) => ({
//           ...acc,
//           [desc.id]: { discountAmount: desc.discountAmount || 0 }
//         }), {})
//       );
      
//       const initialTouched = initializedDescriptions.reduce(
//         (acc, _, index) => ({
//           ...acc,
//           [index]: { 
//             fee: false, 
//             discountAmount: false, 
//             from_date: false, 
//             to_date: false 
//           },
//         }),
//         {}
//       );
      
//       const initialErrors = {
//         ...initializedDescriptions.reduce(
//           (acc, _, index) => ({
//             ...acc,
//             [index]: { 
//               fee: "", 
//               discountAmount: "", 
//               from_date: "", 
//               to_date: "" 
//             },
//           }),
//           {}
//         ),
//         roundOff: ""
//       };
      
//       setTouched(initialTouched);
//       setErrors(initialErrors);
//       setRoundOffAmount(0);
//       setOverallDiscountAmount(0);
//       setDiscountType('after');
//     }
//   }, [selectedOrder]);

//   useEffect(() => {
//     dispatch(fetchBusinesses());
//     dispatch(fetchServiceInvoiceNumbers());
//     dispatch(
//       fetchServiceOrders({
//         page: currentPage,
//         size: pageSize,
//         dateField: "approvedDate",
//         status: "Approved,PartiallyReceived",
//       })
//     );
//   }, [dispatch, currentPage, pageSize]);

//   useEffect(() => {
//     if (invoiceNumber && selectedOrder?.vendorName) {
//       const isDuplicate = serviceInvoices.some(
//         (order) =>
//           order.invoiceNo === invoiceNumber &&
//           order.serviceId !== selectedOrder.serviceId &&
//           order.vendorName === selectedOrder.vendorName
//       );
//       setIsInvoiceDuplicate(isDuplicate);
//     } else {
//       setIsInvoiceDuplicate(false);
//     }
//   }, [invoiceNumber, serviceInvoices, selectedOrder]);

//   const handleFeeChange = useCallback(
//     (id: string, value: string) => {
//       const index = updatedDescriptions.findIndex((desc) => desc.id === id);
//       setTouched((prev) => ({
//         ...prev,
//         [index]: { ...prev[index], fee: true },
//       }));
      
//       if (value === "" || /^\d*\.?\d*$/.test(value)) {
//         const feeValue = value === "" ? 0 : Number(value);
//         setUpdatedDescriptions((prevDesc) =>
//           prevDesc.map((desc) =>
//             desc.id === id ? { ...desc, fee: feeValue } : desc
//           )
//         );
//         setErrors((prev) => ({
//           ...prev,
//           [index]: { ...prev[index], fee: "" },
//         }));
//       } else {
//         setErrors((prev) => ({
//           ...prev,
//           [index]: { ...prev[index], fee: "Invalid number" },
//         }));
//       }
//     },
//     [updatedDescriptions]
//   );

//   const handleDiscountChange = useCallback(
//     (id: string, value: string) => {
//       const index = updatedDescriptions.findIndex((desc) => desc.id === id);
//       setTouched((prev) => ({
//         ...prev,
//         [index]: { ...prev[index], discountAmount: true },
//       }));
      
//       if (value === "" || /^\d*\.?\d*$/.test(value)) {
//         const discountValue = value === "" ? 0 : Number(value);
//         setUpdatedDescriptions((prevDesc) =>
//           prevDesc.map((desc) =>
//             desc.id === id ? { ...desc, discountAmount: discountValue } : desc
//           )
//         );
//         setErrors((prev) => ({
//           ...prev,
//           [index]: { ...prev[index], discountAmount: "" },
//         }));
//       } else {
//         setErrors((prev) => ({
//           ...prev,
//           [index]: { ...prev[index], discountAmount: "Invalid number" },
//         }));
//       }
//     },
//     [updatedDescriptions]
//   );

//   const handleFromDateChange = useCallback(
//     (id: string, value: Date | null) => {
//       const index = updatedDescriptions.findIndex((desc) => desc.id === id);
//       setTouched((prev) => ({
//         ...prev,
//         [index]: { ...prev[index], from_date: true },
//       }));
      
//       setErrors((prev) => ({
//         ...prev,
//         [index]: { ...prev[index], from_date: "" },
//       }));
      
//       setUpdatedDescriptions((prevDesc) =>
//         prevDesc.map((desc) =>
//           desc.id === id
//             ? { ...desc, from_date: value }
//             : desc
//         )
//       );
//     },
//     [updatedDescriptions]
//   );

//   const handleToDateChange = useCallback(
//     (id: string, value: Date | null) => {
//       const index = updatedDescriptions.findIndex((desc) => desc.id === id);
//       setTouched((prev) => ({
//         ...prev,
//         [index]: { ...prev[index], to_date: true },
//       }));
      
//       setErrors((prev) => ({
//         ...prev,
//         [index]: { ...prev[index], to_date: "" },
//       }));
      
//       setUpdatedDescriptions((prevDesc) =>
//         prevDesc.map((desc) =>
//           desc.id === id
//             ? { ...desc, to_date: value }
//             : desc
//         )
//       );
//     },
//     [updatedDescriptions]
//   );

//   const handleSaveChanges = useCallback(async () => {
//     console.log("Saving Service Changes:", { 
//       updatedDescriptions, 
//       invoiceNumber, 
//       invoiceDate, 
//       roundOffAmount, 
//       freights 
//     });
    
//     if (!selectedOrder?.serviceId) {
//       setSnackbarInvoiceMessage("Please select a valid service order with a service ID.");
//       setSnackbarInvoiceOpen(true);
//       return;
//     }
    
//     if (!invoiceNumber.trim()) {
//       setSnackbarInvoiceMessage("Invoice number is required.");
//       setSnackbarInvoiceOpen(true);
//       setIsTouched(true);
//       return;
//     }
    
//     const finalInvoiceDate = invoiceDate || new Date();
//     if (!finalInvoiceDate) {
//       setSnackbarInvoiceMessage("Invoice date is required.");
//       setSnackbarInvoiceOpen(true);
//       return;
//     }
    
//     if (isInvoiceDuplicate) {
//       setSnackbarInvoiceMessage("Duplicate invoice number detected. Please enter a unique invoice number.");
//       setSnackbarInvoiceOpen(true);
//       return;
//     }
    
//     const finalTotal = totalOrderAmount + roundOffAmount;
//     if (finalTotal < 0) {
//       setSnackbarInvoiceMessage(`Round off amount cannot make total negative. Current total: ${totalOrderAmount.toFixed(2)}`);
//       setSnackbarInvoiceOpen(true);
//       return;
//     }
    
//     const hasErrors = Object.values(errors).some((errorObj) =>
//       typeof errorObj === 'object' && Object.values(errorObj).some((error) => error)
//     );
    
//     if (hasErrors) {
//       setSnackbarInvoiceMessage("Please fix all validation errors before saving.");
//       setSnackbarInvoiceOpen(true);
//       return;
//     }
    
//     const validDescriptions = updatedDescriptions.filter((desc) => {
//       const fee = Number(desc.fee) || 0;
//       const discountAmount = Number(desc.discountAmount) || 0;
      
//       if (fee < 0) {
//         setSnackbarInvoiceMessage(`Fee for description "${desc.description}" cannot be negative.`);
//         setSnackbarInvoiceOpen(true);
//         return false;
//       }
      
//       if (discountAmount < 0) {
//         setSnackbarInvoiceMessage(`Discount for description "${desc.description}" cannot be negative.`);
//         setSnackbarInvoiceOpen(true);
//         return false;
//       }
      
//       if (discountAmount > fee) {
//         setSnackbarInvoiceMessage(`Discount for description "${desc.description}" cannot exceed fee.`);
//         setSnackbarInvoiceOpen(true);
//         return false;
//       }
      
//       return fee > 0;
//     });
    
//     if (validDescriptions.length === 0) {
//       setSnackbarInvoiceMessage("At least one service description must have a valid fee greater than 0.");
//       setSnackbarInvoiceOpen(true);
//       return;
//     }
    
//     const descriptions = validDescriptions.map((desc) => {
//       const fee = Number(desc.fee) || 0;
//       const discountAmount = Math.max(0, Math.min(fee, Number(desc.discountAmount) || 0));
      
//       return {
//         id: desc.id,
//         sacCode: desc.sacCode || "",
//         description: desc.description,
//         from_date: desc.from_date || new Date(),
//         to_date: desc.to_date || new Date(),
//         fee: fee,
//         discountAmount: discountAmount,
//         tax_type: desc.tax_type || 'cgst_sgst',
//         tax_per: desc.tax_per || 0,
//       };
//     });
    
//     console.log("Service descriptions being sent to backend:", descriptions);
//     console.log("Freights being sent to backend:", freights);
//     console.log("Round off amount:", roundOffAmount);
    
//     try {
//       setIsProcessing(true);
//       const updateResult = await dispatch(
//         updateServiceToAP({
//           serviceId: selectedOrder.serviceId,
//           descriptions,
//           invoiceNo: invoiceNumber.trim(),
//           invoiceDate: finalInvoiceDate,
//           apDate: apDate || new Date(),
//           overallDiscountValue: overallDiscountAmount,
//           roundOffValue: roundOffAmount,
//           freights,
//         })
//       ).unwrap();
      
//       console.log("Update Result:", updateResult);
      
//       setRoundOffAmount(0);
//       setOverallDiscountAmount(0);
      
//       await dispatch(
//         fetchServiceOrders({
//           page: currentPage,
//           size: pageSize,
//           dateField: "approvedDate",
//           status: "Approved,PartiallyReceived",
//         })
//       ).unwrap();
      
//       setSnackbarInvoiceMessage('Service converted to AP successfully!');
//       setSnackbarInvoiceOpen(true);
//       handleCloseDialogs();
//     } catch (error: any) {
//       console.error("Save Error:", error);
//       let errorMessage = "Failed to save changes. ";
//       if (error.message) {
//         errorMessage += error.message;
//       } else if (typeof error === 'string') {
//         errorMessage += error;
//       } else {
//         errorMessage += "Please check your inputs and try again.";
//       }
//       setSnackbarInvoiceMessage(errorMessage);
//       setSnackbarInvoiceOpen(true);
//     } finally {
//       setIsProcessing(false);
//     }
//   }, [
//     selectedOrder,
//     invoiceNumber,
//     isInvoiceDuplicate,
//     updatedDescriptions,
//     invoiceDate,
//     apDate,
//     roundOffAmount,
//     overallDiscountAmount,
//     totalOrderAmount,
//     errors,
//     dispatch,
//     currentPage,
//     pageSize,
//     handleCloseDialogs,
//     setSnackbarInvoiceMessage,
//     setSnackbarInvoiceOpen,
//     setIsTouched,
//     freights,
//   ]);

//   const filteredOrders = useMemo(() =>
//     serviceList.filter((order) =>
//       (order.status === "Approved" || order.status === "PartiallyReceived")
//     ), [serviceList]);

//   const handleViewDetailsClick = (serviceId: string) => {
//     const rawOrder = serviceList.find((order) => order.serviceId === serviceId);
//     if (rawOrder) {
//       const orderFreights: FreightData[] = rawOrder.freights?.map((freight: any) => ({
//         id: freight.id || freight.freightId || '',
//         name: freight.name || freight.freightName || '',
//         amt: freight.amt || freight.amount || 0,
//         tCode: freight.tCode || freight.taxCode || '',
//         tAmt: freight.tAmt || freight.taxAmount || 0,
//         totalAmt: freight.totalAmt || 0,
//         sgst: freight.sgst || 0,
//         cgst: freight.cgst || 0,
//         igst: freight.igst || 0,
//         taxType: freight.taxType || 'cgst_sgst',
//         taxPercentage: freight.taxPercentage || 0,
//       })) || [];
      
//       setFreights(orderFreights);
      
//       const transformedOrder: ServiceOrderWithDescriptions = {
//         ...rawOrder,
//         workOrderDate: rawOrder.workOrderDate ? new Date(rawOrder.workOrderDate) : null,
//         approvedDate: rawOrder.approvedDate ? parseLocalDate(rawOrder.approvedDate) : null,
//         invoiceDate: rawOrder.invoiceDate ? parseLocalDate(rawOrder.invoiceDate) : null,
//         descriptions: rawOrder.descriptions || [],
//       };
      
//       setSelectedOrder(transformedOrder);
//       const currentDate = new Date();
//       setInvoiceDate(currentDate);
//       setApDate(currentDate);
      
//       const initializedDescriptions = (transformedOrder.descriptions || []).map((desc: any, index: number) => {
//         const fromDate = desc.from_date ? new Date(desc.from_date) : null;
//         const toDate = desc.to_date ? new Date(desc.to_date) : null;
        
//         return {
//           ...desc,
//           id: desc.id || `desc-${index}-${Date.now()}`,
//           fee: desc.fee || 0,
//           discountAmount: desc.discountAmount || 0,
//           from_date: fromDate,
//           to_date: toDate,
//           calculatedTotal: 0,
//           calculatedTaxableAmount: 0,
//           calculatedTaxAmount: 0,
//         };
//       });
      
//       setUpdatedDescriptions(initializedDescriptions);
      
//       const initialTouched = initializedDescriptions.reduce(
//         (acc, _, index) => ({
//           ...acc,
//           [index]: {
//             fee: false,
//             discountAmount: false,
//             from_date: false,
//             to_date: false,
//           },
//         }),
//         {}
//       );
      
//       const initialErrorsObj = initializedDescriptions.reduce(
//         (acc, _, index) => ({
//           ...acc,
//           [index]: { 
//             fee: "", 
//             discountAmount: "", 
//             from_date: "", 
//             to_date: "" 
//           },
//         }),
//         {}
//       );
      
//       const initialErrors = {
//         ...initialErrorsObj,
//         roundOff: ""
//       };
      
//       setTouched(initialTouched);
//       setErrors(initialErrors);
//       setRoundOffAmount(0);
//       setOverallDiscountAmount(0);
//       setDiscountType('after');
      
//       setOriginalDescriptionDiscounts(
//         initializedDescriptions.reduce((acc, desc) => ({
//           ...acc,
//           [desc.id]: { discountAmount: desc.discountAmount || 0 }
//         }), {})
//       );
      
//       setOpenDialog(true);
//     }
//   };

//   const handleDownload = useCallback(
//     async (serviceId: string) => {
//       const serviceOrder = serviceList.find((order) => order.serviceId === serviceId);
//       if (!serviceOrder) {
//         console.error('Service Order not found for ID:', serviceId);
//         return;
//       }
      
//       const business = businesses[0];
//       if (!business) {
//         console.error('Business information not found!');
//         return;
//       }
      
//       const doc = new jsPDF();
//       let yOffset = 50;
//       let totalPages = 1;
//       const headerHeight = 50;
      
//       const drawHeader = (currentDoc: jsPDF) => {
//         let headerYOffset = 10;
//         if (business.imageUrl) {
//           currentDoc.addImage(business.imageUrl, 'JPEG', 35, headerYOffset, 25, 25);
//         }
//         currentDoc.setFontSize(14);
//         currentDoc.setFont('helvetica', 'bold');
//         currentDoc.setTextColor(0, 0, 128);
//         const title = 'Service Work Order';
//         const pageWidth = currentDoc.internal.pageSize.width;
//         currentDoc.text(title, 90, headerYOffset + 5);
//         currentDoc.setFontSize(12);
//         currentDoc.setTextColor(0, 0, 0);
//         currentDoc.text(business.companyName, 90, headerYOffset + 10);
//         currentDoc.setFontSize(8);
//         currentDoc.text(business.address1, 90, headerYOffset + 15);
//         currentDoc.text(`Tel.No: ${business.phoneNo}`, 90, headerYOffset + 20);
//         currentDoc.text(`E-Mail: ${business.emailId}`, 90, headerYOffset + 25);
//         currentDoc.text(`GSTIN: ${business.gstIn}`, 90, headerYOffset + 30);
//       };
      
//       // ... rest of PDF generation similar to purchase order but for services
      
//       doc.save(`${serviceOrder.vendorName} ${serviceOrder.randomId}.pdf`);
//     },
//     [serviceList, businesses]
//   );

//   const handleEditFreights = (updatedFreights: FreightData[]) => {
//     setFreights(updatedFreights);
//     console.log('Updated service freights:', updatedFreights);
//   };

//   const handleApplyDiscount = useCallback(async () => {
//     if (overallDiscountAmount <= 0) {
//       setSnackbarInvoiceMessage('Invalid discount amount.');
//       setSnackbarInvoiceOpen(true);
//       return;
//     }
    
//     setApplyingDiscount(true);
//     try {
//       const requestDescriptions = updatedDescriptions
//         .filter((desc) => (Number(desc.fee) || 0) > 0)
//         .map((desc) => ({
//           id: desc.id,
//           description: desc.description,
//           from_date: desc.from_date || new Date(),
//           to_date: desc.to_date || new Date(),
//           fee: desc.fee || 0,
//           taxType: desc.tax_type || 'cgst_sgst',
//           taxPer: desc.tax_per || 0,
//         }));
      
//       const request = {
//         descriptions: requestDescriptions,
//         applyOverallDiscount: true,
//         overallDiscountAmount,
//         overallDiscountType: discountType === 'before' ? 'before_tax' : 'after_tax',
//       };
      
//       const result: OverallDiscountServiceResponse = await dispatch(calculateServiceOverallDiscount(request)).unwrap();
      
//       if (result.success && result.descriptions) {
//         const newDescriptions = updatedDescriptions.map((desc) => {
//           const updatedDesc = result.descriptions?.find((r: any) => r.id === desc.id);
//           if (updatedDesc) {
//             return {
//               ...desc,
//               discountAmount: updatedDesc.discountAmount || 0,
//             };
//           }
//           return desc;
//         });
        
//         setUpdatedDescriptions(newDescriptions);
//         setSnackbarInvoiceMessage(
//           `Overall discount of ₹${overallDiscountAmount.toFixed(2)} applied.`
//         );
//         setSnackbarInvoiceOpen(true);
//       } else {
//         setSnackbarInvoiceMessage(result.error || 'Failed to apply discount.');
//         setSnackbarInvoiceOpen(true);
//       }
//     } catch (error: any) {
//       console.error('Apply Discount Error:', error);
//       setSnackbarInvoiceMessage(error.message || 'Failed to apply discount.');
//       setSnackbarInvoiceOpen(true);
//     } finally {
//       setApplyingDiscount(false);
//     }
//   }, [
//     overallDiscountAmount,
//     discountType,
//     updatedDescriptions,
//     dispatch,
//     setSnackbarInvoiceMessage,
//     setSnackbarInvoiceOpen,
//   ]);

//   const removeOverallDiscount = useCallback(() => {
//     setUpdatedDescriptions((prev) =>
//       prev.map((desc) => ({
//         ...desc,
//         discountAmount: originalDescriptionDiscounts[desc.id]?.discountAmount || 0,
//       }))
//     );
//     setOverallDiscountAmount(0);
//     setDiscountType('after');
//     setSnackbarInvoiceMessage("Overall discount removed.");
//     setSnackbarInvoiceOpen(true);
//   }, [originalDescriptionDiscounts]);

//   const handleVendorChange = useCallback((vendor: VendorSearch | null) => {
//     setSelectedVendor(vendor);
//     dispatch(fetchServiceOrders({
//       page: 1,
//       size: pageSize,
//       dateField: "approvedDate",
//       vendorName: vendor ? vendor.vendorName : "",
//       status: "Approved,PartiallyReceived",
//       randomId: selectedRandomId,
//     }));
//   }, [dispatch, pageSize, selectedRandomId]);

//   const handleRandomIdChange = useCallback((randomId: string) => {
//     setSelectedRandomId(randomId);
//     dispatch(fetchServiceOrders({
//       page: 1,
//       size: pageSize,
//       dateField: "approvedDate",
//       vendorName: selectedVendor ? selectedVendor.vendorName : "",
//       status: "Approved,PartiallyReceived",
//       randomId,
//     }));
//   }, [dispatch, pageSize, selectedVendor]);

//   const handleFilterClick = useCallback(() => {
//     dispatch(setPagination({ page: 1, size: pageSize }));
//     dispatch(fetchServiceOrders({
//       page: 1,
//       size: pageSize,
//       dateField: "approvedDate",
//       fromDate: moment(selectionRange.startDate).startOf("day").toDate(),
//       toDate: moment(selectionRange.endDate).endOf("day").toDate(),
//       vendorName: selectedVendor ? selectedVendor.vendorName : "",
//       status: "Approved,PartiallyReceived",
//       randomId: selectedRandomId,
//     }));
//   }, [dispatch, pageSize, selectionRange, selectedVendor, selectedRandomId]);

//   const handleFilterClose = useCallback(() => {
//     setSelectionRange({ startDate: new Date(), endDate: new Date(), key: "selection" });
//     setSelectedVendor(null);
//     setSelectedRandomId("");
//     dispatch(fetchServiceOrders({
//       page: 1,
//       size: pageSize,
//       dateField: "approvedDate",
//       status: "Approved,PartiallyReceived",
//     }));
//   }, [dispatch, pageSize]);

//   if (loading) {
//     return (
//       <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
//         <CircularProgress color="primary" />
//       </Box>
//     );
//   }

//   if (error) return <Typography>Error: {error}</Typography>;

//   return (
//     <Box sx={{ pl: 0, py: 1 }}>
//       <ServicePage />
//       <Box sx={{ display: "flex", flexDirection: "column", px: 2 }}>
//         <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, mb: 1 }}>
//           <Link href="/service/serviceOrder" passHref>
//             <Button variant="contained" color="primary">Pending</Button>
//           </Link>
//           <Link href="/service/serviceOrder/Approvedservice" passHref>
//             <Button variant="contained" sx={{ backgroundColor: "white", color: "black", "&:hover": { backgroundColor: "rgba(255, 255, 255, 0.8)" } }}>
//               Approved
//             </Button>
//           </Link>
//           <Link href="/service/serviceOrder/RejectedService" passHref>
//             <Button variant="contained" color="primary">Rejected</Button>
//           </Link>
//         </Box>
        
//         <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "nowrap", width: "100%", mb: 1 }}>
//           <Grid container spacing={1} alignItems="center" wrap="nowrap" sx={{ width: "auto", flexGrow: 1 }}>
//             <Grid item>
//               <DateRangeDialog selectionRange={selectionRange} setSelectionRange={setSelectionRange} onApply={handleFilterClick} />
//             </Grid>
//             <Grid item xs={6} sm={4} md={2}>
//               <VendorSearchAutocomplete value={selectedVendor} onChange={handleVendorChange} label="All Vendors" />
//             </Grid>
//             <Grid item xs={6} sm={4} md={1}>
//               <ServiceOrderRandomIdSearch value={selectedRandomId} onChange={handleRandomIdChange} label="Service Order ID" />
//             </Grid>
//             <Grid item>
//               <IconButton className="icon-button-outline" onClick={handleFilterClick} color="primary" size="small" sx={{ p: 0.3 }}>
//                 <FilterAltIcon fontSize="small" />
//               </IconButton>
//               <Typography variant="caption" align="center" sx={{ maxWidth: 60, wordBreak: "break-word", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.1, mt: 0.2 }}>
//                 Filter
//               </Typography>
//             </Grid>
//             <Grid item>
//               <IconButton className="icon-button-outline" onClick={handleFilterClose} color="primary" size="small" sx={{ p: 0.3 }}>
//                 <ClearIcon fontSize="small" />
//               </IconButton>
//               <Typography variant="caption" align="center" sx={{ maxWidth: 60, wordBreak: "break-word", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.1, mt: 0.2 }}>
//                 Clear
//               </Typography>
//             </Grid>
//             <Grid item sx={{ flexGrow: 1 }} />
//             <Grid item xs="auto">
//               <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
//                 <IconButton
//                   onClick={(e) => setAnchorEl(e.currentTarget)}
//                   color="primary"
//                   size="small"
//                   sx={{ p: 0.3 }}
//                   className="icon-button-outline"
//                   disabled={!filteredOrders || filteredOrders.length === 0}
//                 >
//                   {loading ? <CircularProgress size={16} /> : <DownloadIcon fontSize="small" />}
//                 </IconButton>
//                 <Typography variant="caption" align="center" sx={{ maxWidth: 60, wordBreak: "break-word", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.1, mt: 0.2 }}>
//                   Download
//                 </Typography>
//                 <Menu
//                   anchorEl={anchorEl}
//                   open={Boolean(anchorEl)}
//                   onClose={() => setAnchorEl(null)}
//                   anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
//                   transformOrigin={{ vertical: "top", horizontal: "right" }}
//                 >
//                   <MenuItem onClick={() => setDialogDownloadOpen(true)}>Vendorwise</MenuItem>
//                   <MenuItem onClick={() => setDialogSummaryOpen(true)}>Descriptionwise</MenuItem>
//                 </Menu>
//               </Box>
//             </Grid>
//           </Grid>
//         </Box>
        
//         <TableContainer component={Paper} sx={{ maxHeight: "calc(100vh - 230px)", overflowY: "auto", width: "100%", marginLeft: 2 }}>
//           <Table stickyHeader>
//             <TableHead>
//               <TableRow>
//                 <TableCell className='table-number-right'>S.No</TableCell>
//                 <TableCell>Service Order ID</TableCell>
//                 <TableCell>Vendor Name</TableCell>
//                 <TableCell>Work Order Date</TableCell>
//                 <TableCell>Approved Date</TableCell>
//                 <TableCell className='table-number-right'>Total Amount</TableCell>
//                 <TableCell>Status</TableCell>
//                 <TableCell>View</TableCell>
//               </TableRow>
//             </TableHead>
//             <TableBody>
//               {filteredOrders.length === 0 ? (
//                 <TableRow>
//                   <TableCell colSpan={7} align="center">No Approved Service Orders</TableCell>
//                 </TableRow>
//               ) : (
//                 filteredOrders.map((order, index) => (
//                   <TableRow key={order.serviceId}>
//                     <TableCell className='table-number-right'>{index + 1}</TableCell>
//                     <TableCell>{order.randomId}</TableCell>
//                     <TableCell>{order.vendorName}</TableCell>
//                     <TableCell>{order.workOrderDate ? format(new Date(order.workOrderDate), "dd-MM-yyyy") : ""}</TableCell>
//                     <TableCell>{order.approvedDate ? format(new Date(order.approvedDate), "dd-MM-yyyy") : ""}</TableCell>
//                     <TableCell className='table-number-right'>{(order.totalAmount || 0).toFixed(2)}</TableCell>
//                     <TableCell>{order.status}</TableCell>
//                     <TableCell>
//                       <Tooltip title="View Details">
//                         <span>
//                           <IconButton onClick={() => handleViewDetailsClick(order.serviceId)} color="primary" sx={{ mr: 1 }}>
//                             <VisibilityIcon />
//                           </IconButton>
//                         </span>
//                       </Tooltip>
//                       <Tooltip title="Download">
//                         <span>
//                           <IconButton color="primary" onClick={() => handleDownload(order.serviceId)}>
//                             <PictureAsPdfIcon />
//                           </IconButton>
//                         </span>
//                       </Tooltip>
//                     </TableCell>
//                   </TableRow>
//                 ))
//               )}
//             </TableBody>
//           </Table>
//         </TableContainer>
        
//         <Box sx={{ display: "flex", justifyContent: "end", alignItems: "center", mt: 2 }}>
//           <IconButton onClick={() => dispatch(setPagination({ page: currentPage - 1, size: pageSize }))} disabled={currentPage === 1}>
//             <ChevronLeft />
//           </IconButton>
//           <Typography variant="body1" sx={{ mx: 2 }}>Page {currentPage}</Typography>
//           <IconButton onClick={() => dispatch(setPagination({ page: currentPage + 1, size: pageSize }))} disabled={currentPage * pageSize >= totalItems}>
//             <ChevronRight />
//           </IconButton>
//         </Box>
        
//         <ServiceOrderDetailsDialog
//           open={openDialog}
//           onClose={handleCloseDialogs}
//           selectedOrder={selectedOrder}
//           updatedDescriptions={updatedDescriptions}
//           setUpdatedDescriptions={setUpdatedDescriptions}
//           invoiceNumber={invoiceNumber}
//           setInvoiceNumber={setInvoiceNumber}
//           invoiceDate={invoiceDate}
//           setInvoiceDate={setInvoiceDate}
//           apDate={apDate}
//           setApDate={setApDate}
//           isInvoiceDuplicate={isInvoiceDuplicate}
//           isTouched={isTouched}
//           setIsTouched={setIsTouched}
//           taxDetails={taxDetails}
//           totalOrderAmount={totalOrderAmount}
//           totalDiscountAmount={totalDiscountAmount}
//           handleSaveChanges={handleSaveChanges}
//           handleOpenRevertDialog={() => setOpenRevertDialog(true)}
//           isProcessing={isProcessing}
//           touched={touched}
//           setTouched={setTouched}
//           errors={errors}
//           setErrors={setErrors}
//           handleFeeChange={handleFeeChange}
//           handleDiscountChange={handleDiscountChange}
//           handleFromDateChange={handleFromDateChange}
//           handleToDateChange={handleToDateChange}
//           calculatedDescriptions={calculatedDescriptions}
//           roundOffAmount={roundOffAmount}
//           setRoundOffAmount={setRoundOffAmount}
//           overallDiscountAmount={overallDiscountAmount}
//           setOverallDiscountAmount={setOverallDiscountAmount}
//           discountType={discountType}
//           setDiscountType={setDiscountType}
//           originalDescriptionDiscounts={originalDescriptionDiscounts}
//           setOriginalDescriptionDiscounts={setOriginalDescriptionDiscounts}
//           handleApplyDiscount={handleApplyDiscount}
//           removeOverallDiscount={removeOverallDiscount}
//           applyingDiscount={applyingDiscount}
//           freights={freights}
//           onEditFreights={handleEditFreights}
//         />
        
//         <Dialog open={openRevertDialog} onClose={handleCloseDialogs}>
//           <DialogTitle>Confirm Reversion</DialogTitle>
//           <DialogContent>
//             <DialogContentText>Are you sure you want to revert this Service Order?</DialogContentText>
//           </DialogContent>
//           <DialogActions>
//             <Button onClick={handleCloseDialogs} color="primary">Cancel</Button>
//             <Button
//               onClick={() => {
//                 if (selectedOrder) {
//                   dispatch(updateServiceOrderStatusToPending(selectedOrder.serviceId))
//                     .then(() => {
//                       dispatch(
//                         fetchServiceOrders({
//                           page: currentPage,
//                           size: pageSize,
//                           dateField: "approvedDate",
//                           status: "Approved,PartiallyReceived",
//                         })
//                       );
//                       setSnackbarInvoiceMessage("Service Order reverted successfully!");
//                       setSnackbarInvoiceOpen(true);
//                       handleCloseDialogs();
//                     })
//                     .catch((error) => {
//                       console.error("Revert Error:", error);
//                       setSnackbarInvoiceMessage("Failed to revert Service Order.");
//                       setSnackbarInvoiceOpen(true);
//                     });
//                 }
//               }}
//               color="primary"
//               disabled={isProcessing}
//             >
//               Confirm
//             </Button>
//           </DialogActions>
//         </Dialog>
        
//         <Snackbar
//           open={snackbarOpen}
//           autoHideDuration={6000}
//           onClose={() => dispatch(clearSnackbarMessage())}
//           message={snackbarMessage}
//         />
//         <Snackbar
//           open={snackbarInvoiceOpen}
//           autoHideDuration={6000}
//           onClose={() => setSnackbarInvoiceOpen(false)}
//           message={snackbarInvoiceMessage}
//         />
//       </Box>
//     </Box>
//   );
// };

// export default ApprovedService;