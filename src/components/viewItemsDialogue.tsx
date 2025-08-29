// GrnItemDetails.tsx
import React from 'react';
import { Table, TableRow, TableCell } from '@mui/material';

interface GrnItemDetailsProps {
  item: {
    itemName: string;
    uom: string;
    nos: number;
    eachQuantity: number;
    discount: number;
    purchasetaxName: string;
    quantity: number;
    receivedQuantity: number;
    damagedQuantity: number;
    unitPrice: number;
    totalPrice: number;
  };
  index: number;
}

const GrnItemDetails: React.FC<GrnItemDetailsProps> = ({ item, index }) => {
  return (
    <TableRow key={item.itemName}>
      <TableCell>{index + 1}</TableCell>
      <TableCell>{item.itemName}</TableCell>
      <TableCell>{item.uom}</TableCell>
      <TableCell>{item.nos}</TableCell>
      <TableCell>{item.eachQuantity}</TableCell>
      <TableCell>{item.discount}</TableCell>
      <TableCell>{item.purchasetaxName}</TableCell>
      <TableCell>{item.quantity}</TableCell>
      <TableCell>{item.receivedQuantity}</TableCell>
      <TableCell>{item.damagedQuantity}</TableCell>
      <TableCell>{item.unitPrice}</TableCell>
      <TableCell>{item.totalPrice}</TableCell>
    </TableRow>
  );
};

export default GrnItemDetails;
