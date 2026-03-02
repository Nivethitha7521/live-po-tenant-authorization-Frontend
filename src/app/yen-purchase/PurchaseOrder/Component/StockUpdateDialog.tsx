// components/StockUpdateDialog.tsx
import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Box,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import CloseIcon from '@mui/icons-material/Close';
import StoreIcon from '@mui/icons-material/Store';
import InventoryIcon from '@mui/icons-material/Inventory';

interface StockUpdateItem {
  randomId: string;
  itemName: string;
  stockChange: number;           // Item Master stock change
  newStock: number;               // Item Master new total stock
  locationStockChange?: number;   // Location-specific stock change
  newLocationStock?: number;      // Location-specific new stock
  locationId?: string;            // Location ID
  priceUpdated: boolean;
  status: 'success' | 'failed';
  reason?: string;
}

interface StockUpdateDialogProps {
  open: boolean;
  onClose: () => void;
  result: {
    success: boolean;
    totalProcessed: number;
    successful: number;
    failed: number;
    items: StockUpdateItem[];
    timestamp: string;
  } | null;
}

const StockUpdateDialog: React.FC<StockUpdateDialogProps> = ({ open, onClose, result }) => {
  console.log('StockUpdateDialog - Received props:', { open, result });

  if (!result) {
    console.log('StockUpdateDialog - No result provided');
    return null;
  }

  console.log('StockUpdateDialog - Items to display:', result.items);

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { minHeight: '70vh', maxHeight: '85vh' }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        bgcolor: result.success ? '#e8f5e8' : '#ffebee',
        borderBottom: `1px solid ${result.success ? '#4caf50' : '#f44336'}`
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {result.success ? (
            <CheckCircleIcon color="success" />
          ) : (
            <ErrorIcon color="error" />
          )}
          <Typography variant="h6">
            Stock Update {result.success ? 'Completed' : 'Completed with Errors'}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        {/* Summary Cards */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <Paper sx={{ p: 2, flex: 1, textAlign: 'center', bgcolor: '#f5f5f5' }}>
            <Typography variant="h4" color="primary">{result.totalProcessed}</Typography>
            <Typography variant="body2">Total Items</Typography>
          </Paper>
          <Paper sx={{ p: 2, flex: 1, textAlign: 'center', bgcolor: '#e8f5e8' }}>
            <Typography variant="h4" color="success.main">{result.successful}</Typography>
            <Typography variant="body2">Successful</Typography>
          </Paper>
          <Paper sx={{ p: 2, flex: 1, textAlign: 'center', bgcolor: '#ffebee' }}>
            <Typography variant="h4" color="error.main">{result.failed}</Typography>
            <Typography variant="body2">Failed</Typography>
          </Paper>
        </Box>

        {/* Items Table - Shows both Master Stock and Location Stock */}
        <TableContainer component={Paper} sx={{ maxHeight: 450 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell>Status</TableCell>
                <TableCell>Item Name</TableCell>
                <TableCell align="center" colSpan={2}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                    <InventoryIcon fontSize="small" color="primary" />
                    <Typography variant="subtitle2">Item Master Stock (Total)</Typography>
                  </Box>
                </TableCell>
                <TableCell align="center" colSpan={2}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                    <StoreIcon fontSize="small" color="secondary" />
                    <Typography variant="subtitle2">Location Stock (WH001)</Typography>
                  </Box>
                </TableCell>
                <TableCell>Price Updated</TableCell>
                <TableCell>Details</TableCell>
              </TableRow>
              <TableRow>
                <TableCell></TableCell>
                <TableCell></TableCell>
                <TableCell align="right">Change</TableCell>
                <TableCell align="right">New Stock</TableCell>
                <TableCell align="right">Change</TableCell>
                <TableCell align="right">New Stock</TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {result.items && result.items.length > 0 ? (
                result.items.map((item, index) => (
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
                    <TableCell>{item.itemName || 'Unknown Item'}</TableCell>
                    
                    {/* Item Master Stock Changes */}
                    <TableCell align="right">
                      <Typography color={item.stockChange > 0 ? 'success.main' : 'error.main'} fontWeight="bold">
                        {item.stockChange > 0 ? '+' : ''}{item.stockChange.toFixed(3)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography fontWeight="bold">
                        {item.newStock.toFixed(3)}
                      </Typography>
                    </TableCell>
                    
                    {/* Location Stock Changes */}
                    <TableCell align="right">
                      <Typography color={item.locationStockChange && item.locationStockChange > 0 ? 'success.main' : 'error.main'}>
                        {item.locationStockChange && item.locationStockChange > 0 ? '+' : ''}
                        {item.locationStockChange ? item.locationStockChange.toFixed(3) : '0.000'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography>
                        {item.newLocationStock ? item.newLocationStock.toFixed(3) : '0.000'}
                      </Typography>
                    </TableCell>
                    
                    <TableCell>
                      {item.priceUpdated ? (
                        <Chip label="Yes" color="primary" size="small" />
                      ) : (
                        <Chip label="No" variant="outlined" size="small" />
                      )}
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
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body1" color="text.secondary" sx={{ py: 2 }}>
                      No item details available
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Explanation */}
        <Box sx={{ mt: 2, display: 'flex', gap: 3, justifyContent: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <InventoryIcon fontSize="small" color="primary" />
            <Typography variant="caption">Item Master Stock: Total stock across all locations</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <StoreIcon fontSize="small" color="secondary" />
            <Typography variant="caption">Location Stock: Stock at WH001 (receiving location)</Typography>
          </Box>
        </Box>

        {/* Timestamp */}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, textAlign: 'right' }}>
          Update completed at: {new Date(result.timestamp).toLocaleString()}
        </Typography>
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: '1px solid #e0e0e0' }}>
        <Button 
          onClick={onClose} 
          variant="contained" 
          color="primary"
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StockUpdateDialog;