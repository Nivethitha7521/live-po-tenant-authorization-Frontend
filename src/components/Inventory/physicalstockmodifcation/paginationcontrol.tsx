"use client";
import React from "react";
import { Box, Typography, Button } from "@mui/material";

interface PaginationControlsProps {
  currentPage: number;
  totalItems: number;
  totalPages: number;
  hasMoreData: boolean;
  loading: boolean;
  startItem: number;
  endItem: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onSubmitClick: () => void;
}

const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalItems,
  totalPages,
  startItem,
  endItem,
  loading,
  onSubmitClick,
}) => {
  const isInitialLoading = totalItems === 0 && loading;

  return (
    <Box
      sx={{
        p: 2,
        bgcolor: "#ffffff",
        borderTop: "1px solid #e0e0e0",
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: 2,
      }}
    >
      {/* Info text */}
      <Typography variant="body2" sx={{ color: "#666" }}>
        {isInitialLoading
          ? "Loading items..."
          : `Showing ${startItem}–${endItem} of ${totalItems} items (Page ${currentPage} of ${totalPages})`}
      </Typography>

      {/* Actions */}
      <Button
        onClick={onSubmitClick}
        variant="contained"
        color="primary"
        disabled={isInitialLoading}
      >
        Submit
      </Button>
    </Box>
  );
};

export default React.memo(PaginationControls);
