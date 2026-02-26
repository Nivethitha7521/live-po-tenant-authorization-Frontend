import React, { ChangeEvent } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setFilters } from '../features/assetSlice';
import { RootState, AppDispatch } from '../redux/store';
import { Box, TextField, Grid } from '@mui/material';

const AssetFilter: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const filters = useSelector((state: RootState) => state.assets.filters);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    dispatch(setFilters({ [e.target.name]: e.target.value }));
  };

  return (
    <Box sx={{ p: 2 }}>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <TextField fullWidth label="Asset Name" name="assetName" value={filters.assetName} onChange={handleChange} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField fullWidth label="Asset Type" name="assetType" value={filters.assetType} onChange={handleChange} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField fullWidth label="Department" name="department" value={filters.department} onChange={handleChange} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField fullWidth label="Location" name="location" value={filters.location} onChange={handleChange} />
        </Grid>
      </Grid>
    </Box>
  );
};

export default AssetFilter;
