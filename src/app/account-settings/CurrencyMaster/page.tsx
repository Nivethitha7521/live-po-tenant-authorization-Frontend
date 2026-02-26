// "use client";
// import React, { useEffect, useState } from 'react';
// import { useDispatch, useSelector } from 'react-redux';
// import {
//   TextField,
//   MenuItem,
//   Button,
//   Box,
//   Typography,
//   IconButton,
//   Dialog,
//   DialogActions,
//   DialogContent,
//   DialogTitle,
//   Table,
//   TableHead,
//   TableRow,
//   TableCell,
//   TableBody
// } from '@mui/material';
// import AddIcon from '@mui/icons-material/Add';
// import { RootState } from '@/redux/store';
// import {
//   getcountryandcurrencys,
//   postCurrency,
//   setSelectedCountry,
// } from '@/features/masterAdminSlice/currencySlice';
// import AccountSettingsPage from '../page';
'use client';
import { RootState } from "@/redux/store";
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

// const CurrencyPage = () => {
//   const dispatch = useDispatch();
//   const {
//     countries,
//     selectedCountry,
//     selectedCurrency,
//     selectedCurrencySymbol,
//     status,
//   } = useSelector((state: RootState) => state.currency);

//   const [openDialog, setOpenDialog] = useState(false);

  

//   useEffect(() => {
//     if (status === 'idle') {
//       dispatch(getcountryandcurrencys());
//     }
//   }, [dispatch, status]);

//   const handleCountryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
//     dispatch(setSelectedCountry(event.target.value));
//   };

//   const handleSubmit = () => {
//     const currencyData = {
//       currency: selectedCurrency,
//       currencySymbol: selectedCurrencySymbol,
//       country: selectedCountry,
//     };

//     console.log('Submitting currency data:', currencyData); // Debugging: Log data before submission
//     dispatch(postCurrency(currencyData));
//     setOpenDialog(false); // Close the dialog after submit
//   };

//   const handleAddClick = () => {
//     setOpenDialog(true);
//   };

//   const handleClose = () => {
//     setOpenDialog(false);
//   };

//   return (
//     <Box>
//       <AccountSettingsPage>
//         <Box sx={{ml:2}}>
//         <Typography variant="h4">Currency Management</Typography>

// {/* Add Icon */}
// <IconButton
//   color="primary"
//   aria-label="add currency"
//   onClick={handleAddClick}
//   sx={{ marginTop: 2 }}
// >
//   <AddIcon />
// </IconButton>

// {/* Table for displaying countries and currencies */}
// <Table>
//   <TableHead>
//     <TableRow>
//       <TableCell>Country</TableCell>
//       <TableCell>Currency</TableCell>
//       <TableCell>Currency Symbol</TableCell>
//     </TableRow>
//   </TableHead>
//   <TableBody>
//     {countries.map((country) => (
//       <TableRow key={country.name}>
//         <TableCell>{country.name}</TableCell>
//         <TableCell>{country.currency}</TableCell>
//         <TableCell>{country.currencySymbol}</TableCell>
//       </TableRow>
//     ))}
//   </TableBody>
// </Table>

// {/* Dialog for adding new currency */}
// <Dialog open={openDialog} onClose={handleClose}>
//   <DialogTitle>Add New Currency</DialogTitle>
//   <DialogContent>
//     <TextField
//       select
//       label="Select Country"
//       value={selectedCountry || ''}
//       onChange={handleCountryChange}
//       fullWidth
//       margin="normal"
//     >
//       {countries.map((country) => (
//         <MenuItem key={country.name} value={country.name}>
//           {country.name}
//         </MenuItem>
//       ))}
//     </TextField>

//     <TextField
//       label="Currency"
//       value={selectedCurrency || ''}
//       fullWidth
//       margin="normal"
//       InputProps={{
//         readOnly: true,
//       }}
//     />

//     <TextField
//       label="Currency Symbol"
//       value={selectedCurrencySymbol || ''}
//       fullWidth
//       margin="normal"
//       InputProps={{
//         readOnly: true,
//       }}
//     />
//   </DialogContent>
//   <DialogActions>
//     <Button onClick={handleClose} color="primary">
//       Cancel
//     </Button>
//     <Button onClick={handleSubmit} color="primary">
//       Submit
//     </Button>
//   </DialogActions>
// </Dialog>

//         </Box>
//        </AccountSettingsPage>
//     </Box>
//   );
// };

// export default CurrencyPage;
const CurrencyPage = () => {
    const dispatch = useDispatch();
    // const {
    //   countries,
    //   selectedCountry,
    //   selectedCurrency,
    //   selectedCurrencySymbol,
    //   status,
    // } = useSelector((state: RootState) => state.currency);
  
    const [openDialog, setOpenDialog] = useState(false);
  
  }
export default CurrencyPage;