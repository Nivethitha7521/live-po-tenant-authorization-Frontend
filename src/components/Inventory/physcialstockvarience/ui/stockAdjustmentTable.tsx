"use client";

import { useCallback, useMemo, useEffect, useRef } from "react";
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  TableContainer,
  CircularProgress,
  Paper,
} from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch } from "@/redux/store";
import {
  fetchApprovedItems,
  selectApprovedItems,
  selectApprovedItemsLoading,
  selectApprovedItemsError,
  selectApprovedItemsTotal,
  selectApprovedItemsPage,
  selectApprovedItemsLimit,
  selectApprovedItemsHasMore,
  selectApprovedItemsIsLoadingMore,
  resetApprovedItemsPagination,
} from "@/features/yen_inventory/OutletPhysicalVarianceSlice";

interface StockAdjustmentTableProps {
  isFullScreen?: boolean;
}

export const StockAdjustmentTable: React.FC<StockAdjustmentTableProps> = ({
  isFullScreen = false,
}) => {
  const dispatch = useDispatch<AppDispatch>();

  const approvedItems = useSelector(selectApprovedItems);
  const approvedItemsLoading = useSelector(selectApprovedItemsLoading);
  const approvedItemsError = useSelector(selectApprovedItemsError);
  const approvedItemsTotal = useSelector(selectApprovedItemsTotal);
  const approvedItemsPage = useSelector(selectApprovedItemsPage);
  const approvedItemsLimit = useSelector(selectApprovedItemsLimit);
  const approvedItemsHasMore = useSelector(selectApprovedItemsHasMore);
  const approvedItemsIsLoadingMore = useSelector(selectApprovedItemsIsLoadingMore);

  const isFetchingRef = useRef(false);

  const headers = [
    "S.No",
    "Item Code",
    "Item Name",
    "Location ID",
    "Approved At",
    "Approved By",
    "System Stock Before",
    "Physical Closing",
    "Actual Variance",
    "Updated System Stock",
    "Description",

  ];

  // Fetch approved items
  const loadApprovedItems = useCallback(
    async (page: number, isLoadMore: boolean = false) => {
      if (isFetchingRef.current) return;

      isFetchingRef.current = true;
      try {
        if (!isLoadMore) dispatch(resetApprovedItemsPagination());

        await dispatch(
          fetchApprovedItems({
            page,
            limit: approvedItemsLimit,
            isLoadMore,
          })
        ).unwrap();
      } catch (err) {
        console.error("Error fetching approved items:", err);
      } finally {
        isFetchingRef.current = false;
      }
    },
    [dispatch, approvedItemsLimit]
  );

  useEffect(() => {
    loadApprovedItems(1, false);
  }, [loadApprovedItems]);

  const loadMoreApprovedItems = useCallback(async () => {
    if (approvedItemsIsLoadingMore || !approvedItemsHasMore || isFetchingRef.current) return;
    const nextPage = approvedItemsPage + 1;
    await loadApprovedItems(nextPage, true);
  }, [
    approvedItemsIsLoadingMore,
    approvedItemsHasMore,
    approvedItemsPage,
    loadApprovedItems,
  ]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
      const isNearBottom = scrollHeight - scrollTop - clientHeight <= 100;

      if (isNearBottom && !approvedItemsLoading && !approvedItemsIsLoadingMore && approvedItemsHasMore) {
        loadMoreApprovedItems();
      }
    },
    [approvedItemsLoading, approvedItemsIsLoadingMore, approvedItemsHasMore, loadMoreApprovedItems]
  );

  const displayedItems = useMemo(() => {
    return approvedItems.map((item, index) => ({
      ...item,
      serialNumber: (approvedItemsPage - 1) * approvedItemsLimit + index + 1,
    }));
  }, [approvedItems, approvedItemsPage, approvedItemsLimit]);

  return (
    <Paper
      sx={{
        height: isFullScreen ? "calc(87vh - 100px)" : "70vh",
        display: "flex",
        flexDirection: "column",
        borderRadius: 2,
        overflow: "hidden",
        boxShadow: 3,
        ml: 1
      }}
    >
      {/* 🔹 Title Section */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: "2px solid #e0e0e0",
          backgroundColor: "#fafafa",
        }}
      >
        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          Approved Stocks - OUTLET
        </Typography>
      </Box>
      <TableContainer
        onScroll={handleScroll}
        sx={{
          flex: 1,
          maxHeight: "100%",
          overflowY: "auto",
        }}
      >
        <Table stickyHeader size="small">
          <TableHead>
            {/* Header row only */}
            <TableRow>
              {headers.map((h) => (
                <TableCell
                  key={h}
                  align="center"
                  sx={{
                    fontWeight: 700,
                    backgroundColor: "#f5f5f5",
                    paddingY: 1,
                    textTransform: "uppercase",
                    paddingX: 1,
                    maxWidth: h !== "S.No" ? 150 : "auto",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {h}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {approvedItemsLoading && approvedItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={headers.length} align="center">
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", py: 3 }}>
                    <CircularProgress size={24} />
                    <Typography variant="body2" sx={{ ml: 2 }}>
                      Loading adjustment data...
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            )}

            {approvedItemsError && (
              <TableRow>
                <TableCell colSpan={headers.length} align="center">
                  <Typography variant="body2" color="error">
                    Error: {approvedItemsError}
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {!approvedItemsLoading && approvedItems.length === 0 && !approvedItemsError && (
              <TableRow>
                <TableCell colSpan={headers.length} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                    No adjustment records found.
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {displayedItems.map((item) => (
              <TableRow key={item._id} hover>
                <TableCell align="center">{item.serialNumber}</TableCell>
                <TableCell align="center">{item.itemCode || "-"}</TableCell>
                <TableCell align="center">{item.itemName || "-"}</TableCell>
                <TableCell align="center">{item.locationId || "-"}</TableCell>
                <TableCell align="center">{item.approvedAt || "-"}</TableCell>
                <TableCell align="center">{item.approvedBy || "-"}</TableCell>
                <TableCell align="center">{item.systemStockBefore ?? "-"}</TableCell>
                <TableCell align="center">{item.physicalClosing ?? "-"}</TableCell>
                <TableCell align="center">{item.actualVariance ?? "-"}</TableCell>
                <TableCell align="center">{item.systemStockAfter ?? "-"}</TableCell>
                <TableCell align="center">{item.description || "-"}</TableCell>
              </TableRow>
            ))}

            {approvedItemsIsLoadingMore && (
              <TableRow>
                <TableCell colSpan={headers.length} align="center">
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", py: 2 }}>
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                    <Typography variant="body2">Loading more...</Typography>
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Box
        sx={{
          p: 2,
          borderTop: 1,
          borderColor: "divider",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Showing {approvedItems.length} of {approvedItemsTotal} items{" "}
          {approvedItemsHasMore ? "- Scroll for more" : ""}
        </Typography>
      </Box>
    </Paper>
  );
};