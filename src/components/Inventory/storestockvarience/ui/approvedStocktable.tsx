"use client";

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/redux/store";
import {
  fetchApprovedItems,
  resetApprovedItems,
  setSnackbarMessage,
  setOpenSnackbar,
} from "@/features/yen_inventory/wharehoueStoreSlice";
import DotLoaderLike from "@/components/Loaders/DotLoaderWrapper";

interface ApprovedStockTableProps {
  isFullScreen?: boolean;
  scrollContainerRef: React.RefObject<HTMLDivElement>;
}

const ApprovedStockTable: React.FC<ApprovedStockTableProps> = ({
  isFullScreen = false,
  scrollContainerRef,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const {
    approvedItems,
    approvedItemsTotal,
    approvedItemsStatus,
    approvedItemsError,
    isLoadingMore,
  } = useSelector((state: RootState) => state.rawMaterialStore);

  const isFetchingRef = useRef(false);
  const ITEMS_PER_PAGE = 30;

  const headers = [
    "S.No",
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

  const loadApprovedItems = useCallback(
    async (page: number) => {
      if (isFetchingRef.current) return;

      isFetchingRef.current = true;
      try {
        await dispatch(
          fetchApprovedItems({
            page,
            limit: ITEMS_PER_PAGE,
          })
        ).unwrap();
      } catch (err) {
        console.error("Error fetching approved items:", err);
        dispatch(setSnackbarMessage("Error fetching approved items."));
        dispatch(setOpenSnackbar(true));
      } finally {
        isFetchingRef.current = false;
      }
    },
    [dispatch]
  );

  useEffect(() => {
    dispatch(resetApprovedItems());
    loadApprovedItems(1);
  }, [dispatch, loadApprovedItems]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      const { scrollTop, scrollHeight, clientHeight } = target;
      const isNearBottom =
        scrollHeight - scrollTop - clientHeight <= 200;

      if (
        isNearBottom &&
        approvedItemsStatus !== "loading" &&
        !isLoadingMore &&
        approvedItems.length < approvedItemsTotal &&
        !isFetchingRef.current
      ) {
        const nextPage =
          Math.ceil(approvedItems.length / ITEMS_PER_PAGE) + 1;
        loadApprovedItems(nextPage);
      }
    },
    [
      approvedItemsStatus,
      isLoadingMore,
      approvedItems.length,
      approvedItemsTotal,
      loadApprovedItems,
    ]
  );

  const displayedItems = useMemo(() => {
    return approvedItems.map((item: any, index: number) => ({
      ...item,
      serialNumber: index + 1,
      locationName: item.locationId,
      date: item.approvedAt,
      currentSystem: item.systemStockBefore,
      updatedCurrentSystem: item.systemStockAfter,
    }));
  }, [approvedItems]);

  return (
    <Box
      sx={{
        height: isFullScreen ? "calc(100vh - 120px)" : "110vh",
        display: "flex",
        flexDirection: "column",
        borderRadius: 1,
        overflow: "hidden",
        ml: 1,
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
          Approved Stocks - Warehouse
        </Typography>
      </Box>

      <TableContainer
        ref={scrollContainerRef}
        onScroll={handleScroll}
        sx={{
          maxHeight: isFullScreen ? "calc(87vh - 100px)" : "70vh",
          width: "100%",
          overflow: "auto",
        }}
      >
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              {headers.map((header) => (
                <TableCell
                  key={header}
                  align="center"
                  sx={{
                    fontWeight: 700,
                    backgroundColor: "#f5f5f5",
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                    fontSize: "0.75rem",
                    paddingY: 1,
                    paddingX: 1,
                    borderBottom: "2px solid #e0e0e0",
                    ...(header !== "S.No" && {
                      maxWidth: 150,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }),
                  }}
                >
                  {header}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {approvedItemsStatus === "loading" &&
              approvedItems.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={headers.length}
                    align="center"
                  >
                    <DotLoaderLike message="" />
                  </TableCell>
                </TableRow>
              )}

            {approvedItemsError && (
              <TableRow>
                <TableCell
                  colSpan={headers.length}
                  align="center"
                  sx={{ color: "error.main" }}
                >
                  Error: {approvedItemsError}
                </TableCell>
              </TableRow>
            )}

            {approvedItemsStatus !== "loading" &&
              approvedItems.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={headers.length}
                    align="center"
                  >
                    <Typography
                      variant="body2"
                      color="text.secondary"
                    >
                      No approved items found.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}

            {displayedItems.map((item, idx) => (
              <TableRow key={item.id || `approved-row-${idx}`} hover>
                <TableCell align="center">
                  {item.serialNumber}
                </TableCell>
                <TableCell align="center" title={item.itemName}>
                  {item.itemName || "-"}
                </TableCell>
                <TableCell align="center" title={item.locationName}>
                  {item.locationName || "-"}
                </TableCell>
                <TableCell align="center">
                  {item.date || "-"}
                </TableCell>
                <TableCell align="center" title={item.approvedBy}>
                  {item.approvedBy || "-"}
                </TableCell>
                <TableCell align="center">
                  {item.currentSystem ?? "-"}
                </TableCell>
                <TableCell align="center">
                  {item.physicalClosing ?? "-"}
                </TableCell>
                <TableCell align="center">
                  {item.actualVariance ?? "-"}
                </TableCell>
                <TableCell align="center">
                  {item.updatedCurrentSystem ?? "-"}
                </TableCell>
                <TableCell align="center" title={item.description}>
                  {item.description || "-"}
                </TableCell>
              </TableRow>
            ))}

            {isLoadingMore && (
              <TableRow>
                <TableCell
                  colSpan={headers.length}
                  align="center"
                >
                  <DotLoaderLike message="Loading more..." />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default ApprovedStockTable;