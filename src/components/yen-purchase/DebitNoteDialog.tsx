import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Table,
  IconButton,
  Typography,
  Box,
  Tooltip,
  CircularProgress,
  Paper,
  Chip,
  Divider,
  Card,
  CardContent,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DescriptionIcon from '@mui/icons-material/Description';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import { AppDispatch, RootState } from '@/redux/store';
import {
  selectDebitCreditNote,
  fetchDebitCreditNotesByDocument,
  clearDebitCreditNotes,
  setDebitCreditDialogOpen,
} from '@/features/yen-purchase/DebitNoteSlice';
import { useDownloadPdf } from '@/hooks/useDowloadPdf';

const DebitCreditNoteDialog: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const {
    debitCreditNotes,
    documentId,
    documentType,
    dialogOpen,
    loading,
    error,
    snackbarOpen,
    snackbarMessage,
  } = useSelector(selectDebitCreditNote);
  const hasFetched = useRef(false);
  const { downloadPdf } = useDownloadPdf();
  const [expandedNote, setExpandedNote] = useState<string | null>(null);

  // Debugging: Log state values
  useEffect(() => {
    console.log('DebitCreditNoteDialog State:', {
      dialogOpen,
      documentId,
      documentType,
      debitCreditNotesCount: debitCreditNotes.length,
      debitCreditNotes: debitCreditNotes,
      loading,
      error,
    });
  }, [dialogOpen, documentId, documentType, debitCreditNotes, loading, error]);

  // Fetch data when dialog opens
  useEffect(() => {
    if (dialogOpen && documentId && !hasFetched.current) {
      console.log('Fetching debit/credit notes for documentId:', documentId);
      hasFetched.current = true;
      dispatch(fetchDebitCreditNotesByDocument({ 
        documentId, 
        page: 1, 
        size: 50 
      }));
    }

    return () => {
      if (!dialogOpen) {
        hasFetched.current = false;
      }
    };
  }, [dialogOpen, documentId, dispatch]);

  const handleDownloadPdf = async (noteId: string) => {
    try {
      console.log('Downloading PDF for noteId:', noteId);
      await downloadPdf(
        `http://192.168.29.116:8000/purchasetestapi/debitnote/returnprocess/DebitCreditNote/pdf/${noteId}`,
        `DebitCreditNote_${noteId}.pdf`
      );
    } catch (error) {
      console.error('Error downloading PDF:', error);
    }
  };

  const handleClose = () => {
    console.log('Closing DebitCreditNoteDialog');
    dispatch(setDebitCreditDialogOpen(false));
    dispatch(clearDebitCreditNotes());
    setExpandedNote(null);
  };

  const handleExpandNote = (noteId: string) => {
    setExpandedNote(expandedNote === noteId ? null : noteId);
  };

  // Calculate totals for all notes with null checking
  const totals = debitCreditNotes.reduce(
    (acc, note) => {
      if (!note) return acc; // Skip if note is undefined/null
      
      const isAmountOnly = note.isAmountOnly || note.noteType === 'amount_only';
      
      if (isAmountOnly) {
        // Amount-only note
        acc.totalAmount += note.totalAmount || note.debitAmount || 0;
        acc.finalAmount += note.finalAmount || note.totalAmount || note.debitAmount || 0;
        acc.amountOnlyNotes += 1;
      } else {
        // Item-wise note
        if (note.itemDetails && Array.isArray(note.itemDetails)) {
          note.itemDetails.forEach((item: any) => {
            acc.totalAmount += item.totalPrice || 0;
            acc.totalTax += item.taxAmount || 0;
            acc.finalAmount += item.finalPrice || 0;
            acc.itemWiseNotes += 1;
          });
        }
      }
      return acc;
    },
    {
      totalAmount: 0,
      totalTax: 0,
      finalAmount: 0,
      amountOnlyNotes: 0,
      itemWiseNotes: 0,
    }
  );

  // Format date for display with null checking
  const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return dateString;
    }
  };

  // Get document info with null checking
  const documentInfo = debitCreditNotes.length > 0 ? {
    randomId: debitCreditNotes[0]?.randomId || 'N/A',
    vendorName: debitCreditNotes[0]?.vendorName || 'Loading...',
    noteId: debitCreditNotes[0]?.noteId || debitCreditNotes[0]?._id || 'N/A',
    documentType: debitCreditNotes[0]?.documentType || documentType,
  } : null;

  // Safe accessor functions
  const getNoteId = (note: any) => note?.noteId || note?._id || 'unknown';
  const getNoteType = (note: any) => note?.isAmountOnly || note?.noteType === 'amount_only';
  const getTotalAmount = (note: any, isAmountOnly: boolean) => {
    if (!note) return 0;
    return isAmountOnly ? 
      (note.totalAmount || note.debitAmount || 0) : 
      (note.finalAmount || 0);
  };
  const getStatus = (note: any) => note?.status || 'Active';
  const getCreatedBy = (note: any) => note?.createdBy || 'Unknown';
  const getCreatedDate = (note: any) => note?.createdDate || '';
  const getDocumentType = (note: any) => note?.documentType || 'Unknown';
  const getReason = (note: any) => note?.reason || '';
  const getRemainingPayableAmount = (note: any) => note?.remainingPayableAmount;
  const getSourceDocument = (note: any) => note?.sourceDocument;
  const getItemDetails = (note: any) => note?.itemDetails || [];
  const getTotalTax = (note: any) => note?.totalTax || 0;
  const getTotalDiscount = (note: any) => note?.totalDiscount || 0;

  return (
    <Dialog 
      open={dialogOpen} 
      onClose={handleClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: {
          maxHeight: '90vh',
        }
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Debit/Credit Notes
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Document: {documentInfo?.randomId || 'N/A'} | Vendor: {documentInfo?.vendorName || 'N/A'}
            </Typography>
          </Box>
          <Box>
            {debitCreditNotes.length > 0 && documentInfo?.noteId && (
              <Tooltip title="Download PDF for all notes">
                <IconButton
                  onClick={() => handleDownloadPdf(documentInfo.noteId)}
                  color="primary"
                  size="small"
                >
                  <PictureAsPdfIcon />
                </IconButton>
              </Tooltip>
            )}
            <IconButton 
              aria-label="close" 
              onClick={handleClose} 
              sx={{ ml: 1 }}
              size="small"
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>
      
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 4 }}>
            <CircularProgress />
            <Typography sx={{ mt: 2 }}>Loading debit/credit notes...</Typography>
          </Box>
        ) : error ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="error" variant="body1">
              Error: {error}
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              Unable to fetch debit/credit notes. Please try again.
            </Typography>
          </Box>
        ) : debitCreditNotes.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <DescriptionIcon sx={{ fontSize: 60, color: 'gray', mb: 2 }} />
            <Typography variant="h6" color="textSecondary">
              No Debit/Credit Notes Found
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              There are no debit/credit notes available for this document.
            </Typography>
          </Box>
        ) : (
          <>
            {/* Summary Stats */}
            <Card sx={{ mb: 3, bgcolor: 'background.default' }}>
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="textSecondary">
                      Total Notes
                    </Typography>
                    <Typography variant="h6">
                      {debitCreditNotes.length}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="textSecondary">
                      Item-wise Notes
                    </Typography>
                    <Typography variant="h6">
                      {totals.itemWiseNotes}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="textSecondary">
                      Amount-only Notes
                    </Typography>
                    <Typography variant="h6">
                      {totals.amountOnlyNotes}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="textSecondary">
                      Total Amount
                    </Typography>
                    <Typography variant="h6" color="primary">
                      ₹{totals.finalAmount.toFixed(2)}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Notes List */}
            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold' }}>
              All Notes ({debitCreditNotes.length})
            </Typography>

            {debitCreditNotes.map((note, index) => {
              if (!note) return null; // Skip undefined/null notes
              
              const noteId = getNoteId(note);
              const isAmountOnly = getNoteType(note);
              const isExpanded = expandedNote === noteId;
              const noteTotalAmount = getTotalAmount(note, isAmountOnly);
              const status = getStatus(note);
              const createdDate = getCreatedDate(note);
              const createdBy = getCreatedBy(note);
              const docType = getDocumentType(note);
              const reason = getReason(note);
              const remainingPayableAmount = getRemainingPayableAmount(note);
              const sourceDocument = getSourceDocument(note);
              const itemDetails = getItemDetails(note);
              const totalTax = getTotalTax(note);
              const totalDiscount = getTotalDiscount(note);

              return (
                <Accordion
                  key={noteId}
                  expanded={isExpanded}
                  onChange={() => handleExpandNote(noteId)}
                  sx={{ mb: 2 }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                        {isAmountOnly ? (
                          <MonetizationOnIcon color="primary" sx={{ mr: 2 }} />
                        ) : (
                          <DescriptionIcon color="secondary" sx={{ mr: 2 }} />
                        )}
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                            {noteId || `Note ${index + 1}`}
                            <Chip
                              label={isAmountOnly ? 'Amount-only' : 'Item-wise'}
                              size="small"
                              color={isAmountOnly ? 'primary' : 'secondary'}
                              sx={{ ml: 1, fontSize: '0.7rem' }}
                            />
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            Created: {formatDate(createdDate)} | 
                            Status: <Chip label={status} size="small" color="success" sx={{ ml: 0.5 }} />
                          </Typography>
                        </Box>
                      </Box>
                      <Typography variant="h6" color="primary" sx={{ mr: 2 }}>
                        ₹{noteTotalAmount.toFixed(2)}
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  
                  <AccordionDetails>
                    {isAmountOnly ? (
                      // Amount-only Note Details
                      <Box>
                        <Grid container spacing={2}>
                          <Grid item xs={6}>
                            <Typography variant="body2">
                              <strong>Note ID:</strong> {noteId}
                            </Typography>
                            <Typography variant="body2">
                              <strong>Document Type:</strong> {docType}
                            </Typography>
                            <Typography variant="body2">
                              <strong>Created By:</strong> {createdBy}
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="body2">
                              <strong>Total Amount:</strong> ₹{noteTotalAmount.toFixed(2)}
                            </Typography>
                            {reason && (
                              <Typography variant="body2">
                                <strong>Reason:</strong> {reason}
                              </Typography>
                            )}
                            {remainingPayableAmount !== undefined && (
                              <Typography variant="body2">
                                <strong>Remaining Payable:</strong> ₹{remainingPayableAmount.toFixed(2)}
                              </Typography>
                            )}
                          </Grid>
                        </Grid>
                        
                        {sourceDocument && (
                          <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>
                              Source Document Info:
                            </Typography>
                            <Typography variant="body2">
                              Original Payable: ₹{sourceDocument?.originalPayableAmount?.toFixed(2) || '0.00'} | 
                              Existing Notes: {sourceDocument?.existingDebitNotesCount || 0}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    ) : (
                      // Item-wise Note Details
                      <Box>
                        <Typography variant="subtitle2" sx={{ mb: 2 }}>
                          Item Details
                        </Typography>
                        
                        {itemDetails.length > 0 ? (
                          <>
                            <TableContainer component={Paper} variant="outlined">
                              <Table size="small">
                                <TableHead>
                                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                                    <TableCell>Item Name</TableCell>
                                    <TableCell align="center">Type</TableCell>
                                    <TableCell align="right">Quantity</TableCell>
                                    <TableCell align="right">Unit Price</TableCell>
                                    <TableCell align="right">Total Price</TableCell>
                                    <TableCell align="right">Tax</TableCell>
                                    <TableCell align="right">Final Price</TableCell>
                                    <TableCell>Reason</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {itemDetails.map((item: any, idx: number) => (
                                    <TableRow key={idx}>
                                      <TableCell>{item?.itemName || 'N/A'}</TableCell>
                                      <TableCell align="center">
                                        <Chip 
                                          label={item?.noteType || 'debit'} 
                                          size="small"
                                          color={item?.noteType === 'credit' ? 'error' : 'primary'}
                                        />
                                      </TableCell>
                                      <TableCell align="right">{item?.quantity || 0}</TableCell>
                                      <TableCell align="right">₹{item?.unitPrice?.toFixed(2) || '0.00'}</TableCell>
                                      <TableCell align="right">₹{item?.totalPrice?.toFixed(2) || '0.00'}</TableCell>
                                      <TableCell align="right">₹{item?.taxAmount?.toFixed(2) || '0.00'}</TableCell>
                                      <TableCell align="right">₹{item?.finalPrice?.toFixed(2) || '0.00'}</TableCell>
                                      <TableCell>{item?.reason || 'N/A'}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                            
                            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="body2">
                                <strong>Note Summary:</strong> 
                                Items: {itemDetails.length} | 
                                Total Tax: ₹{totalTax.toFixed(2)} | 
                                Discount: ₹{totalDiscount.toFixed(2)}
                              </Typography>
                              <Typography variant="h6" color="primary">
                                Net Amount: ₹{noteTotalAmount.toFixed(2)}
                              </Typography>
                            </Box>
                          </>
                        ) : (
                          <Typography variant="body2" color="textSecondary">
                            No item details available.
                          </Typography>
                        )}
                      </Box>
                    )}
                    
                    <Divider sx={{ my: 2 }} />
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" color="textSecondary">
                        Note ID: {note?._id || 'N/A'}
                      </Typography>
                      <Box>
                        <Tooltip title="Download PDF for this note">
                          <IconButton
                            onClick={() => handleDownloadPdf(noteId)}
                            size="small"
                            color="primary"
                            disabled={!noteId || noteId === 'unknown'}
                          >
                            <PictureAsPdfIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  </AccordionDetails>
                </Accordion>
              );
            })}

            {/* Grand Total */}
            <Card sx={{ mt: 3, border: '2px solid', borderColor: 'primary.main' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    Grand Total
                  </Typography>
                  <Typography variant="h4" color="primary" sx={{ fontWeight: 'bold' }}>
                    ₹{totals.finalAmount.toFixed(2)}
                  </Typography>
                </Box>
                <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                  {totals.itemWiseNotes} item-wise notes + {totals.amountOnlyNotes} amount-only notes
                </Typography>
              </CardContent>
            </Card>
          </>
        )}

        {snackbarOpen && (
          <Typography color="error" sx={{ mt: 2, textAlign: 'center' }}>
            {snackbarMessage}
          </Typography>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DebitCreditNoteDialog;