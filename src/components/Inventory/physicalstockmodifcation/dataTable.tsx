"use client";
import React, { useState, useCallback, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Box,
  Typography,
  useMediaQuery,
  useTheme,
  Tooltip,
} from "@mui/material";
import { useSelector } from "react-redux";
import { selectVisibleColumns } from "../../../features/yen_inventory/OuletePhysicalStockSlice";
import DotLoaderLike from "@/components/Loaders/DotLoaderWrapper";

export interface Row {
  index: number;
  itemCode: string;
  category: string;
  subcategory: string;
  itemName: string;
  varianceName: string;
  closingQty: string;
  systemStock?: number;
  systemStockSo?: number;
  physicalStock?: number;
  previousSystemStock?: number;
}

interface DataTableProps {
  rows: Row[];
  selectedBranches: string;
  onPhysicalStockChange: (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    itemName: string,
    varianceName: string,
    branchName: string,
    itemCode: string
  ) => void;
  canEdit: boolean;
  loading: boolean;
  tableContainerRef: React.RefObject<HTMLDivElement>;
  inputRefs: React.MutableRefObject<Array<HTMLInputElement | null>>;
  resetInputs: boolean;
}

const DataTable: React.FC<DataTableProps> = ({
  rows,
  selectedBranches,
  onPhysicalStockChange,
  inputRefs,
  tableContainerRef,
  loading,
  resetInputs,
  canEdit,
}) => {
  const [tempStocks, setTempStocks] = useState<Record<string, number | string>>({});
  const visibleColumns = useSelector(selectVisibleColumns);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const isColumnVisible = (columnKey: string) => visibleColumns[columnKey] !== false;
  const [touchedKeys, setTouchedKeys] = useState<Set<string>>(new Set());

  // Reset inputs when resetInputs prop changes
  useEffect(() => {
    if (resetInputs) {
      setTempStocks({});
      setTouchedKeys(new Set());
    }
  }, [resetInputs]);

  // ✅ FIX: Hide tooltips on scroll by briefly disabling pointer events
  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container) return;

    let rafId: number;
    const handleScroll = () => {
      container.style.pointerEvents = "none";
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
  }, [tableContainerRef]);

  const handlePhysicalStockChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, row: Row) => {
      const value = e.target.value;
      const key = `${row.itemName}-${row.varianceName}-${selectedBranches}`;
      if (value === "" || /^[0-9]*\.?[0-9]*$/.test(value)) {
        setTempStocks((prev) => ({ ...prev, [key]: value }));
        setTouchedKeys((prev) => new Set(prev).add(key));
        onPhysicalStockChange(e, row.itemName, row.varianceName, selectedBranches, row.itemCode);
      }
    },
    [onPhysicalStockChange, selectedBranches]
  );

  const getTextFieldSx = (width: string) => ({
    "& .MuiInputBase-root": {
      height: "38px",
      width: width,
      fontSize: "1rem",
      backgroundColor: "#fff",
      transition: "all 0.2s ease-in-out",
    },
    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: "#ccc",
    },
    "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
      borderColor: "#1976d2",
      borderWidth: "2px",
    },
    "& input": {
      textAlign: "center",
      p: 0,
      fontWeight: 700,
      color: "#333",
    },
  });

  const toTooltip = (value: any): string =>
    value === null || value === undefined ? "" : String(value);

  return (
    <Box sx={{ width: "100%", height: "100%", position: "relative" }}>
      <TableContainer
        ref={tableContainerRef}
        component={isMobile ? Box : Paper}
        elevation={0}
        sx={{
          maxHeight: isMobile ? "calc(100vh - 180px)" : "calc(87vh - 170px)",
          overflow: "auto",
          border: isMobile ? "none" : "1px solid #e0e0e0",
          borderRadius: "8px",
          backgroundColor: isMobile ? "transparent" : "#fff",
        }}
      >
        <Table stickyHeader={!isMobile} sx={{ tableLayout: isMobile ? "auto" : "fixed" }}>
          {!isMobile && (
            <TableHead>
              <TableRow
                sx={{ "& th": { backgroundColor: "#f5f5f5", fontWeight: "bold", textAlign: "center" } }}
              >
                {isColumnVisible("S.No") && <TableCell sx={{ width: 60 }}>S.NO</TableCell>}
                {isColumnVisible("Item Code") && <TableCell sx={{ width: 100 }}>ITEM CODE</TableCell>}
                {isColumnVisible("Category") && <TableCell>CATEGORY</TableCell>}
                {isColumnVisible("Subcategory") && <TableCell>SUB-CATEGORY</TableCell>}
                {isColumnVisible("Item Name") && <TableCell sx={{ width: 180 }}>ITEM NAME</TableCell>}
                {isColumnVisible("Variance") && <TableCell>VARIANCE</TableCell>}
                {isColumnVisible("System Stock") && <TableCell>SO STOCK</TableCell>}
                {isColumnVisible("Prev. System Stock") && <TableCell>PREV SYSTEM STOCK</TableCell>}
                {isColumnVisible("System Stock") && <TableCell>SYSTEM STOCK</TableCell>}
                {isColumnVisible("Physical Stock") && <TableCell sx={{ width: 120 }}>PHYSICAL STOCK</TableCell>}
              </TableRow>
            </TableHead>
          )}

          <TableBody sx={{ display: isMobile ? "block" : "table-row-group" }}>
            {loading && rows.length === 0 ? (
              <TableRow sx={{ display: isMobile ? "block" : "table-row" }}>
                <TableCell colSpan={10} sx={{ border: "none" }}>
                  <DotLoaderLike message="" />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow sx={{ display: isMobile ? "block" : "table-row" }}>
                <TableCell colSpan={10} sx={{ py: 10, textAlign: "center", color: "#999" }}>
                  No records found
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, idx) => {
                const key = `${row.itemName}-${row.varianceName}-${selectedBranches}`;
                const displayPhysical = tempStocks[key] ?? 0;
                const soStock = Number(row.systemStockSo ?? 0);
                const systemStock = Number(row.systemStock ?? 0);
                const previousSystemStock = Number(row.previousSystemStock ?? 0);

                return isMobile ? (
                  <Box
                    key={key}
                    sx={{
                      mb: 2,
                      p: 2,
                      borderRadius: "12px",
                      border: "1px solid #e0e0e0",
                      backgroundColor: "#fff",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.03)",
                    }}
                  >
                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                      <Typography variant="caption" color="textSecondary">
                        {isColumnVisible("S.No") && `#${idx + 1}`}{" "}
                        {isColumnVisible("Item Code") && `| ${row.itemCode}`}
                      </Typography>
                      {isColumnVisible("Category") && (
                        <Tooltip title={toTooltip(row.category)} arrow disableInteractive followCursor>
                          <Typography variant="caption" sx={{ fontWeight: "bold", color: "#2e7d32" }}>
                            {row.category}
                          </Typography>
                        </Tooltip>
                      )}
                    </Box>

                    {isColumnVisible("Item Name") && (
                      <Tooltip title={toTooltip(row.itemName)} arrow disableInteractive followCursor>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>
                          {row.itemName}
                        </Typography>
                      </Tooltip>
                    )}

                    {isColumnVisible("Variance") && (
                      <Tooltip title={toTooltip(row.varianceName)} arrow disableInteractive followCursor>
                        <Typography
                          variant="caption"
                          color="textSecondary"
                          display="block"
                          sx={{ mb: 1.5 }}
                        >
                          {row.varianceName}
                        </Typography>
                      </Tooltip>
                    )}

                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, 1fr)",
                        gap: 1,
                        textAlign: "center",
                        backgroundColor: "#f9f9f9",
                        p: 1,
                        borderRadius: "8px",
                        alignItems: "center",
                      }}
                    >
                      <Box>
                        <Tooltip title={toTooltip(soStock)} arrow disableInteractive followCursor>
                          <Box>
                            <Typography variant="caption" sx={{ fontSize: "0.65rem", color: "#666" }}>
                              SO
                            </Typography>
                            <Typography variant="body2">{soStock}</Typography>
                          </Box>
                        </Tooltip>
                      </Box>

                      <Box>
                        <Box>
                          <Typography variant="caption" sx={{ fontSize: "0.65rem", color: "#666" }}>
                            Prev
                          </Typography>
                          <Typography variant="body2">{previousSystemStock}</Typography>
                        </Box>
                      </Box>

                      <Box>
                        <Box>
                          <Typography variant="caption" sx={{ fontSize: "0.65rem", color: "#666" }}>
                            Sys
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>
                            {systemStock}
                          </Typography>
                        </Box>
                      </Box>

                      <Box>
                        <TextField
                          disabled={!canEdit}
                          inputRef={(el) => (inputRefs.current[idx] = el)}
                          value={displayPhysical}
                          onChange={(e) => handlePhysicalStockChange(e, row)}
                          onBlur={(e) => {
                            if (!e.target.value) {
                              setTempStocks((p) => ({ ...p, [key]: 0 }));
                              onPhysicalStockChange(
                                { ...e, target: { ...e.target, value: "" } } as any,
                                row.itemName,
                                row.varianceName,
                                selectedBranches,
                                row.itemCode
                              );
                            }
                          }}
                          onFocus={(e) =>
                            e.target.value === "0" && setTempStocks((p) => ({ ...p, [key]: "" }))
                          }
                          size="small"
                          autoComplete="off"
                          inputProps={{ inputMode: "decimal" }}
                          sx={getTextFieldSx("80px")}
                        />
                      </Box>
                    </Box>
                  </Box>
                ) : (
                  <TableRow key={key} hover>
                    {isColumnVisible("S.No") && (
                      <TableCell align="center">
                        <Tooltip title={toTooltip(idx + 1)} arrow disableInteractive followCursor>
                          <span>{idx + 1}</span>
                        </Tooltip>
                      </TableCell>
                    )}
                    {isColumnVisible("Item Code") && (
                      <TableCell align="center" sx={{ fontWeight: "bold" }}>
                        <Tooltip title={toTooltip(row.itemCode)} arrow disableInteractive followCursor>
                          <span>{row.itemCode}</span>
                        </Tooltip>
                      </TableCell>
                    )}
                    {isColumnVisible("Category") && (
                      <TableCell align="center">
                        <Tooltip title={toTooltip(row.category)} arrow disableInteractive followCursor>
                          <span>{row.category || "-"}</span>
                        </Tooltip>
                      </TableCell>
                    )}
                    {isColumnVisible("Subcategory") && (
                      <TableCell align="center">
                        <Tooltip title={toTooltip(row.subcategory)} arrow disableInteractive followCursor>
                          <span>{row.subcategory || "-"}</span>
                        </Tooltip>
                      </TableCell>
                    )}
                    {isColumnVisible("Item Name") && (
                      <TableCell align="center" sx={{ pl: 2 }}>
                        <Tooltip title={toTooltip(row.itemName)} arrow disableInteractive followCursor>
                          <span>{row.itemName || "-"}</span>
                        </Tooltip>
                      </TableCell>
                    )}
                    {isColumnVisible("Variance") && (
                      <TableCell align="center">
                        <Tooltip title={toTooltip(row.varianceName)} arrow disableInteractive followCursor>
                          <span>{row.varianceName || "-"}</span>
                        </Tooltip>
                      </TableCell>
                    )}
                    {isColumnVisible("System Stock") && (
                      <TableCell
                        align="center"
                        sx={{
                          color: soStock < 0 ? "error.main" : "inherit",
                          fontWeight: 700,
                        }}
                      >
                        <span>{soStock}</span>
                      </TableCell>
                    )}
                    {isColumnVisible("Prev. System Stock") && (
                      <TableCell
                        align="center"
                        sx={{
                          color: previousSystemStock < 0 ? "error.main" : "inherit",
                          fontWeight: previousSystemStock < 0 ? 600 : 400,
                        }}
                      >
                        <span>{previousSystemStock}</span>
                      </TableCell>
                    )}
                    {isColumnVisible("System Stock") && (
                      <TableCell
                        align="center"
                        sx={{
                          color: systemStock < 0 ? "error.main" : "inherit",
                          fontWeight: systemStock < 0 ? 600 : 400,
                        }}
                      >
                        <Box sx={{ fontWeight: 700 }}>{systemStock}</Box>
                      </TableCell>
                    )}
                    {isColumnVisible("Physical Stock") && (
                      <TableCell align="center">
                        <TextField
                          disabled={!canEdit}
                          inputRef={(el) => (inputRefs.current[idx] = el)}
                          value={displayPhysical}
                          onChange={(e) => handlePhysicalStockChange(e, row)}
                          onBlur={(e) =>
                            !e.target.value && setTempStocks((p) => ({ ...p, [key]: 0 }))
                          }
                          onFocus={(e) =>
                            e.target.value === "0" && setTempStocks((p) => ({ ...p, [key]: "" }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              inputRefs.current[idx + 1]?.focus();
                            }
                          }}
                          size="small"
                          autoComplete="off"
                          sx={getTextFieldSx("95px")}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}

            {loading && rows.length > 0 && (
              <TableRow>
                <TableCell colSpan={10} sx={{ border: "none", py: 2 }}>
                  <DotLoaderLike message="" />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default React.memo(DataTable);