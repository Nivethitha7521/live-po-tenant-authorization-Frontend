"use client";
import React from 'react';
import Link from 'next/link';
import { Button, Box } from '@mui/material';
import { usePathname, useRouter } from 'next/navigation';
import YenPurchasePage from '../page';

const subItems = [
  { id: 1, label: 'Vendor Type', path: '/yen-purchase/VendorPage/VendorType' },
  { id: 2, label: 'Vendors', path: '/yen-purchase/VendorPage/Vendor' },
];

const MenuPage = () => {
  const pathname = usePathname(); 
  const router = useRouter();

  React.useEffect(() => {
    if (pathname === '/yen-purchase/VendorPage' || pathname === '/yen-purchase/VendorPage/') {
      router.replace('/yen-purchase/VendorPage/VendorType');
    }
  }, [pathname, router]);

  const buttonStyles = (isActive: boolean) => ({
    backgroundColor: isActive ? "#ffffff" : "primary.main",
    color: isActive ? "#000000" : "white",
    fontWeight: "normal",
    transition: 'all 0.2s ease',
    boxShadow: isActive ? '0px 0px 10px rgba(0, 0, 0, 0.5)' : 'none', 
    minWidth: '100px',
    borderRadius: '4px',
    textTransform: 'none',
    fontSize: '0.875rem',
    px: 3,
    py: 1,
    '&:hover': {
      backgroundColor: isActive ? "#ffffff" : "primary.main", // Same as default
      color: isActive ? "#000000" : "white", // Prevent color change
      boxShadow: isActive ? '0px 0px 10px rgba(0, 0, 0, 0.5)' : 'none', // Prevent shadow change
    },
  });
  
  const cleanPath = pathname?.replace(/\/$/, '');

  return (
    <div>
      <YenPurchasePage />
      <Box sx={{
        display: 'flex',
        flexDirection: 'row',
        gap: 1,
        mb: 2,
        mt: 1,
        ml: '15px',
        alignItems: 'center',
      }}>
        {subItems.map((item) => {
          const isActive = cleanPath === item.path;

          return (
            <Link key={item.id} href={item.path} passHref legacyBehavior>
              <Button
                variant="contained"
                component="a"
                sx={buttonStyles(isActive)}
                disableElevation
              >
                {item.label}
              </Button>
            </Link>
          );
        })}
      </Box>
    </div>
  );
};


export default MenuPage;