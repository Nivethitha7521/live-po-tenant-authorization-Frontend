"use client";

import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
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
  Checkbox,
  ListItemText,
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
  Chip,
  FormControlLabel,
  Tooltip
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  GetApp as GetAppIcon,
  Upload as UploadIcon
} from "@mui/icons-material";
import { usePermissions } from '@/hooks/usePermissions';

import { RootState, AppDispatch } from "../../../../redux/store";
import {
  addCategory,
  deactivateCategory,
  fetchCategories,
  updateCategory,
  activateCategory,
  fetchSubcategories,
  setCategoryData,
  setDialogOpen,
  setEditIndex,
  setSnackbarMessage,
  setSnackbarOpen,
  toggleShowDeactivated,
  setSearchQuery,
} from "../../../../features/yen-book/ExpenseCategorySlice";
import Papa from "papaparse";
import ExpenseManagementPage from "../page";

const ExpenseCategoryPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { hasPermission, isModuleVisible } = usePermissions();
const canAdd = hasPermission('yenerp', 'expensecategory', 'add');
const canEdit = hasPermission('yenerp', 'expensecategory', 'edit');
const canDelete = hasPermission('yenerp', 'expensecategory', 'delete');
  const {
    categories,
    deactivatedItems,
    loading,
    error,
    subcategories,
    snackbarOpen,
    snackbarMessage,
    editIndex,
    categoryData,
    showDeactivated,
    searchQuery,
    dialogOpen,
  } = useSelector((state: RootState) => state.expenseCategory);
  useEffect(() => {
    dispatch(fetchCategories());
    dispatch(fetchSubcategories());
  }, [dispatch]);
