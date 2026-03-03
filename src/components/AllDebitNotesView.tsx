// src/components/debitCreditNote/AllDebitNotesView.tsx
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Badge,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  Close as CloseIcon,
  PictureAsPdf as PdfIcon,
  Download as DownloadIcon,
  ExpandMore as ExpandMoreIcon,
  Description as DescriptionIcon,
  AttachMoney as MoneyIcon,
  ListAlt as ListIcon,
  CheckCircle as CheckIcon,
  Pending as PendingIcon,
  Receipt as ReceiptIcon,
  Visibility as ViewIcon,
  ArrowBack as BackIcon,
  Summarize as SummaryIcon,
  MonetizationOn as CurrencyIcon,
} from '@mui/icons-material';
import { AppDispatch } from '@/redux/store';
import {
  selectDebitNotesAll,
  selectAllNotes,
  selectItemWiseNotes,
  selectAmountOnlyNotes,
  selectActiveNotes,
  selectClearedNotes,
  selectDocumentInfo,
  selectSummary,
  selectLoading,
  selectError,
  selectPdfDownloading,
  selectPdfError,
  selectDialogOpen,
  selectSelectedNote,
  clearAllDebitNotes,
  setDebitNotesDialogOpen,
  selectDebitNote,
  fetchAllDebitNotes,
  downloadAllDebitNotesPdf,
} from '@/features/debitNotesAllSlice';

// Format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

// Format date
const formatDate = (dateString: string) => {
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

// Format document type
const formatDocumentType = (type: string) => {
  if (!type) return 'N/A';
  return type
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Get status color
const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'active': return 'error';
    case 'cleared': return 'success';
    case 'partially cleared': return 'warning';
    default: return 'default';
  }
};

// Get note type color
const getNoteTypeColor = (noteType: string) => {
  return noteType === 'item_wise' ? 'primary' : 'secondary';
};

interface AllDebitNotesViewProps {
  documentId?: string;
  documentType?: string;
  onClose?: () => void;
  open?: boolean;
}

