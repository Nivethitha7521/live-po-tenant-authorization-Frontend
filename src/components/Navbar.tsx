'use client';
import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../redux/store';
import { logout, updateLastActivity } from '../features/authSlice';
import { fetchBusinesses, selectBusinesses, fetchPhoto } from '@/features/account-setting/businessSlice';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import './Navbar.css';
import ConfirmationDialog from './confirmationDialog';
import { FiLogOut, FiMenu, FiUser, FiClock } from 'react-icons/fi';
import { toast } from 'react-toastify';

interface NavbarProps {
  moduleName: string;
  username: string;
  onToggleMenu: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ moduleName, username, onToggleMenu }) => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { businesses } = useSelector(selectBusinesses);
  const { sessionInfo } = useSelector((state: RootState) => state.auth);
  const [fetchedBusinessIds, setFetchedBusinessIds] = useState(new Set<string>());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [sessionMinutesLeft, setSessionMinutesLeft] = useState(60);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);

  // Fetch businesses on mount
  useEffect(() => {
    dispatch(fetchBusinesses());
  }, [dispatch]);

  // Fetch business photos
  useEffect(() => {
    businesses.forEach((business) => {
      if (!fetchedBusinessIds.has(business.businessId)) {
        dispatch(fetchPhoto(business.businessId));
        setFetchedBusinessIds((prevSet) => new Set([...prevSet, business.businessId]));
      }
    });
  }, [businesses, fetchedBusinessIds, dispatch]);

  // Monitor session timeout
  useEffect(() => {
    if (sessionInfo?.willTimeoutIn) {
      const minutesLeft = Math.floor(sessionInfo.willTimeoutIn);
      setSessionMinutesLeft(minutesLeft);
      setShowTimeoutWarning(minutesLeft < 10);
      
      // Show warning toast when less than 5 minutes left
      if (minutesLeft === 5) {
        toast.warning(`Your session will expire in 5 minutes due to inactivity.`, {
          autoClose: 10000,
        });
      }
    }
  }, [sessionInfo]);

  // Periodic session check
  useEffect(() => {
    const interval = setInterval(() => {
      if (sessionMinutesLeft > 0) {
        setSessionMinutesLeft(prev => Math.max(0, prev - 1));
      }
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [sessionMinutesLeft]);

  const handleOpenDialog = () => {
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
  };

  const handleExtendSession = async () => {
    try {
      await dispatch(updateLastActivity()).unwrap();
      setShowTimeoutWarning(false);
      toast.success('Session extended! You can continue working.');
    } catch (error) {
      console.error('Failed to extend session:', error);
      toast.error('Failed to extend session. Please try again.');
    }
  };

  const handleConfirmLogout = async () => {
    setIsDialogOpen(false);
    try {
      await dispatch(logout('manual')).unwrap();
      // Clear all storage on manual logout
      sessionStorage.clear();
      localStorage.removeItem('browserSessionId');
      router.push('/');
    } catch (error) {
      console.error('Logout failed:', error);
      // Force cleanup even if API call fails
      sessionStorage.clear();
      localStorage.removeItem('browserSessionId');
      router.push('/');
    }
  };

  const getSessionTimerClass = () => {
    if (sessionMinutesLeft > 30) return 'active';
    if (sessionMinutesLeft > 10) return 'warning';
    return 'danger';
  };

  return (
    <>
      <header className="navbar">
        <div className="navbar-content">
          <div className="navbar-left">
            <button onClick={onToggleMenu} className="menu-toggle-button" aria-label="Toggle menu">
              <FiMenu />
            </button>
            <Image
              src="/images/blacklogo.png"
              alt="YEN ERP Logo"
              width={100}
              height={40}
              className="logo"
              priority
            />
          </div>

    <div className="navbar-center">
  <Typography 
    sx={{ 
      fontSize: '18px !important', 
      '&.module-name-uppercase': {
        textTransform: 'uppercase !important',
      }
    }}
    className={`${moduleName === moduleName.toLowerCase() ? 'module-name-uppercase' : ''}`}
  >
    {moduleName}
  </Typography>
</div>

          <div className="navbar-right">
  
{/* 
          
            <div className="user-info">
              <div className="user-avatar">
                {username?.charAt(0).toUpperCase()}
              </div>
              <span className="username">{username}</span>
            </div> */}

            {/* Business Logos */}
            {businesses?.length > 0 ? (
              businesses.map((business) => (
                <div className="navbar-logo" key={business.businessId}>
                  {business.imageUrl ? (
                    <Image
                      src={business.imageUrl}
                      alt={business.companyName}
                      width={70}
                      height={60}
                      className="navbar-image"
                      unoptimized={business.imageUrl.includes('http')}
                    />
                  ) : (
                    <span className="no-logo">{business.companyName || 'No Logo'}</span>
                  )}
                </div>
              ))
            ) : (
              <div className="navbar-logo">
                <span className="no-logo">No Businesses</span>
              </div>
            )}

            {/* Logout Button */}
            <div className="navbar-logout">
              <button onClick={handleOpenDialog}>
                <FiLogOut />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Timeout Warning Modal */}
      {showTimeoutWarning && (
        <div className="timeout-warning-modal">
          <div className="timeout-warning-content">
            <h3>Session About to Expire</h3>
            <p>Your session will expire in {sessionMinutesLeft} minutes due to inactivity.</p>
            <div className="timeout-warning-actions">
              <button onClick={handleExtendSession} className="extend-btn">
                Stay Logged In
              </button>
              <button onClick={handleOpenDialog} className="logout-btn">
                Logout Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Dialog */}
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