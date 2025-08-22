import React, { useState, ChangeEvent, FormEvent } from 'react';
import { useDispatch } from 'react-redux';
import { addAsset, updateAsset } from '../features/assetSlice';
import { AppDispatch } from '../redux/store';
import { Box, TextField, Button, Grid } from '@mui/material';

interface AssetFormProps {
  asset?: {
    id: string;
    assetName: string;
    assetType: string;
    description: string;
    acquisitionDate: string;
    purchasePrice: string;
    supplier: string;
    location: string;
    department: string;
    condition: string;
    warrantyPeriod: string;
    depreciationMethod: string;
    depreciationRate: string;
    usefulLife: string;
    salvageValue: string;
    serialNumber: string;
  };
}

const AssetForm: React.FC<AssetFormProps> = ({ asset }) => {
  const [formData, setFormData] = useState({
    assetName: asset?.assetName || '',
    assetType: asset?.assetType || '',
    description: asset?.description || '',
    acquisitionDate: asset?.acquisitionDate || '',
    purchasePrice: asset?.purchasePrice || '',
    supplier: asset?.supplier || '',
    location: asset?.location || '',
    department: asset?.department || '',
    condition: asset?.condition || '',
    warrantyPeriod: asset?.warrantyPeriod || '',
    depreciationMethod: asset?.depreciationMethod || '',
    depreciationRate: asset?.depreciationRate || '',
    usefulLife: asset?.usefulLife || '',
    salvageValue: asset?.salvageValue || '',
    serialNumber: asset?.serialNumber || '',
  });

  const dispatch = useDispatch<AppDispatch>();

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (asset) {
      dispatch(updateAsset({ ...formData, id: asset.id }));
    } else {
      dispatch(addAsset({ ...formData, id: new Date().getTime().toString() }));
    }
    setFormData({
      assetName: '',
      assetType: '',
      description: '',
      acquisitionDate: '',
      purchasePrice: '',
      supplier: '',
      location: '',
      department: '',
      condition: '',
      warrantyPeriod: '',
      depreciationMethod: '',
      depreciationRate: '',
      usefulLife: '',
      salvageValue: '',
      serialNumber: '',
    });
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ p: 2 }}>
      <Grid container spacing={2}>
        {/* First Row */}
        <Grid item xs={12} sm={6}>
          <TextField fullWidth label="Asset Name" name="assetName" value={formData.assetName} onChange={handleChange} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField fullWidth label="Asset Type" name="assetType" value={formData.assetType} onChange={handleChange} />
        </Grid>
        <Grid item xs={12}>
          <TextField fullWidth label="Description" name="description" value={formData.description} onChange={handleChange} />
        </Grid>

        {/* Second Row */}
        <Grid item xs={12} sm={6}>
          <TextField fullWidth label="Acquisition Date" name="acquisitionDate" type="date" value={formData.acquisitionDate} onChange={handleChange} InputLabelProps={{ shrink: true }} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField fullWidth label="Purchase Price" name="purchasePrice" value={formData.purchasePrice} onChange={handleChange} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField fullWidth label="Supplier" name="supplier" value={formData.supplier} onChange={handleChange} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField fullWidth label="Location" name="location" value={formData.location} onChange={handleChange} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField fullWidth label="Department" name="department" value={formData.department} onChange={handleChange} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField fullWidth label="Condition" name="condition" value={formData.condition} onChange={handleChange} />
        </Grid>

        {/* Third Row */}
        <Grid item xs={12} sm={6}>
          <TextField fullWidth label="Warranty Period" name="warrantyPeriod" value={formData.warrantyPeriod} onChange={handleChange} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField fullWidth label="Depreciation Method" name="depreciationMethod" value={formData.depreciationMethod} onChange={handleChange} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField fullWidth label="Depreciation Rate" name="depreciationRate" value={formData.depreciationRate} onChange={handleChange} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField fullWidth label="Useful Life" name="usefulLife" value={formData.usefulLife} onChange={handleChange} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField fullWidth label="Salvage Value" name="salvageValue" value={formData.salvageValue} onChange={handleChange} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField fullWidth label="Serial Number" name="serialNumber" value={formData.serialNumber} onChange={handleChange} />
        </Grid>

        <Grid item xs={12}>
          <Button type="submit" variant="contained" color="primary">{asset ? 'Update Asset' : 'Add Asset'}</Button>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AssetForm;
