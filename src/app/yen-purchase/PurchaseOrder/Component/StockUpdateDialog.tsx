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
  Tooltip,
  Divider
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import CloseIcon from '@mui/icons-material/Close';
import StoreIcon from '@mui/icons-material/Store';
import InventoryIcon from '@mui/icons-material/Inventory';
import PriceChangeIcon from '@mui/icons-material/PriceChange';

interface StockUpdateItem {
  randomId: string;
  itemName: string;
  stockChange: number;           // Item Master stock change (NOW ALWAYS 0)
  newStock: number;               // Item Master new total stock (unchanged)
  locationStockChange?: number;   // Location-specific stock change
  newLocationStock?: number;      // Location-specific new stock
  locationId?: string;            // Location ID
  priceUpdated: boolean;
  status: 'success' | 'failed';
  reason?: string;
  oldMasterPrice?: number;        // Previous price from item master (moves to oldPrice)
  newMasterPrice?: number;        // New price from GRN (becomes purchasePrice)
  oldPrice?: number;              // For backward compatibility
  newPrice?: number;              // For backward compatibility
  priceSource?: string;           // Source of price (grnPrice/newPrice)
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
    stock_updates: number;
    price_updates: number;
    timestamp: string;
  } | null;
}

const StockUpdateDialog: React.FC<StockUpdateDialogProps> = ({ open, onClose, result }) => {
  console.log('StockUpdateDialog - Received props:', { open, result });

  if (!result) {
    console.log('StockUpdateDialog - No result provided');
    return null;
  }

  // Filter items with price updates
  const priceUpdatedItems = result.items?.filter(item => item.priceUpdated) || [];

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
            Stock & Price Update {result.success ? 'Completed' : 'Completed with Errors'}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        {/* Summary Cards */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
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
          <Paper sx={{ p: 2, flex: 1, textAlign: 'center', bgcolor: '#e3f2fd' }}>
            <Typography variant="h4" color="info.main">{result.stock_updates || 0}</Typography>
            <Typography variant="body2">Stock Updates</Typography>
            <Typography variant="caption">(Inventory Only)</Typography>
          </Paper>
          <Paper sx={{ p: 2, flex: 1, textAlign: 'center', bgcolor: '#fff3e0' }}>
            <Typography variant="h4" color="warning.main">{result.price_updates || 0}</Typography>
            <Typography variant="body2">Price Updates</Typography>
            <Typography variant="caption">(Item Master)</Typography>
          </Paper>
        </Box>

        {/* Important Note about Item Master Stock */}
        <Box sx={{ mb: 2, p: 2, bgcolor: '#fff9c4', borderRadius: 1, border: '1px solid #ffb300' }}>
          <Typography variant="body2" color="text.secondary">
            <strong>ℹ️ Note:</strong> Item Master stock is NOT updated during GRN receipt.
            Only Inventory location stock is updated. Prices are updated in Item Master when they change.
          </Typography>
        </Box>

        {/* Items Table - Shows Inventory Stock Updates */}
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', mt: 2 }}>
          📍 Inventory Stock Updates (Location: WH001)
        </Typography>
        <TableContainer component={Paper} sx={{ maxHeight: 300, mb: 3 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell>Status</TableCell>
                <TableCell>Item Name</TableCell>
                <TableCell align="center" colSpan={2}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                    <StoreIcon fontSize="small" color="secondary" />
                    <Typography variant="subtitle2">Location Stock (WH001)</Typography>
                  </Box>
                </TableCell>
                <TableCell>Details</TableCell>
              </TableRow>
              <TableRow>
                <TableCell></TableCell>
                <TableCell></TableCell>
                <TableCell align="right">Change</TableCell>
                <TableCell align="right">New Stock</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {result.items && result.items.length > 0 ? (
                result.items
                  .filter(item => item.locationStockChange && item.locationStockChange !== 0)
                  .map((item, index) => (
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

                      {/* Location Stock Changes */}
                      <TableCell align="right">
                        <Typography color={item.locationStockChange && item.locationStockChange > 0 ? 'success.main' : 'error.main'} fontWeight="bold">
                          {item.locationStockChange && item.locationStockChange > 0 ? '+' : ''}
                          {item.locationStockChange ? item.locationStockChange.toFixed(3) : '0.000'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold">
                          {item.newLocationStock ? item.newLocationStock.toFixed(3) : '0.000'}
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
                  ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography variant="body1" color="text.secondary" sx={{ py: 2 }}>
                      No stock updates
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Price Updates Table */}
        {priceUpdatedItems.length > 0 && (
          <>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', mt: 2 }}>
              💰 Item Master Price Updates
            </Typography>
            <TableContainer component={Paper} sx={{ maxHeight: 200 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Item Name</TableCell>
                    <TableCell align="right">Old Master Price</TableCell>
                    <TableCell align="right">Moved to OldPrice</TableCell>
                    <TableCell align="right">New Master Price</TableCell>
                    <TableCell align="right">Source</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {priceUpdatedItems.map((item, index) => {
                    // Use oldMasterPrice if available, fallback to oldPrice
                    const oldMasterPrice = item.oldMasterPrice || item.oldPrice || 0;
                    // Use newMasterPrice if available, fallback to newPrice
                    const newMasterPrice = item.newMasterPrice || item.newPrice || 0;
                    const priceSource = item.priceSource || 'grnPrice';

                    return (
                      <TableRow key={index}>
                        <TableCell>{item.itemName}</TableCell>
                        <TableCell align="right">₹{oldMasterPrice.toFixed(2)}</TableCell>
                        <TableCell align="right">
                          <Chip
                            label="→ oldPrice"
                            size="small"
                            color="info"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography fontWeight="bold" color="success.main">
                            ₹{newMasterPrice.toFixed(2)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Chip
                            label={priceSource}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <Box sx={{ mt: 1, mb: 2 }}>
              <Typography variant="caption" color="text.secondary">
                <strong>How price updates work:</strong> When GRN price differs from current purchasePrice,
                the current purchasePrice moves to <code>oldPrice</code> and the GRN price becomes the new <code>purchasePrice</code>.
              </Typography>
            </Box>
          </>
        )}

        {/* Explanation */}
        <Box sx={{ mt: 3, display: 'flex', gap: 3, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <InventoryIcon fontSize="small" color="disabled" />
            <Typography variant="caption" color="text.secondary">Item Master Stock: <strong>NOT UPDATED</strong></Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <StoreIcon fontSize="small" color="secondary" />
            <Typography variant="caption" color="text.secondary">Location Stock: Updated at WH001</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PriceChangeIcon fontSize="small" color="warning" />
            <Typography variant="caption" color="text.secondary">Item Master Price: Updated when changed</Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Timestamp */}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'right' }}>
          Update completed at: {new Date(result.timestamp).toLocaleString()}
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

export default StockUpdateDialog;