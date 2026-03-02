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
  Alert,
  AlertTitle,
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
  randomId: string;
  itemName: string;
  quantityToReduce: number;
  status: 'success' | 'failed';
  reason?: string;
  beforeStock?: number;
  afterStock?: number;
  beforeLocationStock?: number;
  afterLocationStock?: number;
}

interface ReturnStockUpdateResult {
  purchaseitem_updates: number;
  inventory_updates: number;
  inventory_not_found: number;
  inventory_errors: number;
  items?: ReturnStockUpdateItem[];
  message?: string;
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
  // ✅ ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  // Log when dialog opens
  React.useEffect(() => {
    if (open) {
      console.log('📊 ReturnStockUpdateDialog OPENED with:', {
        stockUpdates: stockUpdates ? 'Has Data' : 'No Data',
        grnId,
        stockUpdatesType: stockUpdates ? typeof stockUpdates : 'null',
        stockUpdatesKeys: stockUpdates ? Object.keys(stockUpdates) : []
      });
    }
  }, [open, stockUpdates, grnId]);

  // Normalize the stock updates data - moved BEFORE conditional returns
  const normalizedStockUpdates = React.useMemo(() => {
    console.log('🔄 Normalizing stockUpdates:', stockUpdates);

    // If no stock updates, return a default structure
    if (!stockUpdates) {
      return {
        purchaseitem_updates: 0,
        inventory_updates: 0,
        inventory_not_found: 0,
        inventory_errors: 0,
        items: [],
        message: 'No stock update data available',
        success: true
      } as ReturnStockUpdateResult;
    }

    // Handle different data structures
    let data = stockUpdates as any;

    // If data has a data property, unwrap it
    if (data && typeof data === 'object') {
      if (data.data) {
        console.log('📦 Unwrapping data.data property');
        data = data.data;
      }

      // Check if it has the expected structure
      if (data.purchaseitem_updates !== undefined ||
        data.inventory_updates !== undefined ||
        data.items !== undefined) {

        console.log('✅ Found expected structure with keys:', Object.keys(data));

        // If it has items but no counts, calculate counts
        if (data.items && Array.isArray(data.items) && data.items.length > 0) {
          console.log(`📦 Found ${data.items.length} items`);
          const items = data.items as ReturnStockUpdateItem[];
          const successCount = items.filter(item => item.status === 'success').length;
          const failedCount = items.filter(item => item.status === 'failed').length;

          return {
            purchaseitem_updates: data.purchaseitem_updates || successCount,
            inventory_updates: data.inventory_updates || successCount,
            inventory_not_found: data.inventory_not_found || failedCount,
            inventory_errors: data.inventory_errors || failedCount,
            items: items,
            message: data.message || 'Return processed successfully',
            success: data.success !== undefined ? data.success : true
          };
        }

        return {
          ...data,
          message: data.message || 'Return processed successfully',
          success: data.success !== undefined ? data.success : true
        } as ReturnStockUpdateResult;
      }
    }

    console.log('⚠️ Could not normalize stockUpdates, using as-is');
    return stockUpdates;
  }, [stockUpdates]);

