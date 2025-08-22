'use client';
import React from 'react';
import {
  Grid, TextField, IconButton, Box, Typography
} from '@mui/material';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import ClearIcon from '@mui/icons-material/Clear';

interface PurchaseFiltersProps {
  itemName: string;
  category: string;
  subcategory: string;
  setItemName: (value: string) => void;
  setCategory: (value: string) => void;
  setSubcategory: (value: string) => void;
  handleFilter: () => void;
  handleClearFilters: () => void;
}

const PurchaseFilters: React.FC<PurchaseFiltersProps> = ({
  itemName,
  category,
  subcategory,
  setItemName,
  setCategory,
  setSubcategory,
  handleFilter,
  handleClearFilters
}) => {
  const handleClear = () => {
    // Reset all filter fields to empty strings
    setItemName('');
    setCategory('');
    setSubcategory('');
    // Trigger the parent clear filters handler
    handleClearFilters();
  };

  return (
    <Grid container spacing={1} mt={1} ml={1} alignItems="center">
      <Grid item xs={12} md={2}>
        <TextField
          autoComplete='off'
          label="Item Name"
          variant="outlined"
          fullWidth
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
        />
      </Grid>
      <Grid item xs={12} md={2}>
        <TextField
          autoComplete='off'
          label="Category"
          variant="outlined"
          fullWidth
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
      </Grid>
      <Grid item xs={12} md={2}>
        <TextField
          label="Subcategory"
          variant="outlined"
          fullWidth
          value={subcategory}
          onChange={(e) => setSubcategory(e.target.value)}
        />
      </Grid>
      <Grid item xs={12} md={1}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <IconButton
            color="primary"
            className='icon-button-outline'
            onClick={handleFilter}
          >
            <FilterAltIcon />
          </IconButton>
          <Typography
            variant="caption"
            align="center"
            sx={{
              maxWidth: 60,
              wordBreak: 'break-word',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            Filter
          </Typography>
        </Box>
      </Grid>
      <Grid item xs={12} md={1}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <IconButton
            className='icon-button-outline'
            color="primary"
            onClick={handleClear}
          >
            <ClearIcon />
          </IconButton>
          <Typography
            variant="caption"
            align="center"
            sx={{
              maxWidth: 60,
              wordBreak: 'break-word',
              display: '-webkit-box',
              WebkitLineClamp: 1,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            Clear Filters
          </Typography>
        </Box>
      </Grid>
    </Grid>
  );
};

export default PurchaseFilters;