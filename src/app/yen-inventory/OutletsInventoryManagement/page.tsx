"use client";

import React from "react";
import Link from "next/link";
import { Button, Box } from "@mui/material";
import { usePathname } from "next/navigation";
import YenInventoryPage from "../page";
import { usePermissions } from "@/hooks/usePermissions";

/* ✅ TYPE DEFINE */
type SubItem = {
  label: string;
  path: string;
  module: string;
};

/* ✅ ADD MODULE FIELD */
const subItems2: SubItem[] = [
  {
    label: "Physical Stock Modification",
    path: "/yen-inventory/OutletsInventoryManagement/OutletPhysicalStockModification",
    module: "physicalstockmodification",
  },
  {
    label: "Physical Stock Variance Modification",
    path: "/yen-inventory/OutletsInventoryManagement/OutletPhysicalStockVarianceModification",
    module: "physicalstockvariancemodification",
  },
  {
    label: "Stock Ledger",
    path: "/yen-inventory/OutletsInventoryManagement/ledger",
    module: "stockledger",
  },
];

const OutletsInventoryManagementPage = () => {
  const pathname = usePathname();

  /* ✅ PERMISSION HOOK */
  const { isModuleVisible } = usePermissions();

  return (
    <Box>
      <YenInventoryPage />

      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          gap: 2,
          paddingLeft: 2,
          marginTop: 1,
        }}
      >
        {/* ✅ FILTER BASED ON PERMISSION */}
        {subItems2
          .filter((item) => isModuleVisible("yenerp", item.module))
          .map((item) => {
            const isActive = pathname?.startsWith(item.path);

            return (
              <Link key={item.label} href={item.path} passHref prefetch={false}>
                <Button
                  variant="contained"
                  component="a"
                  sx={{
                    backgroundColor: isActive ? "white" : "primary.main",
                    color: isActive ? "black" : "white",
                    "&:hover": {
                      backgroundColor: isActive
                        ? "rgba(255,255,255,0.8)"
                        : "primary.dark",
                    },
                  }}
                >
                  {item.label}
                </Button>
              </Link>
            );
          })}
      </Box>
    </Box>
  );
};

export default OutletsInventoryManagementPage;