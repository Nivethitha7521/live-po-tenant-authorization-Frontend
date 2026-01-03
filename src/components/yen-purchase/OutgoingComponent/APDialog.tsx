// components/yen-purchase/OutgoingComponent/APDialog.tsx
'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  Box,
  IconButton,
} from '@mui/material';
import { format } from 'date-fns';
import { FrontendApInvoiceResponse } from '@/Models/apModel';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';

interface ApInvoiceDialogProps {
  open: boolean;
  onClose: () => void;
  apInvoice: FrontendApInvoiceResponse | null;
}

const ApInvoiceDialog: React.FC<ApInvoiceDialogProps> = ({ open, onClose, apInvoice }) => {
  const [isFullScreen, setIsFullScreen] = useState(false);

  if (!apInvoice) return null;

  const toggleFullScreen = () => setIsFullScreen(!isFullScreen);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      fullScreen={isFullScreen}
      sx={
        isFullScreen
          ? {
            '& .MuiDialog-container': {
              position: 'fixed !important',
              top: 0,
              left: 0,
              width: '100vw !important',
              height: '100vh !important',
              maxWidth: 'none !important',
              maxHeight: 'none !important',
              margin: 0,
              zIndex: 9999,
            },
            '& .MuiDialog-paper': {
              width: '100vw !important',
              height: '100vh !important',
              maxWidth: 'none !important',
              maxHeight: 'none !important',
              margin: 0,
              borderRadius: 0,
            },
          }
          : {}
      }
    >
      <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        AP Invoice Details
        <IconButton onClick={toggleFullScreen} color="primary">
          {isFullScreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ padding: isFullScreen ? '0 24px' : '20px', overflow: 'auto' }}>
        <Box mb={3}>
          <Typography variant="h6"><strong>Type:</strong> {apInvoice.invoiceType === 'service' ? 'Service' : 'Goods'}</Typography>
          <Typography variant="h6"><strong>Invoice ID:</strong> {apInvoice.randomId || 'N/A'}</Typography>
          <Typography variant="h6"><strong>Vendor Name:</strong> {apInvoice.vendorName || 'N/A'}</Typography>
          <Typography variant="h6">
            <strong>Invoice Date:</strong>{' '}
            {apInvoice.apInvoiceDate ? format(new Date(apInvoice.apInvoiceDate), 'dd-MM-yyyy') : 'N/A'}
          </Typography>
          <Typography variant="h6"><strong>GRN ID:</strong> {apInvoice.grnRandomId || 'N/A'}</Typography>
          <Typography variant="h6"><strong>Invoice Amount:</strong> ₹{apInvoice.invoiceAmount?.toFixed(2) || '0.00'}</Typography>
        </Box>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                {apInvoice.invoiceType === 'service' ? (
                  <>
                    <TableCell><strong>S.No</strong></TableCell>
                    <TableCell><strong>Description</strong></TableCell>
                    <TableCell><strong>SAC Code</strong></TableCell>
                    <TableCell><strong>From Date</strong></TableCell>
                    <TableCell><strong>To Date</strong></TableCell>
                    <TableCell><strong>Qty</strong></TableCell>
                    <TableCell><strong>Amount</strong></TableCell>
                    <TableCell><strong>Tax (%)</strong></TableCell>
                    <TableCell><strong>Tax Amt</strong></TableCell>
                    <TableCell><strong>Total</strong></TableCell>
                  </>
                ) : (
                  <>
                    <TableCell><strong>Item Name</strong></TableCell>
                    <TableCell><strong>Quantity</strong></TableCell>
                    <TableCell><strong>Unit Price</strong></TableCell>
                    <TableCell><strong>Total Price</strong></TableCell>
                    <TableCell><strong>Tax (%)</strong></TableCell>
                    <TableCell><strong>Tax Amt</strong></TableCell>
                    <TableCell><strong>Discount</strong></TableCell>
                    <TableCell><strong>Final Price</strong></TableCell>
                  </>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {apInvoice.invoiceType === 'service' ? (
                // Force service layout even if descriptions array is empty
                apInvoice.itemDetails && apInvoice.itemDetails.length > 0 ? (
                  apInvoice.itemDetails.map((item, i) => (
                    <TableRow key={item.itemId || i}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>{item.itemName || 'N/A'}</TableCell>
                      <TableCell>{apInvoice.sacCode?.[i] ?? 'N/A'}</TableCell>                   
                         <TableCell>
                        {apInvoice.from_dates?.[i] && apInvoice.from_dates[i] !== null
                          ? format(new Date(apInvoice.from_dates[i]), 'dd-MM-yyyy')
                          : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {apInvoice.to_dates?.[i] && apInvoice.to_dates[i] !== null
                          ? format(new Date(apInvoice.to_dates[i]), 'dd-MM-yyyy')
                          : 'N/A'}
                      </TableCell>
                      <TableCell>{item.stockQuantity ?? 1}</TableCell>
                      <TableCell>{(item.unitPrice ?? 0).toFixed(2)}</TableCell>
                      <TableCell>{(item.purchasetaxName ?? 0).toFixed(2)}%</TableCell>
                      <TableCell>{(item.taxAmount ?? 0).toFixed(2)}</TableCell>
                      <TableCell>{(item.finalPrice ?? 0).toFixed(2)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} align="center">No service details available</TableCell>
                  </TableRow>
                )
              ) : (
                // Goods invoice - unchanged
                apInvoice.itemDetails && apInvoice.itemDetails.length > 0 ? (
                  apInvoice.itemDetails.map((item) => (
                    <TableRow key={item.itemId}>
                      <TableCell>{item.itemName || 'N/A'}</TableCell>
                      <TableCell>{item.stockQuantity ?? 0}</TableCell>
                      <TableCell>{(item.unitPrice ?? 0).toFixed(2)}</TableCell>
                      <TableCell>{(item.totalPrice ?? 0).toFixed(2)}</TableCell>
                      <TableCell>{(item.purchasetaxName ?? 0).toFixed(2)}%</TableCell>
                      <TableCell>{(item.taxAmount ?? 0).toFixed(2)}</TableCell>
                      <TableCell>{(item.discountAmount ?? 0).toFixed(2)}</TableCell>
                      <TableCell>{(item.finalPrice ?? 0).toFixed(2)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} align="center">No items available</TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained" color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ApInvoiceDialog;