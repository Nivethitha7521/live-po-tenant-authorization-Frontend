"use client";
import React from 'react';
import { Button, Box, Paper,Alert } from '@mui/material';
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
import FreightPage from './Freight/page';
import ServicePage from './Service/page';
import { usePermissions } from "../../../hooks/usePermissions";

const PurchaseMasterItemPage: React.FC = () => {
  const dispatch = useDispatch();
  const { isModuleVisible } = usePermissions();
 const canShow = (module: string) => {
  return isModuleVisible("yenerp", module);
};

  const activeSection = useSelector(selectActiveSection);
 // ✅ ADD THIS useEffect HERE
  React.useEffect(() => {
    const visibleSections = [
      { key: "purchase-category", module: "purchasecategory" },
      { key: "purchase-subcategory", module: "purchasesubcategory" },
      { key: "uom", module: "purchaseuom" },
      { key: "group-master", module: "itemgroup" },
      { key: "purchase-tax", module: "purchasetax" },
      { key: "storage-location", module: "storagelocation" },
      { key: "item-type", module: "itemtype" },
      { key: "freight", module: "freight" },
      { key: "service", module: "service" },
    ];

    const currentIsValid = visibleSections.find(
      (s) => s.key === activeSection && canShow(s.module)
    );

    if (!currentIsValid) {
      const firstVisible = visibleSections.find(({ module }) => canShow(module));
      if (firstVisible) {
        dispatch(setActiveSection(firstVisible.key));
      }
    }
  }, []); // runs once on mount
  const handleSectionClick = (section: string) => {
    dispatch(setActiveSection(section)); // Dispatch action to update active section
  };
 

  // Function to render content based on active section
  const renderContent = () => {
  if (!activeSection) return null;

  const map: any = {
    "purchase-category": { module: "purchasecategory", comp: <PurchaseCategoryPage /> },
    "purchase-subcategory": { module: "purchasesubcategory", comp: <PurchaseSubCategoryPage /> },
    "uom": { module: "purchaseuom", comp: <PurchaseUOMPage /> },
    "group-master": { module: "itemgroup", comp: <GroupMasterPage /> },
    "purchase-tax": { module: "purchasetax", comp: <PurchaseTaxPage /> },
    "storage-location": { module: "storagelocation", comp: <StorageLocationPage /> },
    "item-type": { module: "itemtype", comp: <ItemTypePage /> },
    "freight": { module: "freight", comp: <FreightPage /> },
    "service": { module: "service", comp: <ServicePage /> },
  };

  const current = map[activeSection];
  if (!current) return null;



  return current.comp;
};


  return (
    <Box sx={{ ml: 1.2 }}>
      <YenPurchasePage />
      <Box sx={{ px: 2, pt: 1 }}>
        <Box sx={{ mb: 0.5, display: 'flex', justifyContent: 'start' }}>
         {canShow("purchasecategory") && (
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
         )}
         {canShow("purchasesubcategory") && (
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
         )}
         {canShow("purchaseuom") && (
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
         )}
         {canShow("itemgroup") && (
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
         )}
          {canShow("purchasetax") && (
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
          )}
           {canShow("storagelocation") && (
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
           )}
           {canShow("itemtype") && (
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
              mr:1
            }}
          >
            Item Type
          </Button>
           )}
            {canShow("freight") && (
          <Button
            onClick={() => handleSectionClick('freight')}
            variant="contained"
            sx={{
              color: activeSection === 'freight' ? 'black' : 'white',
              backgroundColor: activeSection === 'freight' ? 'white' : 'primary.main',
              textTransform: 'capitalize',
              '&:hover': {
                backgroundColor: activeSection === 'freight' ? 'white' : 'primary.dark',
              },
                mr:1
            }}
          >
            Freight
          </Button>
            )}
             {canShow("service") && (
          <Button
            onClick={() => handleSectionClick('service')}
            variant="contained"
            sx={{
              color: activeSection === 'service' ? 'black' : 'white',
              backgroundColor: activeSection === 'service' ? 'white' : 'primary.main',
              textTransform: 'capitalize',
              '&:hover': {
                backgroundColor: activeSection === 'service' ? 'white' : 'primary.dark',
              },
            }}
          >
            Service
          </Button>
             )}
        </Box>
        <Paper sx={{ p: 1, mb: 1 }}>
          {renderContent()}
        </Paper>
      </Box>
    </Box>
  );
};

export default PurchaseMasterItemPage;
