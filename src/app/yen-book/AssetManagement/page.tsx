"use client";

import React, { useState } from 'react';
import AssetForm from '../../../components/AssetForm';
import AssetList from '../../../components/AssetList';
import AssetFilter from '../../../components/AssetFilter';
import CSVImportExport from '../../../components/CSVImportExport';
import { Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions, Grid } from '@mui/material';
import YenBookPage from '../page';

const AssetManagement: React.FC = () => {
  const [isFormVisible, setFormVisible] = useState(false);

  const handleAddAssetClick = () => {
    setFormVisible(true);
  };

  const handleClose = () => {
    setFormVisible(false);
  };

  return (
    <Box sx={{ p: 3 }}>
    <YenBookPage />
      <Typography variant="h4" gutterBottom>
        Asset Management
      </Typography>
      
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={12} md={8}>
          <AssetFilter />
        </Grid>
        <Grid item xs={12} md={2}>
          <Button variant="contained" color="primary" onClick={handleAddAssetClick}>
            Add Asset
          </Button>
        </Grid>
        <Grid item xs={12} md={2}>
          <CSVImportExport />
        </Grid>
      </Grid>
      
      <Dialog open={isFormVisible} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>Add Asset</DialogTitle>
        <DialogContent>
          <AssetForm />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="secondary">
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
      
      <AssetList />
    </Box>
  );
};

export default AssetManagement;