  // ✅ NOW we can have conditional returns AFTER all hooks
  // If dialog is open but no data, show a message
  if (open && !stockUpdates) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Stock Update Information</DialogTitle>
        <DialogContent>
          <Alert severity="info">
            <AlertTitle>No Stock Update Data</AlertTitle>
            The return was processed successfully, but no stock update details are available.
          </Alert>
          
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} variant="contained" color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  // If not open, don't render anything
  if (!open) {
    return null;
  }

  // Rest of your component remains the same...
  const hasErrors = (normalizedStockUpdates.inventory_errors || 0) > 0;
  const hasWarnings = (normalizedStockUpdates.inventory_not_found || 0) > 0;

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
        borderBottom: `1px solid ${hasErrors ? '#f44336' : hasWarnings ? '#ff9800' : '#4caf50'
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
            <Typography variant="h4" color="primary">{normalizedStockUpdates.purchaseitem_updates || 0}</Typography>
            <Typography variant="body2">Item Master Updates</Typography>
            <Typography variant="caption" color="text.secondary">(Total Stock)</Typography>
          </Paper>
          <Paper sx={{ p: 2, flex: 1, minWidth: 150, textAlign: 'center', bgcolor: '#e3f2fd' }}>
            <Typography variant="h4" color="info.main">{normalizedStockUpdates.inventory_updates || 0}</Typography>
            <Typography variant="body2">Location Updates</Typography>
            <Typography variant="caption" color="text.secondary">(WH001)</Typography>
          </Paper>
          {(normalizedStockUpdates.inventory_not_found || 0) > 0 && (
            <Paper sx={{ p: 2, flex: 1, minWidth: 150, textAlign: 'center', bgcolor: '#fff3e0' }}>
              <Typography variant="h4" color="warning.main">{normalizedStockUpdates.inventory_not_found}</Typography>
              <Typography variant="body2">Records Not Found</Typography>
              <Typography variant="caption" color="text.secondary">(Skipped)</Typography>
            </Paper>
          )}
          {(normalizedStockUpdates.inventory_errors || 0) > 0 && (
            <Paper sx={{ p: 2, flex: 1, minWidth: 150, textAlign: 'center', bgcolor: '#ffebee' }}>
              <Typography variant="h4" color="error.main">{normalizedStockUpdates.inventory_errors}</Typography>
              <Typography variant="body2">Errors</Typography>
            </Paper>
          )}
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            GRN ID: <strong>{grnId}</strong>
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Location: <strong>WH001</strong> (Default Warehouse)
          </Typography>
        </Box>

        {/* Show items if available */}
        {(!normalizedStockUpdates.items || normalizedStockUpdates.items.length === 0) ? (
          <Box sx={{ textAlign: 'center', py: 4, bgcolor: '#f5f5f5', borderRadius: 1, mb: 2 }}>
            <Typography variant="body1" color="text.secondary" gutterBottom>
              No item details available
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Stock was updated successfully but item details not provided in response
            </Typography>
          </Box>
        ) : (
          <>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
              Item-wise Stock Changes:
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 350 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Status</TableCell>
                    <TableCell>Item Name</TableCell>
                    <TableCell align="center" colSpan={2}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                        <InventoryIcon fontSize="small" color="primary" />
                        <Typography variant="subtitle2">Item Master Stock</Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="center" colSpan={2}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                        <StoreIcon fontSize="small" color="secondary" />
                        <Typography variant="subtitle2">Location Stock (WH001)</Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right">Quantity Returned</TableCell>
                    <TableCell>Details</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell align="right">Change</TableCell>
                    <TableCell align="right">Before → After</TableCell>
                    <TableCell align="right">Change</TableCell>
                    <TableCell align="right">Before → After</TableCell>
                    <TableCell align="right"></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {normalizedStockUpdates.items.map((item: ReturnStockUpdateItem, index: number) => (
                    <TableRow key={index} sx={{
                      bgcolor: item.status === 'failed' ? '#ffebee' : 'inherit',
                      '&:hover': { bgcolor: '#f5f5f5' }
                    }}>
                      <TableCell>
                        <Chip
                          icon={item.status === 'success' ? <CheckCircleIcon /> : <ErrorIcon />}
                          label={item.status === 'success' ? 'Success' : 'Failed'}
                          color={item.status === 'success' ? 'success' : 'error'}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {item.itemName || 'Unknown Item'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ID: {item.randomId || 'N/A'}
                        </Typography>
                      </TableCell>

                      {/* Item Master Stock Changes */}
                      <TableCell align="right">
                        <Typography color="error.main" fontWeight="bold">
                          -{(item.quantityToReduce || 0).toFixed(3)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="caption" display="block">
                          {(item.beforeStock || 0).toFixed(3)} → {(item.afterStock || 0).toFixed(3)}
                        </Typography>
                      </TableCell>

                      {/* Location Stock Changes */}
                      <TableCell align="right">
                        <Typography color="error.main">
                          -{(item.quantityToReduce || 0).toFixed(3)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="caption">
                          {(item.beforeLocationStock || 0).toFixed(3)} → {(item.afterLocationStock || 0).toFixed(3)}
                        </Typography>
                      </TableCell>

                      <TableCell align="right">
                        <Typography fontWeight="bold" color="error.main">
                          {(item.quantityToReduce || 0).toFixed(3)}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        {item.reason && (
                          <Tooltip title={item.reason}>
                            <IconButton size="small">
                              <InfoIcon fontSize="small" color="info" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

        {/* Explanation */}
        <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            <strong>Summary of Stock Updates:</strong>
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <InventoryIcon fontSize="small" color="primary" />
              <Typography variant="body2" color="text.secondary">
                <strong>Item Master:</strong> {normalizedStockUpdates.purchaseitem_updates || 0} items updated - Total stock reduced by returned quantities
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StoreIcon fontSize="small" color="secondary" />
              <Typography variant="body2" color="text.secondary">
                <strong>Inventory (WH001):</strong> {normalizedStockUpdates.inventory_updates || 0} locations updated - Location stock reduced by returned quantities
              </Typography>
            </Box>
            {(normalizedStockUpdates.inventory_not_found || 0) > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <WarningIcon fontSize="small" color="warning" />
                <Typography variant="body2" color="warning.main">
                  <strong>Warning:</strong> {normalizedStockUpdates.inventory_not_found} items had no inventory records and were skipped.
                  Inventory records must exist before return stock can be updated.
                </Typography>
              </Box>
            )}
            {(normalizedStockUpdates.inventory_errors || 0) > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ErrorIcon fontSize="small" color="error" />
                <Typography variant="body2" color="error.main">
                  <strong>Errors:</strong> {normalizedStockUpdates.inventory_errors} errors occurred during inventory update.
                </Typography>
              </Box>
            )}
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