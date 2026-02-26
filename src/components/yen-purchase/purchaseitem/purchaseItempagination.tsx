'use client';
import React from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';

interface PurchasePaginationProps {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  handlePageChange: (newPage: number) => void;
}

const PurchasePagination: React.FC<PurchasePaginationProps> = ({
  currentPage,
  pageSize,
  totalItems,
  handlePageChange
}) => {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
 <Box
      sx={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        px: 2,
        width: '100%',
      }}
    >      
    <Typography>
        Showing {startItem}-{endItem} of {totalItems} items
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <IconButton
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft />
        </IconButton>
        <Typography sx={{ mx: 2 }}>
          Page {currentPage} of {Math.max(1, Math.ceil(totalItems / pageSize))}
        </Typography>
        <IconButton
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage >= Math.ceil(totalItems / pageSize)}
        >
          <ChevronRight />
        </IconButton>
      </Box>
    </Box>
  );
};

export default PurchasePagination;