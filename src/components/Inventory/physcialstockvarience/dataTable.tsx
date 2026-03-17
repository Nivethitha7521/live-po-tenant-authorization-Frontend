"use client";

import React, { useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
  Typography,
  Button,
  useMediaQuery,
  useTheme,
  Tooltip,
} from "@mui/material";
import {
  Branchitem,
  EditableRow,
} from "@/features/yen_inventory/OutletPhysicalVarianceSlice";
import DotLoaderLike from "@/components/Loaders/DotLoaderWrapper";

import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import CancelIcon from "@mui/icons-material/Cancel";

interface DataTableProps {
  filteredItems: Branchitem[];
  visibleColumns: Record<string, boolean>;
  fieldTypes: string[];
  selectedLocation: string;
  editableRows: Record<string, EditableRow>;
  onCellEdit: (
    id: string,
    field: string,
    value: string,
    itemName: string,
    varianceName: string
  ) => void;
  totalColspan: number;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  hasMoreData: boolean;
  isLoadingMore: boolean;
  inputRefs: React.MutableRefObject<{ [key: string]: HTMLInputElement | null }>;
  isFullScreen: boolean;
  handleApproveClick: (item: Branchitem) => void;
  loading: boolean;
  tableContainerRef?: React.RefObject<HTMLDivElement>;
  canApprove: boolean;
}

