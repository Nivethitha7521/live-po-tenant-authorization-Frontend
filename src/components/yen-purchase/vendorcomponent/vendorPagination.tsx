'use client';
import React from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';

interface VendorPaginationProps {
  currentPage: number;
  totalVendors: number;
  pageSize: number;
  handlePageChange: (newPage: number) => void;
}

const VendorPagination: React.FC<VendorPaginationProps> = ({ currentPage, totalVendors, pageSize, handlePageChange }) => {
  const totalPages = Math.max(1, Math.ceil(totalVendors / pageSize));

  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
      <IconButton
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage === 1}
        size="small"
      >
        <ChevronLeft />
      </IconButton>
      <Typography variant="body2" sx={{ mx: 2 }}>
        Page {currentPage} of {totalPages}
      </Typography>
      <IconButton
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        size="small"
      >
        <ChevronRight />
      </IconButton>
    </Box>
  );
};

export default VendorPagination;