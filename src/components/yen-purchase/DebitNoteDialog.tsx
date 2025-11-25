import React, { useEffect, useRef } from 'react';
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
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
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

  // Debugging: Log state values
  useEffect(() => {
    console.log('DebitCreditNoteDialog State:', {
      dialogOpen,
      documentId,
      documentType,
      debitCreditNotes,
      loading,
      error,
    });
  }, [dialogOpen, documentId, documentType, debitCreditNotes, loading, error]);

  // Fetch data when dialog opens
  useEffect(() => {
    if (dialogOpen && documentId && documentType && !hasFetched.current) {
      console.log('Fetching debit/credit notes for documentId:', documentId);
      hasFetched.current = true;
      dispatch(fetchDebitCreditNotesByDocument({ documentId, page: 1, size: 50 }));
    }

    return () => {
      if (!dialogOpen) {
        hasFetched.current = false;
      }
    };
  }, [dialogOpen, documentId, documentType, dispatch]);

  const handleDownloadPdf = async (noteId: string) => {
    try {
      console.log('Downloading PDF for noteId:', noteId);
      await downloadPdf(
        `https://yenerp.com/purchaseapi/debitnote/returnprocess/DebitCreditNote/pdf/${noteId}`,
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
  };

  // Calculate totals
  const totals = debitCreditNotes.reduce(
    (acc, note) => {
      note.itemDetails.forEach((item) => {
        acc.totalWithoutTax += item.totalPrice || 0;
        acc.totalTax += (item.sgst || 0) + (item.cgst || 0) + (item.igst || 0);
        acc.totalFinalPrice += item.finalPrice || 0;
        acc.cgst += item.cgst || 0;
        acc.sgst += item.sgst || 0;
        acc.igst += item.igst || 0;
      });
      return acc;
    },
    {
      totalWithoutTax: 0,
      totalTax: 0,
      totalFinalPrice: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
    }
  );

  // Get unique randomId for display
  const displayRandomId = debitCreditNotes.length > 0 ? debitCreditNotes[0]?.randomId || 'N/A' : 'N/A';
  const displayVendorName = debitCreditNotes.length > 0 ? debitCreditNotes[0]?.vendorName || 'Loading...' : 'Loading...';

  return (
    <Dialog open={dialogOpen} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            Credit/Debit Notes for {documentType || 'Unknown'} {displayRandomId}
          </Typography>
          <Box>
            {debitCreditNotes.length > 0 && (
              <Tooltip title="Download PDF">
                <IconButton
                  onClick={() => handleDownloadPdf(debitCreditNotes[0].noteId)}
                  color="primary"
                >
                  <PictureAsPdfIcon />
                </IconButton>
              </Tooltip>
            )}
            <IconButton aria-label="close" onClick={handleClose} sx={{ ml: 1 }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6">
            {documentType || 'Unknown'} ID: {displayRandomId}
          </Typography>
          <Typography variant="h6">
            Vendor Name: {displayVendorName}
          </Typography>
          {displayRandomId === 'N/A' && (
            <Typography color="error" sx={{ mt: 1 }}>
              Warning: Document ID is missing. Please contact support to ensure the document has a valid ID.
            </Typography>
          )}
        </Box>

        <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>
          Details
        </Typography>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>S.No</TableCell>
                <TableCell>Document ID</TableCell>
                <TableCell>Item Name</TableCell>
                <TableCell>Price</TableCell>
                <TableCell>Note Type</TableCell>
                <TableCell>Quantity</TableCell>
                <TableCell>Final Price</TableCell>
                <TableCell>Reason</TableCell>
                {/* <TableCell>Actions</TableCell> */}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <CircularProgress />
                    <Typography>Loading debit/credit notes...</Typography>
                  </TableCell>
                </TableRow>
              ) : debitCreditNotes.length === 0 && !error ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Typography>No credit/debit notes available for this {documentType || 'Unknown'}.</Typography>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Typography color="error">
                      Error: {error}. Please ensure the document has a valid ID or contact support.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                debitCreditNotes.map((note, noteIndex) =>
                  note.itemDetails.map((item, index) => (
                    <TableRow key={`${note.noteId}-${item.itemId}-${index}`}>
                      <TableCell>{noteIndex * note.itemDetails.length + index + 1}</TableCell>
                      <TableCell>{note.randomId || 'N/A'}</TableCell>
                      <TableCell>{item.itemName || 'N/A'}</TableCell>
                      <TableCell>{item.unitPrice?.toFixed(2) || '0.00'}</TableCell>
                      <TableCell>{item.noteType || 'N/A'}</TableCell>
                      <TableCell>{item.quantity || 0}</TableCell>
                      <TableCell>{item.finalPrice?.toFixed(2) || '0.00'}</TableCell>
                      <TableCell>{item.reason || 'N/A'}</TableCell>
                      {/* <TableCell>
                        <Tooltip title="Download PDF">
                          <IconButton
                            onClick={() => handleDownloadPdf(note.noteId)}
                            color="primary"
                          >
                            <PictureAsPdfIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell> */}
                    </TableRow>
                  ))
                )
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {debitCreditNotes.length > 0 && (
          <Box sx={{ mt: 2, textAlign: 'right' }}>
            <Typography>Total Without Tax: {totals.totalWithoutTax.toFixed(2)}</Typography>
            {totals.cgst > 0 && <Typography>CGST: {totals.cgst.toFixed(2)}</Typography>}
            {totals.sgst > 0 && <Typography>SGST: {totals.sgst.toFixed(2)}</Typography>}
            {totals.igst > 0 && <Typography>IGST: {totals.igst.toFixed(2)}</Typography>}
            <Typography variant="h6">
              Total Amount: {totals.totalFinalPrice.toFixed(2)}
            </Typography>
          </Box>
        )}

        {error && (
          <Typography color="error" sx={{ mt: 2 }}>
            Error: {error}
          </Typography>
        )}
        {snackbarOpen && (
          <Typography color="error" sx={{ mt: 2 }}>
            {snackbarMessage}
          </Typography>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DebitCreditNoteDialog;