const DataTable: React.FC<DataTableProps> = ({
  filteredItems,
  visibleColumns,
  fieldTypes,
  selectedLocation,
  editableRows,
  onCellEdit,
  totalColspan,
  canApprove,
  onScroll,
  scrollContainerRef,
  isFullScreen,
  handleApproveClick,
  loading,
  tableContainerRef,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // Scroll handler fix
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let rafId: number;
    const handleScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        container.style.pointerEvents = "";
      });
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(rafId);
    };
  }, [scrollContainerRef]);

  // Tooltip popper props
  const tooltipPopperProps = {
    sx: { zIndex: 10000 },
    modifiers: [
      { name: "preventOverflow", options: { boundary: "viewport" } },
      { name: "flip", options: { boundary: "viewport" } },
    ],
  };

  if (!selectedLocation) {
    return (
      <Box
        sx={{
          height: isFullScreen ? "100%" : "calc(100vh - 250px)",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          p: 2,
        }}
      >
        <Typography color="textPrimary" variant="h5" fontWeight="bold">
          Please select a location to view stock data
        </Typography>
      </Box>
    );
  }

  const renderApprovalStatusField = (status: string) => {
    switch (status) {
      case "Approved":
        return <CheckCircleIcon sx={{ color: "green" }} titleAccess="Approved" />;
      case "Pending":
        return <HourglassEmptyIcon sx={{ color: "#1976d2" }} titleAccess="Pending" />;
      case "Not Available":
        return <CancelIcon sx={{ color: "#9e9e9e" }} titleAccess="Not Available" />;
      default:
        return null;
    }
  };

  // Helper for Action button (kept unchanged)
  const renderActionButton = (row: Branchitem) => {
    if (row.approvalStatus === "Not Available") {
      return (
        <Button
          variant="contained"
          size="small"
          disabled
          sx={{ fontSize: "11px", backgroundColor: "#9e9e9e" }}
        >
          Approve
        </Button>
      );
    } else if (row.approvalStatus === "Approved") {
      return (
        <Button
          variant="contained"
          size="small"
          disabled
          sx={{
            fontSize: "11px",
            backgroundColor: "#2e7d32",
            "&:hover": { backgroundColor: "#2e7d32" },
          }}
        >
          Approved
        </Button>
      );
    }else if (row.approvalStatus === "Pending" || row.approveButton) {
  return (
    <Button
      variant="contained"
      size="small"
      disabled={!canApprove}   // 👈 ADD THIS
      onClick={() => handleApproveClick(row)}
      sx={{
        fontSize: "11px",
        backgroundColor: "#1976d2",
        "&:hover": { backgroundColor: "#1565c0" },
      }}
    >
      Approve
    </Button>
  );
}
    return null;
  };

  return (
    <Box
      sx={{
        display: "flex",
        overflow: "hidden",
        width: "100%",
        height: isFullScreen ? "100%" : "auto",
        ml: 2,
      }}
    >
      <TableContainer
        ref={scrollContainerRef}
        onScroll={onScroll}
        sx={{
          height: isFullScreen ? "100%" : "calc(100vh - 250px)",
          width: "100%",
          overflowX: "auto",
          overflowY: "auto",
          scrollbarGutter: "stable both-edges",
          "&::-webkit-scrollbar": { height: "8px" },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: "rgba(0,0,0,0.3)",
            borderRadius: "4px",
          },
        }}
      >
        <Table
          stickyHeader={!isMobile}
          size="small"
          sx={{
            tableLayout: isMobile ? "auto" : "fixed",
            width: "100%",
            minWidth: 0,
            borderCollapse: "collapse",
            "& th, & td": { whiteSpace: "nowrap" },
          }}
        >
          {!isMobile && (
            <TableHead>
              <TableRow>
                {visibleColumns["S.No"] && (
                  <TableCell sx={{ fontWeight: "bold", width: 60, overflow: "hidden" }}>
                    <Tooltip
                      title={"S.NO"}
                      arrow
                      disableInteractive
                      PopperProps={tooltipPopperProps}
                    >
                      <span
                        style={{
                          display: "block",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          textTransform: "uppercase",
                        }}
                      >
                        S.No
                      </span>
                    </Tooltip>
                  </TableCell>
                )}

                {visibleColumns["itemCode"] && (
                  <TableCell sx={{ fontWeight: "bold", width: 100, overflow: "hidden" }}>
                    <Tooltip
                      title={"ITEM CODE"}
                      arrow
                      disableInteractive
                      PopperProps={tooltipPopperProps}
                    >
                      <span
                        style={{
                          display: "block",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          textTransform: "uppercase",
                        }}
                      >
                        Item Code
                      </span>
                    </Tooltip>
                  </TableCell>
                )}

                {visibleColumns["Item Name"] && (
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      maxWidth: 150,
                      overflow: "hidden",
                    }}
                  >
                    <Tooltip
                      title={"ITEM NAME"}
                      arrow
                      disableInteractive
                      PopperProps={tooltipPopperProps}
                    >
                      <span
                        style={{
                          display: "block",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          textTransform: "uppercase",
                        }}
                      >
                        Item Name
                      </span>
                    </Tooltip>
                  </TableCell>
                )}

                <TableCell
                  sx={{
                    fontWeight: "bold",
                    maxWidth: 150,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  <Tooltip
                    title={"VARIANCE NAME"}
                    arrow
                    disableInteractive
                    PopperProps={tooltipPopperProps}
                  >
                    <span style={{ textTransform: "uppercase" }}>Variance Name</span>
                  </Tooltip>
                </TableCell>

                {fieldTypes
                  .filter((field) => visibleColumns[field])
                  .map((field) => (
                    <TableCell
                      key={field}
                      sx={{
                        fontWeight: "bold",
                        maxWidth: 120,
                        overflow: "hidden",
                        textAlign: "center",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <Tooltip
                        title={field.toUpperCase()}
                        arrow
                        disableInteractive
                        PopperProps={tooltipPopperProps}
                      >
                        <span
                          style={{
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            textTransform: "uppercase",
                          }}
                        >
                          {field}
                        </span>
                      </Tooltip>
                    </TableCell>
                  ))}
              </TableRow>
            </TableHead>
          )}

          <TableBody>
            {loading && filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={totalColspan} sx={{ border: "none", py: 6 }}>
                  <DotLoaderLike message="" />
                </TableCell>
              </TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={totalColspan}
                  sx={{ py: 6, textAlign: "center", color: "#999" }}
                >
                  No records found
                </TableCell>
              </TableRow>
            ) : (
              <>
                {filteredItems.map((row, index) =>
                  isMobile ? (
                    <Box
                      key={row.id}
                      sx={{
                        mb: 2,
                        p: 2,
                        borderRadius: "12px",
                        border: "1px solid #e0e0e0",
                        backgroundColor: "#fff",
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>
                        <Tooltip
                          title={`${row.itemName} (${row.varianceName})`}
                          arrow
                          disableInteractive
                          followCursor
                          PopperProps={tooltipPopperProps}
                        >
                          <span
                            style={{
                              display: "block",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {row.itemName} ({row.varianceName})
                          </span>
                        </Tooltip>
                      </Typography>
                      <Typography variant="caption" color="textSecondary" noWrap>
                        <Tooltip
                          title={`${row.category} | ${row.subCategory}`}
                          arrow
                          disableInteractive
                          followCursor
                          PopperProps={tooltipPopperProps}
                        >
                          <span
                            style={{
                              display: "block",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {row.category} | {row.subCategory}
                          </span>
                        </Tooltip>
                      </Typography>

                      <Box sx={{ mt: 1 }}>
                        {fieldTypes
                          .filter((field) => visibleColumns[field])
                          .map((field) => {
                            const fieldKey = `${selectedLocation}-${field}`;
                            const isEditable = field === "Physical Variance";
                            const rawValue =
                              editableRows[row.id]?.[fieldKey] ?? row[fieldKey] ?? "0";
                            const value = String(rawValue);
                            if (field === "Status") {
                              return (
                                <Box key={fieldKey} mt={0.5} display="flex" alignItems="center">
                                  <Typography variant="caption" mr={1}>Status</Typography>

                                  <Tooltip
                                    title={row.approvalStatus || "Unknown"}
                                    arrow
                                    followCursor
                                    PopperProps={tooltipPopperProps}
                                  >
                                    <Box sx={{ display: "inline-flex", cursor: "pointer" }}>
                                      {renderApprovalStatusField(row.approvalStatus)}
                                    </Box>
                                  </Tooltip>
                                </Box>
                              );
                            }

                            if (field === "Action") {
                              return (
                                <Box key={fieldKey} mt={1} display="flex" justifyContent="space-between" alignItems="center">
                                  <Typography variant="caption">Action</Typography>
                                  {renderActionButton(row)}
                                </Box>
                              );
                            }

                            return (
                              <Box key={fieldKey} mt={0.5}>
                                <Typography variant="caption" noWrap>
                                  <Tooltip
                                    title={value}
                                    arrow
                                    disableInteractive
                                    followCursor
                                    PopperProps={tooltipPopperProps}
                                  >
                                    <span
                                      style={{
                                        display: "block",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {value}
                                    </span>
                                  </Tooltip>
                                </Typography>
                                {isEditable && (
                                  <input
                                    value={value}
                                    onChange={(e) =>
                                      onCellEdit(
                                        row.id,
                                        fieldKey,
                                        e.target.value,
                                        row.itemName,
                                        row.varianceName
                                      )
                                    }
                                    style={{
                                      width: "80%",
                                      padding: "2px 4px",
                                      fontSize: "12px",
                                      textAlign: "center",
                                      textOverflow: "ellipsis",
                                    }}
                                  />
                                )}
                              </Box>
                            );
                          })}
                      </Box>
                    </Box>
                  ) : (
                    <TableRow key={row.id}>
                      {visibleColumns["S.No"] && <TableCell>{index + 1}</TableCell>}
                      {visibleColumns["itemCode"] && (
                        <TableCell
                          sx={{
                            maxWidth: 100,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          <Tooltip
                            title={row.itemCode}
                            arrow
                            disableInteractive
                            followCursor
                            PopperProps={tooltipPopperProps}
                          >
                            <span>{row.itemCode}</span>
                          </Tooltip>
                        </TableCell>
                      )}
                      {visibleColumns["Item Name"] && (
                        <TableCell
                          sx={{
                            maxWidth: 150,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          <Tooltip
                            title={row.itemName}
                            arrow
                            disableInteractive
                            followCursor
                            PopperProps={tooltipPopperProps}
                          >
                            <span>{row.itemName}</span>
                          </Tooltip>
                        </TableCell>
                      )}
                      {visibleColumns["Variance Name"] && (
                        <TableCell
                          sx={{
                            maxWidth: 150,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          <Tooltip
                            title={row.varianceName}
                            arrow
                            disableInteractive
                            followCursor
                            PopperProps={tooltipPopperProps}
                          >
                            <span>{row.varianceName}</span>
                          </Tooltip>
                        </TableCell>
                      )}
                      {visibleColumns["Category"] && (
                        <TableCell
                          sx={{
                            maxWidth: 100,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          <Tooltip
                            title={row.category}
                            arrow
                            disableInteractive
                            followCursor
                            PopperProps={tooltipPopperProps}
                          >
                            <span>{row.category}</span>
                          </Tooltip>
                        </TableCell>
                      )}
                      {visibleColumns["Subcategory"] && (
                        <TableCell
                          sx={{
                            maxWidth: 100,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          <Tooltip
                            title={row.subCategory}
                            arrow
                            disableInteractive
                            followCursor
                            PopperProps={tooltipPopperProps}
                          >
                            <span>{row.subCategory}</span>
                          </Tooltip>
                        </TableCell>
                      )}

                      {fieldTypes
                        .filter((field) => visibleColumns[field])
                        .map((field) => {
                          const fieldKey = `${selectedLocation}-${field}`;
                          const isEditable = field === "Physical Variance";
                          const rawValue =
                            editableRows[row.id]?.[fieldKey] ?? row[fieldKey] ?? "0";
                          const value = String(rawValue);
                          const numericValue = Number(value);
                          const isNegative = !isNaN(numericValue) && numericValue < 0;

                          if (field === "Status") {
                            return (
                              <TableCell key={fieldKey} align="center">
                                <Tooltip
                                  title={row.approvalStatus || "Unknown"}
                                  arrow
                                  followCursor
                                  PopperProps={tooltipPopperProps}
                                >
                                  <Box sx={{ display: "inline-flex", cursor: "pointer" }}>
                                    {renderApprovalStatusField(row.approvalStatus)}
                                  </Box>
                                </Tooltip>
                              </TableCell>
                            );
                          }

                          if (field === "Action") {
                            return (
                              <TableCell key={fieldKey} align="center">
                                {renderActionButton(row)}
                              </TableCell>
                            );
                          }

                          return (
                            <TableCell
                              key={fieldKey}
                              align="center"
                              sx={{
                                color: isNegative ? "error.main" : "inherit",
                                fontWeight: isNegative ? 600 : 400,
                                maxWidth: 120,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {isEditable ? (
                                <input
                                  value={value}
                                  onChange={(e) =>
                                    onCellEdit(
                                      row.id,
                                      fieldKey,
                                      e.target.value,
                                      row.itemName,
                                      row.varianceName
                                    )
                                  }
                                  style={{
                                    width: "80%",
                                    padding: "2px 4px",
                                    fontSize: "12px",
                                    textAlign: "center",
                                    textOverflow: "ellipsis",
                                  }}
                                />
                              ) : (

                                <span
                                  style={{
                                    display: "block",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {value}
                                </span>
                              )}
                            </TableCell>
                          );
                        })}
                    </TableRow>
                  )
                )}

                {loading && (
                  <TableRow>
                    <TableCell colSpan={totalColspan} sx={{ border: "none", py: 2 }}>
                      <DotLoaderLike message="" />
                    </TableCell>
                  </TableRow>
                )}
              </>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default React.memo(DataTable);
