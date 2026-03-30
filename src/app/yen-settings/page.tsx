// src/app/yen-settings/page.tsx
"use client";

import React, { useMemo, useCallback, useState } from 'react';
import Link from 'next/link';
import { Button, Box, Typography, Paper, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Divider, IconButton } from '@mui/material';
import { usePathname, useRouter } from 'next/navigation';
import SideMenu from '../../components/SideMenu';
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import SettingsIcon from '@mui/icons-material/Settings';
import DateRangeIcon from '@mui/icons-material/DateRange';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import BuildIcon from '@mui/icons-material/Build';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TuneIcon from '@mui/icons-material/Tune';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import Collapse from '@mui/material/Collapse';
import { usePermissions } from '@/hooks/usePermissions';

// Import your existing Date Settings component
import DateSettingsPage from './DateSettings/page';

// Define types
interface SubSetting {
  id: string;
  title: string;
  description: string;
  icon: React.ReactElement;
  component: React.ComponentType;
}

interface SettingsMenuItem {
  id: string;
  title: string;
  icon: React.ReactElement;
  color: string;
  type: "direct" | "nested";
  path?: string;
  component?: React.ComponentType;
  subSettings?: SubSetting[];
}

const YenSettingsPage = () => {
  const pathname = usePathname();
  const router = useRouter();
  //const role = useSelector((state: RootState) => state.auth.role);
  //const isAdmin = role === "Admin";
  const { hasPermission,isModuleVisible: checkModuleVisible } = usePermissions();
  const canReadSettings = hasPermission('yenerp', 'settings', 'read');
  const [selectedMenuItem, setSelectedMenuItem] = useState<string>('datesettings');
  const [selectedSubSetting, setSelectedSubSetting] = useState<string>('');
  const [openNested, setOpenNested] = useState<string | null>('purchase');


  const permissions = useSelector(
    (state: RootState) => state.auth.permissions?.yenerp || {}
  );
  const permissionsLoaded = Object.keys(permissions).length > 0;

// CORRECT ✅ - isModuleVisible line முழுக்க delete பண்ணி இதை மட்டும் வை
const isKeyVisible = (key: string) => {
  const m = permissions?.[key];
  if (!m) return false;
  if (m.hide === true || m.hide === 1) return false;
  const noActions = !m.read && !m.add && !m.edit && !m.delete && !m.approve;
  if (noActions) return false;
  return m.read === true || m.read === 1;
};
  // Purchase module permission keys (for sidebar only)
  const purchaseKeys = [
    "purchasecategory",
    "purchasesubcategory",
    "itemgroup",
    "purchaseuom",
    "purchasetax",
    "storagelocation",
    "freight",
    "itemtype",
    "service",
    "vendors",
    "vendortype",
    "purchaseitem",
    "purchaseorders_pending",
    "purchaseorders_approved",
    "purchaseorders_rejected",
    "serviceorders_pending",
    "serviceorders_approved",
    "serviceorders_rejected",
    "grns",
    "grns_return",
    "apinvoices",
    "settings"
  ];
// Add these key arrays (same as other pages)
const yenBookKeys = ["outgoingpayment", "advancepayment", "partialpayment", 
  "paymentdone", "paymenthistory", "ledger", "purchasereturn"];

const inventoryKeys = ["physicalstockmodification", "physicalstockvariancemodification", 
  "stockledger", "warehousephysicalstockmodification", 
  "warehousephysicalstockvariancemodification", "warehousestockledger"];


 const hidePurchaseMenu =
  permissionsLoaded &&
  !purchaseKeys.some((key: string) => isKeyVisible(key)); 
// Add these computed values
const hideBookMenu = permissionsLoaded && !yenBookKeys.some((key) => isKeyVisible(key));
const showInventoryMenu = inventoryKeys.some((k) => isKeyVisible(k));
const showReportsMenu = isKeyVisible("posreport") || isKeyVisible("purchaseorderreport");
  const handleMenuClick = useCallback((menuItem: { path: string }) => {
    router.push(menuItem.path);
  }, [router]);

  // Settings menu items
  const settingsMenu: SettingsMenuItem[] = [
 
    {
      id: "purchase",
      title: "Purchase Settings",
      icon: <ShoppingCartIcon sx={{ fontSize: 24 }} />,
      color: "#2e7d32",
      type: "nested",
      subSettings: [
        {
          id: "date",
          title: "Date Setting",
          description: "Configure date restrictions for purchase orders",
          icon: <DateRangeIcon sx={{ fontSize: 20 }} />,
          component: DateSettingsPage // Using the same Date Settings component
        },
        {
          id: "common",
          title: "Common Setting",
          description: "Configure common purchase defaults and workflows",
          icon: <TuneIcon sx={{ fontSize: 20 }} />,
          component: () => (
            <Box>
              <Typography variant="h5" gutterBottom fontWeight="bold">
                Purchase Common Settings
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                Configure common defaults and workflows for purchase module
              </Typography>
            </Box>
          )
        },
        {
          id: "general",
          title: "General Setting",
          description: "Configure general purchase preferences",
          icon: <SettingsIcon sx={{ fontSize: 20 }} />,
          component: () => (
            <Box>
              <Typography variant="h5" gutterBottom fontWeight="bold">
                Purchase General Settings
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                Configure general preferences and system defaults for purchase module
              </Typography>
            </Box>
          )
        }
      ]
    },
  ];

  const handleMenuItemClick = (item: SettingsMenuItem) => {
    if (item.type === "direct") {
      setSelectedMenuItem(item.id);
      setSelectedSubSetting('');
      setOpenNested(null);
    } else if (item.type === "nested") {
      setSelectedMenuItem(item.id);
      setOpenNested(openNested === item.id ? null : item.id);
      setSelectedSubSetting('date'); // Default to first sub-setting
    }
  };

  const handleSubSettingClick = (subId: string) => {
    setSelectedSubSetting(subId);
  };

  const getActiveComponent = () => {
    // Check if it's a direct settings item
    const directItem = settingsMenu.find(item => item.id === selectedMenuItem && item.type === "direct");
    if (directItem && directItem.component) {
      return directItem.component;
    }
    
    // Check if it's a nested purchase sub-setting
    const purchaseItem = settingsMenu.find(item => item.id === "purchase");
    const subSetting = purchaseItem?.subSettings?.find(s => s.id === selectedSubSetting);
    return subSetting?.component || DateSettingsPage;
  };

  const ActiveComponent = getActiveComponent();

  // If not admin, show access denied
  { /*
  if (!isAdmin) {
    return (
      <div>
        <SideMenu
          onMenuClick={handleMenuClick}
          activePath={pathname || '/'}
          showPurchaseMenu={!hidePurchaseMenu}
        />
        <Box sx={{ p: 4, textAlign: 'center', mt: 8 }}>
          <BuildIcon sx={{ fontSize: 60, color: '#ccc', mb: 2 }} />
          <Typography variant="h5" color="error" gutterBottom>
            Access Denied
          </Typography>
          <Typography color="textSecondary" sx={{ mb: 3 }}>
           You don&apos;t have permission to access Settings. Contact your administrator.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => router.push('/')}
          >
            Go to Dashboard
          </Button>
        </Box>
      </div>
    );
  }
*/ }
 if (!canReadSettings) {
    return (
      <div>
        <SideMenu
          onMenuClick={handleMenuClick}
          activePath={pathname || '/'}
          showPurchaseMenu={!hidePurchaseMenu}
          showBookMenu={!hideBookMenu}         // ✅ add
  showInventoryMenu={showInventoryMenu} // ✅ add
  showReportsMenu={showReportsMenu}
        />
        <Box sx={{ p: 4, textAlign: 'center', mt: 8 }}>
          <BuildIcon sx={{ fontSize: 60, color: '#ccc', mb: 2 }} />
          <Typography variant="h5" color="error" gutterBottom>
            Access Denied
          </Typography>
          <Typography color="textSecondary" sx={{ mb: 3 }}>
            You don&apos;t have permission to access Settings.
          </Typography>
          <Button variant="contained" onClick={() => router.push('/')}>
            Go to Dashboard
          </Button>
        </Box>
      </div>
    );
  }
  return (
    <div>
      <SideMenu
        onMenuClick={handleMenuClick}
        activePath={pathname || '/'}
        showPurchaseMenu={!hidePurchaseMenu}
        showBookMenu={!hideBookMenu}         // ✅ add
  showInventoryMenu={showInventoryMenu} // ✅ add
  showReportsMenu={showReportsMenu}
      />

      <Box sx={{ display: 'flex', p: 3 }}>
        {/* Left Sidebar Menu */}
        <Paper 
          elevation={1} 
          sx={{ 
            width: 300, 
            mr: 3, 
            borderRadius: 2,
            overflow: 'auto',
            height: 'calc(100vh - 100px)',
            position: 'sticky',
            top: 20
          }}
        >
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="h6" fontWeight="bold">
              Settings
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Configure your application
            </Typography>
          </Box>
          
          <List sx={{ p: 0 }}>
            {settingsMenu.map((item) => (
              <React.Fragment key={item.id}>
                <ListItem disablePadding>
                  <ListItemButton 
                    onClick={() => handleMenuItemClick(item)}
                    selected={selectedMenuItem === item.id}
                    sx={{
                      '&.Mui-selected': {
                        backgroundColor: 'rgba(25, 118, 210, 0.08)',
                        borderRight: '3px solid',
                        borderRightColor: 'primary.main',
                        '&:hover': {
                          backgroundColor: 'rgba(25, 118, 210, 0.12)',
                        }
                      }
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40, color: item.color }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText 
                      primary={item.title}
                      primaryTypographyProps={{
                        fontWeight: selectedMenuItem === item.id ? 600 : 400,
                        fontSize: '0.9rem'
                      }}
                    />
                    {item.type === "nested" && (
                      openNested === item.id ? <ExpandLess /> : <ExpandMore />
                    )}
                  </ListItemButton>
                </ListItem>
                
                {item.type === "nested" && item.subSettings && (
                  <Collapse in={openNested === item.id} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                      {item.subSettings.map((subItem, index) => (
                        <ListItemButton
                          key={subItem.id}
                          selected={selectedSubSetting === subItem.id}
                          onClick={() => handleSubSettingClick(subItem.id)}
                          sx={{
                            pl: 4,
                            py: 1,
                            '&.Mui-selected': {
                              backgroundColor: 'rgba(46, 125, 32, 0.08)',
                              borderRight: '3px solid',
                              borderRightColor: '#2e7d32',
                              '&:hover': {
                                backgroundColor: 'rgba(46, 125, 32, 0.12)',
                              }
                            }
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 36, color: item.color }}>
                            {subItem.icon}
                          </ListItemIcon>
                          <ListItemText 
                            primary={subItem.title}
                            secondary={subItem.description}
                            primaryTypographyProps={{
                              fontWeight: selectedSubSetting === subItem.id ? 500 : 400,
                              fontSize: '0.85rem'
                            }}
                            secondaryTypographyProps={{
                              fontSize: '0.7rem'
                            }}
                          />
                        </ListItemButton>
                      ))}
                    </List>
                  </Collapse>
                )}
                <Divider />
              </React.Fragment>
            ))}
          </List>
        </Paper>

        {/* Right Content Area */}
        <Paper 
          elevation={1} 
          sx={{ 
            flex: 1, 
            borderRadius: 2,
            overflow: 'auto',
            height: 'calc(100vh - 100px)'
          }}
        >
          <Box sx={{ p: 3 }}>
            <ActiveComponent />
          </Box>
        </Paper>
      </Box>
    </div>
  );
};

export default YenSettingsPage;