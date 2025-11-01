'use client';
import React, { useState } from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  IconButton, Tooltip
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import ConfirmationDialog from '@/components/confirmationDialog';
import { PurchaseTax } from '@/Models/purchasetax';

interface PurchaseTaxTableProps {
  purchaseTaxes: PurchaseTax[];
  showDeactivated: boolean;
  searchQuery: string;
  handleEdit: (id: string) => void;
  handleDeactivate: (purchasetaxId: string) => void;
  handleActivate: (purchasetaxId: string) => void;
}

const PurchaseTaxTable: React.FC<PurchaseTaxTableProps> = ({
  purchaseTaxes, showDeactivated, searchQuery, handleEdit, handleDeactivate, handleActivate
}) => {
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogAction, setDialogAction] = useState<'deactivate' | 'activate' | null>(null);
  const [selectedTaxId, setSelectedTaxId] = useState<string | null>(null);

  const handleOpenDialog = (action: 'deactivate' | 'activate', taxId: string) => {
    setSelectedTaxId(taxId);
    setDialogAction(action);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedTaxId(null);
    setDialogAction(null);
  };

  const handleConfirmAction = () => {
    if (selectedTaxId && dialogAction) {
      if (dialogAction === 'deactivate') {
        handleDeactivate(selectedTaxId);
      } else {
        handleActivate(selectedTaxId);
      }
    }
    handleCloseDialog();
  };

  const filteredPurchaseTaxes = purchaseTaxes
  .filter((tax) => {
    // Skip if tax is null or undefined
    if (!tax) return false;
    
    // Filter by status if showDeactivated is false
    if (!showDeactivated && tax.status !== 'active') return false;
    
    // Filter by search query if provided
    if (searchQuery) {
      return tax.purchasetaxName?.toLowerCase().includes(searchQuery.toLowerCase());
    }
    
    return true;
  })
  .reverse();
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
              <TableCell>Tax ID</TableCell>
              <TableCell>Tax Name</TableCell>
              <TableCell className='table-number-right'>Tax Percentage</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredPurchaseTaxes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No Tax Data
                </TableCell>
              </TableRow>
            ) : (
              filteredPurchaseTaxes.map((tax, index) => (
                <TableRow key={tax.purchasetaxId}>
                  <TableCell className='table-number-right'>{index + 1}</TableCell>
                  <TableCell>{tax.randomId}</TableCell>
                  <TableCell>{tax.purchasetaxName}</TableCell>
                  <TableCell className='table-number-right'>{`${tax.purchasetaxPercentage}%`}</TableCell>
                  <TableCell>{tax.status}</TableCell>
                  <TableCell>
                    {tax.status === 'active' ? (
                      <>
                        <IconButton onClick={() => handleEdit(tax.purchasetaxId)}>
                          <EditIcon />
                        </IconButton>
                        <IconButton onClick={() => handleOpenDialog('deactivate', tax.purchasetaxId)}>
                          <DeleteIcon />
                        </IconButton>
                      </>
                    ) : (
                      <IconButton onClick={() => handleOpenDialog('activate', tax.purchasetaxId)}>
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

export default PurchaseTaxTable;