if (!isModuleVisible('yenerp', 'expensecategory')) return null;

  interface Category {
    expenseCategoryId: string;
    category: string;
    status: string;
    subcategories: string[];
  }

  const initialCategoryState: Category = {
    expenseCategoryId: "",
    category: "",
    status: "active",
    subcategories: [],
  };

  const handleTextFieldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    dispatch(setCategoryData({ ...categoryData, [name]: value }));
  };

  const handleSelectChange = (event: SelectChangeEvent<string[]>) => {
    dispatch(
      setCategoryData({
        ...categoryData,
        subcategories: event.target.value as string[],
      })
    );
  };

  const handleAddOrUpdate = async () => {
    try {
      if (editIndex !== null) {
        await dispatch(
          updateCategory({
            expenseCategoryId: categoryData.expenseCategoryId,
            category: categoryData,
          })
        ).unwrap();
        dispatch(setSnackbarMessage("Category updated successfully!"));
      } else {
        await dispatch(addCategory(categoryData)).unwrap();
        dispatch(setSnackbarMessage("Category added successfully!"));
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
    const category = categories[index];
    dispatch(setEditIndex(index));
    dispatch(setCategoryData(category));
    dispatch(setDialogOpen("edit"));
  };

  const handleDeactivateConfirm = async (expenseCategoryId: string) => {
    try {
      await dispatch(deactivateCategory(expenseCategoryId)).unwrap();
      dispatch(fetchCategories());
      dispatch(setSnackbarMessage("Category deactivated successfully!"));
      dispatch(setSnackbarOpen(true));
    } catch (error) {
      dispatch(setSnackbarMessage("Failed to deactivate category"));
      dispatch(setSnackbarOpen(true));
    }
  };

  const handleActivateConfirm = async (expenseCategoryId: string) => {
    try {
      await dispatch(activateCategory(expenseCategoryId)).unwrap();
      dispatch(fetchCategories());
      dispatch(setSnackbarMessage("Category activated successfully!"));
      dispatch(setSnackbarOpen(true));
    } catch (error) {
      dispatch(setSnackbarMessage("Failed to activate category"));
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

  const handleSampleCSV = () => {
    const sampleData: Category[] = [
      {
        expenseCategoryId: "1",
        category: "Sample Category 1",
        subcategories: ["Sample Subcategory 1"],
        status: "active",
      },
      {
        expenseCategoryId: "2",
        category: "Sample Category 2",
        subcategories: ["Sample Subcategory 2"],
        status: "active",
      },
    ];
    const csv = Papa.unparse(sampleData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample_expense_categories.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      Papa.parse<Category>(file, {
        header: true,
        complete: async (results) => {
          for (const category of results.data) {
            try {
              await dispatch(addCategory(category)).unwrap();
            } catch (error) {
              console.error("Error adding category from CSV:", error);
            }
          }
          dispatch(fetchCategories());
          dispatch(setSnackbarMessage("CSV imported successfully!"));
          dispatch(setSnackbarOpen(true));
        },
        error: (error) => {
          console.error("CSV parsing error:", error);
          dispatch(setSnackbarMessage("Error importing CSV"));
          dispatch(setSnackbarOpen(true));
        },
      });
    }
  };

  // Function to get status chip styles
  const getStatusChip = (status: string) => {
    return (
      <Chip
        label={status === "active" ? "Active" : "Inactive"}
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

  const filteredCategories = categories.filter((category) =>
    (category.category || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDeactivatedItems = deactivatedItems.filter((category) =>
    (category.category || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayedCategories = showDeactivated
    ? filteredDeactivatedItems
    : filteredCategories;

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
          placeholder="Search categories..."
          variant="outlined"
          //sclassName=''
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
          {/* CSV Actions */}
          <Box display="flex" gap={1}>
            <Tooltip title="Export CSV">
              <Button
                variant="outlined"
                startIcon={<GetAppIcon />}
                onClick={handleExportCSV}
                size="small"
                sx={{ borderRadius: 2, textTransform: 'none' }}
              >
                Export
              </Button>
            </Tooltip>
            
            <Tooltip title="Sample CSV">
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={handleSampleCSV}
                size="small"
                sx={{ borderRadius: 2, textTransform: 'none' }}
              >
                Sample
              </Button>
            </Tooltip>
            
          <Button
  variant="outlined"
  component="label"
  startIcon={<UploadIcon />}
  size="small"
  disabled={!canAdd}   // ✅ இது மட்டும் add
  sx={{ borderRadius: 2, textTransform: 'none' }}
>
  Import
  <input type="file" hidden accept=".csv" onChange={handleImportCSV} />
</Button>
          </Box>

         
          
        <Button
  variant="contained"
  color="primary"
  startIcon={<AddIcon />}
  onClick={() => dispatch(setDialogOpen("add"))}
  disabled={!canAdd}   // ✅ இது மட்டும் add
  sx={{ borderRadius: 2, textTransform: 'none', px: 3, py: 1 }}
>
  Add Category
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
                sx={{ 
                  fontWeight: 600, 
                  fontSize: '0.95rem',
                  py: 2,
                  pl: 3,
                  width: '30%'
                }}
              >
                Category
              </TableCell>
              <TableCell 
                sx={{ 
                  fontWeight: 600, 
                  fontSize: '0.95rem',
                  py: 2,
                  width: '40%'
                }}
              >
                Subcategories
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
                  width: '15%'
                }}
              >
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {displayedCategories.length > 0 ? (
              displayedCategories.map((category, index) => (
                <TableRow 
                  key={category.expenseCategoryId}
                  hover
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
                    {category.category}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {Array.isArray(category.subcategories) && category.subcategories.length > 0 ? (
                        category.subcategories.map((sub, idx) => (
                          <Chip
                            key={idx}
                            label={sub}
                            size="small"
                            sx={{
                              backgroundColor: '#f0f0f0',
                              fontSize: '0.75rem',
                              height: '24px'
                            }}
                          />
                        ))
                      ) : (
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    {getStatusChip(category.status)}
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                     <IconButton
  onClick={() => handleEdit(index)}
  size="small"
  disabled={!canEdit}   // ✅ இது மட்டும் add
  sx={{ color: '#1976d2', '&:hover': { backgroundColor: '#e3f2fd' } }}
>
  <EditIcon fontSize="small" />
</IconButton>
                      
                      {category.status === "active" ? (
                       <IconButton
  onClick={() => handleDeactivateConfirm(category.expenseCategoryId)}
  size="small"
  disabled={!canDelete}   // ✅ இது மட்டும் add
  sx={{ color: '#d32f2f', '&:hover': { backgroundColor: '#ffebee' } }}
>
  <DeleteIcon fontSize="small" />
</IconButton>
                      ) : (
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => handleActivateConfirm(category.expenseCategoryId)}
                          disabled={!canDelete} 
                          sx={{ 
                            borderRadius: 2,
                            textTransform: 'none',
                            color: '#2e7d32',
                            borderColor: '#2e7d32',
                            minWidth: '70px',
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
                  colSpan={4} 
                  align="center" 
                  sx={{ 
                    py: 4,
                    color: '#666',
                    fontSize: '1rem'
                  }}
                >
                  No categories found
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
            minWidth: 500
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
            label="Category Name"
            name="category"
            fullWidth
            value={categoryData.category}
            onChange={handleTextFieldChange}
            sx={{
              mt: 1,
              mb: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2
              }
            }}
            placeholder="Enter category name"
          />
          
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel id="subcategory-select-label">Select Subcategories</InputLabel>
            <Select
              labelId="subcategory-select-label"
              label="Select Subcategories"
              multiple
              fullWidth
              value={categoryData.subcategories}
              onChange={handleSelectChange}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {(selected as string[]).map((value) => (
                    <Chip key={value} label={value} size="small" />
                  ))}
                </Box>
              )}
              sx={{
                borderRadius: 2
              }}
            >
              {subcategories.map((subcategory) => (
                <MenuItem 
                  key={subcategory.expenseSubcategoryId} 
                  value={subcategory.subcategory}
                >
                  <Checkbox 
                    checked={categoryData.subcategories.includes(subcategory.subcategory)} 
                    size="small"
                  />
                  <ListItemText primary={subcategory.subcategory} />
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

export default ExpenseCategoryPage;