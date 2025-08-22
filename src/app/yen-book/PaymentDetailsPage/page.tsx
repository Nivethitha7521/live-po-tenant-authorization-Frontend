// pages/PaymentDetailsPage.tsx

"use client";
import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Typography, Grid, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, Paper, TextField, Button
} from '@mui/material';
import { fetchPayments, setFilter, selectPayments, selectFilter } from '../../../features/paymentSlice';
import { RootState } from '../../../redux/store';
import { useRouter } from 'next/router'; // Import useNavigate for navigation
import YenBookPage from '../page';

const PaymentDetailsPage = () => {
  // const dispatch = useDispatch();
  // const payments = useSelector((state: RootState) => selectPayments(state));
  // const filter = useSelector((state: RootState) => selectFilter(state));
  // const router = useRouter();

  // useEffect(() => {
  //   // Mock fetch function, replace with actual fetch logic
  //   const mockFetchPayments = () => {
  //     const payments = [
  //       { id: '1', vendorName: 'Vendor A', paymentType: 'Advance', amountPaid: 100, remainingBalance: 200, paymentDate: '2024-01-01', paymentStatus: 'Partial' },
  //       { id: '2', vendorName: 'Vendor B', paymentType: 'Partial', amountPaid: 150, remainingBalance: 50, paymentDate: '2024-02-01', paymentStatus: 'Partial' },
  //       // Add more mock data as needed
  //     ];
  //     dispatch(fetchPayments(payments));
  //   };
  //   mockFetchPayments();
  // }, [dispatch]);

  // const handleFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  //   dispatch(setFilter(event.target.value));
  // };

  // const handlePay = (payment:any) => {
  //   router.push('/outgoing-payment', { state: { payment } });
  // };

  // return (
  //   <Box sx={{ p: 3}}  >
  //   <YenBookPage />
  //     <Typography variant="h4" gutterBottom>
  //       Payment Details
  //     </Typography>

  //     <TextField
  //       label="Filter by Vendor Name"
  //       value={filter}
  //       onChange={handleFilterChange}
  //       fullWidth
  //       margin="normal"
  //     />

  //     <TableContainer component={Paper} sx={{ mt: 2 }}>
  //       <Table>
  //         <TableHead>
  //           <TableRow>
  //             <TableCell>Vendor Name</TableCell>
  //             <TableCell>Payment Type</TableCell>
  //             <TableCell>Amount Paid</TableCell>
  //             <TableCell>Remaining Balance</TableCell>
  //             <TableCell>Payment Date</TableCell>
  //             <TableCell>Payment Status</TableCell>
  //             <TableCell>Action</TableCell> {/* New column for actions */}
  //           </TableRow>
  //         </TableHead>
  //         <TableBody>
  //           {payments.map((payment) => (
  //             <TableRow key={payment.id}>
  //               <TableCell>{payment.vendorName}</TableCell>
  //               <TableCell>{payment.paymentType}</TableCell>
  //               <TableCell>{payment.amountPaid}</TableCell>
  //               <TableCell>{payment.remainingBalance}</TableCell>
  //               <TableCell>{payment.paymentDate}</TableCell>
  //               <TableCell>{payment.paymentStatus}</TableCell>
  //               <TableCell>
  //                 <Button variant="contained" color="primary" onClick={() => handlePay(payment)}>
  //                   Pay
  //                 </Button>
  //               </TableCell>
  //             </TableRow>
  //           ))}
  //         </TableBody>
  //       </Table>
  //     </TableContainer>

  //     <Grid container spacing={3} sx={{ mt: 4 }}>
  //       <Grid item xs={12} sm={6}>
  //         <Paper sx={{ p: 2 }}>
  //           <Typography variant="h6" gutterBottom>Total Payable Amount</Typography>
  //           <Typography variant="h4">$ {payments.reduce((total, payment) => total + payment.remainingBalance, 0)}</Typography>
  //         </Paper>
  //       </Grid>
  //       <Grid item xs={12} sm={6}>
  //         <Paper sx={{ p: 2 }}>
  //           <Typography variant="h6" gutterBottom>Total Paid Amount</Typography>
  //           <Typography variant="h4">$ {payments.reduce((total, payment) => total + payment.amountPaid, 0)}</Typography>
  //         </Paper>
  //       </Grid>
  //     </Grid>
  //   </Box>
  // );
};

export default PaymentDetailsPage;
