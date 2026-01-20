"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Typography,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Paper,
  Snackbar,
  Box,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  IconButton,
  CircularProgress,
} from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { returnGrn, fetchGrns, setSelectedGrnId, fetchReturnReasons, addReturnReason, setSnackbarMessageGRN, setSnackbarOpenGRN } from '../../../features/yen-purchase/GRN/grnSlice';
import { ReturnGRNRequest, ItemDetail, ReturnReason } from '@/Models/grnModel';
import { AppDispatch, RootState } from '@/redux/store';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';

interface EditedItem {
  returnedQuantity: number;
  nos: number;
  eachQuantity: number;
  returnReason: string;
  customReason: string;
}

interface GrnReturnDialogProps {
  dialogItems: ItemDetail[];
  selectedGrnId: string | null;
  currentPage: number;
  pageSize: number;
  status?: string;
  fromDate?: string | undefined;
  toDate?: string | undefined;
  onReturnComplete: () => void;
  onCancel: () => void;
}

const GrnReturnDialog: React.FC<GrnReturnDialogProps> = ({
  dialogItems,
  selectedGrnId,
  currentPage,
  pageSize,
  status,
  fromDate,
  toDate,
  onReturnComplete,
  onCancel,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { returnReasons, snackbarMessageGRN, snackbarOpenGRN, loading } = useSelector((state: RootState) => state.grn);
  const [dialogOpen, setDialogOpen] = useState(true);
  const [dialogReturnOpen, setDialogReturnOpen] = useState(false);
  const [returnScenario, setReturnScenario] = useState<'full' | 'partial' | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [selectedItemsForReturn, setSelectedItemsForReturn] = useState<Set<string>>(new Set());
  const [editedItems, setEditedItems] = useState<{ [itemId: string]: EditedItem }>({});
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // Local loading state for submission

  // Filter out "Other" option - only use dropdown reasons
  const dropdownReasons = returnReasons.filter(r => r.reason !== 'Other');

  const customRound = (value: number): number => {
    return Math.round(value * 100) / 100;
  };

  const getMaxReturnable = (item: ItemDetail): number => {
    return customRound((item.receivedQuantity || 0) - (item.returnedQuantity || 0));
  };

  const calculateItemTotal = (item: ItemDetail, returnedQuantity: number): number => {
    return customRound(returnedQuantity * (item.unitPrice || 0));
  };

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  // Calculate nos and eachQuantity based on returnedQuantity
  const calculateNosAndEachQuantity = (item: ItemDetail, returnedQuantity: number): { nos: number; eachQuantity: number } => {
    const maxReturnable = getMaxReturnable(item);
    const originalEachQuantity = item.eachQuantity || 1;
    const originalNos = item.nos || 0;

    if (returnedQuantity <= 0) {
      return { nos: 0, eachQuantity: originalEachQuantity };
    }

    if (returnedQuantity >= maxReturnable) {
      return { nos: originalNos, eachQuantity: originalEachQuantity };
    }

    // Prioritize maintaining original eachQuantity
    let nos = Math.floor(returnedQuantity / originalEachQuantity);
    let eachQuantity = originalEachQuantity;
    let remaining = returnedQuantity % originalEachQuantity;

    if (remaining > 0) {
      eachQuantity = customRound(returnedQuantity / (nos + 1));
      nos = Math.ceil(returnedQuantity / eachQuantity);
    }

    return { nos: customRound(nos), eachQuantity: customRound(eachQuantity) };
  };

  // Fetch return reasons only once on mount
  useEffect(() => {
    if (returnReasons.length === 0) {
      dispatch(fetchReturnReasons());
    }
  }, [dispatch, returnReasons.length]);

  // Handle changes to returnedQuantity or returnReason
  const handleEditReturn = (itemId: string, field: string, value: number | string) => {
    const dialogItem = dialogItems.find((i) => i.itemId === itemId);
    if (!dialogItem) return;

    const maxReturnable = getMaxReturnable(dialogItem);

    if (field === 'returnedQuantity') {
      const enteredQuantity = Number(value);
      if (enteredQuantity > maxReturnable) {
        // Use setTimeout to defer dispatch calls outside of render cycle
        setTimeout(() => {
          dispatch(setSnackbarMessageGRN(`Cannot return more than ${maxReturnable} units for ${dialogItem.itemName ?? 'this item'}.`));
          dispatch(setSnackbarOpenGRN(true));
        }, 0);
        return;
      }
    }

    setEditedItems((prev) => {
      const existingItem = prev[itemId] || {
        returnedQuantity: 0,
        nos: 0,
        eachQuantity: dialogItem.eachQuantity || 1,
        returnReason: '',
        customReason: '',
      };

      let updatedItem = { ...existingItem };

      if (field === 'returnedQuantity') {
        const enteredQuantity = Number(value);
        const { nos, eachQuantity } = calculateNosAndEachQuantity(dialogItem, enteredQuantity);
        updatedItem = { ...updatedItem, returnedQuantity: customRound(enteredQuantity), nos, eachQuantity };
      } else if (field === 'returnReason') {
        updatedItem = { ...updatedItem, returnReason: String(value) };
      }

      return { ...prev, [itemId]: updatedItem };
    });

    if (returnScenario === 'partial' && field === 'returnedQuantity') {
      setSelectedItemsForReturn((prev) => new Set(prev).add(itemId));
    }
  };

  const handleCheckboxChange = (itemId: string) => {
    setSelectedItemsForReturn((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
        setEditedItems((prev) => {
          const { [itemId]: _, ...rest } = prev;
          return rest;
        });
      } else {
        newSet.add(itemId);
        const dialogItem = dialogItems.find((i) => i.itemId === itemId);
        if (dialogItem && !editedItems[itemId]) {
          setEditedItems((prev) => ({
            ...prev,
            [itemId]: {
              returnedQuantity: 0,
              nos: 0,
              eachQuantity: dialogItem.eachQuantity || 1,
              returnReason: '',
              customReason: '',
            },
          }));
        }
      }
      return newSet;
    });
  };

  const handleReturnClick = (scenario: 'full' | 'partial') => {
    // Clear previous selections when switching scenarios
    setReturnReason('');
    setCustomReason('');
    setSelectedItemsForReturn(new Set());
    setEditedItems({});
    
    setReturnScenario(scenario);
  };

  const handleClearSelections = () => {
    // Clear all selections and reset to initial state
    setReturnReason('');
    setCustomReason('');
    setSelectedItemsForReturn(new Set());
    setEditedItems({});
    setReturnScenario(null); // Reset scenario to enable both buttons
  };

  const handleSubmit = async () => {
    if (!selectedGrnId) {
      dispatch(setSnackbarMessageGRN('No GRN selected to return.'));
      dispatch(setSnackbarOpenGRN(true));
      return;
    }

    if (!returnScenario) {
      dispatch(setSnackbarMessageGRN('Please select a return scenario.'));
      dispatch(setSnackbarOpenGRN(true));
      return;
    }

    if (returnScenario === 'full' && !returnReason.trim()) {
      dispatch(setSnackbarMessageGRN("Please provide a return reason for 'Return All'."));
      dispatch(setSnackbarOpenGRN(true));
      return;
    }

    if (returnScenario === 'partial') {
      if (selectedItemsForReturn.size === 0) {
        dispatch(setSnackbarMessageGRN('Please select at least one item to return.'));
        dispatch(setSnackbarOpenGRN(true));
        return;
      }

      const missingReasons = Array.from(selectedItemsForReturn).filter(
        (itemId) => !editedItems[itemId]?.returnReason?.trim()
      );
      if (missingReasons.length > 0) {
        dispatch(setSnackbarMessageGRN('Please provide a return reason for all selected items.'));
        dispatch(setSnackbarOpenGRN(true));
        return;
      }

      const invalidQuantities = Array.from(selectedItemsForReturn).filter(
        (itemId) => editedItems[itemId]?.returnedQuantity <= 0
      );
      if (invalidQuantities.length > 0) {
        dispatch(setSnackbarMessageGRN('Invalid quantities detected. Ensure return quantity is greater than 0.'));
        dispatch(setSnackbarOpenGRN(true));
        return;
      }
    }

    setDialogReturnOpen(true);
  };

  const handleDialogClose = () => {
    if (!isSubmitting) {
      setDialogOpen(false);
      onCancel();
    }
  };

  const handleReturnCancel = () => {
    if (!isSubmitting) {
      setDialogReturnOpen(false);
    }
  };

  const handleReturn = async () => {
    if (!selectedGrnId || isSubmitting) {
      return;
    }

    setIsSubmitting(true); // Start submission - this disables buttons immediately

    const returnData: ReturnGRNRequest = {
      scenario: returnScenario!,
      returnedDate: new Date().toISOString(),
      returnedBy: 'user123', // Replace with actual user ID
      comments: returnReason,
      items: returnScenario === 'partial'
        ? Array.from(selectedItemsForReturn).map((itemId) => {
            const edited = editedItems[itemId];
            return {
              itemId,
              nos: edited.nos,
              eachQuantity: edited.eachQuantity,
              returnedQuantity: edited.returnedQuantity,
              returnReason: edited.returnReason,
            };
          })
        : dialogItems.map((item) => {
            const maxReturnable = getMaxReturnable(item);
            const { nos, eachQuantity } = calculateNosAndEachQuantity(item, maxReturnable);
            return {
              itemId: item.itemId,
              nos,
              eachQuantity,
              returnedQuantity: maxReturnable,
              returnReason: returnReason,
            };
          }),
    };

    try {
      const resultAction = await dispatch(returnGrn({ grnId: selectedGrnId, returnData })).unwrap();
      dispatch(setSnackbarMessageGRN('Items returned successfully.'));
      dispatch(setSnackbarOpenGRN(true));
      const fromDateObj = fromDate ? new Date(fromDate) : undefined;
      const toDateObj = toDate ? new Date(toDate) : undefined;
      await dispatch(
        fetchGrns({ page: currentPage, size: pageSize, status, fromDate: fromDateObj, toDate: toDateObj })
      );
      setDialogOpen(false);
      setDialogReturnOpen(false);
      setSelectedItemsForReturn(new Set());
      setReturnReason('');
      setCustomReason('');
      setEditedItems({});
      setReturnScenario(null);
      dispatch(setSelectedGrnId(null));
      onReturnComplete();
    } catch (error) {
      dispatch(setSnackbarMessageGRN('Failed to return items. Please try again.'));
      dispatch(setSnackbarOpenGRN(true));
      console.error('Error returning items:', error);
    } finally {
      setIsSubmitting(false); // End submission
    }
  };

  // Combined loading state
  const isLoading = loading || isSubmitting;

  return (
    <>
      <Dialog
        open={dialogOpen}
        onClose={handleDialogClose}
        disableEscapeKeyDown
        maxWidth={false}
        fullWidth={true}
        fullScreen={isFullScreen}
        container={document.body}
        disablePortal={false}
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
          padding: isFullScreen ? '16px 24px' : '16px'
        }}>
          GRN Return Details
          <IconButton onClick={toggleFullScreen} color="primary" edge="end" disabled={isLoading}>
            {isFullScreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{
          padding: isFullScreen ? '0 24px' : '20px',
          height: isFullScreen ? 'calc(100vh - 120px)' : 'auto',
          overflow: 'auto'
        }}>
          <Typography variant="h6" gutterBottom>
            Select a return option below.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, mb: 2, flexWrap: 'wrap', maxWidth: '100%' }}>
            <FormControl sx={{ flex: 2, minWidth: 150 }}>
              <InputLabel>Return Reason (for Return All)</InputLabel>
              <Select
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                disabled={returnScenario !== 'full' || isLoading}
              >
                {dropdownReasons.map((reasonObj) => (
                  <MenuItem key={reasonObj.reason} value={reasonObj.reason}>
                    {reasonObj.reason}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="contained"
              color="primary"
              onClick={() => handleReturnClick('full')}
              disabled={Boolean(returnScenario && returnScenario !== 'full') || isLoading}
              sx={{ flex: 1, minWidth: 120 }}
            >
              Return GRN
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={() => handleReturnClick('partial')}
              disabled={Boolean(returnScenario && returnScenario !== 'partial') || isLoading}
              sx={{ flex: 1, minWidth: 120 }}
            >
              Return Specific Items
            </Button>
          </Box>
          <TableContainer component={Paper}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Item</TableCell>
                  <TableCell>Received Quantity</TableCell>
                  <TableCell>Returned Quantity</TableCell>
                  <TableCell>Returnable Quantity</TableCell>
                  <TableCell>Return Quantity</TableCell>
                  <TableCell>Nos</TableCell>
                  <TableCell>Each Quantity</TableCell>
                  <TableCell>Return Reason</TableCell>
                  <TableCell>Unit Price</TableCell>
                  <TableCell>Total Price</TableCell>
                  <TableCell>Select</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dialogItems.map((item) => {
                  const maxReturnable = getMaxReturnable(item);
                  const edited = editedItems[item.itemId] || {
                    returnedQuantity: 0,
                    nos: 0,
                    eachQuantity: item.eachQuantity || 1,
                    returnReason: '',
                    customReason: '',
                  };
                  const totalPrice = calculateItemTotal(item, edited.returnedQuantity);
                  const isDisabled = returnScenario === 'full' || !selectedItemsForReturn.has(item.itemId) || isLoading;
                  return (
                    <TableRow key={item.itemId}>
                      <TableCell>{item.itemName ?? 'Unknown Item'}</TableCell>
                      <TableCell>{customRound(item.receivedQuantity || 0)}</TableCell>
                      <TableCell>{customRound(item.returnedQuantity || 0)}</TableCell>
                      <TableCell>{customRound(maxReturnable)}</TableCell>
                      <TableCell>
                        <TextField
                          type="number"
                          value={edited.returnedQuantity}
                          onChange={(e) => handleEditReturn(item.itemId, 'returnedQuantity', Number(e.target.value))}
                          variant="outlined"
                          fullWidth
                          inputProps={{ min: 0, step: 0.01 }}
                          disabled={isDisabled}
                          placeholder="Enter return quantity"
                          autoComplete="off"
                        />
                      </TableCell>
                      <TableCell>{customRound(edited.nos)}</TableCell>
                      <TableCell>{customRound(edited.eachQuantity)}</TableCell>
                      <TableCell>
                        <FormControl fullWidth>
                          <InputLabel>Return Reason</InputLabel>
                          <Select
                            value={edited.returnReason}
                            onChange={(e) => handleEditReturn(item.itemId, 'returnReason', e.target.value)}
                            disabled={isDisabled}
                          >
                            {dropdownReasons.map((reasonObj) => (
                              <MenuItem key={reasonObj.reason} value={reasonObj.reason}>
                                {reasonObj.reason}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>{customRound(item.unitPrice || 0)}</TableCell>
                      <TableCell>{customRound(totalPrice)}</TableCell>
                      <TableCell>
                        <Checkbox
                          checked={selectedItemsForReturn.has(item.itemId)}
                          onChange={() => handleCheckboxChange(item.itemId)}
                          disabled={returnScenario !== 'partial' || maxReturnable <= 0 || isLoading}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose} color="secondary" variant='outlined' disabled={isLoading}>
            Cancel
          </Button>
          {returnScenario && (
            <Button onClick={handleClearSelections} color="warning" variant="outlined" disabled={isLoading}>
              Clear
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            color="primary"
            variant="outlined"
            disabled={!returnScenario || !selectedGrnId || isLoading}
          >
            {isLoading ? 'Submitting...' : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog - Buttons disabled immediately when submitting */}
      <Dialog 
        open={dialogReturnOpen} 
        onClose={!isSubmitting ? handleReturnCancel : undefined} // Prevent closing when submitting
        disableEscapeKeyDown={isSubmitting}
      >
        <DialogTitle>Confirm GRN Return</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {returnScenario === 'full'
              ? `Are you sure you want to return all items for this GRN? Reason: ${returnReason || 'Not provided'}`
              : `Are you sure you want to return the selected items with specified quantities?`}
          </DialogContentText>
          {returnScenario === 'partial' && (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Item</TableCell>
                    <TableCell>Return Quantity</TableCell>
                    <TableCell>Nos</TableCell>
                    <TableCell>Each Quantity</TableCell>
                    <TableCell>Return Reason</TableCell>
                    <TableCell>Total Price</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Array.from(selectedItemsForReturn).map((itemId) => {
                    const item = dialogItems.find((i) => i.itemId === itemId);
                    const edited = editedItems[itemId];
                    const maxReturnable = getMaxReturnable(item!);
                    const status = edited.returnedQuantity >= maxReturnable ? 'Fully Returned' : 'Partially Returned';
                    return (
                      <TableRow key={itemId}>
                        <TableCell>{item?.itemName ?? 'Unknown Item'}</TableCell>
                        <TableCell>{customRound(edited.returnedQuantity)}</TableCell>
                        <TableCell>{customRound(edited.nos)}</TableCell>
                        <TableCell>{customRound(edited.eachQuantity)}</TableCell>
                        <TableCell>{edited.returnReason}</TableCell>
                        <TableCell>{customRound(calculateItemTotal(item!, edited.returnedQuantity))}</TableCell>
                        <TableCell>{status}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleReturnCancel} 
            color="secondary" 
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleReturn} 
            color="primary" 
            variant="contained"
            disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={20} /> : null}
          >
            {isSubmitting ? 'Processing...' : 'Confirm Return'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbarOpenGRN}
        message={snackbarMessageGRN}
        autoHideDuration={3000}
        onClose={() => dispatch(setSnackbarOpenGRN(false))}
      />
    </>
  );
};

export default GrnReturnDialog;