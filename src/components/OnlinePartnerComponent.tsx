// "use client";
// import React, { useState } from 'react';
// import { useDispatch } from 'react-redux';
// import {
//   Box, FormControl, InputLabel, Select, MenuItem, Checkbox, ListItemText, TextField,
//   FormLabel, RadioGroup, Radio, FormControlLabel, Button, Table, TableBody, TableCell,
//   TableContainer, TableHead, TableRow, Paper, Switch, Typography
// } from '@mui/material';
// import { SelectChangeEvent } from '@mui/material/Select';
// import { addPartnerOffer } from '../features/onlinePartnersSlice';
// import MasterAdminMenu from '@/app/master-admin/page';

// const itemsOptions = ['Item1', 'Item2', 'Item3']; // Replace with actual items

// interface Offer {
//   name: string;
//   currentPrice: number;
//   percentage: string;
//   partnerPrice: string;
//   active: boolean;
// }

// interface OnlinePartnerProps {
//   partner: string;
// }

// const OnlinePartner: React.FC<OnlinePartnerProps> = ({ partner }) => {
//   const dispatch = useDispatch();
//   const [selectionType, setSelectionType] = useState<string>('items');
//   const [selectedItems, setSelectedItems] = useState<string[]>([]);
//   const [percentage, setPercentage] = useState<string>('');
//   const [offers, setOffers] = useState<Offer[]>([]);

//   const handleSelectionChange = (event: SelectChangeEvent) => {
//     setSelectionType(event.target.value as string);
//   };

//   const handleMultiSelectChange = (event: SelectChangeEvent<string[]>) => {
//     const { value } = event.target;
//     setSelectedItems(typeof value === 'string' ? value.split(',') : value);
//   };

//   const handleApplyPercentage = () => {
//     const updatedOffers = selectedItems.map(item => ({
//       name: item,
//       currentPrice: Math.floor(Math.random() * 100), // Replace with actual price fetching logic
//       percentage: percentage,
//       partnerPrice: '', // Will be calculated below
//       active: true
//     }));

//     updatedOffers.forEach(offer => {
//       offer.partnerPrice = (offer.currentPrice * (1 - parseFloat(offer.percentage) / 100)).toFixed(2);
//     });

//     setOffers(updatedOffers);
//   };

//   const handleFieldChange = (index: number, field: string, value: string) => {
//     setOffers((prevOffers) => {
//       const newOffers = [...prevOffers];
//       newOffers[index][field] = value;
//       if (field === 'percentage') {
//         newOffers[index].partnerPrice = (newOffers[index].currentPrice * (1 - parseFloat(value) / 100)).toFixed(2);
//       }
//       return newOffers;
//     });
//   };

//   const handleToggleActive = (index: number) => {
//     setOffers((prevOffers) => {
//       const newOffers = [...prevOffers];
//       newOffers[index].active = !newOffers[index].active;
//       return newOffers;
//     });
//   };

//   const handleSubmit = () => {
//     dispatch(addPartnerOffer({ partner: partner.toLowerCase(), offer: offers }));
//   };

//   return (
//     <Box sx={{ml:2}}>
//       <Typography variant="h6">{partner} Menu</Typography>
//       <FormControl component="fieldset" margin="normal">
//         <FormLabel component="legend">Selection Type</FormLabel>
//         <RadioGroup
//           row
//           name="selectionType"
//           value={selectionType}
//           onChange={handleSelectionChange}
//         >
//           <FormControlLabel value="items" control={<Radio />} label="Items" />
//         </RadioGroup>
//       </FormControl>

//       <FormControl fullWidth margin="normal">
//         <InputLabel>Select Items</InputLabel>
//         <Select
//           multiple
//           value={selectedItems}
//           onChange={handleMultiSelectChange}
//           renderValue={(selected) => (selected as string[]).join(', ')}
//         >
//           {itemsOptions.map((option) => (
//             <MenuItem key={option} value={option}>
//               <Checkbox checked={selectedItems.indexOf(option) > -1} />
//               <ListItemText primary={option} />
//             </MenuItem>
//           ))}
//         </Select>
//       </FormControl>

//       <TextField
//         margin="normal"
//         label={`${partner} %`}
//         value={percentage}
//         onChange={(e) => setPercentage(e.target.value)}
//         fullWidth
//       />

//       <Button variant="contained" color="primary" sx={{ mt: 2 }} onClick={handleApplyPercentage}>
//         Apply Percentage
//       </Button>

//       <TableContainer component={Paper} sx={{ mt: 2 }}>
//         <Table>
//           <TableHead>
//             <TableRow>
//               <TableCell>Item Name</TableCell>
//               <TableCell>Current Price</TableCell>
//               <TableCell>{`${partner} %`}</TableCell>
//               <TableCell>{`${partner} Price`}</TableCell>
//               <TableCell>Active</TableCell>
//             </TableRow>
//           </TableHead>
//           <TableBody>
//             {offers.map((offer, index) => (
//               <TableRow key={index}>
//                 <TableCell>{offer.name}</TableCell>
//                 <TableCell>{offer.currentPrice}</TableCell>
//                 <TableCell>
//                   <TextField
//                     value={offer.percentage}
//                     onChange={(e) => handleFieldChange(index, 'percentage', e.target.value)}
//                     fullWidth
//                   />
//                 </TableCell>
//                 <TableCell>{offer.partnerPrice}</TableCell>
//                 <TableCell>
//                   <Switch checked={offer.active} onChange={() => handleToggleActive(index)} />
//                 </TableCell>
//               </TableRow>
//             ))}
//           </TableBody>
//         </Table>
//       </TableContainer>

//       <Button variant="contained" color="primary" sx={{ mt: 2 }} onClick={handleSubmit}>
//         Submit
//       </Button>
//     </Box>
//   );
// }

// export default OnlinePartner;