const AllDebitNotesView: React.FC<AllDebitNotesViewProps> = ({
  documentId,
  documentType,
  onClose,
  open = false,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  
  // Select from Redux store
  const {
    allNotes,
    itemWiseNotes,
    amountOnlyNotes,
    activeNotes,
    clearedNotes,
    documentInfo,
    summary,
    loading,
    error,
    pdfDownloading,
    pdfError,
    dialogOpen,
    selectedNote,
  } = useSelector(selectDebitNotesAll);
  
  // Local state
  const [viewMode, setViewMode] = useState<'summary' | 'details' | 'list'>('summary');
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  
  // Handle open/close
  useEffect(() => {
    if (open && documentId && !loading && allNotes.length === 0) {
      dispatch(fetchAllDebitNotes({ documentId, includeCleared: true, includeActive: true }));
    }
    
    if (!open) {
      handleClose();
    }
  }, [open, documentId, dispatch]);
  
  // Handle dialog open from Redux
  useEffect(() => {
    if (dialogOpen && documentId && !loading && allNotes.length === 0) {
      dispatch(fetchAllDebitNotes({ documentId, includeCleared: true, includeActive: true }));
    }
  }, [dialogOpen, documentId, dispatch]);
  
  const handleClose = () => {
    setViewMode('summary');
    setExpandedNoteId(null);
    dispatch(selectDebitNote(null));
    
    if (onClose) {
      onClose();
    } else {
      dispatch(setDebitNotesDialogOpen(false));
    }
  };
  
  const handleDownloadPdf = () => {
    if (documentInfo?.document_id) {
      dispatch(downloadAllDebitNotesPdf({ documentId: documentInfo.document_id }));
    }
  };
  
  const handleViewNoteDetails = (note: any) => {
    dispatch(selectDebitNote(note));
    setViewMode('details');
  };
  
  const handleBackToList = () => {
    dispatch(selectDebitNote(null));
    setViewMode('list');
  };
  
  const handleBackToSummary = () => {
    dispatch(selectDebitNote(null));
    setViewMode('summary');
  };
  
  const toggleExpandNote = (noteId: string) => {
    setExpandedNoteId(expandedNoteId === noteId ? null : noteId);
  };
  
  // Render note card
  const renderNoteCard = (note: any) => {
    const statusColor = getStatusColor(note.status);
    const noteTypeColor = getNoteTypeColor(note.noteType);
    
    return (
      <Card sx={{ mb: 2, borderLeft: `4px solid ${statusColor === 'error' ? '#f44336' : '#4caf50'}` }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={8}>
              <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                <Chip
                  label={note.noteType === 'item_wise' ? 'Item-wise' : 'Amount-only'}
                  size="small"
                  color={noteTypeColor}
                  icon={note.noteType === 'item_wise' ? <ListIcon /> : <MoneyIcon />}
                />
                <Typography variant="subtitle1" fontWeight="bold">
                  {note.noteId}
                </Typography>
                <Chip
                  label={note.status}
                  size="small"
                  color={statusColor}
                  icon={note.status === 'Cleared' ? <CheckIcon /> : <PendingIcon />}
                />
              </Stack>
              
              <Typography variant="body2" color="textSecondary">
                Created: {formatDate(note.createdDate)} • {note.createdBy}
              </Typography>
              
              {note.reason && (
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  <strong>Reason:</strong> {note.reason}
                </Typography>
              )}
              
              <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                <Typography variant="body2">
                  <strong>Total:</strong> {formatCurrency(note.totalAmount)}
                </Typography>
                <Typography variant="body2" color="error">
                  <strong>Pending:</strong> {formatCurrency(note.pendingAmount)}
                </Typography>
              </Stack>
            </Grid>
            
            <Grid item xs={4} sx={{ textAlign: 'right' }}>
              <Typography variant="h6" color="primary">
                {formatCurrency(note.finalAmount)}
              </Typography>
              
              <Stack direction="row" spacing={0.5} justifyContent="flex-end" sx={{ mt: 1 }}>
                <Tooltip title="View Details">
                  <IconButton size="small" onClick={() => handleViewNoteDetails(note)}>
                    <ViewIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Expand">
                  <IconButton size="small" onClick={() => toggleExpandNote(note.noteId)}>
                    <ExpandMoreIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Grid>
          </Grid>
          
          {expandedNoteId === note.noteId && (
            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
              <Typography variant="body2" color="textSecondary">
                <strong>Document:</strong> {note.documentId}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                <strong>Note Type:</strong> {note.noteType}
              </Typography>
              {note.items && note.items.length > 0 && (
                <Typography variant="body2" color="textSecondary">
                  <strong>Items:</strong> {note.items.length}
                </Typography>
              )}
              {note.paymentHistory && note.paymentHistory.length > 0 && (
                <Typography variant="body2" color="textSecondary">
                  <strong>Payments:</strong> {note.paymentHistory.length}
                </Typography>
              )}
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };
  
  // Render note details
  const renderNoteDetails = () => {
    if (!selectedNote) return null;
    
    const statusColor = getStatusColor(selectedNote.status);
    const noteTypeColor = getNoteTypeColor(selectedNote.noteType);
    
    return (
      <Box>
        {/* Header */}
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Button startIcon={<BackIcon />} onClick={handleBackToList} variant="outlined" size="small">
            Back to List
          </Button>
          
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" fontWeight="bold">
              {selectedNote.noteId}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Document: {selectedNote.documentId} • Type: {formatDocumentType(selectedNote.documentType)}
            </Typography>
          </Box>
          
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip label={selectedNote.noteType === 'item_wise' ? 'Item-wise' : 'Amount-only'} color={noteTypeColor} />
            <Chip label={selectedNote.status} color={statusColor} />
          </Stack>
        </Stack>
        
        {/* Details */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Basic Information
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText primary="Note ID" secondary={selectedNote.noteId} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Document ID" secondary={selectedNote.documentId} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Vendor" secondary={selectedNote.vendorName} />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Created" 
                      secondary={`${formatDate(selectedNote.createdDate)} by ${selectedNote.createdBy}`} 
                    />
                  </ListItem>
                  {selectedNote.reason && (
                    <ListItem>
                      <ListItemText primary="Reason" secondary={selectedNote.reason} />
                    </ListItem>
                  )}
                </List>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Financial Details
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText primary="Total Amount" secondary={formatCurrency(selectedNote.totalAmount)} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Final Amount" secondary={formatCurrency(selectedNote.finalAmount)} />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Pending Amount" 
                      secondary={formatCurrency(selectedNote.pendingAmount)} 
                      secondaryTypographyProps={{ color: 'error' }}
                    />
                  </ListItem>
                  {selectedNote.remainingPayableAmount !== undefined && (
                    <ListItem>
                      <ListItemText 
                        primary="Remaining Payable" 
                        secondary={formatCurrency(selectedNote.remainingPayableAmount)} 
                      />
                    </ListItem>
                  )}
                  {selectedNote.clearedDate && (
                    <ListItem>
                      <ListItemText 
                        primary="Cleared" 
                        secondary={`${formatDate(selectedNote.clearedDate)} by ${selectedNote.clearedBy}`} 
                      />
                    </ListItem>
                  )}
                </List>
              </CardContent>
            </Card>
          </Grid>
          
          {/* Items for item-wise notes */}
          {selectedNote.noteType === 'item_wise' && selectedNote.items && selectedNote.items.length > 0 && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Item Details ({selectedNote.items.length} items)
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: 'grey.50' }}>
                          <TableCell>Item Name</TableCell>
                          <TableCell align="center">Type</TableCell>
                          <TableCell align="right">Quantity</TableCell>
                          <TableCell align="right">Unit Price</TableCell>
                          <TableCell align="right">Total</TableCell>
                          <TableCell align="right">Final</TableCell>
                          <TableCell>Reason</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedNote.items.map((item: any, idx: number) => (
                          <TableRow key={idx} hover>
                            <TableCell>
                              <Typography variant="body2">{item.itemName || 'N/A'}</Typography>
                              <Typography variant="caption" color="textSecondary">ID: {item.itemId}</Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Chip label={item.noteType || 'debit'} size="small" color={item.noteType === 'credit' ? 'error' : 'primary'} />
                            </TableCell>
                            <TableCell align="right">{item.quantity || 0}</TableCell>
                            <TableCell align="right">{formatCurrency(item.unitPrice || 0)}</TableCell>
                            <TableCell align="right">{formatCurrency(item.totalPrice || 0)}</TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" fontWeight="bold">
                                {formatCurrency(item.finalPrice || 0)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" color="textSecondary">{item.reason || '-'}</Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          )}
          
          {/* Payment History */}
          {selectedNote.paymentHistory && selectedNote.paymentHistory.length > 0 && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Payment History ({selectedNote.paymentHistory.length})
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: 'grey.50' }}>
                          <TableCell>Date</TableCell>
                          <TableCell>Outgoing Payment</TableCell>
                          <TableCell>Cleared By</TableCell>
                          <TableCell align="right">Amount</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedNote.paymentHistory.map((payment: any, idx: number) => (
                          <TableRow key={idx} hover>
                            <TableCell>{formatDate(payment.date)}</TableCell>
                            <TableCell>{payment.outgoingPaymentId || '-'}</TableCell>
                            <TableCell>{payment.clearedBy || '-'}</TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" fontWeight="bold">
                                {formatCurrency(payment.amount || 0)}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      </Box>
    );
  };
  
  // Render summary view
  const renderSummaryView = () => {
    if (!summary) return null;
    
    const progressValue = summary.original_amount > 0 
      ? (summary.total_amount / summary.original_amount) * 100 
      : 0;
    
    return (
      <Box>
        {/* Document Info */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Document Information
                </Typography>
                <Typography variant="body2">
                  <strong>ID:</strong> {documentInfo?.document_id}
                </Typography>
                <Typography variant="body2">
                  <strong>Type:</strong> {formatDocumentType(documentInfo?.document_type || '')}
                </Typography>
                <Typography variant="body2">
                  <strong>Vendor:</strong> {documentInfo?.vendor_name}
                </Typography>
                <Typography variant="body2">
                  <strong>Original Amount:</strong> {formatCurrency(documentInfo?.original_amount || 0)}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Quick Actions
                </Typography>
                <Stack spacing={1}>
                  <Button
                    variant="outlined"
                    startIcon={<DescriptionIcon />}
                    onClick={() => setViewMode('list')}
                  >
                    View All Notes ({summary.total_notes})
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<PdfIcon />}
                    onClick={handleDownloadPdf}
                    disabled={pdfDownloading}
                  >
                    {pdfDownloading ? 'Downloading...' : 'Download All PDF'}
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
        
        {/* Summary Statistics */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="primary">
                  {summary.total_notes}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Total Notes
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={6} sm={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="primary">
                  {summary.item_wise_count}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Item-wise
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={6} sm={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="secondary">
                  {summary.amount_only_count}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Amount-only
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={6} sm={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="primary">
                  {formatCurrency(summary.total_amount)}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Total Amount
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        
        {/* Amount Progress */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Amount Utilization
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Stack direction="row" justifyContent="space-between" mb={1}>
                <Typography variant="body2">Original: {formatCurrency(summary.original_amount)}</Typography>
                <Typography variant="body2">Used: {formatCurrency(summary.total_amount)}</Typography>
              </Stack>
              <LinearProgress 
                variant="determinate" 
                value={Math.min(progressValue, 100)} 
                color={progressValue > 80 ? "error" : progressValue > 50 ? "warning" : "primary"}
                sx={{ height: 10, borderRadius: 5 }}
              />
              <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                {progressValue.toFixed(1)}% of original amount used
              </Typography>
            </Box>
            
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body2">
                  <strong>Available:</strong> {formatCurrency(summary.available_for_new_debit)}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="error">
                  <strong>Pending:</strong> {formatCurrency(summary.pending_amount)}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
        
        {/* Recent Notes */}
        {allNotes.length > 0 && (
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Recent Debit Notes ({Math.min(3, allNotes.length)} of {allNotes.length})
              </Typography>
              {allNotes.slice(0, 3).map(note => renderNoteCard(note))}
              {allNotes.length > 3 && (
                <Box sx={{ textAlign: 'center', mt: 2 }}>
                  <Button variant="text" onClick={() => setViewMode('list')}>
                    View All {allNotes.length} Notes
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        )}
      </Box>
    );
  };
  
  // Render list view
  const renderListView = () => {
    return (
      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Typography variant="h6">
            All Debit Notes ({allNotes.length})
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button startIcon={<BackIcon />} onClick={handleBackToSummary} variant="outlined" size="small">
              Back to Summary
            </Button>
            <Button startIcon={<DownloadIcon />} onClick={handleDownloadPdf} variant="contained" size="small">
              Download PDF
            </Button>
          </Stack>
        </Stack>
        
        {/* Filters */}
        <Stack direction="row" spacing={1} sx={{ mb: 3, flexWrap: 'wrap', gap: 1 }}>
          <Chip 
            label={`All (${allNotes.length})`} 
            color="default" 
            variant={viewMode === 'list' ? 'filled' : 'outlined'}
            onClick={() => setViewMode('list')}
          />
          <Chip 
            label={`Item-wise (${itemWiseNotes.length})`} 
            color="primary" 
            variant="outlined"
            onClick={() => setViewMode('list')}
          />
          <Chip 
            label={`Amount-only (${amountOnlyNotes.length})`} 
            color="secondary" 
            variant="outlined"
            onClick={() => setViewMode('list')}
          />
          <Chip 
            label={`Active (${activeNotes.length})`} 
            color="error" 
            variant="outlined"
            onClick={() => setViewMode('list')}
          />
          <Chip 
            label={`Cleared (${clearedNotes.length})`} 
            color="success" 
            variant="outlined"
            onClick={() => setViewMode('list')}
          />
        </Stack>
        
        {/* Notes List */}
        {allNotes.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <DescriptionIcon sx={{ fontSize: 60, color: 'gray', mb: 2 }} />
            <Typography color="textSecondary">No debit notes found</Typography>
          </Box>
        ) : (
          <>
            {allNotes.map(note => renderNoteCard(note))}
            
            {/* Total at bottom */}
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="textSecondary">
                      Total Notes
                    </Typography>
                    <Typography variant="h6">{allNotes.length}</Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="textSecondary">
                      Total Amount
                    </Typography>
                    <Typography variant="h6" color="primary">
                      {formatCurrency(allNotes.reduce((sum, n) => sum + n.finalAmount, 0))}
                    </Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="textSecondary">
                      Pending Amount
                    </Typography>
                    <Typography variant="h6" color="error">
                      {formatCurrency(allNotes.reduce((sum, n) => sum + n.pendingAmount, 0))}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </>
        )}
      </Box>
    );
  };
  
  // Loading state
  if (loading) {
    return (
      <Dialog open={true} maxWidth="md" fullWidth>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
            <CircularProgress />
            <Typography sx={{ mt: 2 }}>Loading debit notes...</Typography>
          </Box>
        </DialogContent>
      </Dialog>
    );
  }
  
  // Error state
  if (error && allNotes.length === 0) {
    return (
      <Dialog open={true} maxWidth="sm" fullWidth onClose={handleClose}>
        <DialogTitle>Error</DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Typography variant="body2">
            Failed to load debit notes for document: {documentId}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  }
  
  return (
    <Dialog
      open={open || dialogOpen}
      onClose={handleClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        sx: {
          maxHeight: '90vh',
          minHeight: '70vh',
        }
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              <ReceiptIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              ALL Debit Notes
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {documentInfo ? (
                <>
                  Document: {documentInfo.document_id} • Type: {formatDocumentType(documentInfo.document_type)}
                  {documentInfo.vendor_name && ` • Vendor: ${documentInfo.vendor_name}`}
                </>
              ) : (
                `Document: ${documentId || 'N/A'}`
              )}
            </Typography>
          </Box>
          <IconButton aria-label="close" onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent dividers>
        {/* PDF Download Error */}
        {pdfError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => dispatch({ type: 'debitNotesAll/clearErrors' })}>
            {pdfError}
          </Alert>
        )}
        
        {/* PDF Download Success */}
        {pdfDownloading && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Downloading PDF...
          </Alert>
        )}
        
        {/* Main Content */}
        {viewMode === 'details' && selectedNote ? (
          renderNoteDetails()
        ) : viewMode === 'list' ? (
          renderListView()
        ) : (
          renderSummaryView()
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={handleClose}>Close</Button>
        {summary && summary.total_notes > 0 && (
          <Button
            variant="contained"
            startIcon={<PdfIcon />}
            onClick={handleDownloadPdf}
            disabled={pdfDownloading}
          >
            Download All PDF
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default AllDebitNotesView;