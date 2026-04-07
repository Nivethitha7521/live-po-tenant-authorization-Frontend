import React from 'react';
import { Button, Box } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAssets } from '../features/assetSlice';
import { RootState, AppDispatch } from '../redux/store';
import { importCsv, exportCsv } from '../utilities/csvUtils';

const CSVImportExport: React.FC = () => {
  const assets = useSelector((state: RootState) => state.assets.assets);
  const dispatch = useDispatch<AppDispatch>();

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      importCsv(file, (data) => {
        dispatch(fetchAssets(data));
      });
    }
  };

  const handleExport = () => {
    const headers = [
      { label: 'Asset Name', key: 'assetName' },
      { label: 'Asset Type', key: 'assetType' },
      { label: 'Description', key: 'description' },
      { label: 'Acquisition Date', key: 'acquisitionDate' },
      { label: 'Purchase Price', key: 'purchasePrice' },
      { label: 'Supplier', key: 'supplier' },
      { label: 'Location', key: 'location' },
      { label: 'Department', key: 'department' },
      { label: 'Condition', key: 'condition' },
      { label: 'Warranty Period', key: 'warrantyPeriod' },
      { label: 'Depreciation Method', key: 'depreciationMethod' },
      { label: 'Depreciation Rate', key: 'depreciationRate' },
      { label: 'Useful Life', key: 'usefulLife' },
      { label: 'Salvage Value', key: 'salvageValue' },
      { label: 'Serial Number', key: 'serialNumber' },
    ];
    exportCsv(assets, headers, 'assets.csv');
  };

  return (
    <Box sx={{ display: 'flex', gap: 2 }}>
      <Button variant="contained" component="label">
        Import CSV
        <input type="file" accept=".csv" hidden onChange={handleImport} />
      </Button>
      <Button variant="contained" onClick={handleExport}>
        Export CSV
      </Button>
    </Box>
  );
};

export default CSVImportExport;
