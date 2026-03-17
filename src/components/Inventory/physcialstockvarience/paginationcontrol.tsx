
'use client';

import React, { useState } from "react";
import { Box, Typography } from "@mui/material";
import ConfirmDialog from "../physcialstockvarience/confirmDailog";

interface PaginationControlsProps {
  currentPage: number;
  totalItems: number;
  totalPages: number;
  loading: boolean;
  onSaveChanges: () => void;
  changesLength: number;
  isFullScreen: boolean;
}

const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalItems,
  totalPages,
  onSaveChanges,
  changesLength,
  isFullScreen,
}) => {
  const [openDialog, setOpenDialog] = useState(false);

  const handleDialogClose = (confirm: boolean) => {
    setOpenDialog(false);
    if (confirm) {
      onSaveChanges();
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: 5,
        p: 2,
        borderTop: isFullScreen ? "1px solid #e0e0e0" : "none",
        backgroundColor: isFullScreen ? "#ffffff" : "inherit",
        position: isFullScreen ? "fixed" : "static", 
        bottom: isFullScreen ? 0 : "auto",
        left: 0,
        right: 0,
        zIndex: isFullScreen ? 11000 : 1000,
        width: "100%",
        boxShadow: isFullScreen ? "0 -2px 5px rgba(0,0,0,0.1)" : "none", 
      }}
    >
      <Typography variant="body2" sx={{ color: "#666" }}>
        Showing {(currentPage - 1) * 30 + 1}–
        {Math.min(currentPage * 30, totalItems)} of {totalItems} items (Page{" "}
        {currentPage} of {totalPages})
      </Typography>

      <ConfirmDialog
        open={openDialog}
        totalItems={totalItems}
        changesLength={changesLength}
        onClose={handleDialogClose} fullScreen={false} />
    </Box>
  );
};

export default PaginationControls;