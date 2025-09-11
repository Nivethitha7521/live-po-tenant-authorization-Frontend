import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchDebitCreditNotesByGrn } from '../../../features/yen-purchase/GRN/grnSlice';
import { AppDispatch, RootState } from '@/redux/store';
import { Dialog, DialogContent, DialogTitle, TableHead, TableRow, TableCell, TableBody, TableContainer, Table, IconButton, Typography, Box, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { useDownloadPdf } from '../../../hooks/useDowloadPdf';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';

interface GrnDebitDialogProps {
  grnId: string;
  open: boolean;
  onClose: () => void;
}

const GrnDebitDialog: React.FC<GrnDebitDialogProps> = ({ grnId, open, onClose }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { debitCreditNotes, grns, loading, error, snackbarOpenGRN, snackbarMessageGRN } = useSelector((state: RootState) => state.grn);
  const hasFetched = useRef(false);
  const { downloadPdf } = useDownloadPdf();
 const [isFullScreen, setIsFullScreen] = useState(false);
  useEffect(() => {
    if (open && grnId && !hasFetched.current) {
      const hasNotes = debitCreditNotes.some((note) => note.grnId === grnId);
      if (!hasNotes) {
        hasFetched.current = true;
        dispatch(fetchDebitCreditNotesByGrn({ grnId, page: 1, size: 50 }));
      }
    }
    return () => {
      if (!open) {
        hasFetched.current = false;
      }
    };
  }, [open, grnId, dispatch, debitCreditNotes]);

  useEffect(() => {
    console.log('debitCreditNotes:', debitCreditNotes); // Debug state
  }, [debitCreditNotes]);
const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };
  const handleDownloadPdf = async (noteId: string) => {
    try {
      await downloadPdf(`http://192.168.29.116:8000/purchaseapi/grns/returnprocess/DebitCreditNote/pdf/${noteId}`, `DebitCreditNote_${noteId}.pdf`);
    } catch (error) {
      console.error('Error downloading PDF:', error);
    }
  };

  const totals = debitCreditNotes.reduce(
    (acc, note) => {
      note.itemDetails.forEach((item) => {
        acc.totalWithoutTax += item.totalPrice || 0;
        acc.totalTax += item.taxAmount || 0;
        acc.totalFinalPrice += item.finalPrice || 0;
        if (item.cgst) acc.cgst += item.cgst;
        if (item.sgst) acc.sgst += item.sgst;
        if (item.igst) acc.igst += item.igst;
      });
      return acc;
    },
    { totalWithoutTax: 0, totalTax: 0, totalFinalPrice: 0, cgst: 0, sgst: 0, igst: 0 }
  );

  const randomId = debitCreditNotes[0]?.randomId || grnId;
  const displayVendorName = debitCreditNotes[0]?.vendorName || 'Loading...';

  return (
    <Dialog open={open} onClose={onClose}    fullScreen={isFullScreen}
          container={document.body} // Always render in document.body
          disablePortal={false} // Use portal to break out of parent containers
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
          }}>
      <DialogTitle sx={{
            fontWeight: 'bold',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: isFullScreen ? '16px 24px' : '16px' // Adjust padding for fullscreen
          }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Credit/Debit Notes for GRN {randomId}</Typography>
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
            
            <IconButton
              aria-label="close"
              onClick={onClose}
              sx={{ ml: 1 }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
        
      </DialogTitle>
      <DialogContent sx={{
            padding: isFullScreen ? '0 24px' : '20px', // Adjust content padding
            height: isFullScreen ? 'calc(100vh - 120px)' : 'auto', // Account for header/footer height
            overflow: 'auto'
          }}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6">GRN ID: {randomId}</Typography>
          <Typography variant="h6">Vendor Name: {displayVendorName}</Typography>
            <IconButton onClick={toggleFullScreen} color="primary" edge="end">
              {isFullScreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton>
        </Box>
        
        <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>Details</Typography>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>S.No</TableCell>
                <TableCell>Item Name</TableCell>
                <TableCell>Price</TableCell>
                <TableCell>Note Type</TableCell>
                <TableCell>Quantity</TableCell>
                <TableCell>Final Price</TableCell>
                <TableCell>Reason</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {debitCreditNotes.map((note) =>
                note.itemDetails.map((item, index) => (
                  <TableRow key={`${note.noteId}-${item.itemId}`}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{item.itemName || 'N/A'}</TableCell>
                    <TableCell>{item.unitPrice || 0}</TableCell>
                    <TableCell>{item.noteType || 'N/A'}</TableCell>
                    <TableCell>{item.quantity || 0}</TableCell>
                    <TableCell>{item.finalPrice ? item.finalPrice.toFixed(2) : '0.00'}</TableCell>
                    <TableCell>{item.reason || 'N/A'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {debitCreditNotes.length > 0 && (
          <Box sx={{ mt: 1, textAlign: 'right' }}>
            <Typography>Without Tax: {totals.totalWithoutTax.toFixed(2)}</Typography>
            {totals.cgst > 0 && <Typography>CGST: {totals.cgst.toFixed(2)}</Typography>}
            {totals.sgst > 0 && <Typography>SGST: {totals.sgst.toFixed(2)}</Typography>}
            {totals.igst > 0 && <Typography>IGST: {totals.igst.toFixed(2)}</Typography>}
            <Typography variant="h6">Total Amount: {totals.totalFinalPrice.toFixed(2)}</Typography>
          </Box>
        )}

        {loading && <Typography>Loading...</Typography>}
        {!loading && debitCreditNotes.length === 0 && !error && (
          <Typography>No credit/debit notes available for this GRN.</Typography>
        )}
        {error && <Typography color="error">Error: {error}</Typography>}
        {snackbarOpenGRN && <Typography color="error">{snackbarMessageGRN}</Typography>}
      </DialogContent>
    </Dialog>
  );
};

export default GrnDebitDialog;