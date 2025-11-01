'use client';
import React, { useState } from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  IconButton, Button,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import ConfirmationDialog from '@/components/confirmationDialog';
import { PurchaseItemType } from '@/Models/itemType';

interface ItemTypeTableProps {
  items: PurchaseItemType[];
  showDeactivated: boolean;
  handleEdit: (index: string) => void;
  handleDeactivate: (id: string) => void;
  handleActivate: (id: string) => void;
}

const ItemTypeTable: React.FC<ItemTypeTableProps> = ({
  items, showDeactivated, handleEdit, handleDeactivate, handleActivate
}) => {
  const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
  const [dialogAction, setDialogAction] = useState<'deactivate' | 'activate' | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const handleOpenConfirmDialog = (itemId: string, action: 'deactivate' | 'activate') => {
    setSelectedItemId(itemId);
    setDialogAction(action);
    setOpenConfirmDialog(true);
  };

  const handleCloseConfirmDialog = () => {
    setOpenConfirmDialog(false);
    setSelectedItemId(null);
    setDialogAction(null);
  };

  const handleConfirmAction = () => {
    if (dialogAction === 'deactivate' && selectedItemId) {
      handleDeactivate(selectedItemId);
    } else if (dialogAction === 'activate' && selectedItemId) {
      handleActivate(selectedItemId);
    }
    handleCloseConfirmDialog();
  };

  const reversedItems = [...items].reverse();

  return (
    <>
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
              <TableCell>Item Type ID</TableCell>
              <TableCell>Item Type Name</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {reversedItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align='center'>
                  No ItemType Data
                </TableCell>
              </TableRow>
            ) : (
              reversedItems.map((item, index) => (
                <TableRow key={item.itemtypeId || index}>
                  <TableCell className='table-number-right'>{index + 1}</TableCell>
                  <TableCell>{item.randomId}</TableCell>
                  <TableCell>{item.itemtypeName}</TableCell>
                  <TableCell>{item.status}</TableCell>
                  <TableCell>
                    {!showDeactivated && item.status === 'active' && (
                      <IconButton onClick={() => handleEdit(item.itemtypeId)}>
                        <EditIcon />
                      </IconButton>
                    )}
                    {item.status === 'active' && !showDeactivated ? (
                      <IconButton onClick={() => handleOpenConfirmDialog(item.itemtypeId, 'deactivate')}>
                        <DeleteIcon />
                      </IconButton>
                    ) : (
                      <IconButton onClick={() => handleOpenConfirmDialog(item.itemtypeId, 'activate')}>
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

      <ConfirmationDialog
        open={openConfirmDialog}
        onClose={handleCloseConfirmDialog}
        onConfirm={handleConfirmAction}
        title={dialogAction === 'deactivate' ? 'Confirm Deactivation' : 'Confirm Activation'}
        description={dialogAction === 'deactivate'
          ? 'Are you sure you want to deactivate this purchase item type?'
          : 'Are you sure you want to activate this purchase item type?'}
        confirmText={'Confirm'}
        cancelText={'Cancel'} />
    </>
  );
};

export default ItemTypeTable;
