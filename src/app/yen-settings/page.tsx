// src/app/yen-settings/page.tsx
"use client";

import React, { useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Button, Box, Typography, Paper, Grid, Card, CardContent, CardActionArea } from '@mui/material';
import { usePathname, useRouter } from 'next/navigation';
import SideMenu from '../../components/SideMenu';
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import SettingsIcon from '@mui/icons-material/Settings';
import DateRangeIcon from '@mui/icons-material/DateRange';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import BuildIcon from '@mui/icons-material/Build';

const YenSettingsPage = () => {
  const pathname = usePathname();
  const router = useRouter();
  const role = useSelector((state: RootState) => state.auth.role);
  const isAdmin = role === "Admin";

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

  const permissions = useSelector(
    (state: RootState) => state.auth.permissions?.yenerp || {}
  );
  const permissionsLoaded = Object.keys(permissions).length > 0;

  const isModuleVisible = (key: string) => {
    const m = permissions?.[key];

    if (!m) return false;
    if (m.hide === true || m.hide === 1) return false;

    const noActions = !m.read && !m.add && !m.edit && !m.delete && !m.approve;
    if (noActions) return false;

    return m.read === true || m.read === 1;
  };

  const hidePurchaseMenu =
    permissionsLoaded &&
    !purchaseKeys.some((key: string) => isModuleVisible(key));

  const settingsModules = [
    {
      title: "Date Settings",
      description: "Configure date restrictions for purchase orders, invoice dates, and delivery dates",
      icon: <DateRangeIcon sx={{ fontSize: 40 }} />,
      path: "/yen-settings/DateSettings",
      color: "#1976d2",
      visible: true
    },
    {
      title: "Purchase Settings",
      description: "Manage purchase order defaults, approval workflows, and vendor settings",
      icon: <ShoppingCartIcon sx={{ fontSize: 40 }} />,
      path: "/yen-settings/PurchaseSettings",
      color: "#2e7d32",
      visible: true
    },
    {
      title: "General Settings",
      description: "Configure application preferences, notifications, and system defaults",
      icon: <SettingsIcon sx={{ fontSize: 40 }} />,
      path: "/yen-settings/GeneralSettings",
      color: "#ed6c02",
      visible: true
    }
  ];

  const handleMenuClick = useCallback((menuItem: { path: string }) => {
    router.push(menuItem.path);
  }, [router]);

  // If not admin, show access denied
  if (!isAdmin) {
    return (
      <div>
        <SideMenu
          onMenuClick={handleMenuClick}
          activePath={pathname || "/"}
          showPurchaseMenu={!hidePurchaseMenu}
        />
        <Box sx={{ p: 4, textAlign: 'center', mt: 8 }}>
          <BuildIcon sx={{ fontSize: 60, color: '#ccc', mb: 2 }} />
          <Typography variant="h5" color="error" gutterBottom>
            Access Denied
          </Typography>
          <Typography color="textSecondary" sx={{ mb: 3 }}>
           You do not have permission to access Settings. Contact your administrator.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => router.push("/")}
          >
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
        activePath={pathname || "/"}
        showPurchaseMenu={!hidePurchaseMenu}
      />

      <Box sx={{ p: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Settings
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Configure your application settings and preferences
          </Typography>
        </Box>

        {/* Settings Cards Grid */}
        <Grid container spacing={3}>
          {settingsModules.map((module) => (
            <Grid item xs={12} md={4} key={module.title}>
              <Card
                sx={{
                  height: '100%',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4
                  }
                }}
              >
                <CardActionArea
                  onClick={() => router.push(module.path)}
                  sx={{ height: '100%', p: 2 }}
                >
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Box sx={{
                      color: module.color,
                      mb: 2,
                      display: 'flex',
                      justifyContent: 'center'
                    }}>
                      {module.icon}
                    </Box>
                    <Typography variant="h6" gutterBottom>
                      {module.title}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {module.description}
                    </Typography>
                    <Box
                      sx={{
                        mt: 2,
                        display: 'inline-block',
                        px: 2,
                        py: 0.5,
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'primary.main',
                        color: 'primary.main',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        '&:hover': {
                          backgroundColor: 'rgba(25, 118, 210, 0.04)'
                        }
                      }}
                    >
                      Configure
                    </Box>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>

      </Box>
    </div>
  );
};

export default YenSettingsPage;