'use client';
import React, { useState } from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  IconButton, Tooltip
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import ConfirmationDialog from '@/components/confirmationDialog';
import { PurchaseSubcategory } from '@/Models/purchasesubcategory';

interface PurchaseSubcategoryTableProps {
  subcategories: PurchaseSubcategory[];
  showDeactivated: boolean;
  handleEdit: (index: number) => void;
  handleDeactivate: (id: string) => void;
  handleActivate: (id: string) => void;
}

const PurchaseSubcategoryTable: React.FC<PurchaseSubcategoryTableProps> = ({
  subcategories, showDeactivated, handleEdit, handleDeactivate, handleActivate
}) => {
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogAction, setDialogAction] = useState<'deactivate' | 'activate' | null>(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(null);

  const handleOpenDialog = (action: 'deactivate' | 'activate', subcategoryId: string) => {
    setSelectedSubcategoryId(subcategoryId);
    setDialogAction(action);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedSubcategoryId(null);
    setDialogAction(null);
  };

  const handleConfirmAction = () => {
    if (selectedSubcategoryId && dialogAction) {
      if (dialogAction === 'deactivate') {
        handleDeactivate(selectedSubcategoryId);
      } else {
        handleActivate(selectedSubcategoryId);
      }
    }
    handleCloseDialog();
  };

  // Reverse the subcategories array to display in descending order
  const reversedSubcategories = [...subcategories].reverse();

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
              <TableCell>Subcategory ID</TableCell>
              <TableCell>Subcategory Name</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {reversedSubcategories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  No Subcategory Data
                </TableCell>
              </TableRow>
            ) : (
              reversedSubcategories.map((subcategory, index) => (
                <TableRow key={subcategory.randomId}>
                  <TableCell className='table-number-right'>{index+1}</TableCell>
                  <TableCell>{subcategory.randomId}</TableCell>
                  <TableCell>{subcategory.purchasesubcategoryName}</TableCell>
                  <TableCell>{subcategory.status}</TableCell>
                  <TableCell>
                    {showDeactivated ? (
                      <IconButton onClick={() => handleOpenDialog('activate', subcategory.purchasesubcategoryId)}>
                        <RefreshIcon />
                      </IconButton>
                    ) : (
                      <>
                        <IconButton onClick={() => handleEdit(subcategories.indexOf(subcategory))}>
                          <EditIcon />
                        </IconButton>
                        {subcategory.status === 'active' ? (
                          <IconButton onClick={() => handleOpenDialog('deactivate', subcategory.purchasesubcategoryId)}>
                            <DeleteIcon />
                          </IconButton>
                        ) : (
                          <IconButton onClick={() => handleOpenDialog('activate', subcategory.purchasesubcategoryId)}>
                            <RefreshIcon />
                          </IconButton>
                        )}
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <ConfirmationDialog
        open={openDialog}
        onClose={handleCloseDialog}
        onConfirm={handleConfirmAction}
        title={dialogAction === 'deactivate' ? 'Confirm Deactivation' : 'Confirm Activation'}
        description={
          dialogAction === 'deactivate'
            ? 'Are you sure you want to deactivate this purchase tax?'
            : 'Are you sure you want to activate this purchase tax?'
        }
        confirmText={dialogAction === 'deactivate' ? 'Deactivate' : 'Activate'}
        cancelText="Cancel"
      />
    </>
  );
};

export default PurchaseSubcategoryTable;