"use client";
import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Backdrop,
} from "@mui/material";

interface FinalConfirmDialogProps {
  open: boolean;
  totalItems: number;
  changesLength: number;
  onClose: () => void;
  onConfirm: () => Promise<void> | void; // allow async if needed
}

const FinalConfirmDialog: React.FC<FinalConfirmDialogProps> = ({
  open,
  totalItems,
  changesLength,
  onClose,
  onConfirm,
}) => {
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm(); // in case onConfirm is async
    } finally {
      setConfirming(false); // remove this if you want to keep button disabled after confirm
    }
  };

  return (
    <>
      {/* Blur the background when dialog is open */}
      <div
        style={{
          filter: open ? "blur(4px)" : "none",
          transition: "filter 0.3s",
        }}
      >
        {/* This represents the rest of your app */}
      </div>

      <Dialog open={open} onClose={onClose}>
        <DialogTitle>Final Confirmation</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You are about to update {changesLength} items out of {totalItems}.
            <br />
            <br />
            Are you definitely sure you want to update? Do you want to proceed?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} color="primary" disabled={confirming}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            color="primary"
            disabled={confirming} // disable after click
          >
            {confirming ? "Processing..." : "Confirm"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default FinalConfirmDialog;
