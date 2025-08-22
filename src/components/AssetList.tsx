import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { deleteAsset } from '../features/assetSlice';
import { RootState, AppDispatch } from '../redux/store';
import { Box, Typography, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, Paper, Button } from '@mui/material';

const AssetList: React.FC = () => {
  const assets = useSelector((state: RootState) => state.assets.assets);
  const dispatch = useDispatch<AppDispatch>();

  const handleDelete = (id: string) => {
    dispatch(deleteAsset(id));
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6">Asset List</Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Asset Name</TableCell>
              <TableCell>Asset Type</TableCell>
              <TableCell>Department</TableCell>
              <TableCell>Location</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {assets.map(asset => (
              <TableRow key={asset.id}>
                <TableCell>{asset.assetName}</TableCell>
                <TableCell>{asset.assetType}</TableCell>
                <TableCell>{asset.department}</TableCell>
                <TableCell>{asset.location}</TableCell>
                <TableCell>
                  <Button onClick={() => handleDelete(asset.id)} variant="contained" color="secondary">Delete</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default AssetList;
