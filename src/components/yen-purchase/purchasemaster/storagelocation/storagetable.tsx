'use client';
import React, { useState } from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  IconButton
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import ConfirmationDialog from '@/components/confirmationDialog';
import { StorageLocationItem } from '@/Models/storagelocation';

interface StorageLocationTableProps {
  items: StorageLocationItem[];
  handleEdit: (index: string) => void;
  handleDeactivate: (id: string) => void;
  handleActivate: (id: string) => void;
}

const StorageLocationTable: React.FC<StorageLocationTableProps> = ({
  items, handleEdit, handleDeactivate, handleActivate
}) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'deactivate' | 'activate' | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleOpenDialog = (action: 'deactivate' | 'activate', id: string) => {
    setConfirmAction(action);
    setSelectedId(id);
    setConfirmOpen(true);  // Open dialog
  };

  const handleCloseDialog: () => void = () => {
    setConfirmOpen(false); // Close dialog
    setConfirmAction(null);
    setSelectedId(null);
  };

  const handleConfirmAction = () => {
    if (confirmAction === 'deactivate' && selectedId) {
      handleDeactivate(selectedId);
    } else if (confirmAction === 'activate' && selectedId) {
      handleActivate(selectedId);
    }
    handleCloseDialog();
  };

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
        <Table
          stickyHeader
          sx={{
            tableLayout: 'fixed', // Fixes column widths to prevent overflow
            width: '100%',
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell>S.No</TableCell>
              <TableCell>Location Id</TableCell>
              <TableCell>Location Name</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align='center'>
                  No Storage Location Data
                </TableCell>
              </TableRow>
            ) : (
              items.map((loc, index) => (
                <TableRow key={loc.storageLocationId}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{loc.randomId}</TableCell>
                  <TableCell>{loc.locationName}</TableCell>
                  <TableCell>{loc.status}</TableCell>
                  <TableCell>
                    {loc.status === 'active' ? (
                      <>
                        <IconButton onClick={() => handleEdit(loc.storageLocationId)}>
                          <EditIcon />
                        </IconButton>
                        <IconButton onClick={() => handleOpenDialog('deactivate', loc.storageLocationId)}>
                          <DeleteIcon />
                        </IconButton>
                      </>
                    ) : (
                      <IconButton onClick={() => handleOpenDialog('activate', loc.storageLocationId)}>
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
        open={confirmOpen}
        onClose={handleCloseDialog}
        onConfirm={handleConfirmAction}
        title={confirmAction === 'deactivate' ? 'Confirm Deactivation' : 'Confirm Activation'}
        description={
          confirmAction === 'deactivate'
            ? 'Are you sure you want to deactivate this storage location?'
            : 'Are you sure you want to activate this storage location?'
        }
        confirmText={confirmAction === 'deactivate' ? 'Deactivate' : 'Activate'}
        cancelText="Cancel"
      />

    </>
  );
};

export default StorageLocationTable;
