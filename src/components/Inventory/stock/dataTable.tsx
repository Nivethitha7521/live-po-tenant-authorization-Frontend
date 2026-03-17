import React, { useEffect, useCallback, useState } from "react";
import {
  TableContainer,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
  TextField,
  Box,
  Typography,
  useMediaQuery,
  useTheme,
  Tooltip,
} from "@mui/material";
import DotLoaderLike from "@/components/Loaders/DotLoaderWrapper";
import { TableRowData } from "@/app/yen-inventory/WarehouseInventoryManagement/stockModification/page";

export interface DataTableProps {
  canEdit: boolean;
  inputRefs: React.MutableRefObject<(HTMLInputElement | null)[]>;
  tableContainerRef: React.RefObject<HTMLDivElement>;
  rows: TableRowData[];
  onPhysicalStockChange: (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    itemName: string,
    varianceName: string,
    itemId: string,
    currentSystemStock: number
  ) => void;
  loading: boolean;
  hasMore: boolean;
  onScrollBottom: () => void;
  changedRows: Record<string, boolean>;
}

const DataTable: React.FC<DataTableProps> = ({
  inputRefs,
  tableContainerRef,
  rows,
  onPhysicalStockChange,
  loading,
  hasMore,
  onScrollBottom,
  changedRows,
  canEdit
}) => {
  const [tempStocks, setTempStocks] = useState<Record<string, number | string>>({});
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isInitialLoading = loading && rows.length === 0;

  /* --- INFINITE SCROLL --- */
  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const nearBottom = scrollHeight - scrollTop - clientHeight < 100;
      if (nearBottom && hasMore && !loading) {
        onScrollBottom();
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [hasMore, loading, onScrollBottom, tableContainerRef]);

  /* --- ✅ FIX: Hide tooltips on scroll --- */
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

  useEffect(() => {
    if (Object.keys(changedRows).length === 0) setTempStocks({});
  }, [changedRows]);

  const handlePhysicalStockChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, row: TableRowData) => {
      const value = e.target.value;
      const key = row.id;

      if (value === "" || /^[0-9]*\.?[0-9]*$/.test(value)) {
        setTempStocks((prev) => ({ ...prev, [key]: value }));
        onPhysicalStockChange(e, row.itemName, row.varianceName, row.id, row.systemStock);
      }
    },
    [onPhysicalStockChange]
  );

  const getTextFieldSx = (width: string) => ({
    "& .MuiInputBase-root": {
      height: "38px",
      width,
      fontSize: "1rem",
      backgroundColor: "#fff",
      transition: "all 0.2s ease-in-out",
    },
    "& .MuiOutlinedInput-notchedOutline": { borderColor: "#ccc" },
    "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
      borderColor: "#1976d2",
      borderWidth: 2,
    },
    "& input": { textAlign: "center", p: 0, fontWeight: 700, color: "#333" },
  });

  const toTooltip = (val: number | string | undefined) => (val ?? 0).toString();

  return (
    <Box sx={{ width: "100%", position: "relative" }}>
      <TableContainer
        ref={tableContainerRef}
        component={isMobile ? Box : Paper}
        elevation={0}
        sx={{
          maxHeight: isMobile ? "calc(100vh - 200px)" : "calc(87vh - 170px)",
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
                sx={{
                  "& th": {
                    backgroundColor: "#f5f5f5",
                    fontWeight: "bold",
                    textAlign: "center",
                    height: 50,
                  },
                }}
              >
                <TableCell sx={{ width: 60 }}>S.NO</TableCell>
                <TableCell sx={{ width: 100 }}>ITEM CODE</TableCell>
                <TableCell sx={{ width: 120 }}>CATEGORY</TableCell>
                <TableCell sx={{ width: 130 }}>SUB-CATEGORY</TableCell>
                <TableCell sx={{ width: 200 }}>ITEM GROUP</TableCell>
                <TableCell sx={{ width: 100 }}>ITEM NAME</TableCell>
                <TableCell sx={{ width: 100 }}>SO STOCK</TableCell>
                <TableCell sx={{ width: 140 }}>PREV SYSTEM STOCK</TableCell>
                <TableCell sx={{ width: 100 }}>SYSTEM STOCK</TableCell>
                <TableCell sx={{ width: 100 }}>PHYSICAL STOCK</TableCell>
              </TableRow>
            </TableHead>
          )}

          <TableBody sx={{ display: isMobile ? "block" : "table-row-group" }}>
            {isInitialLoading ? (
              <TableRow>
                <TableCell colSpan={10}>
                  <DotLoaderLike message="" />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} sx={{ py: 10, textAlign: "center", color: "#999" }}>
                  No records found
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, idx) => {
                const key = row.id;
                const displayPhysical =
                  tempStocks[key] !== undefined ? tempStocks[key] : row.physicalStock ?? "";

                const soStock = Number(row.systemStockSo);
                const systemStock = Number(row.systemStock);
                const previousSystemStock = Number(row.previousSystemStock);

                return isMobile ? (
                  <Box
                    key={key}
                    sx={{
                      mb: 2,
                      p: 2,
                      borderRadius: "12px",
                      border: "1px solid #e0e0e0",
                      backgroundColor: "#fff",
                    }}
                  >
                    <Tooltip
                      title={`${row.itemName} (${row.varianceName})`}
                      arrow
                      disableInteractive
                      followCursor
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {row.itemName} ({row.varianceName})
                      </Typography>
                    </Tooltip>

                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, 1fr)",
                        gap: 1,
                        textAlign: "center",
                        p: 1,
                      }}
                    >
                      <Tooltip title={toTooltip(soStock)} arrow disableInteractive followCursor>
                        <Box>
                          <Typography variant="caption">SO</Typography>
                          <Typography variant="body2">{soStock}</Typography>
                        </Box>
                      </Tooltip>

                      <Tooltip
                        title={toTooltip(previousSystemStock)}
                        arrow
                        disableInteractive
                        followCursor
                      >
                        <Box>
                          <Typography variant="caption">Prev</Typography>
                          <Typography variant="body2">{previousSystemStock}</Typography>
                        </Box>
                      </Tooltip>

                      <Tooltip title={toTooltip(systemStock)} arrow disableInteractive followCursor>
                        <Box>
                          <Typography variant="caption">Sys</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {systemStock}
                          </Typography>
                        </Box>
                      </Tooltip>

                      <Box>
                        <TextField
                          disabled={!canEdit}
                          inputRef={(el) => (inputRefs.current[idx] = el)}
                          value={displayPhysical}
                          onChange={(e) => handlePhysicalStockChange(e, row)}
                          onFocus={() => {
                            if (displayPhysical === 0 || displayPhysical === "0") {
                              setTempStocks((prev) => ({ ...prev, [key]: "" }));
                            }
                          }}
                          size="small"
                          sx={getTextFieldSx("75px")}
                        />
                      </Box>
                    </Box>
                  </Box>
                ) : (
                  <TableRow key={key} hover>
                    <TableCell align="center">{row.index}</TableCell>

                    <TableCell align="center">
                      <Tooltip title={row.itemCode || "-"} arrow disableInteractive followCursor>
                        <Box>{row.itemCode || "-"}</Box>
                      </Tooltip>
                    </TableCell>

                    <TableCell align="center">
                      <Tooltip title={row.category || "-"} arrow disableInteractive followCursor>
                        <Box>{row.category || "-"}</Box>
                      </Tooltip>
                    </TableCell>

                    <TableCell align="center">
                      <Tooltip title={row.subcategory || "-"} arrow disableInteractive followCursor>
                        <Box>{row.subcategory || "-"}</Box>
                      </Tooltip>
                    </TableCell>

                    <TableCell align="center">
                      <Tooltip title={row.itemName || "-"} arrow disableInteractive followCursor>
                        <Box>{row.itemName || "-"}</Box>
                      </Tooltip>
                    </TableCell>

                    <TableCell align="center">
                      <Tooltip title={row.varianceName || "-"} arrow disableInteractive followCursor>
                        <Box>{row.varianceName || "-"}</Box>
                      </Tooltip>
                    </TableCell>

                    <TableCell align="center">
                      <Box>{soStock}</Box>
                    </TableCell>

                    <TableCell align="center">

                      <Box>{previousSystemStock}</Box>
                    </TableCell>

                    <TableCell align="center">
                      <Box sx={{ fontWeight: 700 }}>{systemStock}</Box>
                    </TableCell>

                    <TableCell align="center">
                      <TextField
                        disabled={!canEdit}
                        inputRef={(el) => (inputRefs.current[idx] = el)}
                        value={displayPhysical}
                        onChange={(e) => handlePhysicalStockChange(e, row)}
                        onFocus={() => {
                          if (displayPhysical === 0 || displayPhysical === "0") {
                            setTempStocks((prev) => ({ ...prev, [key]: "" }));
                          }
                        }}
                        size="small"
                        sx={getTextFieldSx("75px")}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default React.memo(DataTable);