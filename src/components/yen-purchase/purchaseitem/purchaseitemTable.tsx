'use client';
import React from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  IconButton, Tooltip, Typography
} from '@mui/material';
import { Edit, Delete, Refresh } from '@mui/icons-material';
import { format } from 'date-fns';

interface PurchaseTableProps {
  items: any[];
  loading: boolean;
  showDeactivated: boolean;
  handleEdit: (index: number) => void;
  handleDeactivate: (item: any) => void; // Changed to accept item object
  handleActivate: (item: any) => void; // Changed to accept item object
  canEdit: boolean; // ✅ ADD PERMISSION PROP
  canDelete: boolean;
}

const PurchaseTable: React.FC<PurchaseTableProps> = ({
  items,
  loading,
  showDeactivated,
  handleEdit,
  handleDeactivate,
  handleActivate,
  canEdit, // ✅ RECEIVE PERMISSION
  canDelete // ✅ RECEIVE PERMISSION
}) => {
  return (
 <TableContainer
        component={Paper}
        sx={{
          maxHeight: 'calc(100vh - 170px)', // Dynamic height based on viewport
          overflowY: 'auto',
          width: '100%',
        }}
      >
      <Table stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell className='table-number-right'>S.No</TableCell>
            <TableCell className='table-number-right'>Item Code</TableCell>
            <TableCell>Item ID</TableCell>
            <TableCell>Item Name</TableCell>
            <TableCell>Category</TableCell>
            <TableCell>SubCategory</TableCell>
            <TableCell>Item Group</TableCell>
            <TableCell className='table-number-right'>Purchase Price</TableCell>
            <TableCell>Created Date</TableCell>
            <TableCell>Last Updated Date</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={10} align='center'>
                Loading...
              </TableCell>
            </TableRow>
          ) : items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} style={{ textAlign: 'center' }}>
                No items found.
              </TableCell>
            </TableRow>
          ) : (
            items.map((item, index) => (
              <TableRow key={item.purchaseitemId || index}>
                <TableCell className='table-number-right'>{index + 1}</TableCell>
                <TableCell className='table-number-right'>{item.itemCode}</TableCell>
                <TableCell>{item.randomId}</TableCell>
                <TableCell>{item.itemName || 'N/A'}</TableCell>
                <TableCell>{item.purchasecategoryName || 'N/A'}</TableCell>
                <TableCell>{item.purchasesubcategoryName || 'N/A'}</TableCell>
                <TableCell>{item.itemgroupName || 'N/A'}</TableCell>
                <TableCell className='table-number-right'>{item.purchasePrice !== null ? item.purchasePrice : 'N/A'}</TableCell>
                <TableCell>{item.createdDate ? format(item.createdDate, 'dd-MM-yyyy') : ''}</TableCell>
                <TableCell>{item.lastUpdatedDate ? format(item.lastUpdatedDate, 'dd-MM-yyyy') : ''}</TableCell>
                <TableCell>
                  {!showDeactivated && (
                    <>
                      <Tooltip title={canEdit ? "Edit" : "No edit permission"}>
                      <span>
                        <IconButton 
                          onClick={() => handleEdit(index)}
                          disabled={!canEdit}
                          sx={{ 
                            opacity: canEdit ? 1 : 0.5,
                            '&.Mui-disabled': { opacity: 0.5 }
                          }}
                        >
                          <Edit />
                        </IconButton>
                      </span>
                    </Tooltip>
                        <Tooltip title={canDelete ? "Deactivate" : "No delete permission"}>
                      <span>
                        <IconButton 
                          onClick={() => handleDeactivate(item)}
                          disabled={!canDelete}
                          sx={{ 
                            opacity: canDelete ? 1 : 0.5,
                            '&.Mui-disabled': { opacity: 0.5 }
                          }}
                        >
                          <Delete />
                        </IconButton>
                      </span>
                    </Tooltip>
                    </>
                  )}
                  {showDeactivated && (
                      <Tooltip title={canDelete ? "Reactivate" : "No activate permission"}>
                    <span>
                      <IconButton 
                        onClick={() => handleActivate(item)}
                        disabled={!canDelete}
                        sx={{ 
                          opacity: canDelete ? 1 : 0.5,
                          '&.Mui-disabled': { opacity: 0.5 }
                        }}
                      >
                        <Refresh />
                      </IconButton>
                    </span>
                  </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default PurchaseTable;