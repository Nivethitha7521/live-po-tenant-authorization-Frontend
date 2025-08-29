import React, { useState, useEffect, useRef } from 'react';
import { Drawer, List, ListItem, ListItemIcon, ListItemText, IconButton, Divider, Typography } from '@mui/material';
import {
  Menu as MenuIcon,
  Close as CloseIcon,
  AdminPanelSettings as AdminPanelSettingsIcon,
  ReceiptLong as ReceiptLongIcon,
  Group as GroupIcon,
  PeopleAlt as PeopleAltIcon,
  BookOnline as BookOnlineIcon,
  ShoppingCart as ShoppingCartIcon,
  StoreMallDirectory as StoreMallDirectoryIcon,
  Inventory2 as Inventory2Icon,
  AccountCircle as AccountCircleIcon,
} from '@mui/icons-material';
import Image from 'next/image'; // Import Image from next/image
import './SideMenu.css';

const drawerWidth = 240;

export interface MenuItem {
  text: string;
  icon: React.ReactNode;
  subItems: string[];
  path: string;
}

export const menuItems: MenuItem[] = [
  {
    text: 'MASTER ADMIN',
    icon: <AdminPanelSettingsIcon />,
    subItems: [
      'Wharehouse', 'Locations', 'Items', 'Category', 'Subcategory',
      'Item Groups', 'Uom', 'Tax', 'Vehicle', 'Discount', 'Online Partners'
    ],
    path: '/master-admin',
  },
  {
    text: 'YEN POS',
    icon: <ReceiptLongIcon />,
    subItems: [
      'Cash Management', 'Table Master', 'Bill Receipts', 'EB Reading',
      'POS Devices', 'Print Barcodes', 'Print Unique Barcodes'
    ],
    path: '/yen-pos',
  },
  {
    text: 'YEN HRM',
    icon: <GroupIcon />,
    subItems: [
      'HRM Master', 'Employee Master', 'Attendance Management', 'Leave Management',
      'Payroll Management', 'Performance Management', 'Training and Development',
      'Recruitment Management', 'Employee Benefits'
    ],
    path: '/yen-hrm',
  },
  {
    text: 'YEN CRM',
    icon: <PeopleAltIcon />,
    subItems: [
      'Customer Details', 'Customer Feedback', 'Service Integration', 'Promotional Offers'
    ],
    path: '/yen-crm',
  },
  {
    text: 'YEN BOOK',
    icon: <BookOnlineIcon />,
    subItems: [
      'OutletBank Deposit', 'Payment Details', 'OutGoing Payment', 'Asset Management',
      'Budget Management'
    ],
    path: '/yen-book',
  },
  {
    text: 'YEN PURCHASE',
    icon: <ShoppingCartIcon />,
    subItems: [
      'Vendor', 'Purchase Item', 'Purchase Order', 'Goods Receipt Note', 'AP Invoice'
    ],
    path: '/yen-purchase',
  },
  {
    text: 'YEN STORE',
    icon: <StoreMallDirectoryIcon />,
    subItems: ['Purchase Requisition'],
    path: '/yen-store',
  },
  {
    text: 'YEN INVENTORY',
    icon: <Inventory2Icon />,
    subItems: [
      'Outlets Inventory Management', 'Wharehouse Inventory Management'
    ],
    path: '/yen-inventory',
  },
  {
    text: 'ACCOUNT SETTINGS',
    icon: <AccountCircleIcon />,
    subItems: [
      'User Accounts', 'Role Management', 'Business Details', 'Personal Details'
    ],
    path: '/account-settings',
  },
];

interface SideMenuProps {
  onMenuClick: (menuItem: { path: string; text: string }) => void;
  activePath: string;
}

const SideMenu: React.FC<SideMenuProps> = ({ onMenuClick }) => {
  const [open, setOpen] = useState(false);
  const [subMenuOpen, setSubMenuOpen] = useState<number | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const drawerRef = useRef(null);
  const handleDrawerOpen = () => {
    setOpen(true);
  };

  const handleDrawerClose = () => {
    setOpen(false);
    setTimeout(() => {
      setDataLoaded(true);
    }, 800);
  };
    
  const handleSubMenuToggle = (index: number) => {
    setSubMenuOpen(subMenuOpen === index ? null : index);
  };

  const handleMenuItemClick = (menuItem: { path: string; text: string }) => {
    onMenuClick(menuItem);
    handleDrawerClose();
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (drawerRef.current && !(drawerRef.current as HTMLElement).contains(event.target as Node)) {
        handleDrawerClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div style={{ display: 'flex' }}>
      <Drawer
        ref={drawerRef}
        classes={{ paper: 'drawer-paper' }}
        variant="permanent"
        open={open}
        PaperProps={{ style: { width: open ? drawerWidth : 70 } }}
      >
        <div className={`drawer-header ${open ? 'open' : ''}`}>
          {open && (
            <div className="logo-container">
              <Image
                src="/images/bluelogo.png"
                alt="YEN ERP Logo"
                width={100} // Set appropriate width
                height={40} // Set appropriate height
                className="logo"
                priority // Prioritize loading for LCP
              />
            </div>
          )}
          <IconButton onClick={open ? handleDrawerClose : handleDrawerOpen}>
            {open ? <CloseIcon /> : <MenuIcon className="menu-header" />}
          </IconButton>
        </div>
        <List>
          {menuItems.map((menuItem, index) => (
            <React.Fragment key={index}>
              <ListItem
                button
                onClick={() => handleMenuItemClick(menuItem)}
                className="menu-item"
              >
                <ListItemIcon>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span>{menuItem.icon}</span>
                    {!open && (
                      <Typography variant="caption" className="menu-text-small">
                        {menuItem.text}
                      </Typography>
                    )}
                  </div>
                </ListItemIcon>
                {open && <ListItemText primary={menuItem.text} />}
              </ListItem>

              {open && subMenuOpen === index && menuItem.subItems && (
                <List component="div" disablePadding>
                  {menuItem.subItems.map((subItem, subIndex) => (
                    <ListItem
                      button
                      className="menu-sub-item"
                      onClick={() => handleMenuItemClick({ path: menuItem.path, text: menuItem.text })}
                      key={subIndex}
                    >
                      <ListItemText inset primary={subItem} />
                    </ListItem>
                  ))}
                </List>
              )}
            </React.Fragment>
          ))}
        </List>
      </Drawer>
    </div>
  );
};

export default SideMenu;