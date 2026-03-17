import React from "react";
import { Snackbar, Alert } from "@mui/material";

export interface FeedbackSnackbarProps {
  open: boolean;
  message: string;
  onClose: (event?: React.SyntheticEvent | Event, reason?: string) => void;
}

const FeedbackSnackbar: React.FC<FeedbackSnackbarProps> = ({ open, message, onClose }) => {
  return (
    <Snackbar
      open={open}
      autoHideDuration={2000}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      sx={{ ml: "50px" }} 
    >
      <Alert
        onClose={onClose}
        severity="info"
        sx={{
          width: "100%",
          bgcolor: "primary.main",
          color: "primary.contrastText",
        }}
      >
        {message}
      </Alert>
    </Snackbar>
  );
};

export default FeedbackSnackbar;
