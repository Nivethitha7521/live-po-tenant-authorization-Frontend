'use client';
import React, { useState } from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  IconButton, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Button,
  Box
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { Freight } from '../../../../Models/freightModel';

interface FreightTableProps {
  items: Freight[];
  loading: boolean;
  handleEdit: (id: string) => void;
  handleDeactivate: (id: string) => void;
  handleActivate: (id: string) => void;
}

const FreightTable: React.FC<FreightTableProps> = ({
  items, loading, handleEdit, handleDeactivate, handleActivate
}) => {
  const [openDialog, setOpenDialog] = useState(false);
  const [actionType, setActionType] = useState<'deactivate' | 'activate' | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const handleOpenDialog = (itemId: string, action: 'deactivate' | 'activate') => {
    setSelectedItemId(itemId);
    setActionType(action);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedItemId(null);
    setActionType(null);
  };

  const handleConfirmAction = () => {
    if (actionType === 'deactivate' && selectedItemId) {
      handleDeactivate(selectedItemId);
    } else if (actionType === 'activate' && selectedItemId) {
      handleActivate(selectedItemId);
    }
    handleCloseDialog();
  };

  return (
    <Box>
      <TableContainer
        component={Paper}
        sx={{
          maxHeight: 'calc(100vh - 200px)', // Dynamic height based on viewport
          overflowY: 'auto',
          width: '100%',
        }}
      >       
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell className='table-number-right'>S.No</TableCell>
              <TableCell>Freight ID</TableCell>
              <TableCell>Freight</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center">Loading...</TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">No Freight</TableCell>
              </TableRow>
            ) : (
              // Reverse the items to make it Last-In-First-Out
              items.slice().reverse().map((item, index) => (
                <TableRow key={item.randomId}>
                  <TableCell className='table-number-right'>{index + 1}</TableCell>
                  <TableCell>{item.randomId}</TableCell>
                  <TableCell>{item.freightName}</TableCell>
                  <TableCell>{item.status}</TableCell>
                  <TableCell>
                    {item.status === 'active' ? (
                      <>
                        <IconButton onClick={() => handleEdit(item.freightId)}>
                          <EditIcon />
                        </IconButton>
                        <IconButton onClick={() => handleOpenDialog(item.freightId, 'deactivate')}>
                          <DeleteIcon />
                        </IconButton>
                      </>
                    ) : (
                      <IconButton onClick={() => handleOpenDialog(item.freightId, 'activate')}>
                        <RefreshIcon />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Confirmation Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog}>
        <DialogTitle>
          {actionType === 'deactivate' ? 'Confirm Deactivation' : 'Confirm Activation'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {actionType === 'deactivate'
              ? 'Are you sure you want to deactivate this freight?'
              : 'Are you sure you want to activate this freight?'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleConfirmAction} color="primary">
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FreightTable;