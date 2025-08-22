// components/yen-purchase/ApInvoiceDialog.tsx
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
const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };
  return (
    <Dialog open={open} onClose={onClose}  maxWidth={false}
          fullWidth={true}
          fullScreen={isFullScreen}
          container={document.body} // Always render in document.body
          disablePortal={false} // Use portal to break out of parent containers
          sx={isFullScreen ? {
            '& .MuiDialog-container': {
              position: 'fixed !important',
              top: '0 !important',
              left: '0 !important',
              right: '0 !important',
              bottom: '0 !important',
              width: '100vw !important',
              height: '100vh !important',
              maxWidth: 'none !important',
              maxHeight: 'none !important',
              margin: '0 !important',
              zIndex: 9999,
            },
            '& .MuiDialog-paper': {
              width: '100vw !important',
              height: '100vh !important',
              maxWidth: 'none !important',
              maxHeight: 'none !important',
              margin: '0 !important',
              borderRadius: '0 !important',
            }
          } : {}}
          PaperProps={{
            style: {
              height: isFullScreen ? '100vh' : 'auto',
              width: isFullScreen ? '100vw' : '90vw',
              maxWidth: isFullScreen ? 'none' : 'none',
              margin: isFullScreen ? 0 : 'auto',
              borderRadius: isFullScreen ? 0 : undefined,
            },
          }}>
      <DialogTitle sx={{
            fontWeight: 'bold',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: isFullScreen ? '16px 24px' : '16px' // Adjust padding for fullscreen
          }}>AP Invoice Details <IconButton onClick={toggleFullScreen} color="primary" edge="end">
              {isFullScreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton></DialogTitle>
      <DialogContent sx={{
            padding: isFullScreen ? '0 24px' : '20px', // Adjust content padding
            height: isFullScreen ? 'calc(100vh - 120px)' : 'auto', // Account for header/footer height
            overflow: 'auto'
          }}>
        <Box>
          <Typography variant="h6" gutterBottom>
            <strong>Invoice ID:</strong> {apInvoice.randomId || 'N/A'}
          </Typography>
          <Typography variant="h6" gutterBottom>
            <strong>Vendor Name:</strong> {apInvoice.vendorName || 'N/A'}
          </Typography>
          <Typography variant="h6" gutterBottom>
            <strong>Invoice Date:</strong>{' '}
            {apInvoice.apInvoiceDate ? format(new Date(apInvoice.apInvoiceDate), 'dd-MM-yyyy') : 'N/A'}
          </Typography>
          <Typography variant="h6" gutterBottom>
            <strong>GRN ID:</strong> {apInvoice.grnRandomId || 'N/A'}
          </Typography>
          <Typography variant="h6" gutterBottom>
            <strong>Invoice Amount:</strong> {apInvoice.invoiceAmount?.toFixed(2) || '0.00'}
          </Typography>
        </Box>
        <TableContainer component={Paper} sx={{ mt: 2 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Item Name</strong></TableCell>
                <TableCell><strong>Quantity</strong></TableCell>
                <TableCell><strong>Unit Price</strong></TableCell>
                <TableCell><strong>Total Price</strong></TableCell>
                <TableCell><strong>Tax Rate (%)</strong></TableCell>
                <TableCell><strong>Tax Amount</strong></TableCell>
                <TableCell><strong>Discount</strong></TableCell>
                <TableCell><strong>Final Price</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {apInvoice.itemDetails && apInvoice.itemDetails.length > 0 ? (
                apInvoice.itemDetails.map((item) => (
                  <TableRow key={item.itemId}>
                    <TableCell>{item.itemName || 'N/A'}</TableCell>
                    <TableCell>{item.stockQuantity}</TableCell>
                    <TableCell>{item.unitPrice?.toFixed(2) || '0.00'}</TableCell>
                    <TableCell>{item.totalPrice?.toFixed(2) || '0.00'}</TableCell>
                    <TableCell>{item.purchasetaxName?.toFixed(2) || '0.00'}</TableCell>
                    <TableCell>{item.taxAmount?.toFixed(2) || '0.00'}</TableCell>
                    <TableCell>{item.discountAmount?.toFixed(2) || '0.00'}</TableCell>
                    <TableCell>{item.finalPrice?.toFixed(2) || '0.00'}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8}>No items available</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary" variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ApInvoiceDialog;