"use client";
import  dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useCallback } from 'react';
import { Button } from '@mui/material';
import React from 'react';

// Dynamically import SideMenu
const SideMenu = dynamic(() => import('../../components/SideMenu'), {
  ssr: false, // Disable SSR if SideMenu is client-only
});

const YenPurchasePage = () => {
  const pathname = usePathname();
  const router = useRouter();

  const subItems = useMemo(
    () => [
      { label: 'Purchase Master', path: '/yen-purchase/PurchaseMaster' },
      { label: 'Vendor', path: '/yen-purchase/VendorPage' },
      { label: 'Purchase Item', path: '/yen-purchase/PurchaseItemPage' },
      { label: 'Purchase Order', path: '/yen-purchase/PurchaseOrder' },
      { label: 'GRN Note', path: '/yen-purchase/GrnPage' },
      { label: 'AP Invoice', path: '/yen-purchase/ApInvoicePage' },
    ],
    []
  );

  React.useEffect(() => {
    if (pathname === '/yen-purchase' || pathname === '/yen-purchase/') {
      router.replace('/yen-purchase/PurchaseMaster');
    }
  }, [pathname, router]);

  const isActiveRoute = (itemPath: string) => (pathname || '').startsWith(itemPath);

  const handleMenuClick = useCallback((menuItem: { path: string }) => {
    router.push(menuItem.path);
  }, [router]);

  return (
    <div>
      <SideMenu onMenuClick={handleMenuClick} activePath={pathname || '/'} /> 
      <div className="flex flex-wrap gap-2 ml-4 items-center justify-start">
        {subItems.map((item) => {
          const isActive = isActiveRoute(item.path);

          return (
            <Link key={item.label} href={item.path} className="no-underline">
              <Button
                variant={isActive ? 'contained' : 'outlined'}
                color="primary"
                size="medium"
                sx={{
                  textTransform: 'none',
                  fontWeight: isActive ? 'bold' : 'normal',
                  fontSize: isActive ? '16px' : '15px',
                  borderRadius: '4px',
                  padding: '8px 16px',
                  width: isActive ? '200px' : '150px',
                  height: isActive ? '40px' : '30px',
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

export default YenPurchasePage;