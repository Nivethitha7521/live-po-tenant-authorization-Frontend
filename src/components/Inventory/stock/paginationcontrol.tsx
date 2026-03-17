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
  onSubmitClick,
}) => {
  return (
    <Box
      sx={{
        p: 2,
        borderTop: "1px solid #e0e0e0",
        bgcolor: "#fff",
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <Typography variant="body2" sx={{ color: "#666" }}>
        Showing {startItem}–{endItem} of {totalItems} items (Page {currentPage} of {totalPages})
      </Typography>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Button variant="contained" onClick={onSubmitClick} sx={{ ml: 2 }}>
          Submit
        </Button>
      </Box>
    </Box>
  );
};

export default PaginationControls;
