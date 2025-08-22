// src/app/yen-book/page.tsx
"use client";

import React, { useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@mui/material';
import { usePathname, useRouter } from 'next/navigation';
import SideMenu from '../../components/SideMenu';

const YenBookPage = () => {
  const pathname = usePathname();
  const router = useRouter();

  const subItems = useMemo(() => [
    { label: 'Outlet Bank Deposit', path: '/yen-book/OutletBankDeposit' },
    { label: 'Payment Details', path: '/yen-book/PaymentDetailsPage' },
    { label: 'Outgoing Payment', path: '/yen-book/OutgoingPaymentPage' },
    { label: 'Asset Management', path: '/yen-book/AssetManagement' },
    { label: 'Budget Management', path: '/yen-book/BudgetManagementPage' },
  ], []);

  const isActiveRoute = (itemPath: string) => (pathname || '').startsWith(itemPath);

  const handleMenuClick = useCallback((menuItem: { path: string }) => {
    router.push(menuItem.path);
  }, [router]);

  return (
    <div>
      <SideMenu
        onMenuClick={handleMenuClick}
        activePath={pathname || '/'} // Fallback to '/' if pathname is null
      />

      <div className="flex flex-wrap gap-2 mt-1 ml-5 mr:1 items-center justify-start">
        {subItems.map((item) => {
          const isActive = isActiveRoute(item.path);

          return (
            <Link key={item.label} href={item.path} passHref className="no-underline-book">
              <Button
                variant={isActive ? 'contained' : 'outlined'}
                color="primary"
                size="medium"
                sx={{
                  textTransform: 'none',
                  fontWeight: isActive ? 'bold' : 'normal',
                  fontSize: isActive ? '26px' : '12px',
                  borderRadius: '4px',
                  padding: '10px 20px',
                  width: isActive ? '550px' : '15px',
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
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default YenBookPage;