// components/yen-purchase/OutgoingComponent/PODialog.tsx
import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Table, TableHead, TableRow, TableCell, TableBody, IconButton } from '@mui/material';
import { PoResponse } from '@/Models/purchaseModel';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
interface PODialogProps {
  open: boolean;
  onClose: () => void;
  po: PoResponse | null;
}

const PODialog: React.FC<PODialogProps> = ({ open, onClose, po }) => {
    const [isFullScreen, setIsFullScreen] = useState(false);
  console.log('PODialog rendered, open:', open); // Debug: Log open state

  const handleClose = () => {
    console.log('PODialog handleClose called'); // Debug: Log close action
    onClose();
  };
const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose} // Handle backdrop clicks and escape key
       maxWidth={false}
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
          }}
    >
      <DialogTitle sx={{
            fontWeight: 'bold',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: isFullScreen ? '16px 24px' : '16px' // Adjust padding for fullscreen
          }}>Purchase Order Details <IconButton onClick={toggleFullScreen} color="primary" edge="end">
              {isFullScreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton></DialogTitle>
      <DialogContent sx={{
            padding: isFullScreen ? '0 24px' : '20px', // Adjust content padding
            height: isFullScreen ? 'calc(100vh - 120px)' : 'auto', // Account for header/footer height
            overflow: 'auto'
          }}>
        {po ? (
          <>
            <Typography><strong>Random ID:</strong> {po.randomId}</Typography>
            <Typography><strong>Vendor Name:</strong> {po.vendorName || 'N/A'}</Typography>
            <Typography>
              <strong>Order Date:</strong>{' '}
              {po.orderDate
                ? new Date(po.orderDate).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })
                : 'N/A'}
            </Typography>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Item Name</TableCell>
                  <TableCell>PO Quantity</TableCell>
                  <TableCell>Received Quantity</TableCell>
                  <TableCell>Price</TableCell>
                  <TableCell>Total Price</TableCell>
                  <TableCell>Tax (%)</TableCell>
                  <TableCell>Tax Amount</TableCell>
                  <TableCell>Discount</TableCell>
                  <TableCell>Final Price</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {po.itemDetails.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{item.itemName}</TableCell>
                    <TableCell>{item.poQuantity}</TableCell>
                    <TableCell>{item.receivedQuantity}</TableCell>
                    <TableCell>{item.newPrice?.toFixed(2)}</TableCell>
                    <TableCell>{item.totalPrice?.toFixed(2)}</TableCell>
                    <TableCell>{item.taxPercentage.toFixed(2)}</TableCell>
                    <TableCell>{item.taxAmount?.toFixed(2)}</TableCell>
                    <TableCell>{item.discountAmount?.toFixed(2)}</TableCell>
                    <TableCell>{item.finalPrice?.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        ) : (
          <Typography>No purchase order data available.</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="primary" variant='contained'>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PODialog;