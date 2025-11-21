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
  fr_Id: string;
  fr_Name: string;
  fr_Amt: number;
  fr_TCode: string;
  fr_TAmt: number;
  fr_TotalAmt: number;
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

  useEffect(() => {
    if (open) {
      dispatch(fetchFreightItems());
      dispatch(fetchPurchaseTaxes());
      setPreviewFreights(existingFreights);
      setError(null);
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
      // CORRECTED: Dispatch and await the async thunk, then use the result
      const result = await dispatch(calculateFreightTotals({
        fr_Amt: amount,
        fr_TCode: selectedTax.purchasetaxName,
        taxType: taxType,
      })).unwrap();
      
      // Create freight data with backend-calculated values
      const freightWithTotals: FreightData = {
        fr_Id: selectedFreight.freightId,
        fr_Name: selectedFreight.freightName,
        fr_Amt: amount,
        fr_TCode: selectedTax.purchasetaxName,
        fr_TAmt: result.fr_TAmt,
        fr_TotalAmt: result.fr_TotalAmt,
        sgst: result.sgst,
        cgst: result.cgst,
        igst: result.igst,
        taxType: taxType,
        taxPercentage: result.taxPercentage,
      };

      // CORRECTED: Add the actual FreightData object, not the async thunk
      setPreviewFreights((prev) => [...prev, freightWithTotals]);
      
      // Reset form
      setSelectedFreight(null);
      setFreightAmount('');
      setSelectedTax(null);
      setTaxType('cgst_sgst');
      setError(null);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to calculate freight totals';
      setError(errorMessage);
      console.error('Failed to add freight:', error);
    }
  };

  const handleDeletePreview = (index: number) => {
    setPreviewFreights((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveAll = () => {
    onAddFreights(previewFreights);
    handleClose();
  };

  const handleClose = () => {
    setPreviewFreights([]);
    setSelectedFreight(null);
    setFreightAmount('');
    setSelectedTax(null);
    setTaxType('cgst_sgst');
    setError(null);
    onClose();
  };

  // Calculate totals from preview freights (only display, no calculation)
  const previewFreightTotal = previewFreights.reduce((sum, f) => sum + f.fr_Amt, 0);
  const previewFreightTaxTotal = previewFreights.reduce((sum, f) => sum + f.fr_TAmt, 0);
  const previewGrandTotal = previewFreights.reduce((sum, f) => sum + f.fr_TotalAmt, 0);
  const totalSgst = previewFreights.reduce((sum, f) => sum + f.sgst, 0);
  const totalCgst = previewFreights.reduce((sum, f) => sum + f.cgst, 0);
  const totalIgst = previewFreights.reduce((sum, f) => sum + f.igst, 0);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        Add Freight Charges
        {freightCalculationLoading && <CircularProgress size={20} sx={{ ml: 2 }} />}
      </DialogTitle>
      <DialogContent>
        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Selection Form */}
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
            <Button
              variant="contained"
              onClick={handleAddToPreview}
              disabled={!selectedFreight || !freightAmount || !selectedTax || freightCalculationLoading}
              fullWidth
              size="small"
            >
              {freightCalculationLoading ? <CircularProgress size={20} /> : 'Add to List'}
            </Button>
          </Grid>
        </Grid>

        {/* Preview Table */}
        {previewFreights.length > 0 && (
          <>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Freight Charges Preview 
              <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                (All calculations done by backend API via Redux slice)
              </Typography>
            </Typography>
            <TableContainer sx={{ maxHeight: 300, mb: 2 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Freight Name</TableCell>
                    <TableCell align="right">Amount (₹)</TableCell>
                    <TableCell align="center">Tax Code</TableCell>
                    <TableCell align="center">Tax Type</TableCell>
                    <TableCell align="right">SGST (₹)</TableCell>
                    <TableCell align="right">CGST (₹)</TableCell>
                    <TableCell align="right">IGST (₹)</TableCell>
                    <TableCell align="right">Total Tax (₹)</TableCell>
                    <TableCell align="right">Total (₹)</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {previewFreights.map((freight, index) => (
                    <TableRow key={index}>
                      <TableCell>{freight.fr_Name}</TableCell>
                      <TableCell align="right">{freight.fr_Amt.toFixed(2)}</TableCell>
                      <TableCell align="center">{freight.fr_TCode}</TableCell>
                      <TableCell align="center">
                        {freight.taxType === 'cgst_sgst' ? 'CGST/SGST' : 'IGST'}
                      </TableCell>
                      <TableCell align="right">{freight.sgst.toFixed(2)}</TableCell>
                      <TableCell align="right">{freight.cgst.toFixed(2)}</TableCell>
                      <TableCell align="right">{freight.igst.toFixed(2)}</TableCell>
                      <TableCell align="right">{freight.fr_TAmt.toFixed(2)}</TableCell>
                      <TableCell align="right">{freight.fr_TotalAmt.toFixed(2)}</TableCell>
                      <TableCell align="right">
                        <IconButton 
                          onClick={() => handleDeletePreview(index)} 
                          size="small" 
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  
                  {/* Totals Row */}
                  <TableRow sx={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}>
                    <TableCell>Backend Calculated Totals:</TableCell>
                    <TableCell align="right">{previewFreightTotal.toFixed(2)}</TableCell>
                    <TableCell colSpan={3} />
                    <TableCell align="right">{totalSgst.toFixed(2)}</TableCell>
                    <TableCell align="right">{totalCgst.toFixed(2)}</TableCell>
                    <TableCell align="right">{totalIgst.toFixed(2)}</TableCell>
                    <TableCell align="right">{previewFreightTaxTotal.toFixed(2)}</TableCell>
                    <TableCell align="right">{previewGrandTotal.toFixed(2)}</TableCell>
                    <TableCell />
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
                  label={`${freight.fr_Name}: ₹${(freight.fr_TotalAmt || 0).toFixed(2)}`}
                  variant="outlined"
                  color="primary"
                  size="small"
                />
              ))}
            </Box>
          </>
        )}

        {/* Information Text */}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
          💡 All tax calculations are performed by the backend API via Redux slice to ensure accuracy and consistency.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button 
          onClick={handleSaveAll} 
          variant="contained" 
          disabled={previewFreights.length === 0 || freightCalculationLoading}
        >
          {freightCalculationLoading ? <CircularProgress size={16} /> : `Save All Freights (${previewFreights.length})`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FreightSelectionDialog;