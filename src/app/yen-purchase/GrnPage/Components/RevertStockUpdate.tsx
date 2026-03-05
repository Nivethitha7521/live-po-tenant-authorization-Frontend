// components/RevertStockUpdateDialog.tsx
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

// Interface matching your backend update_inventory_only function response
interface RevertStockUpdateItem {
  randomId: string;
  itemName: string;
  stockChange: number;           // Always 0 for revert (item master not updated)
  newStock: number;               // Always 0 for revert
  locationStockChange: number;    // Location-specific stock change (negative for revert)
  newLocationStock: number;       // Location-specific new stock
  locationId: string;
  priceUpdated: boolean;          // Always false for revert
  status: 'success' | 'failed';
  reason?: string;
}

interface RevertStockUpdateResult {
  success: boolean;
  totalProcessed: number;
  successful: number;
  failed: number;
  items: RevertStockUpdateItem[];
  purchaseitem_updates: number;   // Always 0 for revert
  inventory_updates: number;
  inventory_creates: number;
  inventory_not_found: number;
  errors: number;
  timestamp: string;
}

interface RevertStockUpdateDialogProps {
  open: boolean;
  stockUpdates?: RevertStockUpdateResult | null;
  grnId?: string | null;
  onClose: () => void;
}

const RevertStockUpdateDialog: React.FC<RevertStockUpdateDialogProps> = ({
  open,
  stockUpdates,
  grnId,
  onClose,
}) => {
  // Debug log
  React.useEffect(() => {
    if (open) {
      console.log('📊 RevertStockUpdateDialog OPENED with:', {
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
            Inventory was updated successfully during revert operation.
          </Typography>
          <Typography variant="body2" sx={{ mt: 2 }}>
            <strong>Note:</strong> Only systemStock in inventory collection was updated (subtracted).
          </Typography>
          <Box sx={{ mt: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
            <Typography variant="body2">
              GRN ID: <strong>{grnId || 'N/A'}</strong>
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              Location: <strong>WH001</strong> (Default Warehouse)
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, color: 'warning.main' }}>
              <strong>Note:</strong> Item Master stock was NOT updated
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

  const hasErrors = stockUpdates.errors ? stockUpdates.errors > 0 : false;
  const hasWarnings = stockUpdates.inventory_not_found ? stockUpdates.inventory_not_found > 0 : false;
  const inventoryUpdates = stockUpdates.inventory_updates || 0;

  // Filter successful items
  const successfulItems = stockUpdates.items?.filter(item => item.status === 'success') || [];

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
        borderBottom: `1px solid ${hasErrors ? '#f44336' : hasWarnings ? '#ff9800' : '#4caf50'}`,
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
            Inventory Update After GRN Revert
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
            <Typography variant="h4" color="primary">{stockUpdates.totalProcessed}</Typography>
            <Typography variant="body2">Total Items</Typography>
          </Paper>
          <Paper sx={{ p: 2, flex: 1, minWidth: 150, textAlign: 'center', bgcolor: '#e3f2fd' }}>
            <Typography variant="h4" color="info.main">{inventoryUpdates}</Typography>
            <Typography variant="body2">Inventory Updates</Typography>
            <Typography variant="caption">(Location Stock)</Typography>
          </Paper>
          {stockUpdates.inventory_creates > 0 && (
            <Paper sx={{ p: 2, flex: 1, minWidth: 150, textAlign: 'center', bgcolor: '#e8f5e8' }}>
              <Typography variant="h4" color="success.main">{stockUpdates.inventory_creates}</Typography>
              <Typography variant="body2">Records Created</Typography>
            </Paper>
          )}
          {stockUpdates.inventory_not_found > 0 && (
            <Paper sx={{ p: 2, flex: 1, minWidth: 150, textAlign: 'center', bgcolor: '#fff3e0' }}>
              <Typography variant="h4" color="warning.main">{stockUpdates.inventory_not_found}</Typography>
              <Typography variant="body2">Records Not Found</Typography>
              <Typography variant="caption">(Skipped)</Typography>
            </Paper>
          )}
          {stockUpdates.errors > 0 && (
            <Paper sx={{ p: 2, flex: 1, minWidth: 150, textAlign: 'center', bgcolor: '#ffebee' }}>
              <Typography variant="h4" color="error.main">{stockUpdates.errors}</Typography>
              <Typography variant="body2">Errors</Typography>
            </Paper>
          )}
        </Box>

        {/* Important Note */}
        <Box sx={{ mb: 2, p: 2, bgcolor: '#fff9c4', borderRadius: 1, border: '1px solid #ffb300' }}>
          <Typography variant="body2">
            <strong>ℹ️ Important:</strong> During revert operation, only <strong>Inventory location stock (systemStock)</strong> is updated. 
            <strong> Item Master stock remains unchanged</strong> as items are only moved, not removed from total stock.
          </Typography>
        </Box>

        {/* Operation Type Badge */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <Chip
            icon={<RemoveCircleIcon />}
            label="REVERT OPERATION - INVENTORY ONLY"
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

        {/* Items Table - Inventory Updates Only */}
        <Box sx={{ mt: 2, mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
            📍 Inventory Stock Updates (Location: WH001):
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                  <TableCell><strong>Status</strong></TableCell>
                  <TableCell><strong>Item Name</strong></TableCell>
                  <TableCell align="right"><strong>SystemStock Change</strong></TableCell>
                  <TableCell align="right"><strong>New SystemStock</strong></TableCell>
                  <TableCell><strong>Details</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {successfulItems.length > 0 ? (
                  successfulItems.map((item, index) => {
                    const change = item.locationStockChange || 0;
                    
                    return (
                      <TableRow key={index}>
                        <TableCell>
                          <Chip
                            icon={item.status === 'success' ? <CheckCircleIcon /> : <ErrorIcon />}
                            label={item.status === 'success' ? 'Success' : 'Failed'}
                            color={item.status === 'success' ? 'success' : 'error'}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>{item.itemName || 'Unknown'}</TableCell>
                        <TableCell align="right">
                          <Typography color="error.main" fontWeight="bold">
                            {change.toFixed(3)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            (Removed: {Math.abs(change).toFixed(3)})
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography fontWeight="bold">
                            {(item.newLocationStock || 0).toFixed(3)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {item.reason && (
                            <Tooltip title={item.reason}>
                              <IconButton size="small">
                                <InfoIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {item.locationId && (
                            <Tooltip title={`Location: ${item.locationId}`}>
                              <IconButton size="small">
                                <StoreIcon fontSize="small" color="action" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        No inventory updates found
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        {/* Failed Items if any */}
        {stockUpdates.failed > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', color: 'error.main' }}>
              ❌ Failed Items:
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#ffebee' }}>
                    <TableCell><strong>Item Name</strong></TableCell>
                    <TableCell><strong>Reason</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stockUpdates.items
                    ?.filter(item => item.status === 'failed')
                    .map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.itemName || 'Unknown'}</TableCell>
                        <TableCell>{item.reason || 'Unknown error'}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Summary Stats */}
        <Box sx={{ mt: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Paper sx={{ p: 2, flex: 1, bgcolor: '#f5f5f5' }}>
            <Typography variant="subtitle2" gutterBottom>Item Master Updates:</Typography>
            <Typography variant="h6" color="text.secondary">0 (Not Updated)</Typography>
          </Paper>
          <Paper sx={{ p: 2, flex: 1, bgcolor: '#e3f2fd' }}>
            <Typography variant="subtitle2" gutterBottom>PurchaseItem Updates:</Typography>
            <Typography variant="h6" color="info.main">{stockUpdates.purchaseitem_updates || 0}</Typography>
          </Paper>
        </Box>

        {/* Explanation */}
        <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            <strong>Summary of Revert Operation:</strong>
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <InventoryIcon fontSize="small" color="disabled" />
              <Typography variant="body2" color="text.secondary">
                <strong>Item Master:</strong> <span style={{ color: '#757575' }}>NOT UPDATED</span> - Total stock remains unchanged
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StoreIcon fontSize="small" color="secondary" />
              <Typography variant="body2" color="text.secondary">
                <strong>Inventory (WH001):</strong> Updated - systemStock reduced by returned quantities
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Note about negative values */}
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
            <strong>Note:</strong> All stock changes are negative (subtracted) as this is a revert operation.
            Values in red indicate stock reduction at location level only.
          </Typography>
        </Box>

        {/* Timestamp */}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, textAlign: 'right' }}>
          Update completed at: {new Date(stockUpdates.timestamp).toLocaleString()}
        </Typography>
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: '1px solid #e0e0e0' }}>
        <Button onClick={onClose} variant="contained" color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RevertStockUpdateDialog;