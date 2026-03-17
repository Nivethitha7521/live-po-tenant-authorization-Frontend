"use client";
import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogActions,
  Button,
  Divider,
  Box,
} from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import GridOnIcon from "@mui/icons-material/GridOn";

interface DownloadDialogProps {
  open: boolean;
  onClose: () => void;
  onDownloadPDF: () => Promise<void> | void;
  onDownloadExcel: () => Promise<void> | void;
}

const DownloadDialog: React.FC<DownloadDialogProps> = ({
  open,
  onClose,
  onDownloadPDF,
  onDownloadExcel,
}) => {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async (type: "pdf" | "excel") => {
    setDownloading(true);
    try {
      if (type === "pdf") await onDownloadPDF();
      else await onDownloadExcel();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      BackdropProps={{
        sx: {
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          backgroundColor: "rgba(0,0,0,0.25)",
        },
      }}
      PaperProps={{
        sx: {
          width: 400,
          maxWidth: "90%",
          borderRadius: 3,
          overflow: "hidden",
          bgcolor: "rgba(255,255,255,0.8)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          p: 3,
        },
      }}
    >
      <DialogTitle sx={{ textAlign: "center", fontWeight: 800 }}>
        Download Stock Ledger
      </DialogTitle>

      <Divider sx={{ mb: 2 }} />

      <Box sx={{ display: "flex", justifyContent: "center", gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<PictureAsPdfIcon />}
          onClick={() => handleDownload("pdf")}
          disabled={downloading}
          sx={{ borderRadius: 2, px: 4 }}
        >
          PDF
        </Button>
        <Button
          variant="contained"
          startIcon={<GridOnIcon />}
          onClick={() => handleDownload("excel")}
          disabled={downloading}
          sx={{ borderRadius: 2, px: 4 }}
        >
          Excel
        </Button>
      </Box>

      <DialogActions sx={{ justifyContent: "center", mt: 3 }}>
        <Button
          onClick={onClose}
          variant="outlined"
          sx={{ borderRadius: 2 }}
          disabled={downloading}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DownloadDialog;