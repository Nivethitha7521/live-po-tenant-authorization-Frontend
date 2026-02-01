'use client';
import React, { useState } from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, IconButton,
  Box
} from '@mui/material';
import { Refresh as RefreshIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import ConfirmationDialog from '../../../confirmationDialog';

interface VendorType {
  vendortypeId: string;
  vendorType: string;
  status: string;
  randomId: string;
}

interface VendorTableProps {
  vendorTypes: VendorType[];
  onEdit: (vendortypeId: string) => void;
  onDeactivate: (id: string) => void;
  onActivate: (id: string) => void;
  canEdit: boolean; // ✅ ADD PERMISSION PROP
  canDelete: boolean;
}

const VendorTable: React.FC<VendorTableProps> = ({ 
  vendorTypes, 
  onEdit, 
  onDeactivate, 
  onActivate,
  canEdit, // ✅ RECEIVE PERMISSION PROP
  canDelete
}) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'deactivate' | 'activate' | null>(null);
  const [selectedVendorTypeId, setSelectedVendorTypeId] = useState<string | null>(null);

  const handleConfirmOpen = (action: 'deactivate' | 'activate', vendortypeId: string) => {
     if (!canDelete) {
      return;
    }
    setConfirmAction(action);
    setSelectedVendorTypeId(vendortypeId);
    setConfirmOpen(true);
  };

  const handleConfirmClose = () => {
    setConfirmOpen(false);
    setSelectedVendorTypeId(null);
  };

  const handleConfirmAction = () => {
    if (confirmAction === 'deactivate' && selectedVendorTypeId) {
      onDeactivate(selectedVendorTypeId);
    } else if (confirmAction === 'activate' && selectedVendorTypeId) {
      onActivate(selectedVendorTypeId);
    }
    handleConfirmClose();
  };

  return (
    <Box marginLeft={2}>
  <TableContainer
        component={Paper}
        sx={{
          maxHeight: 'calc(100vh - 200px)', // Dynamic height based on viewport
          overflowY: 'auto',
        }}
      >
        <Table
          stickyHeader >
          <TableHead>
            <TableRow>
              <TableCell className='table-number-right'>S.No</TableCell>
              <TableCell>Vendor Type ID</TableCell>
              <TableCell>Vendor Type</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {vendorTypes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align='center'>No Vendor Type Data</TableCell>
              </TableRow>
            ) : (
              vendorTypes.map((vendorType, index) => (
                <TableRow key={vendorType.randomId}>
                  <TableCell className='table-number-right'>{index + 1}</TableCell>
                  <TableCell>{vendorType.randomId}</TableCell>
                  <TableCell>{vendorType.vendorType}</TableCell>
                  <TableCell>{vendorType.status}</TableCell>
                  <TableCell>
                    {vendorType.status === 'active' ? (
                      <>
                         <IconButton 
                          onClick={() => onEdit(vendorType.vendortypeId)}
                          disabled={!canEdit}
                          sx={{ 
                            opacity: canEdit ? 1 : 0.5,
                            '&.Mui-disabled': {
                              opacity: 0.5,
                              color: 'text.disabled'
                            }
                          }}
                        >
                          <EditIcon />
                        </IconButton>
                         <IconButton 
                          onClick={() => handleConfirmOpen('deactivate', vendorType.vendortypeId)}
                          disabled={!canDelete}
                          sx={{ 
                            opacity: canDelete ? 1 : 0.5,
                            '&.Mui-disabled': {
                              opacity: 0.5,
                              color: 'text.disabled'
                            }
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </>
                    ) : (
                      <IconButton 
                        onClick={() => handleConfirmOpen('activate', vendorType.vendortypeId)}
                        disabled={!canDelete}
                        sx={{ 
                          opacity: canDelete ? 1 : 0.5,
                          '&.Mui-disabled': {
                            opacity: 0.5,
                            color: 'text.disabled'
                          }
                        }}
                      >
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
      <ConfirmationDialog
        open={confirmOpen}
        onClose={handleConfirmClose}
        onConfirm={handleConfirmAction}
        title={confirmAction === 'deactivate' ? 'Confirm Deactivation' : 'Confirm Activation'}
        description={
          confirmAction === 'deactivate'
            ? 'Are you sure you want to deactivate this vendor type?'
            : 'Are you sure you want to activate this vendor type?'
        }
        confirmText={'Confirm'}
        cancelText={'Cancel'}
      />
    </Box>
  );
};

export default VendorTable;