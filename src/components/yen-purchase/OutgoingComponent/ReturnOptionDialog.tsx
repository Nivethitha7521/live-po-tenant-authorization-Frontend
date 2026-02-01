"use client";

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  Paper,
  Typography,
  Box,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import InventoryIcon from '@mui/icons-material/Inventory';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';

interface ReturnOptionDialogProps {
  open: boolean;
  onClose: () => void;
  onSelectItemWise: () => void;
  onSelectAmountWise: () => void;
  documentType: 'grn' | 'outgoing_payment';
  documentNumber: string;
}

const ReturnOptionDialog: React.FC<ReturnOptionDialogProps> = ({
  open,
  onClose,
  onSelectItemWise,
  onSelectAmountWise,
  documentType,
  documentNumber,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 3 }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        bgcolor: '#f5f5f5',
        borderBottom: 1,
        borderColor: 'divider'
      }}>
        <Typography variant="h6" component="span" fontWeight="bold">
          Select Return Type
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        <Typography variant="body1" paragraph align="center" sx={{ mb: 3 }}>
          How would you like to process the return for <strong>{documentType.toUpperCase()} {documentNumber}</strong>?
        </Typography>

        <Grid container spacing={3}>
          {/* Item-wise Return Option */}
          <Grid item xs={12} sm={6}>
            <Paper
              variant="outlined"
              sx={{
                p: 3,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s',
                borderColor: 'primary.main',
                borderWidth: 2,
                '&:hover': {
                  bgcolor: 'primary.light',
                  borderColor: 'primary.dark',
                  transform: 'translateY(-4px)',
                },
              }}
              onClick={onSelectItemWise}
            >
              <Box
                sx={{
                  width: 60,
                  height: 60,
                  borderRadius: '50%',
                  bgcolor: 'primary.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 2,
                }}
              >
                <ShoppingCartIcon sx={{ fontSize: 32, color: 'white' }} />
              </Box>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Item-wise Return
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Return specific items with quantities. Reduces stock levels and creates itemized debit note.
              </Typography>
              <Box sx={{ mt: 'auto', pt: 2 }}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<InventoryIcon />}
                  fullWidth
                >
                  Select Items
                </Button>
              </Box>
            </Paper>
          </Grid>

          {/* Amount-wise Return Option */}
          <Grid item xs={12} sm={6}>
            <Paper
              variant="outlined"
              sx={{
                p: 3,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s',
                borderColor: 'secondary.main',
                borderWidth: 2,
                '&:hover': {
                  bgcolor: 'secondary.light',
                  borderColor: 'secondary.dark',
                  transform: 'translateY(-4px)',
                },
              }}
              onClick={onSelectAmountWise}
            >
              <Box
                sx={{
                  width: 60,
                  height: 60,
                  borderRadius: '50%',
                  bgcolor: 'secondary.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 2,
                }}
              >
                <AttachMoneyIcon sx={{ fontSize: 32, color: 'white' }} />
              </Box>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Amount-wise Return
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Financial adjustment only. No quantity reduction. Use for discounts, price adjustments, or other financial corrections.
              </Typography>
              <Box sx={{ mt: 'auto', pt: 2 }}>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<ReceiptLongIcon />}
                  fullWidth
                >
                  Adjust Amount
                </Button>
              </Box>
            </Paper>
          </Grid>
        </Grid>

        <Box sx={{ mt: 3, p: 2, bgcolor: '#f8f9fa', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary">
            <strong>Note:</strong> Item-wise returns affect stock quantities, while amount-wise returns only adjust financial amounts.
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, justifyContent: 'center' }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReturnOptionDialog;