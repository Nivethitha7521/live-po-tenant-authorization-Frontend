"use client";

import React, { useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Typography,
  Box,
  useTheme,
  useMediaQuery,
  Tooltip,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import CancelIcon from "@mui/icons-material/Cancel";

import { RawMaterialStore } from "../../../features/yen_inventory/wharehoueStoreSlice";
import DotLoaderLike from "@/components/Loaders/DotLoaderWrapper";

interface DataTableProps {
  filteredItems: RawMaterialStore[];
  visibleColumns: Record<string, boolean>;
  staticColumns: string[];
  fieldTypes: string[];
  totalColspan: number;
  hasMoreData: boolean;
  isLoadingMore: boolean;
  isFullScreen: boolean;
  handleApproveClick: (item: RawMaterialStore) => void;
   canApprove: boolean;
  handleTableScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement>;
}

const DataTable: React.FC<DataTableProps> = ({
  filteredItems,
  visibleColumns,
  staticColumns,
  fieldTypes,
  totalColspan,
  isLoadingMore,
  handleApproveClick,
  handleTableScroll,
  scrollContainerRef,
  canApprove
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const renderApprovalStatusField = (status?: string) => {
    switch (status) {
      case "Approved":
        return (
          <Tooltip title="Approved" arrow disableInteractive followCursor>
            <CheckCircleIcon sx={{ color: "#2e7d32", fontSize: 20 }} />
          </Tooltip>
        );
      case "Pending":
        return (
          <Tooltip title="Pending" arrow disableInteractive followCursor>
            <HourglassEmptyIcon sx={{ color: "#1976d2", fontSize: 20 }} />
          </Tooltip>
        );
      case "Not Available":
        return (
          <Tooltip title="Not Available" arrow disableInteractive followCursor>
            <CancelIcon sx={{ color: "#9e9e9e", fontSize: 20 }} />
          </Tooltip>
        );
      default:
        return (
          <Tooltip title="Pending" arrow disableInteractive followCursor>
            <HourglassEmptyIcon sx={{ color: "#1976d2", fontSize: 20 }} />
          </Tooltip>
        );
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;

    let rafId: number;
    const handleScroll = () => {
      if (container) container.style.pointerEvents = "none";
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (container) container.style.pointerEvents = "";
      });
    };

    container?.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      container?.removeEventListener("scroll", handleScroll);
      window.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(rafId);
    };
  }, [scrollContainerRef]);

  const headerDisplayMap: Record<string, string> = {
    openingStock: "Opening Stock",
    receivedQty: "Received Qty",
    returnedQty: "Returned Qty",
    dispatchQty: "Dispatch Qty",
    warehouseReturn: "Warehouse Return",
    currentSystem: "System Stock",
    SystemStock: "System Stock",
    PhysicalStock: "Physical Stock",
    variance: "Variance",
    approvalStatus: "Approval Status",
    approvalButton: "Action",
  };

  const allColumns = [
    "S.No",
    "Item Code",
    "Category",
    "Subcategory",
    "Itemgroup",
    "Item Name",
    ...fieldTypes,
  ];

  const visibleColumnKeys = allColumns.filter((key) => visibleColumns[key]);
  const truncateColumns = ["Item Name", "Category", "Subcategory", "Itemgroup"];

  return (
    <Box sx={{ width: "100%" }}>
      <TableContainer
        ref={scrollContainerRef}
        onScroll={handleTableScroll}
        sx={{
          maxHeight: isMobile ? "auto" : "calc(100vh - 100px)",
          width: "100%",
          overflow: "auto",
        }}
      >
        {!isMobile ? (
          <Table
            stickyHeader
            size="small"
            sx={{
              width: "100%",
              tableLayout: "fixed",
              "& .MuiTableCell-root": {
                height: 42,
                maxHeight: 42,
                padding: "4px 8px",
                verticalAlign: "middle",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                fontSize: "13px",
              },
            }}
          >
            <TableHead>
              <TableRow>
                {visibleColumnKeys.map((colKey) => {
                  const displayHeaderRaw =
                    staticColumns.includes(colKey) || colKey === "Itemgroup"
                      ? colKey
                      : headerDisplayMap[colKey] || colKey;

                  const displayHeader = displayHeaderRaw.toUpperCase();
                  return (
                    <TableCell
                      key={colKey}
                      align="center"
                      sx={{
                        fontWeight: "bold",
                        backgroundColor: "#f5f5f5",
                        height: 44,
                        maxHeight: 44,
                        ...(colKey === "S.No" && {
                          width: 60,
                          minWidth: 60,
                          maxWidth: 60,
                        }),
                        ...(truncateColumns.includes(colKey) && {
                          maxWidth: 150,
                          textAlign: "left",
                        }),
                      }}
                    >
                      <Tooltip
                        title={displayHeader}
                        arrow
                        disableInteractive
                        followCursor
                      >
                        <Box
                          component="span"
                          sx={{
                            display: "block",
                            width: "100%",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {displayHeader}
                        </Box>
                      </Tooltip>
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableHead>

            <TableBody>
              {!isLoadingMore && filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={totalColspan} align="center" sx={{ py: 4 }}>
                    <DotLoaderLike message="" />
                  </TableCell>
                </TableRow>
              ) : filteredItems.length > 0 ? (
                filteredItems.map((item, index) => (
                  <TableRow key={item.itemCode}>
                    {visibleColumnKeys.map((colKey) => {
                      let cellValue: React.ReactNode;

                      switch (colKey) {
                        case "S.No":
                          cellValue = index + 1;
                          break;
                        case "Item Code":
                          cellValue = item.itemCode || "-";
                          break;
                        case "Category":
                          cellValue = item.category || "-";
                          break;
                        case "Subcategory":
                          cellValue = item.subcategory || "-";
                          break;
                        case "Item Name":
                          cellValue = item.itemName || "-";
                          break;
                        case "Itemgroup":
                          cellValue = item.varianceName || "-";
                          break;
                        case "Opening Stock":
                          cellValue = item.openingStock ?? "0";
                          break;
                        case "Receiving Stock":
                          cellValue = item.receivedQty ?? "0";
                          break;
                        case "Returned Stock":
                          cellValue = item.returnedQty ?? "0";
                          break;
                        case "Dispatch Stock":
                          cellValue = item.dispatchQty ?? "0";
                          break;
                        case "WH-Return":
                          cellValue = item.warehouseReturn ?? "0";
                          break;
                        case "Calc System":
                          cellValue = item.currentSystem ?? "0";
                          break;
                        case "SystemStock":
                          cellValue = item.updatedCurrentSystem ?? "0";
                          break;
                        case "PhysicalStock":
                          cellValue = item.physicalClosing ?? "0";
                          break;
                        case "Variance":
                          cellValue = item.variance ?? "0";
                          break;
                        case "Status":
                          // ✅ Render status with icon + tooltip
                          cellValue = renderApprovalStatusField(item.approvalStatus);
                          break;
                        case "Action":
                          cellValue =
                            item.approvalStatus === "Not Available" ? (
                              <Button
                                variant="contained"
                                size="small"
                                disabled
                                sx={{ fontSize: "11px", width: "90%", backgroundColor: "#9e9e9e" }}
                              >
                                Approve
                              </Button>
                            ) : item.approvalStatus === "Approved" ? (
                              <Button
                                variant="contained"
                                size="small"
                                disabled
                                sx={{
                                  fontSize: "11px",
                                  width: "90%",
                                  backgroundColor: "#2e7d32",
                                  "&:hover": { backgroundColor: "#2e7d32" },
                                }}
                              >
                                Approved
                              </Button>
                            ) : (
                              <Button
                                variant="contained"
                                size="small"
                                 disabled={!canApprove}
                                onClick={() => handleApproveClick(item)}
                                sx={{
                                  fontSize: "11px",
                                  width: "90%",
                                  backgroundColor: "#1976d2",
                                  "&:hover": { backgroundColor: "#1976d2" },
                                }}
                              >
                                Approve
                              </Button>
                            );
                          break;
                        default:
                          const dynamicValue = item[colKey as keyof RawMaterialStore];
                          cellValue =
                            dynamicValue !== undefined &&
                              dynamicValue !== null &&
                              dynamicValue !== ""
                              ? dynamicValue
                              : "N/A";
                      }

                      const numericValue =
                        typeof cellValue === "number"
                          ? cellValue
                          : typeof cellValue === "string" && !isNaN(Number(cellValue))
                            ? Number(cellValue)
                            : null;

                      const isNegative = numericValue !== null && numericValue < 0;
                      const isTruncatedColumn =
                        truncateColumns.includes(colKey) && typeof cellValue === "string";

                      return (
                        <TableCell
                          key={colKey}
                          align={isTruncatedColumn ? "left" : "center"}
                          sx={{
                            color: isNegative ? "error.main" : "inherit",
                            fontWeight: isNegative ? 600 : "inherit",
                            maxWidth: isTruncatedColumn ? 150 : undefined,
                            whiteSpace: isTruncatedColumn ? "nowrap" : "normal",
                            overflow: isTruncatedColumn ? "hidden" : "visible",
                            textOverflow: isTruncatedColumn ? "ellipsis" : "unset",
                          }}
                        >
                          {isTruncatedColumn ? (
                            <Tooltip title={cellValue} arrow disableInteractive followCursor>
                              <span>{cellValue}</span>
                            </Tooltip>
                          ) : (
                            cellValue
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={totalColspan} align="center">
                    <Typography variant="body1" color="textSecondary">
                      No data available.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}

              {isLoadingMore && filteredItems.length > 0 && (
                <TableRow>
                  <TableCell colSpan={totalColspan} align="center">
                    <DotLoaderLike message="" />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        ) : (
          // Mobile Card View
          <Box>
            {filteredItems.map((item, index) => (
              <Box
                key={item.itemCode}
                sx={{
                  mb: 2,
                  p: 2,
                  borderRadius: 1,
                  border: "1px solid #e0e0e0",
                  backgroundColor: "#fff",
                }}
              >
                <Tooltip
                  title={`${item.itemName} (${item.varianceName})`}
                  arrow
                  disableInteractive
                  followCursor
                >
                  <Typography variant="subtitle2" fontWeight={600} noWrap>
                    {item.itemName} ({item.varianceName})
                  </Typography>
                </Tooltip>

                <Tooltip
                  title={`${item.category} | ${item.subcategory}`}
                  arrow
                  disableInteractive
                  followCursor
                >
                  <Typography variant="caption" color="textSecondary" noWrap>
                    {item.category} | {item.subcategory}
                  </Typography>
                </Tooltip>

                {visibleColumnKeys
                  .filter((colKey) => colKey !== "Item Name" && colKey !== "Itemgroup")
                  .map((colKey) => {
                    if (colKey === "Status") {
                      return (
                        <Box key={colKey} mt={0.5} display="flex" alignItems="center" gap={1}>
                          <Typography variant="caption">
                            {headerDisplayMap[colKey] || colKey}
                          </Typography>
                          {renderApprovalStatusField(item.approvalStatus)}
                        </Box>
                      );
                    }

                    let value: any;
                    if (colKey === "S.No") value = index + 1;
                    else value = item[colKey as keyof RawMaterialStore] ?? "0";

                    if (colKey === "Action") {
                      return (
                        <Box key={colKey} mt={1} display="flex" justifyContent="flex-start" gap={1}>
                          {item.approvalStatus === "Not Available" ? (
                            <Button
                              variant="contained"
                              size="small"
                              disabled
                              sx={{ fontSize: 11, backgroundColor: "#9e9e9e" }}
                            >
                              Approve
                            </Button>
                          ) : item.approvalStatus === "Approved" ? (
                            <Button
                              variant="contained"
                              size="small"
                              disabled
                              sx={{ fontSize: 11, backgroundColor: "#2e7d32" }}
                            >
                              Approved
                            </Button>
                          ) : (
                            <Button
                              variant="contained"
                              size="small"
                               disabled={!canApprove}
                              onClick={() => handleApproveClick(item)}
                              sx={{ fontSize: 11, backgroundColor: "#1976d2" }}
                            >
                              Approve
                            </Button>
                          )}
                        </Box>
                      );
                    }

                    return (
                      <Box key={colKey} mt={0.5} display="flex" justifyContent="space-between">
                        <Typography variant="caption">{headerDisplayMap[colKey] || colKey}</Typography>
                        <Typography variant="body2">{value}</Typography>
                      </Box>
                    );
                  })}
              </Box>
            ))}

            {isLoadingMore && (
              <Box textAlign="center" py={2}>
                <DotLoaderLike message="" />
              </Box>
            )}
          </Box>
        )}
      </TableContainer>
    </Box>
  );
};

export default DataTable;