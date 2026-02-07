// vendor/page.tsx
"use client";
import React from "react";
import Link from "next/link";
import { Button, Box } from "@mui/material";
import { usePathname, useRouter } from "next/navigation";
import YenPurchasePage from "../page";
import { usePermissions } from "../../../hooks/usePermissions"; // Add this import

const MenuPage = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { isModuleVisible } = usePermissions(); // Add this hook

  // Define all sub items with their module names
  const allSubItems = React.useMemo(
    () => [
      {
        id: 1,
        label: "Vendor Type",
        path: "/yen-purchase/VendorPage/VendorType",
        module: "vendortype", // Add module name for permission check
      },
      {
        id: 2,
        label: "Vendors",
        path: "/yen-purchase/VendorPage/Vendor",
        module: "vendors", // Add module name for permission check
      },
    ],
    [],
  );

  // Filter sub items based on module visibility
  const visibleSubItems = React.useMemo(
    () => allSubItems.filter((item) => isModuleVisible("yenerp", item.module)),
    [allSubItems, isModuleVisible],
  );

  React.useEffect(() => {
    // Redirect to first visible sub item if current path is base VendorPage
    if (
      pathname === "/yen-purchase/VendorPage" ||
      pathname === "/yen-purchase/VendorPage/"
    ) {
      if (visibleSubItems.length > 0) {
        router.replace(visibleSubItems[0].path);
      }
    }

    // If current active path is not visible, redirect to first visible
    const currentItem = allSubItems.find((item) => item.path === pathname);
    if (currentItem && !isModuleVisible("yenerp", currentItem.module)) {
      if (visibleSubItems.length > 0) {
        router.replace(visibleSubItems[0].path);
      }
    }
  }, [pathname, router, visibleSubItems, isModuleVisible, allSubItems]);

  const buttonStyles = (isActive: boolean) => ({
    backgroundColor: isActive ? "#ffffff" : "primary.main",
    color: isActive ? "#000000" : "white",
    fontWeight: "normal",
    transition: "all 0.2s ease",
    boxShadow: isActive ? "0px 0px 10px rgba(0, 0, 0, 0.5)" : "none",
    minWidth: "100px",
    borderRadius: "4px",
    textTransform: "none",
    fontSize: "0.875rem",
    px: 3,
    py: 1,
    "&:hover": {
      backgroundColor: isActive ? "#ffffff" : "primary.main",
      color: isActive ? "#000000" : "white",
      boxShadow: isActive ? "0px 0px 10px rgba(0, 0, 0, 0.5)" : "none",
    },
  });

  const cleanPath = pathname?.replace(/\/$/, "");

  // If no sub items are visible, show nothing or a message
  if (visibleSubItems.length === 0) {
    return (
      <div>
        <YenPurchasePage />
        <Box sx={{ p: 3, textAlign: "center" }}>
          No vendor modules accessible
        </Box>
      </div>
    );
  }

  return (
    <div>
      <YenPurchasePage />
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          gap: 1,
          mb: 2,
          mt: 1,
          ml: "15px",
          alignItems: "center",
        }}
      >
        {visibleSubItems.map((item) => {
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
