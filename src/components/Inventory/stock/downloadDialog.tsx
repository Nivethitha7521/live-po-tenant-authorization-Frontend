import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from "@mui/material";

export interface DownloadDialogProps {
  open: boolean;
  onClose: () => void;
  onDownloadPDF: () => void;
  onDownloadCSV: () => void;
}

const DownloadDialog: React.FC<DownloadDialogProps> = ({
  open,
  onClose,
  onDownloadPDF,
  onDownloadCSV,
}) => {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Download Options</DialogTitle>
      <DialogContent>
        <Typography>Choose a download format:</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onDownloadPDF}>PDF</Button>
        <Button onClick={onDownloadCSV}>Excel/CSV</Button>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
};

export default DownloadDialog;