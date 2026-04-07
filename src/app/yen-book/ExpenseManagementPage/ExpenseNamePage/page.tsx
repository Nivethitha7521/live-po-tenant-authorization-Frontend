"use client";
import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { usePermissions } from '@/hooks/usePermissions';

import {
  Box,
  Button,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  SelectChangeEvent,
  Table,
  Select,
  MenuItem,
  InputAdornment,
  IconButton,
  Snackbar,
  Switch,
  FormControlLabel,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Alert,
  InputLabel,
  FormControl,
  Chip
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  GetApp as GetAppIcon,
} from "@mui/icons-material";
import { RootState, AppDispatch } from "../../../../redux/store";
import {
  addNames,
  deactivateNames,
  fetchCategories,
  updateNames,
  activateNames,
  setCategoryData,
  setDialogOpen,
  setEditIndex,
  setSnackbarMessage,
  setSnackbarOpen,
  toggleShowDeactivated,
  setSearchQuery,
  fetchNames,
} from "../../../../features/yen-book/ExpenseNameSlice";
import Papa from "papaparse";
import ExpenseManagementPage from "../page";

const ExpenseNamePage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { hasPermission, isModuleVisible } = usePermissions();
const canAdd = hasPermission('yenerp', 'expensename', 'add');
const canEdit = hasPermission('yenerp', 'expensename', 'edit');
const canDelete = hasPermission('yenerp', 'expensename', 'delete');
  const {
    names,
    categories,
    deactivatedItems,
    loading,
    error,
    snackbarOpen,
    snackbarMessage,
    editIndex,
    categoryData,
    showDeactivated,
    searchQuery,
    dialogOpen,
  } = useSelector((state: RootState) => state.expenseName);
  useEffect(() => {
    dispatch(fetchNames());
    dispatch(fetchCategories());
  }, [dispatch]);
if (!isModuleVisible('yenerp', 'expensename')) return null;

  // Interface for Subcategory
  interface ExpenseName {
    expenseName: string;
    expenseNameId: string;
    categories: string; // Changed to string for single value selection
    subcategories: string;
    status: string;
  }

  // Initial state for Category slice
  const initialCategoryState: ExpenseName = {
    expenseNameId: "",
    expenseName: "",
    categories: "", // Changed to single string value
    subcategories: "",
    status: "active",
  };

  const handleTextFieldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    dispatch(setCategoryData({ ...categoryData, [name]: value }));
  };

  const handleSelectChange = (event: SelectChangeEvent<string>) => {
    dispatch(
      setCategoryData({
        ...categoryData,
        categories: event.target.value as string,
      })
    );
  };

  const handleAddOrUpdate = async () => {
    try {
      if (editIndex !== null) {
        await dispatch(
          updateNames({
            expenseNameId: categoryData.expenseNameId,
            category: categoryData,
          })
        ).unwrap();
        dispatch(setSnackbarMessage("Expense Name updated successfully!"));
      } else {
        await dispatch(addNames(categoryData)).unwrap();
        dispatch(setSnackbarMessage("Expense Name added successfully!"));
      }
      dispatch(setCategoryData(initialCategoryState));
      dispatch(setEditIndex(null));
      dispatch(setDialogOpen("none"));
      dispatch(fetchCategories());
      dispatch(setSnackbarOpen(true));
    } catch (error: any) {
      dispatch(setSnackbarMessage(error.message || "An error occurred"));
      dispatch(setSnackbarOpen(true));
    }
  };

  const handleEdit = (index: number) => {
    const category = names[index];
    dispatch(setEditIndex(index));
    dispatch(setCategoryData(category));
    dispatch(setDialogOpen("edit"));
  };

  const handleDeactivateConfirm = async (expenseNameId: string) => {
    try {
      await dispatch(deactivateNames(expenseNameId)).unwrap();
      dispatch(fetchCategories());
    } catch (error) {
      dispatch(setSnackbarMessage("Failed to deactivate expense name"));
      dispatch(setSnackbarOpen(true));
    }
  };

  const handleActivateConfirm = async (expenseNameId: string) => {
    try {
      await dispatch(activateNames(expenseNameId)).unwrap();
      dispatch(fetchCategories());
    } catch (error) {
      dispatch(setSnackbarMessage("Failed to activate expense name"));
      dispatch(setSnackbarOpen(true));
    }
  };

  const handleCloseDialog = () => {
    dispatch(setDialogOpen("none"));
    dispatch(setCategoryData(initialCategoryState));
    dispatch(setEditIndex(null));
  };

  const handleSnackbarClose = () => {
    dispatch(setSnackbarOpen(false));
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setSearchQuery(e.target.value));
  };

  const handleExportCSV = () => {
    const csv = Papa.unparse(categories);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "expense_categories.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Function to get status chip styles
  const getStatusChip = (status: string) => {
    return (
      <Chip
       label={status.toLowerCase() === "active" ? "Active" : "Inactive"}
        size="small"
        sx={{
          backgroundColor: status === "active" ? "#e8f5e8" : "#ffebee",
          color: status === "active" ? "#2e7d32" : "#c62828",
          fontWeight: 500,
          fontSize: "0.75rem",
          height: "24px"
        }}
      />
    );
  };

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
      <Typography>Loading...</Typography>
    </Box>
  );
  
  if (error) return (
    <Box sx={{ p: 3 }}>
      <Alert severity="error">{error}</Alert>
    </Box>
  );

  const filteredNames = names.filter((item) =>
  (item.expenseName || "").toLowerCase().includes(searchQuery.toLowerCase())
);

