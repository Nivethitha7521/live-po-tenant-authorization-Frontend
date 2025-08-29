'use client';
import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../redux/store';
import { logout } from '../features/authSlice';
import { fetchBusinesses, selectBusinesses, fetchPhoto } from '@/features/account-setting/businessSlice';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import './Navbar.css';
import ConfirmationDialog from './confirmationDialog';

interface NavbarProps {
  moduleName: string;
  username: string;
  onToggleMenu: () => void; // Add onToggleMenu to props
}

const Navbar: React.FC<NavbarProps> = ({ moduleName, username, onToggleMenu }) => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { businesses } = useSelector(selectBusinesses);
  const [fetchedBusinessIds, setFetchedBusinessIds] = useState(new Set<string>());
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(()=>{
    fetchBusinesses();
  },[dispatch]);
  // Fetch business photos
  useEffect(() => {
    businesses.forEach((business) => {
      if (!fetchedBusinessIds.has(business.businessId)) {
        dispatch(fetchPhoto(business.businessId));
        setFetchedBusinessIds((prevSet) => new Set([...prevSet, business.businessId]));
      }
    });
  }, [businesses, fetchedBusinessIds, dispatch]);

  const handleOpenDialog = () => {
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
  };

 const handleConfirmLogout = async () => {
  setIsDialogOpen(false);
  try {
    await dispatch(logout('manual')).unwrap(); // Pass 'manual' or another reason
    router.push('/');
  } catch (error) {
    if (error !== 'Request canceled') {
      console.error('Logout failed:', error);
    }
    router.push('/');
  }
};

  return (
    <>
      <header className="navbar">
        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
          <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <button onClick={onToggleMenu} className="menu-toggle-button">
              ☰ {/* Simple hamburger icon; replace with your preferred icon */}
            </button>
            <Image
              src="/images/blacklogo.png"
              alt="YEN ERP Logo"
              width={100}
              height={40}
              className="logo"
              style={{ marginLeft: '20px' }}
              priority
            />
          </Box>
          <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
            <Typography
              className={`module-name ${moduleName === moduleName.toLowerCase() ? 'module-name-uppercase' : ''}`}
            >
              {moduleName}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', marginRight: '20px' }}>
            {businesses?.length > 0 ? (
              businesses.map((business) => (
                <div className="navbar-logo" key={business.businessId}>
                  {business.imageUrl ? (
                    <Image
                      src={business.imageUrl}
                      alt={business.companyName}
                      width={50}
                      height={50}
                      className="navbar-image"
                      unoptimized={business.imageUrl.includes('http')}
                    />
                  ) : (
                    <span className="no-logo">No Logo</span>
                  )}
                </div>
              ))
            ) : (
              <div className="navbar-logo">
                <span className="no-logo">No Businesses</span>
              </div>
            )}
            <Box className="navbar-logout">
              <button onClick={handleOpenDialog} className="text-white">
                Logout
              </button>
            </Box>
          </Box>
        </Box>
      </header>
      <ConfirmationDialog
        open={isDialogOpen}
        onClose={handleCloseDialog}
        onConfirm={handleConfirmLogout}
        title="Confirm Logout"
        description="Are you sure you want to log out?"
        confirmText="Logout"
        cancelText="Cancel"
      />
    </>
  );
};

export default Navbar;