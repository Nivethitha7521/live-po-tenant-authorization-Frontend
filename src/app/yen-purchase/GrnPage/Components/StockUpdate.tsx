"use client";

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Paper,
  Table,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  TableHead,
  Chip,
  IconButton,
  Tooltip,
  Divider
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import StoreIcon from '@mui/icons-material/Store';
import InventoryIcon from '@mui/icons-material/Inventory';
import CloseIcon from '@mui/icons-material/Close';
import InfoIcon from '@mui/icons-material/Info';

interface ReturnStockUpdateItem {
  randomId?: string;
  itemName?: string;
  quantityToReduce?: number;
  status?: 'success' | 'failed';
  reason?: string;
  beforeStock?: number;
  afterStock?: number;
  beforeLocationStock?: number;
  afterLocationStock?: number;
}

interface ReturnStockUpdateResult {
  purchaseitem_updates?: number;
  inventory_updates?: number;
  inventory_not_found?: number;
  inventory_errors?: number;
  items?: ReturnStockUpdateItem[];
  success?: boolean;
}

interface ReturnStockUpdateDialogProps {
  open: boolean;
  stockUpdates?: ReturnStockUpdateResult | null;
  grnId?: string | null;
  onClose: () => void;
}

const ReturnStockUpdateDialog: React.FC<ReturnStockUpdateDialogProps> = ({
  open,
  stockUpdates,
  grnId,
  onClose,
}) => {
  // Debug log
  React.useEffect(() => {
    if (open) {
      console.log('📊 ReturnStockUpdateDialog OPENED with:', { 
        stockUpdates, 
        grnId,
        hasItems: stockUpdates?.items?.length || 0
      });
    }
  }, [open, stockUpdates, grnId]);

  // If no stockUpdates, show a simple dialog with message
  if (!stockUpdates) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: '#ff9800', color: 'white' }}>
          Stock Update Information
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography variant="body1">
            Stock was updated successfully but detailed information is not available.
          </Typography>
          <Box sx={{ mt: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
            <Typography variant="body2">
              GRN ID: <strong>{grnId || 'N/A'}</strong>
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              Location: <strong>WH001</strong> (Default Warehouse)
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} variant="contained" color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  const hasErrors = stockUpdates.inventory_errors ? stockUpdates.inventory_errors > 0 : false;
  const hasWarnings = stockUpdates.inventory_not_found ? stockUpdates.inventory_not_found > 0 : false;
  const purchaseUpdates = stockUpdates.purchaseitem_updates || 0;
  const inventoryUpdates = stockUpdates.inventory_updates || 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { minHeight: '60vh', maxHeight: '85vh' }
      }}
    >
      <DialogTitle sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        bgcolor: hasErrors ? '#ffebee' : hasWarnings ? '#fff3e0' : '#e8f5e8',
        borderBottom: `1px solid ${
          hasErrors ? '#f44336' : hasWarnings ? '#ff9800' : '#4caf50'
        }`,
        py: 2
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {hasErrors ? (
            <ErrorIcon sx={{ color: 'error.main' }} />
          ) : hasWarnings ? (
            <WarningIcon sx={{ color: 'warning.main' }} />
          ) : (
            <CheckCircleIcon sx={{ color: 'success.main' }} />
          )}
          <Typography variant="h6">
            Stock Update After GRN Return
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        {/* Summary Cards */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <Paper sx={{ p: 2, flex: 1, minWidth: 150, textAlign: 'center', bgcolor: '#f5f5f5' }}>
            <Typography variant="h4" color="primary">{purchaseUpdates}</Typography>
            <Typography variant="body2">Item Master Updates</Typography>
            <Typography variant="caption" color="text.secondary">(Total Stock)</Typography>
          </Paper>
          <Paper sx={{ p: 2, flex: 1, minWidth: 150, textAlign: 'center', bgcolor: '#e3f2fd' }}>
            <Typography variant="h4" color="info.main">{inventoryUpdates}</Typography>
            <Typography variant="body2">Location Updates</Typography>
            <Typography variant="caption" color="text.secondary">(WH001)</Typography>
          </Paper>
          {stockUpdates.inventory_not_found ? stockUpdates.inventory_not_found > 0 && (
            <Paper sx={{ p: 2, flex: 1, minWidth: 150, textAlign: 'center', bgcolor: '#fff3e0' }}>
              <Typography variant="h4" color="warning.main">{stockUpdates.inventory_not_found}</Typography>
              <Typography variant="body2">Records Not Found</Typography>
              <Typography variant="caption" color="text.secondary">(Skipped)</Typography>
            </Paper>
          ) : null}
          {stockUpdates.inventory_errors ? stockUpdates.inventory_errors > 0 && (
            <Paper sx={{ p: 2, flex: 1, minWidth: 150, textAlign: 'center', bgcolor: '#ffebee' }}>
              <Typography variant="h4" color="error.main">{stockUpdates.inventory_errors}</Typography>
              <Typography variant="body2">Errors</Typography>
            </Paper>
          ) : null}
        </Box>

        {/* Operation Type Badge */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <Chip
            icon={<RemoveCircleIcon />}
            label="RETURN OPERATION (Stock Subtracted)"
            color="warning"
            variant="outlined"
            sx={{ fontWeight: 'bold', px: 2 }}
          />
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            GRN ID: <strong>{grnId}</strong>
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Location: <strong>WH001</strong> (Default Warehouse)
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Items Table - Show data from your logs */}
        <Box sx={{ mt: 2, mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
            Stock Update Summary (from your successful return):
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                  <TableCell><strong>Item Name</strong></TableCell>
                  <TableCell align="right"><strong>Item Master Stock</strong></TableCell>
                  <TableCell align="right"><strong>Location Stock (WH001)</strong></TableCell>
                  <TableCell align="right"><strong>Quantity Returned</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
{stockUpdates.items && stockUpdates.items.length > 0 ? (
  stockUpdates.items.map((item:any, index:number) => {

    const beforeStock =
      (item.newStock ?? 0) - (item.stockChange ?? 0);

    const beforeLocationStock =
      (item.newLocationStock ?? 0) - (item.locationStockChange ?? 0);

    const returnedQty = Math.abs(item.stockChange ?? 0);

    return (
      <TableRow key={index}>
        <TableCell>
          {item.itemName}
        </TableCell>

        {/* Item Master */}
        <TableCell align="right">
          <Typography>
            {beforeStock.toFixed(3)} →{" "}
            <strong style={{color:"#d32f2f"}}>
              {(item.newStock ?? 0).toFixed(3)}
            </strong>
          </Typography>

          <Typography variant="caption">
            (Reduced by {returnedQty.toFixed(3)})
          </Typography>
        </TableCell>

        {/* Location */}
        <TableCell align="right">
          <Typography>
            {beforeLocationStock.toFixed(3)} →{" "}
            <strong style={{color:"#d32f2f"}}>
              {(item.newLocationStock ?? 0).toFixed(3)}
            </strong>
          </Typography>

          <Typography variant="caption">
            (Reduced by {returnedQty.toFixed(3)})
          </Typography>
        </TableCell>

        {/* Returned */}
        <TableCell align="right">
          <Typography fontWeight="bold" color="error">
            {returnedQty.toFixed(3)}
          </Typography>
        </TableCell>

      </TableRow>
    );
  })
) : (
  <TableRow>
    <TableCell colSpan={4} align="center">
      No stock updates found
    </TableCell>
  </TableRow>
)}
</TableBody>
            </Table>
          </TableContainer>
        </Box>

        {/* Raw data for debugging 
        <Box sx={{ mt: 3, p: 2, bgcolor: '#f0f0f0', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Raw Response Data:
          </Typography>
          <Typography variant="caption" component="pre" sx={{ fontSize: '10px', overflow: 'auto', maxHeight: '200px' }}>
            {JSON.stringify(stockUpdates, null, 2)}
          </Typography>
        </Box>
*/}
        {/* Explanation */}
        <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            <strong>Summary of Stock Updates:</strong>
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <InventoryIcon fontSize="small" color="primary" />
              <Typography variant="body2" color="text.secondary">
                <strong>Item Master:</strong> {purchaseUpdates} items updated - Total stock reduced by returned quantities
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StoreIcon fontSize="small" color="secondary" />
              <Typography variant="body2" color="text.secondary">
                <strong>Inventory (WH001):</strong> {inventoryUpdates} locations updated - Location stock reduced by returned quantities
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Note about negative values */}
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
            <strong>Note:</strong> All stock changes are negative (subtracted) as this is a return operation.
            Values in red indicate stock reduction.
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: '1px solid #e0e0e0' }}>
        <Button onClick={onClose} variant="contained" color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReturnStockUpdateDialog;