// components/yen-service/ServiceDialog.tsx
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Chip,
  Box,
} from '@mui/material';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import { ServiceData } from '../Models/servicepo';

interface ServiceDialogProps {
  open: boolean;
  onClose: () => void;
  service: ServiceData | null;
}

const ServiceDialog: React.FC<ServiceDialogProps> = ({ open, onClose, service }) => {
  const [isFullScreen, setIsFullScreen] = useState(false);

  const handleClose = () => {
    onClose();
  };

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  if (!service) {
    return null;
  }

  const formatDate = (dateVal: any) => {
    if (!dateVal) return 'N/A';
    try {
      return new Date(dateVal).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return 'N/A';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved': return 'success';
      case 'rejected': return 'error';
      case 'pending': return 'warning';
      case 'completed': return 'info';
      case 'in progress': return 'primary';
      default: return 'default';
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth={false}
      fullWidth={true}
      fullScreen={isFullScreen}
      disablePortal={false}
      sx={
        isFullScreen
          ? {
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
              },
            }
          : {}
      }
      PaperProps={{
        style: {
          width: isFullScreen ? '100vw' : '95vw',
          height: isFullScreen ? '100vh' : 'auto',
          maxWidth: 'none',
          margin: isFullScreen ? 0 : '32px',
          borderRadius: isFullScreen ? 0 : 8,
        },
      }}
    >
      <DialogTitle
        sx={{
          fontWeight: 'bold',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#f5f5f5',
          borderBottom: '1px solid #e0e0e0',
        }}
      >
        <Box>
          Service Order Details - {service.serviceId || 'N/A'}
        </Box>
        <IconButton onClick={toggleFullScreen} color="primary">
          {isFullScreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
        </IconButton>
      </DialogTitle>

      <DialogContent
        sx={{
          padding: isFullScreen ? '24px' : '20px',
          overflow: 'auto',
        }}
      >
        {service && (
          <>
            {/* Header Info */}
            <Box sx={{ mb: 3, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Typography><strong>Vendor:</strong> {service.vendorName || 'N/A'}</Typography>
              <Typography><strong>Work Order Date:</strong> {formatDate(service.workOrderDate)}</Typography>
              <Typography><strong>Total Amount:</strong> ₹{service.totalAmount?.toFixed(2) || '0.00'}</Typography>
            </Box>

            {/* Service Descriptions Table */}
            <Typography variant="h6" gutterBottom sx={{ mt: 4, fontWeight: 'bold' }}>
              Service Items
            </Typography>
            <Table size="small" sx={{ border: '1px solid #e0e0e0' }}>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f0f0f0' }}>
                  <TableCell><strong>Description</strong></TableCell>
                  <TableCell><strong>Period</strong></TableCell>
                  <TableCell align="right"><strong>Quantity</strong></TableCell>
                  <TableCell align="right"><strong>Fee (incl. tax)</strong></TableCell>
                  <TableCell align="right"><strong>Discount</strong></TableCell>
                  <TableCell align="right"><strong>Tax %</strong></TableCell>
                  <TableCell align="right"><strong>Tax Amount</strong></TableCell>
                  <TableCell align="right"><strong>Line Total</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {service.descriptions?.map((desc, index) => (
                  <TableRow key={index} hover>
                    <TableCell>
                      <div>
                        <div>{desc || 'N/A'}</div>
                        {service.remarks?.[index] && (
                          <Typography variant="caption" color="text.secondary">
                            {service.remarks[index]}
                          </Typography>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {service.from_dates?.[index]
                        ? `${formatDate(service.from_dates[index])} → ${formatDate(service.to_dates?.[index])}`
                        : 'N/A'}
                    </TableCell>
                    <TableCell align="right">
                      {service.quantity?.[index]?.toFixed(2) || '1.00'}
                    </TableCell>
                    <TableCell align="right">
                      ₹{(service.fees?.[index] || 0).toFixed(2)}
                    </TableCell>
                    <TableCell align="right">
                      ₹{((service.desc_discount_amounts?.[index] || 0) + 
                         (service.desc_discount_percentages?.[index] || 0)).toFixed(2)}
                    </TableCell>
                    <TableCell align="right">
                      {(service.desc_tax_pers?.[index] || 0).toFixed(1)}%
                    </TableCell>
                    <TableCell align="right">
                      ₹{(service.desc_tax_amounts?.[index] || 0).toFixed(2)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      ₹{(service.desc_totals?.[index] || 0).toFixed(2)}
                    </TableCell>
                  </TableRow>
                )) || (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      No service items found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {/* Totals Summary */}
            <Box sx={{ mt: 4, textAlign: 'right', pr: 2 }}>
              <Typography><strong>Subtotal (Fees):</strong> ₹{(service.base_amounts || 0)}</Typography>
              <Typography><strong>Total Tax:</strong> ₹{(service.totalTax || 0).toFixed(2)}</Typography>
              <Typography><strong>Total Discount:</strong> -₹{(service.totalDiscount || 0).toFixed(2)}</Typography>
              <Typography><strong>Round Off:</strong> ₹{(service.roundOffValue || 0).toFixed(2)}</Typography>
              <Typography variant="h6" sx={{ mt: 1, color: 'primary.main' }}>
                <strong>Grand Total: ₹{(service.totalAmount || 0).toFixed(2)}</strong>
              </Typography>
            </Box>

            {service.comments && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1"><strong>Comments:</strong></Typography>
                <Typography variant="body2" color="text.secondary">
                  {service.comments}
                </Typography>
              </Box>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ borderTop: '1px solid #e0e0e0', p: 2 }}>
        <Button onClick={handleClose} variant="contained" color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ServiceDialog;