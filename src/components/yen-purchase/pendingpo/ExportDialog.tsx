import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DescriptionIcon from '@mui/icons-material/Description';

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  onExportCSV: () => void;
  onGeneratePDF: () => void;
}

const ExportDialog: React.FC<ExportDialogProps> = ({ open, onClose, onExportCSV, onGeneratePDF }) => {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Select Export Format</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Choose whether you want to download the report as an Excel (CSV) file or generate a PDF.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onExportCSV} variant="contained" color="primary" startIcon={<DescriptionIcon />}>
          Download CSV
        </Button>
        <Button onClick={onGeneratePDF} variant="contained" color="secondary" startIcon={<PictureAsPdfIcon />}>
          Generate PDF
        </Button>
        <Button onClick={onClose} variant="outlined">Cancel</Button>
      </DialogActions>
    </Dialog>
  );
};

export default React.memo(ExportDialog);