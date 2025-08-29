'use client';
import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Button,
  Popover,
  Box,
  Typography,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  VisibilityOutlined as ViewIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import {
  deactivateCategory,
  activateCategory,
  fetchCategories,
  setSnackbarMessage,
  setSnackbarOpen,
  removeSubcategory,
} from '../../../../features/yen-purchase/PurchaseMaster/PurchaseCategorySlice';
import { AppDispatch, RootState } from '@/redux/store';
import ConfirmationDialog from '@/components/confirmationDialog';

interface CategoryTableProps {
  onEditClick: (categoryId: string) => void;
}

const CategoryTable: React.FC<CategoryTableProps> = ({ onEditClick }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { categories, deactivatedItems, showDeactivated, searchQuery } = useSelector(
    (state: RootState) => state.purchaseCategory
  );
  const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
  const [dialogAction, setDialogAction] = useState<'deactivate' | 'activate' | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  
  // For subcategory popover
  const [subcategoryAnchorEl, setSubcategoryAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [viewingSubcategories, setViewingSubcategories] = useState<string[]>([]);
  const [currentCategoryId, setCurrentCategoryId] = useState<string | null>(null);

  const handleOpenConfirmDialog = (categoryId: string, action: 'deactivate' | 'activate') => {
    setSelectedCategoryId(categoryId);
    setDialogAction(action);
    setOpenConfirmDialog(true);
  };

  const handleCloseConfirmDialog = () => {
    setOpenConfirmDialog(false);
    setSelectedCategoryId(null);
    setDialogAction(null);
  };

  const handleEdit = (categoryId: string) => {
    const category = categories.find((category) => category.purchasecategoryId === categoryId);
    if (category) {
      onEditClick(categoryId);
    }
  };

  const handleConfirmAction = async () => {
    if (selectedCategoryId && dialogAction) {
      try {
        if (dialogAction === 'deactivate') {
          await dispatch(deactivateCategory(selectedCategoryId)).unwrap();
          dispatch(setSnackbarMessage('Category deactivated successfully'));
        } else {
          await dispatch(activateCategory(selectedCategoryId)).unwrap();
          dispatch(setSnackbarMessage('Category activated successfully'));
        }
        dispatch(fetchCategories());
      } catch (error) {
        dispatch(setSnackbarMessage(`Failed to ${dialogAction} category`));
      }
      dispatch(setSnackbarOpen(true));
    }
    handleCloseConfirmDialog();
  };

  const handleViewSubcategories = (event: React.MouseEvent<HTMLButtonElement>, subcategories: string[], categoryId: string) => {
    setSubcategoryAnchorEl(event.currentTarget);
    setViewingSubcategories(subcategories);
    setCurrentCategoryId(categoryId);
  };

  const handleCloseSubcategoryView = () => {
    setSubcategoryAnchorEl(null);
    setCurrentCategoryId(null);
  };

  // Updated handleRemoveSubcategory to use currentCategoryId
  const handleRemoveSubcategory = (subcategory: string) => {
    if (currentCategoryId) {
      console.log('Triggering removeSubcategory:', { categoryId: currentCategoryId, subcategory });
      dispatch(removeSubcategory({ categoryId: currentCategoryId, subcategory }));
      dispatch(fetchCategories());
    } else {
      console.error('No categoryId available for removing subcategory');
      dispatch(setSnackbarMessage('Cannot remove subcategory: No category selected'));
      dispatch(setSnackbarOpen(true));
    }
  };

  const filteredCategories = categories.filter((category) =>
    (category.purchasecategoryName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDeactivatedItems = deactivatedItems.filter((category) =>
    (category.purchasecategoryName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayedCategories = showDeactivated ? filteredDeactivatedItems : filteredCategories.reverse();
  
  const subcategoryPopoverOpen = Boolean(subcategoryAnchorEl);
  const subcategoryPopoverId = subcategoryPopoverOpen ? 'subcategory-popover' : undefined;

  return (
    <Box>
       <TableContainer
        component={Paper}
        sx={{
          maxHeight: 'calc(100vh - 180px)', // Dynamic height based on viewport
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
              <TableCell>Category ID</TableCell>
              <TableCell>Category Name</TableCell>
              <TableCell>Subcategories</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {displayedCategories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No Categories Data
                </TableCell>
              </TableRow>
            ) : (
              displayedCategories.map((category, index) => (
                <TableRow key={category.purchasecategoryId}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{category.randomId}</TableCell>
                  <TableCell>{category.purchasecategoryName}</TableCell>
                  <TableCell>
                    {Array.isArray(category.subcategories) && category.subcategories.length > 0 ? (
                      <Button
                        size="small"
                        onClick={(e) => handleViewSubcategories(e, category.subcategories, category.purchasecategoryId)}
                      >
                        View ({category.subcategories.length})
                      </Button>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No subcategories
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{category.status}</TableCell>
                  <TableCell>
                    {category.status === 'active' ? (
                      <>
                        <IconButton onClick={() => handleEdit(category.purchasecategoryId)}>
                          <EditIcon />
                        </IconButton>
                        <IconButton onClick={() => handleOpenConfirmDialog(category.purchasecategoryId, 'deactivate')}>
                          <DeleteIcon />
                        </IconButton>
                      </>
                    ) : (
                      <IconButton onClick={() => handleOpenConfirmDialog(category.purchasecategoryId, 'activate')}>
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

      <Popover
        id={subcategoryPopoverId}
        open={subcategoryPopoverOpen}
        anchorEl={subcategoryAnchorEl}
        onClose={handleCloseSubcategoryView}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
      >
        <Box sx={{ p: 0.5, width: viewingSubcategories.length < 3 ? 'auto' : 400, maxHeight: 300, overflow: 'auto' }}>
          <Typography variant="subtitle1" sx={{  fontWeight: 'bold', textAlign: 'center' }}>
            Subcategories
          </Typography>
          {viewingSubcategories.length > 0 ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 1,
                justifyContent: 'flex-start',
              }}
            >
              {viewingSubcategories.map((subcategory) => {
                const baseChipWidth = 100;
                const chipWidth =
                  viewingSubcategories.length === 1
                    ? 'auto'
                    : viewingSubcategories.length === 2
                    ? 'auto'
                    : 'calc(33.33% - 1rem)';

                return (
                  <Chip
                    key={subcategory}
                    label={subcategory}
                    size="medium"
                    deleteIcon={<CloseIcon />}
                    onDelete={() => handleRemoveSubcategory(subcategory)} // Pass subcategory only, categoryId is handled by currentCategoryId
                    sx={{
                      width: chipWidth,
                      minWidth: `${baseChipWidth}px`,
                      height: 'auto',
                      minHeight: 20,
                      mb: 0.2,
                      bgcolor: 'primary.light',
                      color: 'primary.contrastText',
                      fontWeight: 'medium',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      px: 0.2,
                      whiteSpace: 'normal',
                      wordBreak: 'break-word',
                    }}
                  />
                );
              })}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
              No subcategories available
            </Typography>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'center'}}>
            <Button
              size="small"
              onClick={handleCloseSubcategoryView}
              sx={{ px: 0.2 }}
            >
              Close
            </Button>
          </Box>
        </Box>
      </Popover>

      <ConfirmationDialog
        open={openConfirmDialog}
        onClose={handleCloseConfirmDialog}
        onConfirm={handleConfirmAction}
        title={dialogAction === 'deactivate' ? 'Confirm Deactivation' : 'Confirm Activation'}
        description={
          dialogAction === 'deactivate'
            ? 'Are you sure you want to deactivate this category?'
            : 'Are you sure you want to activate this category?'
        }
        confirmText={dialogAction === 'deactivate' ? 'Deactivate' : 'Activate'}
        cancelText="Cancel"
      />
    </Box>
  );
};

export default CategoryTable;