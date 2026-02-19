"use client";

import React, { useMemo, useState } from 'react';
import { Button } from '@mui/material';
import { usePathname, useRouter } from 'next/navigation';
import SideMenu from '@/components/SideMenu';
import BusinessPage from './BusinessPage/page';
import PersonalPage from './PersonalPage/page';
import { RootState } from "@/redux/store";
import { Typography } from "@mui/material";
import { useEffect } from "react";
import { useSelector } from "react-redux";
import TenantPage from './TenantPage/page';

import UserAccounts from './UserAccount/page';
import RoleManagementPage from '../account-settings/RoleManagementPage/page'; // Fixed import path
const AccountSettingsPage: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
const { role, isInitialized } = useSelector(
  (state: RootState) => state.auth
);
const isAdmin = role === "Admin";

const [activeContent, setActiveContent] = useState<string>('user-accounts');


const subItems = useMemo(() => {
  if (!isAdmin) return [];

  return [
    { 
      label: 'User Accounts', 
      path: '/account-settings/UserAccount',
      component: 'user-accounts'
    }, 
    { 
      label: 'Role Management', 
      path: '/account-settings/RoleManagementPage',
      component: 'role-management'
    },
    { 
      label: 'Business Details', 
      path: '/account-settings/BusinessPage', 
      component: 'business-details'
    },
    { 
      label: 'Personal Details', 
      path: '/account-settings/PersonalPage',
      component: 'personal-details'
    },
    {
  label: 'Tenant',
  path: '/account-settings/TenantPage',
  component: 'tenant'
},

  ];
}, [isAdmin]);


  const isActiveRoute = (itemPath: string) => pathname?.startsWith(itemPath);

  const handleMenuClick = (menuItem: { path: string }) => {
    router.push(menuItem.path);
  };

  const handleButtonClick = (item: any) => {
  if (item.component) {
    setActiveContent(item.component);
  }
};



const renderActiveContent = () => {
  switch (activeContent) {
    case 'user-accounts':
      return <UserAccounts />;
    case 'role-management':
      return <RoleManagementPage />;
    case 'business-details':
      return <BusinessPage />;
    case 'personal-details':
      return <PersonalPage />; 
      case 'tenant':
  return <TenantPage />;

    default:
      return null;
  }
};

// ⏳ Wait for auth hydration
if (!isInitialized) {
  return null;   // or loading spinner
}

// ❌ After auth ready, block non-admin
if (!isAdmin) {
  return (
    <Typography color="error" align="center" mt={5}>
      ❌ You do not have permission to access Account Settings
    </Typography>
  );
}



  return (
    <div>
     

      <div className="flex flex-start gap-2 mt-4 ml-4 items-center justify-start">
      {subItems.map((item) => {
  const isActive = activeContent === item.component;

  return (
    <Button
      key={item.label}
      variant={isActive ? 'contained' : 'outlined'}
      color="primary"
      size="medium"
      onClick={() => handleButtonClick(item)}
      sx={{
        textTransform: 'none',
        fontWeight: isActive ? 'bold' : 'normal',
        fontSize: isActive ? '16px' : '15px',
        borderRadius: '4px',
        padding: '10px 20px',
        width: isActive ? '550px' : '150px',
        height: isActive ? '50px' : '30px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        transition: 'all 0.2s ease',
        boxShadow: isActive ? '0px 0px 10px rgba(0, 0, 0, 0.1)' : 'none',
      }}
    >
      {item.label}
    </Button>
  );
})}

      </div>

      <div className="mt-4">
        {renderActiveContent()}
      </div>
    </div>
  );
};

export default AccountSettingsPage;