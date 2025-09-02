"use client";
import React from 'react';
import { Button, Box, Paper } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { setActiveSection, selectActiveSection } from '../../../features/yen-purchase/purchaseMasterSlice'; // Adjust the path based on your project structure
import PurchaseCategoryPage from './PurchaseCategory/page';
import PurchaseSubCategoryPage from './PurchaseSubcategory/page';
import PurchaseUOMPage from './PurchaseUom/page';
import GroupMasterPage from './GroupItem/page';
import PurchaseTaxPage from './PurchaseTax/page';
import StorageLocationPage from './StorageLocation/page';
import ItemTypePage from './ItemType/page';
import YenPurchasePage from '../page';

const PurchaseMasterItemPage: React.FC = () => {
  const dispatch = useDispatch();
  const activeSection = useSelector(selectActiveSection);

  const handleSectionClick = (section: string) => {
    dispatch(setActiveSection(section)); // Dispatch action to update active section
  };

  // Function to render content based on active section
  const renderContent = () => {
    switch (activeSection) {
      case 'purchase-category':
        return <PurchaseCategoryPage />;
      case 'purchase-subcategory':
        return <PurchaseSubCategoryPage />;
      case 'uom':
        return <PurchaseUOMPage />;
      case 'group-master':
        return <GroupMasterPage />;
      case 'purchase-tax':
        return <PurchaseTaxPage />;
      case 'storage-location':
        return <StorageLocationPage />;
      case 'item-type':
        return <ItemTypePage />;
      default:
        return null;
    }
  };

  return (
    <Box sx={{ ml: 1.2 }}>
      <YenPurchasePage />
      <Box sx={{ px: 2, pt: 1 }}>
        <Box sx={{ mb: 0.5, display: 'flex', justifyContent: 'start' }}>
          <Button
            onClick={() => handleSectionClick('purchase-category')}
            variant="contained"
            sx={{
              color: activeSection === 'purchase-category' ? 'black' : 'white',
              backgroundColor: activeSection === 'purchase-category' ? 'white' : 'primary.main',
              textTransform: 'capitalize',  // Added this line
              mr: 1,
              '&:hover': {
                backgroundColor: activeSection === 'purchase-category' ? 'white' : 'primary.dark',
              },
            }}
          >
            Purchase Category
          </Button>

          <Button
            onClick={() => handleSectionClick('purchase-subcategory')}
            variant="contained"
            sx={{
              color: activeSection === 'purchase-subcategory' ? 'black' : 'white',
              backgroundColor: activeSection === 'purchase-subcategory' ? 'white' : 'primary.main',
              textTransform: 'capitalize',  // Added this line
              mr: 1,
              '&:hover': {
                backgroundColor: activeSection === 'purchase-subcategory' ? 'white' : 'primary.dark',
              },
            }}
          >
            Purchase SubCategory
          </Button>

          <Button
            onClick={() => handleSectionClick('uom')}
            variant="contained"
            sx={{
              color: activeSection === 'uom' ? 'black' : 'white',
              backgroundColor: activeSection === 'uom' ? 'white' : 'primary.main',
              textTransform: 'capitalize',  // Added this line

              mr: 1,
              '&:hover': {
                backgroundColor: activeSection === 'uom' ? 'white' : 'primary.dark',
              },
            }}
          >
            Purchase UOM
          </Button>

          <Button
            onClick={() => handleSectionClick('group-master')}
            variant="contained"
            sx={{
              color: activeSection === 'group-master' ? 'black' : 'white',
              backgroundColor: activeSection === 'group-master' ? 'white' : 'primary.main',
              textTransform: 'capitalize',  // Added this line
              mr: 1,
              '&:hover': {
                backgroundColor: activeSection === 'group-master' ? 'white' : 'primary.dark',
              },
            }}
          >
            Group Item
          </Button>

          <Button
            onClick={() => handleSectionClick('purchase-tax')}
            variant="contained"
            sx={{
              color: activeSection === 'purchase-tax' ? 'black' : 'white',
              backgroundColor: activeSection === 'purchase-tax' ? 'white' : 'primary.main',
              textTransform: 'capitalize',  // Added this line
              mr: 1,
              '&:hover': {
                backgroundColor: activeSection === 'purchase-tax' ? 'white' : 'primary.dark',
              },
            }}
          >
            Purchase Tax
          </Button>

          <Button
            onClick={() => handleSectionClick('storage-location')}
            variant="contained"
            sx={{
              color: activeSection === 'storage-location' ? 'black' : 'white',
              backgroundColor: activeSection === 'storage-location' ? 'white' : 'primary.main',
              textTransform: 'capitalize',
              mr: 1,
              '&:hover': {
                backgroundColor: activeSection === 'storage-location' ? 'white' : 'primary.dark',
              },
            }}
          >
            Storage Location
          </Button>

          <Button
            onClick={() => handleSectionClick('item-type')}
            variant="contained"
            sx={{
              color: activeSection === 'item-type' ? 'black' : 'white',
              backgroundColor: activeSection === 'item-type' ? 'white' : 'primary.main',
              textTransform: 'capitalize',
              '&:hover': {
                backgroundColor: activeSection === 'item-type' ? 'white' : 'primary.dark',
              },
            }}
          >
            Item Type
          </Button>

        </Box>
        <Paper sx={{ p: 1, mb: 1 }}>
          {renderContent()}
        </Paper>
      </Box>
    </Box>
  );
};

export default PurchaseMasterItemPage;
