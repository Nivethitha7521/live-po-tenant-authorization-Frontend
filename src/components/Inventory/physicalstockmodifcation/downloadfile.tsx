import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import TableChartIcon from "@mui/icons-material/TableChart";


interface DownloadDialogProps {
  open: boolean;
  onClose: () => void;
  onDownloadCSV: () => void;
  onDownloadPDF: () => void;
}

const DownloadDialog: React.FC<DownloadDialogProps> = ({
  open,
  onClose,
  onDownloadCSV,
  onDownloadPDF,
}) => {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Select Download Format</DialogTitle>
      <DialogContent>
        <Typography>Select the format to download full  updated stocks:</Typography>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onDownloadCSV}
          color="primary"
          startIcon={<TableChartIcon />} // CSV icon
        >
          Download CSV
        </Button>
        <Button
          onClick={onDownloadPDF}
          color="primary"
          startIcon={<PictureAsPdfIcon />} // PDF icon
        >
          Download PDF
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
};

export default DownloadDialog;
