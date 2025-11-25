import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Autocomplete,
  Grid,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/redux/store';
import { fetchFreightItems } from '@/features/yen-purchase/PurchaseMaster/FreightMasterSlice';
import { fetchPurchaseTaxes } from '@/features/yen-purchase/PurchaseMaster/purchaseTaxSlice';
import { calculateFreightTotals } from '@/features/yen-purchase/PurchaseOrder/purchaseOrderSlice';

interface FreightSelectionDialogProps {
  open: boolean;
  onClose: () => void;
  onAddFreights: (freights: any[]) => void;
  existingFreights?: any[];
}

export interface FreightData {
  id: string;
  name: string;
  amt: number;
  tCode: string;
  tAmt: number;
  totalAmt: number;
  sgst: number;
  cgst: number;
  igst: number;
  taxType: 'cgst_sgst' | 'igst';
  taxPercentage: number;
}

const FreightSelectionDialog: React.FC<FreightSelectionDialogProps> = ({
  open,
  onClose,
  onAddFreights,
  existingFreights = [],
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { items: freightItems } = useSelector((state: RootState) => state.freightItems);
  const { items: taxItems } = useSelector((state: RootState) => state.purchaseTax);
  const { freightCalculationLoading } = useSelector((state: RootState) => state.purchaseOrder);
 
  const [selectedFreight, setSelectedFreight] = useState<any>(null);
  const [freightAmount, setFreightAmount] = useState<string>('');
  const [selectedTax, setSelectedTax] = useState<any>(null);
  const [taxType, setTaxType] = useState<'cgst_sgst' | 'igst'>('cgst_sgst');
  const [previewFreights, setPreviewFreights] = useState<FreightData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      dispatch(fetchFreightItems());
      dispatch(fetchPurchaseTaxes());
      setPreviewFreights(existingFreights);
      setError(null);
      setEditingIndex(null);
    }
  }, [open, dispatch, existingFreights]);

  const handleAddToPreview = async () => {
    if (!selectedFreight || !freightAmount || !selectedTax) {
      setError('Please select freight, enter amount, and select tax');
      return;
    }

    const amount = parseFloat(freightAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid freight amount');
      return;
    }

    try {
      const result = await dispatch(calculateFreightTotals({
        amt: amount,
        tCode: selectedTax.purchasetaxName,
        taxType: taxType,
      })).unwrap();
      
      const freightWithTotals: FreightData = {
        id: selectedFreight.freightId,
        name: selectedFreight.freightName,
        amt: amount,
        tCode: selectedTax.purchasetaxName,
        tAmt: result.tAmt,
        totalAmt: result.totalAmt,
        sgst: result.sgst,
        cgst: result.cgst,
        igst: result.igst,
        taxType: taxType,
        taxPercentage: result.taxPercentage,
      };

      if (editingIndex !== null) {
        // Update existing freight
        setPreviewFreights((prev) => 
          prev.map((item, index) => 
            index === editingIndex ? freightWithTotals : item
          )
        );
        setEditingIndex(null);
      } else {
        // Add new freight
        setPreviewFreights((prev) => [...prev, freightWithTotals]);
      }
      
      // Reset form
      resetForm();
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to calculate freight totals';
      setError(errorMessage);
      console.error('Failed to add freight:', error);
    }
  };

  const handleEditPreview = (index: number) => {
    const freight = previewFreights[index];
    
    // Find the freight item
    const freightItem = freightItems.find(item => item.freightId === freight.id);
    // Find the tax item
    const taxItem = taxItems.find(item => item.purchasetaxName === freight.tCode);
    
    setSelectedFreight(freightItem || null);
    setFreightAmount(freight.amt.toString());
    setSelectedTax(taxItem || null);
    setTaxType(freight.taxType);
    setEditingIndex(index);
    setError(null);
  };

  const handleDeletePreview = (index: number) => {
    setPreviewFreights((prev) => prev.filter((_, i) => i !== index));
    // If deleting the item being edited, reset form
    if (editingIndex === index) {
      resetForm();
    }
  };

  const resetForm = () => {
    setSelectedFreight(null);
    setFreightAmount('');
    setSelectedTax(null);
    setTaxType('cgst_sgst');
    setEditingIndex(null);
    setError(null);
  };

  const handleCancelEdit = () => {
    resetForm();
  };

  const handleSaveAll = () => {
    onAddFreights(previewFreights);
    handleClose();
  };

  const handleClose = () => {
    setPreviewFreights([]);
    resetForm();
    onClose();
  };

  // Calculate totals from preview freights
  const previewFreightTotal = previewFreights.reduce((sum, f) => sum + f.amt, 0);
  const previewFreightTaxTotal = previewFreights.reduce((sum, f) => sum + f.tAmt, 0);
  const previewGrandTotal = previewFreights.reduce((sum, f) => sum + f.totalAmt, 0);
  const totalSgst = previewFreights.reduce((sum, f) => sum + f.sgst, 0);
  const totalCgst = previewFreights.reduce((sum, f) => sum + f.cgst, 0);
  const totalIgst = previewFreights.reduce((sum, f) => sum + f.igst, 0);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xl" fullWidth>
      <DialogTitle>
        {editingIndex !== null ? 'Edit Freight Charge' : 'Add Freight Charges'}
        {freightCalculationLoading && <CircularProgress size={20} sx={{ ml: 2 }} />}
      </DialogTitle>
      <DialogContent>
        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Selection/Edit Form */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={3}>
            <Autocomplete
              options={freightItems}
              getOptionLabel={(option) => option.freightName || ''}
              value={selectedFreight}
              onChange={(event, newValue) => {
                setSelectedFreight(newValue);
                setError(null);
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Freight"
                  variant="outlined"
                  size="small"
                  fullWidth
                  error={!!error && !selectedFreight}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={2}>
            <TextField
              fullWidth
              label="Amount (₹)"
              variant="outlined"
              size="small"
              value={freightAmount}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
                  setFreightAmount(value);
                  setError(null);
                }
              }}
              type="text"
              error={!!error && (!freightAmount || parseFloat(freightAmount) <= 0)}
              helperText={!!error && (!freightAmount || parseFloat(freightAmount) <= 0) ? 'Enter valid amount' : ''}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <Autocomplete
              options={taxItems}
              getOptionLabel={(option) =>
                `${option.purchasetaxName} (${option.purchasetaxPercentage}%)`
              }
              value={selectedTax}
              onChange={(event, newValue) => {
                setSelectedTax(newValue);
                setError(null);
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Tax Code"
                  variant="outlined"
                  size="small"
                  fullWidth
                  error={!!error && !selectedTax}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={2}>
            <Autocomplete
              options={['cgst_sgst', 'igst']}
              getOptionLabel={(option) => option === 'cgst_sgst' ? 'CGST/SGST' : 'IGST'}
              value={taxType}
              onChange={(event, newValue) => setTaxType(newValue as 'cgst_sgst' | 'igst')}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Tax Type"
                  variant="outlined"
                  size="small"
                  fullWidth
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={2}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                onClick={handleAddToPreview}
                disabled={!selectedFreight || !freightAmount || !selectedTax || freightCalculationLoading}
                fullWidth
                size="small"
              >
                {freightCalculationLoading ? (
                  <CircularProgress size={20} />
                ) : editingIndex !== null ? (
                  'Update'
                ) : (
                  'Add to List'
                )}
              </Button>
              {editingIndex !== null && (
                <Button
                  variant="outlined"
                  onClick={handleCancelEdit}
                  size="small"
                >
                  Cancel
                </Button>
              )}
            </Box>
          </Grid>
        </Grid>

        {/* Preview Table */}
        {previewFreights.length > 0 && (
          <>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Freight Charges {editingIndex !== null ? '(Editing Mode)' : 'Preview'}
              <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                (All calculations done by backend API via Redux slice)
              </Typography>
            </Typography>
            <TableContainer sx={{ maxHeight: 300, mb: 2 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ minWidth: 120 }}>Name</TableCell>
                    <TableCell align="right" sx={{ minWidth: 100 }}>Amount (₹)</TableCell>
                    <TableCell align="center" sx={{ minWidth: 100 }}>Tax Code</TableCell>
                    <TableCell align="center" sx={{ minWidth: 100 }}>Tax Type</TableCell>
                    <TableCell align="right" sx={{ minWidth: 80 }}>SGST (₹)</TableCell>
                    <TableCell align="right" sx={{ minWidth: 80 }}>CGST (₹)</TableCell>
                    <TableCell align="right" sx={{ minWidth: 80 }}>IGST (₹)</TableCell>
                    <TableCell align="right" sx={{ minWidth: 100 }}>Total Tax (₹)</TableCell>
                    <TableCell align="right" sx={{ minWidth: 100 }}>Total (₹)</TableCell>
                    <TableCell align="center" sx={{ minWidth: 120, width: 120 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {previewFreights.map((freight, index) => (
                    <TableRow 
                      key={index}
                      sx={{ 
                        backgroundColor: editingIndex === index ? 'action.selected' : 'inherit',
                        '&:hover': { backgroundColor: 'action.hover' }
                      }}
                    >
                      <TableCell>{freight.name}</TableCell>
                      <TableCell align="right">{freight.amt.toFixed(2)}</TableCell>
                      <TableCell align="center">{freight.tCode}</TableCell>
                      <TableCell align="center">
                        {freight.taxType === 'cgst_sgst' ? 'CGST/SGST' : 'IGST'}
                      </TableCell>
                      <TableCell align="right">{freight.sgst.toFixed(2)}</TableCell>
                      <TableCell align="right">{freight.cgst.toFixed(2)}</TableCell>
                      <TableCell align="right">{freight.igst.toFixed(2)}</TableCell>
                      <TableCell align="right">{freight.tAmt.toFixed(2)}</TableCell>
                      <TableCell align="right">{freight.totalAmt.toFixed(2)}</TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                          <IconButton 
                            onClick={() => handleEditPreview(index)} 
                            size="small" 
                            color="primary"
                            sx={{ padding: '4px' }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton 
                            onClick={() => handleDeletePreview(index)} 
                            size="small" 
                            color="error"
                            sx={{ padding: '4px' }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                  
                  {/* Totals Row */}
                  <TableRow sx={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}>
                    <TableCell>Total</TableCell>
                    <TableCell align="right">{previewFreightTotal.toFixed(2)}</TableCell>
                    <TableCell align="center"></TableCell>
                    <TableCell align="center"></TableCell>
                    <TableCell align="right">{totalSgst.toFixed(2)}</TableCell>
                    <TableCell align="right">{totalCgst.toFixed(2)}</TableCell>
                    <TableCell align="right">{totalIgst.toFixed(2)}</TableCell>
                    <TableCell align="right">{previewFreightTaxTotal.toFixed(2)}</TableCell>
                    <TableCell align="right">{previewGrandTotal.toFixed(2)}</TableCell>
                    <TableCell align="center"></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

        {/* Existing Freights Summary */}
        {existingFreights.length > 0 && (
          <>
            <Typography variant="subtitle1" sx={{ mb: 1, color: 'text.secondary' }}>
              Existing Freights (Backend Calculated)
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
              {existingFreights.map((freight: any, index: number) => (
                <Chip
                  key={index}
                  label={`${freight.name}: ₹${(freight.totalAmt || 0).toFixed(2)}`}
                  variant="outlined"
                  color="primary"
                  size="small"
                />
              ))}
            </Box>
          </>
        )}

      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button 
          onClick={handleSaveAll} 
          variant="contained" 
          disabled={previewFreights.length === 0 || freightCalculationLoading}
        >
          {freightCalculationLoading ? (
            <CircularProgress size={16} />
          ) : (
            `Save All Freights (${previewFreights.length})`
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FreightSelectionDialog;