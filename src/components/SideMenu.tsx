// components/SideMenu.tsx
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
  Settings as SettingsIcon,
} from '@mui/icons-material';
import Image from 'next/image';
import './SideMenu.css';
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";

const drawerWidth = 240;

export interface MenuItem {
  text: string;
  icon: React.ReactNode;
  subItems: string[];
  path: string;
}

export const menuItems: MenuItem[] = [
  {
    text: 'YEN BOOK',
    icon: <BookOnlineIcon />,
    subItems: ['OutGoing Payment'],
    path: '/yen-book',
  },
  {
    text: 'YEN PURCHASE',
    icon: <ShoppingCartIcon />,
    subItems: ['Vendor', 'Purchase Item', 'Purchase Order', 'Goods Receipt Note', 'AP Invoice'],
    path: '/yen-purchase',
  },
   {
    text: 'YEN INVENTORY',
    icon: <Inventory2Icon />,
    subItems: [
      'Outlets Inventory Management',
      'Warehouse Inventory Management',
    ],
    path: '/yen-inventory',
  },
  {
    text: 'ACCOUNT SETTINGS',
    icon: <AccountCircleIcon />,
    subItems: ['Business Details', 'Personal Details'],
    path: '/account-settings',
  },
  {
    text: 'SETTINGS',
    icon: <SettingsIcon />,
    subItems: ['Date Settings', 'Purchase Settings', 'General Settings'],
    path: '/yen-settings',
  },
];

interface SideMenuProps {
  onMenuClick: (menuItem: { path: string; text: string }) => void;
  activePath: string;
  showPurchaseMenu?: boolean;
  showBookMenu?: boolean;
  showInventoryMenu?: boolean;
}

const SideMenu: React.FC<SideMenuProps> = ({ onMenuClick, showPurchaseMenu, showBookMenu,showInventoryMenu }) => {
  const role = useSelector((state: RootState) => state.auth.role);
  const isAdmin = role === "Admin";

  const [open, setOpen] = useState(false);
  const [subMenuOpen, setSubMenuOpen] = useState<number | null>(null);
  const drawerRef = useRef(null);

  const handleDrawerOpen = () => setOpen(true);
  const handleDrawerClose = () => setOpen(false);
  
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
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
                width={100}
                height={40}
                className="logo"
                priority
              />
            </div>
          )}
          <IconButton onClick={open ? handleDrawerClose : handleDrawerOpen}>
            {open ? <CloseIcon /> : <MenuIcon className="menu-header" />}
          </IconButton>
        </div>
        <List>
          {menuItems
            .filter((menuItem) => {
              // Hide YEN PURCHASE if no permission
              if (menuItem.text === "YEN PURCHASE" && !showPurchaseMenu) {
                return false;
              }

              // Hide YEN BOOK if no permission
              if (menuItem.text === "YEN BOOK" && !showBookMenu) {
                return false;
              }
              if (menuItem.text === "YEN INVENTORY" && !showInventoryMenu)
              { return false;
              }
              // ACCOUNT SETTINGS only for Admin
              if (menuItem.text === "ACCOUNT SETTINGS" && !isAdmin) {
                return false;
              }

              // SETTINGS - Show only for Admin (or based on your permission logic)
              if (menuItem.text === "SETTINGS") {
                // Show only for Admin users
                return isAdmin;
              }

              return true;
            })
            .map((menuItem, index) => (
              <React.Fragment key={index}>
<ListItem 
  button 
  onClick={() => handleMenuItemClick(menuItem)}
  sx={{ 
    justifyContent: open ? 'flex-start' : 'center',
    px: open ? 2 : 0,
  }}
>
                 <ListItemIcon sx={{ minWidth: 0, justifyContent: 'center', width: '100%' }}>
  <div style={{ 
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center',
    width: '100%',
    textAlign: 'center'
  }}>
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
                        onClick={() => handleMenuItemClick({ 
                          path: `${menuItem.path}/${subItem.replace(/\s+/g, '')}`, 
                          text: subItem 
                        })}
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