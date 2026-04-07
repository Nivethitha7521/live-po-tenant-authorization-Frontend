"use client";
import React from "react";
import Link from "next/link";
import { Button, Box } from "@mui/material";
import { usePathname } from "next/navigation";
import YenInventoryPage from "../page";
import { usePermissions } from "@/hooks/usePermissions";
type SubItem = {
  label: string;
  path: string;
  module: string;
};
const subItems: SubItem[] = [
  {
    label: "Physical Stock Modification",
    path: "/yen-inventory/WarehouseInventoryManagement/stockModification",
    module: "warehousephysicalstockmodification",
  },
  {
    label: "Physical Stock Variance Modification",
    path: "/yen-inventory/WarehouseInventoryManagement/storeStockModification",
    module: "warehousephysicalstockvariancemodification",
  },
  {
    label: "Stock Ledger",
    path: "/yen-inventory/WarehouseInventoryManagement/ledger",
    module: "warehousestockledger",
  },
];
const WarehouseInventoryManagementPage = () => {
  const pathname = usePathname();
 const { isModuleVisible } = usePermissions();

  return (
    <div>
      <YenInventoryPage />
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          gap: 2,
          ml: 2,
          marginTop: 1,
        }}
      >
       {subItems
          .filter((item) => isModuleVisible("yenerp", item.module))
          .map((item) => {
            const isActive = pathname?.startsWith(item.path);

            return (
              <Link key={item.label} href={item.path} passHref prefetch={false}>
                <Button
                  component="a"
                  variant="contained"
                  sx={{
                    backgroundColor: isActive ? "white" : "primary.main",
                    color: isActive ? "black" : "white",
                    "&:hover": {
                      backgroundColor: isActive
                        ? "rgba(255, 255, 255, 0.8)"
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
    </div>
  );
};

export default WarehouseInventoryManagementPage;
  