"use client";

import React, { useEffect } from 'react';
import {
  Box, Button, TextField, Dialog, DialogActions, DialogContent, DialogTitle,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Snackbar, Switch, FormControlLabel,
  IconButton, InputAdornment
} from '@mui/material';
import { 
  Add as AddIcon, 
  Refresh as RefreshIcon, 
  Delete as DeleteIcon, 
  Edit as EditIcon,
  Search as SearchIcon 
} from '@mui/icons-material';
import { usePermissions } from '@/hooks/usePermissions';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch } from '../../../../redux/store';
import {
  fetchExpenseSubcategories, updateExpenseSubcategory, addExpenseSubcategory,
  deactivateExpenseSubcategory, activateExpenseSubcategory, setExpenseSubcategoryData,
  setEditIndex, setDialogOpen, setSnackbarOpen, setSnackbarMessage, setSearchQuery,
  setShowDeactivated, selectExpenseSubcategoryItems
} from '../../../../features/yen-book/ExpenseSubcategorySlice';
import ExpenseManagementPage from '../page';

const initialSubcategoryState = {
  expenseSubcategoryId: '',
  subcategory: '',
  status: 'active',
};

const ExpenseSubcategoryPage: React.FC = () => {
  const dispatch: AppDispatch = useDispatch();
  const { hasPermission, isModuleVisible } = usePermissions();
const canAdd = hasPermission('yenerp', 'expensesubcategory', 'add');
const canEdit = hasPermission('yenerp', 'expensesubcategory', 'edit');
const canDelete = hasPermission('yenerp', 'expensesubcategory', 'delete');
  const {
    items: expenseSubcategories,
    deactivatedSubcategories,
    expenseSubcategoryData,
    editIndex,
    dialogOpen,
    snackbarOpen,
    snackbarMessage,
    showDeactivated,
    searchQuery
  } = useSelector(selectExpenseSubcategoryItems);
  useEffect(() => {
    dispatch(fetchExpenseSubcategories());
  }, [dispatch]);
if (!isModuleVisible('yenerp', 'expensesubcategory')) return null;

  const handleTextFieldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setExpenseSubcategoryData({
      ...expenseSubcategoryData,
      [e.target.name]: e.target.value
    }));
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setSearchQuery(e.target.value));
  };

  const filteredSubcategories = (showDeactivated ? deactivatedSubcategories : expenseSubcategories).filter(subcategory =>
    subcategory.subcategory.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDialogOpen = () => {
    dispatch(setDialogOpen('edit'));
  };

  const handleDialogClose = () => {
    dispatch(setDialogOpen('none'));
    dispatch(setExpenseSubcategoryData(initialSubcategoryState));
    dispatch(setEditIndex(null));
  };

  const handleSubmit = () => {
    // Check if subcategory data is empty
    if (!expenseSubcategoryData.subcategory.trim()) {
      dispatch(setSnackbarMessage('Subcategory name cannot be empty'));
      dispatch(setSnackbarOpen(true));
      return;
    }

    // Check if subcategory already exists
    const subcategoryExists = expenseSubcategories.some(subcategory => subcategory.subcategory.toLowerCase() === expenseSubcategoryData.subcategory.toLowerCase());

    if (subcategoryExists) {
      dispatch(setSnackbarMessage('Subcategory already exists'));
      dispatch(setSnackbarOpen(true));
      return;
    }

    if (editIndex !== null) {
      dispatch(updateExpenseSubcategory({ expenseSubcategoryId: expenseSubcategoryData.expenseSubcategoryId, expensesubcategory: expenseSubcategoryData }))
        .then(() => {
          dispatch(setSnackbarMessage('Expense subcategory updated successfully'));
          dispatch(setSnackbarOpen(true));
          dispatch(fetchExpenseSubcategories());
          handleDialogClose();
        })
        .catch((error) => {
          dispatch(setSnackbarMessage(`Failed to update expense subcategory: ${error.message}`));
          dispatch(setSnackbarOpen(true));
        });
    } else {
      dispatch(addExpenseSubcategory(expenseSubcategoryData))
        .then(() => {
          dispatch(setSnackbarMessage('Expense subcategory added successfully'));
          dispatch(setSnackbarOpen(true));
          dispatch(fetchExpenseSubcategories());
          handleDialogClose();
        })
        .catch((error) => {
          dispatch(setSnackbarMessage(`Failed to add expense subcategory: ${error.message}`));
          dispatch(setSnackbarOpen(true));
        });
    }
  };

  const handleEdit = (index: number) => {
    dispatch(setEditIndex(index));
    dispatch(setExpenseSubcategoryData(expenseSubcategories[index]));
    handleDialogOpen();
  };

  const handleDeactivate = (expenseSubcategoryId: string) => {
    dispatch(deactivateExpenseSubcategory(expenseSubcategoryId))
      .then(() => {
        dispatch(setSnackbarMessage('Expense subcategory deactivated successfully'));
        dispatch(setSnackbarOpen(true));
        dispatch(fetchExpenseSubcategories());
      })
      .catch((error) => {
        dispatch(setSnackbarMessage(`Failed to deactivate expense subcategory: ${error.message}`));
        dispatch(setSnackbarOpen(true));
      });
  };

  const handleActivate = (expenseSubcategoryId: string) => {
    dispatch(activateExpenseSubcategory(expenseSubcategoryId))
      .then(() => {
        dispatch(setSnackbarMessage('Expense subcategory activated successfully'));
        dispatch(setSnackbarOpen(true));
        dispatch(fetchExpenseSubcategories());
      })
      .catch((error) => {
        dispatch(setSnackbarMessage(`Failed to activate expense subcategory: ${error.message}`));
        dispatch(setSnackbarOpen(true));
      });
  };

  const toggleShowDeactivated = () => {
    dispatch(setShowDeactivated(!showDeactivated));
  };

  // Function to get status chip color
  const getStatusChip = (status: string) => {
    const statusStyles = {
      active: {
        backgroundColor: '#e8f5e8',
        color: '#2e7d32',
        padding: '4px 12px',
        borderRadius: '16px',
        display: 'inline-block',
        fontWeight: 500,
        fontSize: '0.875rem'
      },
      inactive: {
        backgroundColor: '#ffebee',
        color: '#c62828',
        padding: '4px 12px',
        borderRadius: '16px',
        display: 'inline-block',
        fontWeight: 500,
        fontSize: '0.875rem'
      }
    };
    return status === 'active' ? statusStyles.active : statusStyles.inactive;
  };

  return (
    <Box>
      {/* Pass children to ExpenseManagementPage to maintain layout */}
      <ExpenseManagementPage />
        <Box sx={{ p: 3 }}>
          <Box 
            display="flex" 
            justifyContent="space-between" 
            alignItems="center" 
            sx={{ 
              mb: 4,
              flexWrap: 'wrap',
              gap: 2
            }}
          >
            <TextField
              placeholder="Search subcategories..."
              //className="some"
              variant="outlined"
              size="small"
              value={searchQuery}
              onChange={handleSearchChange}
              sx={{ 
minWidth: 300,
                maxWidth: 400,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2
                }
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />
            
            <Box display="flex" alignItems="center" gap={2}>
              
              
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                onClick={handleDialogOpen}
                disabled={!canAdd}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  px: 3,
                  py: 1
                }}
              >
                Add Subcategory
              </Button>
              <FormControlLabel
                control={
                  <Switch
                    checked={showDeactivated}
                    onChange={toggleShowDeactivated}
                    color="primary"
                    size="medium"
                  />
                }
                label="Show Deactivated"
                sx={{ 
                  mr: 2,
                  '& .MuiFormControlLabel-label': {
                    fontWeight: 500
                  }
                }}
              />
            </Box>
          </Box>

          {/* Table Section with improved styling */}
          <TableContainer 
            component={Paper} 
            sx={{ 
              borderRadius: 2,
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              overflow: 'auto',
              maxHeight: '500px'
            }}
          >
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell 
                    sx={{ 
                      fontWeight: 600, 
                      fontSize: '0.95rem',
                      py: 2,
                      pl: 3
                    }}
                  >
                    Subcategory Name
                  </TableCell>
                  <TableCell 
                    sx={{ 
                      fontWeight: 600, 
                      fontSize: '0.95rem',
                      py: 2,
                      width: '120px'
                    }}
                  >
                    Status
                  </TableCell>
                  <TableCell 
                    sx={{ 
                      fontWeight: 600, 
                      fontSize: '0.95rem',
                      py: 2,
                      width: '150px',
                      textAlign: 'center'
                    }}
                  >
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredSubcategories.length > 0 ? (
                  filteredSubcategories.map((subcategory, index) => (
                    <TableRow 
                      key={subcategory.expenseSubcategoryId}
                      sx={{ 
                        '&:hover': { 
                          backgroundColor: '#fafafa' 
                        },
                        transition: 'background-color 0.2s'
                      }}
                    >
                      <TableCell 
                        sx={{ 
                          pl: 3,
                          fontWeight: 500,
                          fontSize: '0.95rem'
                        }}
                      >
                        {subcategory.subcategory}
                      </TableCell>
                      <TableCell>
                        <Box sx={getStatusChip(subcategory.status)}>
                          {subcategory.status === 'active' ? 'Active' : 'Inactive'}
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                          {showDeactivated ? (
                            <IconButton 
                              onClick={() => handleActivate(subcategory.expenseSubcategoryId)}
                              disabled={!canDelete}
                              size="small"
                              sx={{ 
                                color: '#2e7d32',
                                '&:hover': { backgroundColor: '#e8f5e8' }
                              }}
                              title="Activate"
                            >
                              <RefreshIcon fontSize="small" />
                            </IconButton>
                          ) : (
                            <>
                              <IconButton 
                                onClick={() => handleEdit(index)}
                                disabled={!canEdit}
                                size="small"
                                sx={{ 
                                  color: '#1976d2',
                                  '&:hover': { backgroundColor: '#e3f2fd' }
                                }}
                                title="Edit"
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              {subcategory.status === 'active' && (
                                <IconButton 
                                  onClick={() => handleDeactivate(subcategory.expenseSubcategoryId)}
                                  disabled={!canDelete}
                                  size="small"
                                  sx={{ 
                                    color: '#d32f2f',
                                    '&:hover': { backgroundColor: '#ffebee' }
                                  }}
                                  title="Deactivate"
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              )}
                            </>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell 
                      colSpan={3} 
                      align="center" 
                      sx={{ 
                        py: 4,
                        color: '#666',
                        fontSize: '1rem'
                      }}
                    >
                      No subcategories found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Dialog with improved styling */}
          <Dialog 
            open={dialogOpen !== 'none'} 
            onClose={handleDialogClose}
            PaperProps={{
              sx: {
                borderRadius: 2,
                minWidth: 400
              }
            }}
          >
            <DialogTitle sx={{ 
              backgroundColor: '#f5f5f5',
              px: 3,
              py: 2,
              fontWeight: 600
            }}>
              {editIndex !== null ? 'Edit Subcategory' : 'Add New Subcategory'}
            </DialogTitle>
            <DialogContent sx={{ px: 3, py: 3 }}>
              <TextField
                autoFocus
                margin="dense"
                name="subcategory"
                label="Subcategory Name"
                type="text"
                fullWidth
                variant="outlined"
                value={expenseSubcategoryData.subcategory}
                onChange={handleTextFieldChange}
                sx={{
                  mt: 1,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2
                  }
                }}
                placeholder="Enter subcategory name"
              />
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
              <Button 
                onClick={handleDialogClose} 
                variant="outlined"
                sx={{ 
                  borderRadius: 2,
                  textTransform: 'none',
                  px: 3
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit} 
                variant="contained"
                sx={{ 
                  borderRadius: 2,
                  textTransform: 'none',
                  px: 3
                }}
              >
                {editIndex !== null ? 'Update' : 'Add'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Snackbar for notifications */}
          <Snackbar
            open={snackbarOpen}
            autoHideDuration={4000}
            onClose={() => dispatch(setSnackbarOpen(false))}
            message={snackbarMessage}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            sx={{
              '& .MuiSnackbarContent-root': {
                borderRadius: 2,
                backgroundColor: '#333'
              }
            }}
          />
        </Box>
    </Box>
  );
};

export default ExpenseSubcategoryPage;