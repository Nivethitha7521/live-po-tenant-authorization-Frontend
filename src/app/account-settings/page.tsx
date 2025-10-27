"use client";

import React, { useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@mui/material';
import { usePathname, useRouter } from 'next/navigation';
import SideMenu from '@/components/SideMenu'; // Adjust the import path as necessary

const AccountSettingsPage = () => {
  const pathname = usePathname();
  const router = useRouter();

  // Submenu items for the Account Settings Page
  const subItems = useMemo(() => [
    { label: 'User Accounts', path: '/account-settings/UserAccount' },
    { label: 'Role Management', path: '/account-settings/RoleManagementPage' },
    { label: 'Business Details', path: '/account-settings/BusinessPage' },
    { label: 'Personal Details', path: '/account-settings/PersonalPage' },
  ], []);

  const isActiveRoute = (itemPath: string) => pathname?.startsWith(itemPath);

  const handleMenuClick = useCallback((menuItem: { path: string }) => {
    router.push(menuItem.path);
  }, [router]);

  return (
    <div>
      <SideMenu onMenuClick={handleMenuClick} activePath={pathname || ''} />

      {/* Displaying the submenu as buttons */}
      <div className="flex flex-start gap-2 mt-4 ml-4 items-center justify-start">
        {subItems.map((item) => {
          const isActive = isActiveRoute(item.path);

          return (
            <Link key={item.label} href={item.path} passHref className="no-underline">
              <Button
                variant={isActive ? 'contained' : 'outlined'}
                color="primary"
                size="medium"
                sx={{
                  textTransform: 'none', // Prevent uppercase transformation
                  fontWeight: isActive ? 'bold' : 'normal', // Bold text when active
                  fontSize: isActive ? '16px' : '15px',
                  borderRadius: '4px', // Rounded corners
                  padding: '10px 20px', // Same padding for both states
                  width: isActive ? '550px' : '150px', // Adjust width for active state
                  height: isActive ? '50px' : '30px', // Adjust height for active state
                  display: 'flex', // Align button content center
                  justifyContent: 'center', // Center text horizontally
                  alignItems: 'center', // Center text vertically
                  transition: 'all 0.2s ease', // Smooth transition for active state
                  boxShadow: isActive ? '0px 0px 10px rgba(0, 0, 0, 0.1)' : 'none', // Subtle shadow when active
                }}
              >
                {item.label}
              </Button>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default AccountSettingsPage;