const filteredDeactivatedItems = deactivatedItems.filter((item) =>
  (item.expenseName || "").toLowerCase().includes(searchQuery.toLowerCase())
);

const displayedData = showDeactivated
  ? filteredDeactivatedItems
  : filteredNames;

  return (
    <Box>
      {/* Header Section */}
     <ExpenseManagementPage />
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
          autoComplete="off"
          placeholder="Search expense names..."
          //className="some"
          variant="outlined"
          size="small"
          value={searchQuery}
          onChange={handleSearch}
          sx={{ 
            minWidth: 200,
            maxWidth: 300,
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
  onClick={() => dispatch(setDialogOpen("add"))}
  disabled={!canAdd}   // ✅
>
  Add Expense Name
</Button>
<FormControlLabel
            control={
              <Switch
                checked={showDeactivated}
                onChange={() => dispatch(toggleShowDeactivated())}
                color="primary"
                size="medium"
              />
            }
            label="Show Deactivated"
            sx={{ 
              '& .MuiFormControlLabel-label': {
                fontWeight: 500
              }
            }}
          />
        </Box>
      </Box>

      {/* Table Section */}
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
                align="left" 
                sx={{ 
                  fontWeight: 600, 
                  fontSize: '0.95rem',
                  py: 2,
                  pl: 3,
                  width: '30%'
                }}
              >
                Expense Name
              </TableCell>
              <TableCell 
                align="left" 
                sx={{ 
                  fontWeight: 600, 
                  fontSize: '0.95rem',
                  py: 2,
                  width: '25%'
                }}
              >
                Category
              </TableCell>
              <TableCell 
                align="left" 
                sx={{ 
                  fontWeight: 600, 
                  fontSize: '0.95rem',
                  py: 2,
                  width: '20%'
                }}
              >
                Subcategory
              </TableCell>
              <TableCell 
                align="center" 
                sx={{ 
                  fontWeight: 600, 
                  fontSize: '0.95rem',
                  py: 2,
                  width: '15%'
                }}
              >
                Status
              </TableCell>
              <TableCell 
                align="center" 
                sx={{ 
                  fontWeight: 600, 
                  fontSize: '0.95rem',
                  py: 2,
                  width: '20%'
                }}
              >
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {displayedData.length > 0 ? (
              displayedData.map((item, index) => (
                <TableRow 
                 key={item.expenseNameId}
                  hover
                  sx={{ 
                    '&:hover': { 
                      backgroundColor: '#fafafa' 
                    },
                    transition: 'background-color 0.2s'
                  }}
                >
                  <TableCell 
                    align="left"
                    sx={{ 
                      pl: 3,
                      fontWeight: 500,
                      fontSize: '0.95rem'
                    }}
                  >
                    {item.expenseName}
                  </TableCell>
                  <TableCell align="left">
                    {item.categories}
                  </TableCell>
                  <TableCell align="left">
                    {item.subcategories}
                  </TableCell>
                  
                  <TableCell align="center">
                    {getStatusChip(item.status)}
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
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

                      {item.status.toLowerCase() === "active" ? (
                        <IconButton
                          onClick={() => handleDeactivateConfirm(item.expenseNameId)}
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
                      ) : (
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => handleActivateConfirm(item.expenseNameId)}
                           disabled={!canDelete}
                          sx={{ 
                            borderRadius: 2,
                            textTransform: 'none',
                            color: '#2e7d32',
                            borderColor: '#2e7d32',
                            '&:hover': { 
                              backgroundColor: '#e8f5e8',
                              borderColor: '#2e7d32'
                            }
                          }}
                        >
                          Activate
                        </Button>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell 
                  colSpan={5} 
                  align="center" 
                  sx={{ 
                    py: 4,
                    color: '#666',
                    fontSize: '1rem'
                  }}
                >
                  No expense names found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit Dialog */}
      <Dialog 
        open={dialogOpen !== "none"} 
        onClose={handleCloseDialog}
        PaperProps={{
          sx: {
            borderRadius: 2,
            minWidth: 450
          }
        }}
      >
        <DialogTitle sx={{ 
          backgroundColor: '#f5f5f5',
          px: 3,
          py: 2,
          fontWeight: 600
        }}>
          {editIndex !== null ? "Edit Category" : "Add New Category"}
        </DialogTitle>
        <DialogContent sx={{ px: 3, py: 3 }}>
          <TextField
            autoComplete="off"
            margin="dense"
            label="Expense Name"
            name="expenseName"
            fullWidth
            value={categoryData.expenseName}
            onChange={handleTextFieldChange}
            sx={{
              mt: 1,
              mb: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2
              }
            }}
            placeholder="Enter expense name"
          />
          
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel id="category-select-label">Select Category</InputLabel>
            <Select
              labelId="category-select-label"
              label="Select Category"
              fullWidth
              value={categoryData.categories}
              onChange={handleSelectChange}
              sx={{
                borderRadius: 2
              }}
            >
              {categories.map((category) => (
                <MenuItem
                  key={category.expenseCategoryId || Math.random()}
                  value={category.category}
                >
                  {category.category}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button 
            onClick={handleCloseDialog} 
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
            onClick={handleAddOrUpdate} 
            variant="contained"
            sx={{ 
              borderRadius: 2,
              textTransform: 'none',
              px: 3
            }}
          >
            {editIndex !== null ? "Update" : "Add"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert 
          onClose={handleSnackbarClose} 
          severity="success"
          sx={{ 
            borderRadius: 2,
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
          }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ExpenseNamePage;