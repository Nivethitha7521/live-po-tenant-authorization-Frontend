'use client';
import React, { useState } from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  IconButton, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Button,
  Box
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { PurchaseGroupItem } from '@/Models/itemgroup';

interface ItemGroupTableProps {
  items: PurchaseGroupItem[];
  loading: boolean;
  handleEdit: (id: string) => void;
  handleDeactivate: (id: string) => void;
  handleActivate: (id: string) => void;
}

const ItemGroupTable: React.FC<ItemGroupTableProps> = ({
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
              <TableCell>S.No</TableCell>
              <TableCell>Item Group ID</TableCell>
              <TableCell>Item Group</TableCell>
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
                <TableCell colSpan={5} align="center">No Item Group</TableCell>
              </TableRow>
            ) : (
              // Reverse the items to make it Last-In-First-Out
              items.slice().reverse().map((item, index) => (
                <TableRow key={item.randomId}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{item.randomId}</TableCell>
                  <TableCell>{item.itemgroupName}</TableCell>
                  <TableCell>{item.status}</TableCell>
                  <TableCell>
                    {item.status === 'active' ? (
                      <>
            <IconButton onClick={() => handleEdit(item.itemgroupId)}>
            <EditIcon />
                        </IconButton>
                        <IconButton onClick={() => handleOpenDialog(item.itemgroupId, 'deactivate')}>
                          <DeleteIcon />
                        </IconButton>
                      </>
                    ) : (
                      <IconButton onClick={() => handleOpenDialog(item.itemgroupId, 'activate')}>
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
              ? 'Are you sure you want to deactivate this item group?'
              : 'Are you sure you want to activate this item group?'}
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

export default ItemGroupTable;
