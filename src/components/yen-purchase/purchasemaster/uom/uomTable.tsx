'use client';
import React, { useState } from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  IconButton, Tooltip,
  Box
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import ConfirmationDialog from '@/components/confirmationDialog';
import { UOMItem } from '@/Models/uom';

interface UOMTableProps {
  items: UOMItem[];
  showDeactivated: boolean;
  handleEdit: (index: string) => void;
  handleDeactivate: (id: string) => void;
  handleActivate: (id: string) => void;
}

const UOMTable: React.FC<UOMTableProps> = ({
  items, showDeactivated, handleEdit, handleDeactivate, handleActivate
}) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'deactivate' | 'activate' | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleOpenDialog = (action: 'deactivate' | 'activate', id: string) => {
    setConfirmAction(action);
    setSelectedId(id);
    setConfirmOpen(true);
  };

  const handleCloseDialog = () => {
    setConfirmOpen(false);
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
    <Box>
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
              <TableCell>UOM ID</TableCell>
              <TableCell>UOM</TableCell>
              <TableCell>Precision Value</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align='center'>
                  No UOM Data
                </TableCell>
              </TableRow>
            ) : (
              items.map((uom, index) => {
                const isFirstFive = items.length >= 5 && index >= items.length - 5;
                return (
                  <TableRow key={uom.randomId}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{uom.randomId}</TableCell>
                    <TableCell>{uom.uom}</TableCell>
                    <TableCell>{uom.precisionValue}</TableCell>
                    <TableCell>{uom.status}</TableCell>
                    <TableCell>
                      {uom.status === 'active' ? (
                        <>
                          <Tooltip
                            title={isFirstFive ? "Edit is disabled for the first 5 UOMs" : "Edit UOM"}
                            disableInteractive
                          >
                            <span>
                              <IconButton
                                onClick={() => handleEdit(uom.purchaseuomId)}
                                disabled={isFirstFive}
                              >
                                <EditIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip
                            title={isFirstFive ? "Deactivate is disabled for the first 5 UOMs" : "Deactivate UOM"}
                            disableInteractive
                          >
                            <span>
                              <IconButton
                                onClick={() => handleOpenDialog('deactivate', uom.purchaseuomId)}
                                disabled={isFirstFive}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </>
                      ) : (
                        <Tooltip title="Activate UOM" disableInteractive>
                          <IconButton onClick={() => handleOpenDialog('activate', uom.purchaseuomId)}>
                            <RefreshIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
              )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={confirmOpen}
        onClose={handleCloseDialog}
        onConfirm={handleConfirmAction}
        title={confirmAction === 'deactivate' ? 'Confirm Deactivation' : 'Confirm Activation'}
        description={confirmAction === 'deactivate'
          ? 'Are you sure you want to deactivate this UOM?'
          : 'Are you sure you want to activate this UOM?'} confirmText={'Yes'} cancelText={'No'}      />
    </Box>
  );
};

export default UOMTable;
