// Separate Pagination Component - ServicePagination.tsx
'use client';
import React from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';

interface ServicePaginationProps {
  currentPage: number;
  totalPages: number;
  handlePageChange: (newPage: number) => void;
}

const ServicePagination: React.FC<ServicePaginationProps> = ({ currentPage, totalPages, handlePageChange }) => {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mt: 2, pb: 2 }}>
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

export default ServicePagination;