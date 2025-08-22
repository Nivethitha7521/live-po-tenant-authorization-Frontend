// components/GrnDialog.tsx
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
import { GrnResponse, ItemDetailResponse } from '@/Models/grnModel';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
interface GrnDialogProps {
  open: boolean;
  onClose: () => void;
  grn: GrnResponse | null;
}

const GrnDialog: React.FC<GrnDialogProps> = ({ open, onClose, grn }) => {
    const [isFullScreen, setIsFullScreen] = useState(false);
  if (!grn) return null;
const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };
  // Helper function to calculate quantity safely
  const calculateQuantity = (item: ItemDetailResponse): number => {
    const received = Number(item.receivedQuantity) || 0;
    const returned = Number(item.returnedQuantity) || 0;
    const quantity = Number(item.quantity) || 0;
    // Prefer item.quantity if available and valid, else calculate received - returned
    return quantity > 0 ? quantity : received - returned;
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
          }}>GRN Details <IconButton onClick={toggleFullScreen} color="primary" edge="end">
              {isFullScreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton></DialogTitle>
      <DialogContent sx={{
            padding: isFullScreen ? '0 24px' : '20px', // Adjust content padding
            height: isFullScreen ? 'calc(100vh - 120px)' : 'auto', // Account for header/footer height
            overflow: 'auto'
          }}>
        <Box>
          <Typography variant="h6" gutterBottom>
            <strong>GRN ID:</strong> {grn.randomId || 'N/A'}
          </Typography>
          <Typography variant="h6" gutterBottom>
            <strong>Vendor Name:</strong> {grn.vendorName || 'N/A'}
          </Typography>
          <Typography variant="h6" gutterBottom>
            <strong>GRN Date:</strong>{' '}
            {grn.grnDate ? format(new Date(grn.grnDate), 'dd-MM-yyyy') : 'N/A'}
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
                <TableCell><strong>Tax</strong></TableCell>
                <TableCell><strong>Discount</strong></TableCell>
                <TableCell><strong>Final Price</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {grn.itemDetails.length > 0 ? (
                grn.itemDetails.map((item) => (
                  <TableRow key={item.itemId}>
                    <TableCell>{item.itemName || 'N/A'}</TableCell>
                    <TableCell>{item.receivedQuantity-item.returnedQuantity}</TableCell>
                    <TableCell>{Number(item.unitPrice).toFixed(2) || '0.00'}</TableCell>
                    <TableCell>{Number(item.totalPrice).toFixed(2) || '0.00'}</TableCell>
                    <TableCell>{item.purchasetaxName || 'N/A'}</TableCell>
                    <TableCell>{Number(item.discountAmount).toFixed(2) || '0.00'}</TableCell>
                    <TableCell>{Number(item.finalPrice).toFixed(2) || '0.00'}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9}>No items available</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary" variant='contained'>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default GrnDialog;