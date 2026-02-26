// Updated ServiceTable.tsx
'use client';
import React, { useState } from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  IconButton, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Button,
  Box
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/redux/store';
import { Service } from '../Models/Service';
import { fetchServiceItems } from '../Features/ServiceSlice';
import ServicePagination from './ServicePagination'; // Adjust path as needed

interface ServiceTableProps {
  handleEdit: (mongoId: string) => void;
  handleDeactivate: (mongoId: string) => void;
  handleActivate: (mongoId: string) => void;
   canEdit?: boolean;
  canDelete?: boolean;
}

const ServiceTable: React.FC<ServiceTableProps> = ({
  handleEdit, handleDeactivate, handleActivate,
  canEdit = true,
  canDelete = true,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { displayItems, loading, currentPage, totalPages, pageSize, currentViewStatus, searchQuery } = useSelector((state: RootState) => state.serviceItems);
  
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

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      dispatch(fetchServiceItems({ 
        page: newPage, 
        limit: pageSize, 
        status: currentViewStatus, 
        search: searchQuery 
      }));
    }
  };

  const totalPagesCount = Math.max(1, totalPages || 0);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TableContainer
        component={Paper}
        sx={{
          flex: 1,
          maxHeight: 'calc(100vh - 240px)', // Adjusted to leave space for pagination (200px + 40px margin)
          overflowY: 'auto',
          width: '100%',
        }}
      >
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell className='table-number-right'>S.No</TableCell>
              <TableCell>ID</TableCell>
                  <TableCell>SAC Code</TableCell>
              <TableCell>Service</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center">Loading...</TableCell>
              </TableRow>
            ) : displayItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">No Services</TableCell>
              </TableRow>
            ) : (
              displayItems.map((item, index) => (
                <TableRow key={item.serviceId}>
                  <TableCell className='table-number-right'>{((currentPage - 1) * pageSize) + index + 1}</TableCell>
                  <TableCell>{item.serviceId}</TableCell>
                    <TableCell>{item.saccode || ''}</TableCell>
                  <TableCell>{item.serviceName}</TableCell>
                  <TableCell>{item.status}</TableCell>
                  <TableCell>
                    {item.status === 'active' ? (
                      <>
                       <IconButton
  onClick={() => handleEdit(item.mongoId || '')}
  disabled={!canEdit}
  sx={{
    opacity: canEdit ? 1 : 0.5,
    "&.Mui-disabled": { color: "grey.500" },
  }}
>

                          <EditIcon />
                        </IconButton>
                       <IconButton
  onClick={() => handleOpenDialog(item.mongoId || '', 'deactivate')}
  disabled={!canDelete}
  sx={{
    opacity: canDelete ? 1 : 0.5,
    "&.Mui-disabled": { color: "grey.500" },
  }}
>

                          <DeleteIcon />
                        </IconButton>
                      </>
                    ) : (
                     <IconButton
  onClick={() => handleOpenDialog(item.mongoId || '', 'activate')}
  disabled={!canDelete}
  sx={{
    opacity: canDelete ? 1 : 0.5,
    "&.Mui-disabled": { color: "grey.500" },
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
      
      {/* Custom Pagination - Always visible */}
      <ServicePagination 
        currentPage={currentPage} 
        totalPages={totalPagesCount} 
        handlePageChange={handlePageChange}
      />
      
      {/* Confirmation Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog}>
        <DialogTitle>
          {actionType === 'deactivate' ? 'Confirm Deactivation' : 'Confirm Activation'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {actionType === 'deactivate'
              ? 'Are you sure you want to deactivate this service?'
              : 'Are you sure you want to activate this service?'}
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

export default ServiceTable;