"use client";
import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  Autocomplete,
  TextField,
  Checkbox,
  Snackbar,
  Alert,
  InputAdornment,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  CircularProgress,
  IconButton,
  TableContainer,
  Dialog,
  DialogTitle,
  DialogContent,
  Container,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import VisibilityIcon from "@mui/icons-material/Visibility";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import CloseIcon from "@mui/icons-material/Close";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchActivities,
  selectBranch,
} from "./features/branchesSlice";
import {
  fetchDispatches,
  Dispatch,
  selectDispatches,
  setFilter,
} from "./features/storedispatch";
import { AppDispatch } from "../../../../redux/store";
import { blue } from "@mui/material/colors";
import DateRangeDialog from "./components/dateRange";;
import Report from "../page";
import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import * as XLSX from "xlsx";
import Grid from "@mui/material/Grid";

// Extend dayjs with plugins
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(utc);
dayjs.extend(timezone);

interface SelectionRange {
  startDate: string;
  endDate: string;
  key: string;
}

interface Branch {

  branchName?: string;

}

interface BranchOption {
  label: string;
  id: string;
  branchName: string;
  aliasName?: string;
}

interface FetchDispatchParams {
  startDate?: string;
  endDate?: string;
  branchNames?: string[];
}

const parseDate = (date: string | Date | null) => {
  if (!date) return dayjs();
  if (date instanceof Date) return dayjs(date);
  return dayjs(date);
};
const DispatchDateFilter = ({
  selectedBranches,
  fetchDataWithFilter,
}: {
  selectedBranches: BranchOption[];
  fetchDataWithFilter: () => Promise<void>;
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { filter } = useSelector(selectDispatches);

  const [selectionRange, setSelectionRange] = useState<SelectionRange>({
    startDate: dayjs().format("YYYY-MM-DD"),
    endDate: dayjs().format("YYYY-MM-DD"),
    key: "selection",
  });

  const [submitError, setSubmitError] = useState<string | null>(null);
  useEffect(() => {
    if (filter.startDate && filter.endDate) {
      setSelectionRange({
        startDate: filter.startDate,
        endDate: filter.endDate,
        key: "selection",
      });
    } else {
      const today = dayjs().format("YYYY-MM-DD");
      setSelectionRange({
        startDate: today,
        endDate: today,
        key: "selection",
      });
      dispatch(
        setFilter({
          startDate: today,
          endDate: today,
          branchNames: filter.branchNames || [],
        })
      );
    }
  }, [dispatch, filter]);

  const handleSelectionChange = (
    newRange: SelectionRange | ((prev: SelectionRange) => SelectionRange)
  ) => {
    const range =
      typeof newRange === "function" ? newRange(selectionRange) : newRange;

    if (!range.startDate || !range.endDate) {
      setSubmitError("Please select a valid date range");
      return;
    }

    if (dayjs(range.startDate).isAfter(dayjs(range.endDate))) {
      setSubmitError("Start date cannot be after end date");
      return;
    }

    setSelectionRange(range);
    setSubmitError(null);

    // Dispatch ISO strings to Redux
    dispatch(
      setFilter({
        startDate: range.startDate,
        endDate: range.endDate,
        branchNames: selectedBranches
          .filter((b) => b.id !== "ALL")
          .map((b) => b.aliasName || b.branchName)
          .filter((name): name is string => name !== undefined && name !== ""),
      })
    );

    fetchDataWithFilter();
  };


  return (
    <Container>
      <label>Select Date Range</label>
      <Grid container spacing={2}>


        <Grid mt={-2}>
          <Box sx={{ display: "flex", height: "100%" }}>
            <DateRangeDialog
              selectionRange={selectionRange}
              setSelectionRange={handleSelectionChange}
            />
            {submitError && (
              <Typography color="error" variant="caption" sx={{ ml: 2 }}>
                {submitError}
              </Typography>
            )}
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
};

const DispatchPage = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { branch, error: branchError } = useSelector(selectBranch);
  const {
    error: dispatchError,
    filter,
    items,
    deactivatedItems,
    showDeactivated,
  } = useSelector(selectDispatches);
  const [selectedBranches, setSelectedBranches] = useState<BranchOption[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
  const [isTableVisible, setIsTableVisible] = useState<boolean>(true);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [popupRowId, setPopupRowId] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);

  const branchOptions = useMemo<BranchOption[]>(() => {
    if (!branch || !Array.isArray(branch)) return [];
    const branchMap = new Map<string, BranchOption>();
    branch.forEach((b: Branch) => {
      if (!b.branchName) return;
      const id = b.branchName || "";
      if (id && !branchMap.has(id)) {
        branchMap.set(id, {
          label: b.branchName ? `${b.branchName}` : b.branchName,
          id,
          branchName: b.branchName,
        });
      }
    });
    return [
      { id: "ALL", label: "Select All", branchName: "" },
      ...Array.from(branchMap.values()),
    ];
  }, [branch]);

  useEffect(() => {
    if (isInitialLoad && branchOptions.length > 0 && selectedBranches.length === 0) {
      const validOptions = branchOptions.filter((option) => option.id !== "ALL");
      setSelectedBranches(validOptions);
      const today = dayjs().format("YYYY-MM-DD");
      dispatch(
        setFilter({
          startDate: today,
          endDate: today,
          branchNames: validOptions
            .map((b) => b.branchName)
            .filter((name): name is string => name !== undefined && name !== ""),
        })
      );
      fetchDataWithFilter();
    }
  }, [branchOptions, dispatch, isInitialLoad]);

  const fetchDataWithFilter = async () => {
    setIsLoading(true);
    try {
      if (!selectedBranches.length) {
        setIsTableVisible(true);
        return;
      }

      if (!filter.startDate || !filter.endDate) {
        setSubmitError("Please select a valid date range");
        setIsTableVisible(false);
        return;
      }

      const branchNames = selectedBranches
        .filter((b) => b.id !== "ALL")
        .map((b) => b.aliasName || b.branchName)
        .filter((name): name is string => name !== undefined && name !== "");

      const params: FetchDispatchParams = {
        startDate: parseDate(filter.startDate).format("YYYY-MM-DD"),
        endDate: parseDate(filter.endDate).format("YYYY-MM-DD"),
        branchNames: branchNames.length > 0 ? branchNames : undefined,
      };
      const result = await dispatch(fetchDispatches(params)).unwrap();
      if (!result || !Array.isArray(result) || result.length === 0) {
        setSubmitError("No data found for the selected branches and date range");
        setIsTableVisible(false);
        return;
      }

      setSubmitError(null);
      setSubmitSuccess(true);
      setIsTableVisible(true);
    } catch (err: unknown) {
      console.error("Fetch error:", err);
      const message =
        err instanceof Error ? err.message : String(err);
      setSubmitError(message || dispatchError || "Failed to fetch filtered data");
      setSubmitSuccess(false);
      setIsTableVisible(false);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadXLSX = () => {
    const headers = [
      "Document Number",
      "Document Internal ID",
      "Document Date",
      "Issue_Time",
      "Posting Date",
      "RowID",
      "Item Code",
      "Item Description",
      "UOM",
      "HSN",
      "From Warehouse Code",
      "To Whscode",
      "Location",
      "Quantity",
      "Stock Price",
      "Row Total",
      "Document Total",
      "CreatedBy",
      "Section",
      "Category",
      "Sub Category",
    ];

    const rows: (string | number)[][] = [];

    const groupedByDispatch: Record<string, typeof filteredData> = {};
    filteredData.forEach((item) => {
      const key = item.dispatchId || "unknown";
      if (!groupedByDispatch[key]) groupedByDispatch[key] = [];
      groupedByDispatch[key].push(item);
    });

    Object.values(groupedByDispatch).forEach((dispatchGroup) => {
      let rowCounter = 1;
      dispatchGroup.forEach((item) => {
        const dispatchId = typeof item.dispatchNumber === "number" ? String(item.dispatchNumber) : "";
        const cou = item.sentDate ? dayjs(item.sentDate).format("DD/MM/YYYY") : "";
        const date = item.date ? dayjs(item.date).format("DD/MM/YYYY") : "";
        const time = item.date ? dayjs(item.date).format("HH:mm") : "";
        const totalAmount = Array.isArray(item.amount)
          ? Number(item.amount.reduce((sum: number, val: number) => sum + (val || 0), 0).toFixed(2))
          : 0;

        if (Array.isArray(item.itemName) && item.itemName.length > 0) {
          item.itemName.forEach((name, i) => {
            const iCode = item.itemCode?.[i] || "";
            const qty = typeof item.qty?.[i] === "number" ? item.qty[i] : 0;
            const weight = typeof item.weight?.[i] === "number" ? item.weight[i] : 0;
            const qtyWeight =
              (qty ? qty : "") + (qty && weight ? " / " : "") + (weight ? weight.toFixed(2) : "");
            const price =
              typeof item.price?.[i] === "number" && !isNaN(item.price[i])
                ? Number(item.price[i].toFixed(2))
                : 0;
            const amount =
              typeof item.amount?.[i] === "number" && !isNaN(item.amount[i])
                ? Number(item.amount[i].toFixed(2))
                : 0;

            rows.push([
              dispatchId.toUpperCase(),
              item.dispatchId.toUpperCase(),
              date.toUpperCase(),
              time.toUpperCase(),
              cou.toUpperCase(),
              rowCounter++,
              iCode.toUpperCase(),
              name.toUpperCase(),
              (item.uom?.[i] || "").toUpperCase(),
              (item.hsnCode || "").toUpperCase(),
              (item.from || "").toUpperCase(),
              (item.towarehouseCode || "").toUpperCase(),
              (item.location || "").toUpperCase(),
              qtyWeight,
              price,
              amount,
              totalAmount,
              (item.createdBy || "").toUpperCase(),
              (item.branchName || "").toUpperCase(),
              (item.category?.[i] || "").toUpperCase(),
              (item.subCategory?.[i] || "").toUpperCase(),
            ]);
          });
        }
      });
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    Object.keys(worksheet).forEach((cell) => {
      if (cell[0] === "!") return; // skip metadata
      worksheet[cell].s = {
        font: { name: "Calibri", sz: 11 },
      };
    });
    worksheet["!cols"] = headers.map(header => ({

      width: Math.min(Math.max(header.length * 1.25, 10), 40),
    }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

    const fileName = `RawMaterial Request_YenERP.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true);
      try {
        const today = dayjs().format("YYYY-MM-DD");
        const result = await dispatch(
          fetchDispatches({
            startDate: today,
            endDate: today,
          })
        ).unwrap();


        await dispatch(fetchActivities());


        setIsTableVisible(!!result && Array.isArray(result) && result.length > 0);
        setSubmitSuccess(true);
      } catch (err: unknown) {
        console.error("Fetch all error:", err);
        const message =
          err instanceof Error ? err.message : String(err);
        setSubmitError(dispatchError || message || "Failed to fetch initial data");
        setSubmitSuccess(false);
        setIsTableVisible(false);
      } finally {
        setIsInitialLoad(false);
        setIsLoading(false);
      }
    };
    fetchAll();
  }, [dispatch]);

  const filterOptions = (
    options: BranchOption[],
    { inputValue }: { inputValue: string }
  ) => {
    const searchTerm = inputValue.toLowerCase().trim();
    if (!searchTerm) return options;

    return options.filter((option) => {
      const nameMatch = option.branchName.toLowerCase().includes(searchTerm);
      const aliasMatch = option.aliasName?.toLowerCase().includes(searchTerm) ?? false;
      const labelMatch = option.label.toLowerCase().includes(searchTerm);

      return nameMatch || aliasMatch || labelMatch;
    });
  };

  const handleBranchChange = async (
    _: React.SyntheticEvent,
    newValue: BranchOption[]
  ) => {
    const selectAllOption = newValue.find((option) => option.id === "ALL");
    let updatedBranches: BranchOption[] = [];

    if (selectAllOption) {
      updatedBranches =
        selectedBranches.length < branchOptions.length - 1
          ? branchOptions.filter((option) => option.id !== "ALL")
          : [];
    } else {
      updatedBranches = newValue.filter((option) => option.id !== "ALL");
    }

    setSelectedBranches(updatedBranches);
    dispatch(
      setFilter({
        ...filter,
        branchNames: updatedBranches
          .map((b) => b.aliasName || b.branchName)
          .filter((name): name is string => name !== undefined && name !== ""),
      })
    );

    if (updatedBranches.length > 0) {
      await fetchDataWithFilter();
    } else {
      setIsTableVisible(false);
      setSubmitError("Please select at least one branch");
    }
  };

  interface OptionProps extends React.HTMLAttributes<HTMLLIElement> {
    key?: React.Key;
  }

  const renderOption = (
    props: OptionProps,
    option: BranchOption,
    { selected }: { selected: boolean }
  ) => {
    const { key, ...otherProps } = props;
    const isSelectAll = option.id === "ALL";
    const isAllSelected = selectedBranches.length >= branchOptions.length - 1;
    const isChecked = isSelectAll ? isAllSelected : selected;

    return (
      <li key={key} {...otherProps}>
        <Checkbox
          checked={isChecked}
          sx={{
            textAlign: "center",
            mr: 1,
            color: blue[700],
            "&.Mui-checked": { color: blue[700] },
            transform: "scale(1.5)",
            padding: "8px",
          }}
        />
        {option.label}
      </li>
    );
  };

  const filteredData = useMemo(() => {
    let result = Array.isArray(items)
      ? showDeactivated
        ? [...items, ...deactivatedItems]
        : [...items]
      : [];

    // Exclude invalid records: no dispatchNumber or total amount effectively 0
    result = result.filter((item) => {
      const calculatedTotal = Array.isArray(item.amount)
        ? item.amount.reduce((sum: number, val: number) => sum + (val || 0), 0)
        : (item.totalAmount || 0);
      return item.dispatchNumber && calculatedTotal > 0;
    });

    if (
      selectedBranches.length > 0 &&
      selectedBranches.length < branchOptions.length - 1
    ) {
      result = result.filter((item) =>
        selectedBranches.some(
          (branch) =>
            branch.aliasName === item.branchName ||
            branch.branchName === item.branchName
        )
      );
    }

    if (filter.startDate && filter.endDate) {
      const start = parseDate(filter.startDate).startOf("day");
      const end = parseDate(filter.endDate).endOf("day");

      result = result.filter((item) => {
        if (!item.date) return false;

        const itemDate = parseDate(item.date);
        if (!itemDate.isValid()) return false;

        return itemDate.isSameOrAfter(start) && itemDate.isSameOrBefore(end);
      });
    }

    return result.sort((a, b) => {
      const dateA = parseDate(a.date).valueOf();
      const dateB = parseDate(b.date).valueOf();
      return dateA - dateB;
    }) as unknown as Dispatch[];
  }, [items, deactivatedItems, selectedBranches, branchOptions, filter.startDate, filter.endDate, showDeactivated]);

  const VirtualizedTable = ({
    isFullScreen,
    setIsFullScreen,
  }: {
    isFullScreen: boolean;
    setIsFullScreen: React.Dispatch<React.SetStateAction<boolean>>;
  }) => {
    const rowHeight = 40;
    const containerRef = React.useRef<HTMLDivElement>(null);

    const toggleFullScreen = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIsFullScreen((prev) => !prev);
    };

    const handlePopupOpen = (dispatchId: string) => {
      setPopupRowId(dispatchId);
    };

    const handlePopupClose = () => {
      setPopupRowId(null);
    };

    const columns = [
      {
        label: "Dispatch Number",
        width: "120px",
        sx: { textAlign: "center" }, // Center header text
        render: (item: Dispatch) => (
          <Box sx={{ display: "flex", alignItems: "center" }}>
            {item.dispatchNumber ? String(item.dispatchNumber) : "N/A"}
            <IconButton
              onClick={(e) => {
                e.stopPropagation();
                handlePopupOpen(item.dispatchId || "");
              }}
              size="small"
              sx={{ ml: 1 }}
            >
              <VisibilityIcon color="inherit" fontSize="small" />
            </IconButton>
          </Box>
        ),
      },
      {
        label: "Doc Internal ID",
        width: "100px",
        sx: { textAlign: "center" }, // Center header text
        render: (item: Dispatch) => (item.dispatchId ? item.dispatchId.slice(-5) : "W/H-1"),
      },
      {
        label: "Doc Date",
        width: "100px",
        sx: { textAlign: "center" }, // Center header text
        render: (item: Dispatch) =>
          item.sentDate ? dayjs(item.sentDate).format("DD/MM/YYYY") : "N/A",
      },
      {
        label: "Issue Time",
        width: "100px",
        sx: { textAlign: "center" }, // Center header text
        render: (item: Dispatch) =>
          item.date ? dayjs(item.date).format("HH:mm") : "N/A",
      },
      {
        label: "Posting Date",
        width: "100px",
        sx: { textAlign: "center" }, // Center header text
        render: (item: Dispatch) =>
          item.date ? dayjs(item.date).format("DD/MM/YYYY") : "N/A",
      },
      {
        label: "Row ID",
        width: "100px",
        sx: { textAlign: "center" }, // Center header text
        render: (item: Dispatch) =>
          Array.isArray(item.itemName) && item.itemName.length > 0
            ? item.itemName.length
            : "N/A",
      },
      {
        label: "Total Amount",
        width: "100px",
        sx: { textAlign: "center" }, // Center header text
        render: (item: Dispatch) => {
          if (!item.amount || !Array.isArray(item.amount)) {
            return "0.00";
          }
          return item.amount
            .reduce((sum: number, val: number) => sum + (val || 0), 0)
            .toFixed(2);
        },
      },
      {
        label: "HSN",
        width: "100px",
        sx: { textAlign: "center" }, // Center header text
        render: (item: Dispatch) => (item.hsnCode ? String(item.hsnCode) : "N/A"),
      },
      {
        label: "From Whs Code",
        width: "100px",
        sx: { textAlign: "center" }, // Center header text
        render: (item: Dispatch) => (item.from ? String(item.from).toUpperCase() : "N/A"),
      },
      {
        label: "To Whs Code",
        width: "100px",
        sx: { textAlign: "center" }, // Center header text
        render: (item: Dispatch) => (item.towarehouseCode ? String(item.towarehouseCode).toUpperCase() : "N/A"),
      },
      {
        label: "Location",
        width: "100px",
        sx: { textAlign: "center" }, // Center header text
        render: (item: Dispatch) => (item.location ? String(item.location).toUpperCase() : "N/A"),
      },
      {
        label: "Section",
        width: "100px",
        sx: { textAlign: "center" }, // Center header text
        render: (item: Dispatch) => (item.section ? String(item.section).toUpperCase() : "N/A"),
      },
      {
        label: "Created By",
        width: "100px",
        sx: { textAlign: "center" }, // Center header text
        render: (item: Dispatch) => (item.createdBy ? String(item.createdBy).toUpperCase() : "N/A"),
      },
      {
        label: "Status",
        width: "100px",
        sx: { textAlign: "center" }, // Center header text
        render: (item: Dispatch) => (item.status ? String(item.status).toUpperCase() : "N/A"),
      },
    ];

    const expandedColumns = [
      { label: "Row ID", width: "50px" },
      { label: "Item Code", width: "80px" },
      { label: "Item Name", width: "150px" },
      { label: "Uom", width: "50px" },
      { label: "Qty", width: "80px" },
      { label: "Price (₹)", width: "80px" },
      { label: "Amount (₹)", width: "80px" },
      { label: "Category", width: "100px" },
      { label: "Subcategory", width: "100px" },
    ];

    const selectedItem = filteredData.find((item) => item.dispatchId === popupRowId);
    const totalAmount = selectedItem?.amount && Array.isArray(selectedItem.amount)
      ? selectedItem.amount.reduce((sum: number, val: number) => sum + (val || 0), 0).toFixed(2)
      : "0.00";

    return (
      <>
        <Box
          sx={{
            ...(isFullScreen && {
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1300,
              backgroundColor: "white",
              padding: 2,
            }),
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
            <IconButton
              onClick={downloadXLSX}
              title="Download as XL"
            >
              <DownloadIcon sx={{ color: blue[700], fontSize: "24px" }} />
            </IconButton>
            <IconButton
              onClick={toggleFullScreen}
              title={isFullScreen ? "Exit" : "Fullscreen"}
            >
              {isFullScreen ? (
                <FullscreenExitIcon sx={{ color: blue[700], fontSize: "24px" }} />
              ) : (
                <FullscreenIcon sx={{ color: blue[700], fontSize: "24px" }} />
              )}
            </IconButton>
          </Box>

          <Paper
            elevation={3}
            sx={{
              overflow: "auto",
              width: "100%",
              ...(isFullScreen && {
                height: "calc(100vh - 100px)",
              }),
            }}
          >
            <TableContainer
              ref={containerRef}
              sx={{
                maxHeight: isFullScreen ? 'calc(100vh - 150px)' : '60vh',
                position: "relative",
              }}
            >
              <Table stickyHeader sx={{ minWidth: 1400 }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: blue[50] }}>
                    {columns.map((col, index) => (
                      <TableCell
                        key={index}
                        sx={{
                          width: col.width,
                          fontWeight: "bold",
                          whiteSpace: "nowrap",
                          py: 1,
                          // Remove border completely
                          border: "none",
                          borderBottom: `2px solid ${blue[300]}`,
                        }}
                      >
                        {col.label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        align="center"
                        sx={{ py: 4, border: "none" }}
                      >
                        <CircularProgress />
                        <Typography variant="body1" sx={{ mt: 1 }}>
                          Loading dispatch data...
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : filteredData.length > 0 ? (
                    filteredData.map((item, index) => (
                      <TableRow
                        key={item.dispatchId || index}
                        sx={{
                          "&:hover": { backgroundColor: blue[50] },
                          height: rowHeight,
                          // Remove row borders
                          border: "none",
                        }}
                      >
                        {columns.map((col, colIndex) => (
                          <TableCell
                            key={colIndex}
                            sx={{
                              width: col.width,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              py: 1,
                              // Remove cell borders completely
                              border: "none",
                              // Add only bottom border for separation
                              borderBottom: `1px solid ${blue[100]}`,
                            }}
                          >
                            {col.render(item)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        align="center"
                        sx={{ py: 4, border: "none" }}
                      >
                        <Typography variant="body1">No dispatch data available</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>

        <Dialog
          open={!!popupRowId}
          onClose={handlePopupClose}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: blue[50],
          }}>
            <Box>
              <Typography variant="h6">
                Dispatch Details - {selectedItem?.dispatchNumber || "N/A"}
              </Typography>
              <Typography variant="subtitle1">
                Branch: {selectedItem?.branchName || "N/A"}
              </Typography>
              <Typography variant="subtitle1">
                Total Amount: ₹{totalAmount}
              </Typography>
            </Box>
            <IconButton onClick={handlePopupClose}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ padding: 0 }}>
            <TableContainer component={Paper} elevation={0}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow sx={{ bgcolor: blue[100] }}>
                    {expandedColumns.map((col, idx) => (
                      <TableCell
                        key={idx}
                        sx={{
                          width: col.width,
                          fontWeight: "bold",
                          whiteSpace: "nowrap",
                          // Remove borders for popup table as well
                          border: "none",
                          borderBottom: `2px solid ${blue[300]}`,
                        }}
                      >
                        {col.label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedItem && Array.isArray(selectedItem.itemName) ? (
                    selectedItem.itemName.map((name, i) => (
                      <TableRow
                        key={i}
                        sx={{ border: "none" }}
                      >
                        <TableCell sx={{ border: "none", borderBottom: `1px solid ${blue[50]}` }}>
                          {i + 1}
                        </TableCell>
                        <TableCell sx={{ border: "none", borderBottom: `1px solid ${blue[50]}` }}>
                          {Array.isArray(selectedItem.itemCode) && selectedItem.itemCode[i]
                            ? selectedItem.itemCode[i]
                            : "N/A"}
                        </TableCell>
                        <TableCell sx={{ border: "none", borderBottom: `1px solid ${blue[50]}` }}>
                          {name || "N/A"}
                        </TableCell>
                        <TableCell sx={{ border: "none", borderBottom: `1px solid ${blue[50]}` }}>
                          {Array.isArray(selectedItem.uom) && selectedItem.uom[i]
                            ? selectedItem.uom[i].toString().toUpperCase()
                            : "N/A"}
                        </TableCell>
                        <TableCell sx={{ border: "none", borderBottom: `1px solid ${blue[50]}` }}>
                          {(() => {
                            const qty = Array.isArray(selectedItem.qty) && selectedItem.qty[i];
                            const weight = Array.isArray(selectedItem.weight) && selectedItem.weight[i];
                            if (qty && weight) return `${qty} / ${weight.toFixed(2)}`;
                            if (qty) return `${qty}`;
                            if (weight) return `${weight.toFixed(2)}`;
                            return "N/A";
                          })()}
                        </TableCell>
                        <TableCell sx={{ border: "none", borderBottom: `1px solid ${blue[50]}` }}>
                          {Array.isArray(selectedItem.price) && selectedItem.price[i]
                            ? selectedItem.price[i].toFixed(2)
                            : "0.00"}
                        </TableCell>
                        <TableCell sx={{ border: "none", borderBottom: `1px solid ${blue[50]}` }}>
                          {Array.isArray(selectedItem.amount) && selectedItem.amount[i]
                            ? selectedItem.amount[i].toFixed(2)
                            : "0.00"}
                        </TableCell>
                        <TableCell sx={{ border: "none", borderBottom: `1px solid ${blue[50]}` }}>
                          {Array.isArray(selectedItem.category) && selectedItem.category[i]
                            ? selectedItem.category[i]
                            : "N/A"}
                        </TableCell>
                        <TableCell sx={{ border: "none", borderBottom: `1px solid ${blue[50]}` }}>
                          {Array.isArray(selectedItem.subCategory) && selectedItem.subCategory[i]
                            ? selectedItem.subCategory[i]
                            : "N/A"}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={expandedColumns.length}
                        align="center"
                        sx={{ border: "none" }}
                      >
                        No items available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </DialogContent>
        </Dialog>
      </>
    );
  };

  if (dispatchError || branchError) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
        <Typography color="error">{dispatchError || branchError}</Typography>
      </Box>
    );
  }

  return (
    <>
      <Report />
      <Box sx={{ my: 4, margin: 3, height: 240 }}>
        <Grid container spacing={2}>
          <Grid item xs={11} sm={6} md={4}>
            <label>Search Branches (name or alias)</label>
            <Autocomplete
              multiple
              options={branchOptions}
              disableCloseOnSelect
              getOptionLabel={(option) => option.label}
              value={selectedBranches}
              onChange={handleBranchChange}
              filterOptions={filterOptions}
              renderTags={() => null}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderOption={renderOption}
              renderInput={(params) => (
                <TextField
                  {...params}
                  variant="outlined"
                  error={!!submitError && selectedBranches.length === 0}
                  helperText={
                    submitError && selectedBranches.length === 0
                      ? submitError
                      : selectedBranches.length >= branchOptions.length - 1
                        ? "All branches selected"
                        : `${selectedBranches.length} selected`
                  }
                  sx={{
                    mt: 0,
                    "& .MuiOutlinedInput-root": {
                      minHeight: "30px",
                      padding: "0 8px",
                      display: "flex",
                      overflow: "hidden",
                    },
                    "& .MuiOutlinedInput-input": {
                      padding: "0 !important",
                      height: "30px",
                      fontSize: "large",
                      lineHeight: "2.4rem",
                      display: "flex",
                    },
                  }}
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <>
                        {selectedBranches.length > 0 && (
                          <InputAdornment position="start">
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              mb={2}
                            >
                              {selectedBranches.length} selected
                            </Typography>
                          </InputAdornment>
                        )}
                        {params.InputProps.startAdornment}
                      </>
                    ),
                  }}
                />
              )}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <DispatchDateFilter
              selectedBranches={selectedBranches}
              fetchDataWithFilter={fetchDataWithFilter}
            />
          </Grid>
        </Grid>

        {isTableVisible ? (
          <Box>
            <Typography variant="h6">
              Showing {filteredData.length} dispatch records for{" "}
              {selectedBranches.length} branches
              {filter.startDate && filter.endDate
                ? ` from ${parseDate(filter.startDate).format("DD MMM YYYY")} to ${parseDate(
                  filter.endDate
                ).format("DD MMM YYYY")}`
                : ""}
            </Typography>
            <Box mt={-5}>
              <VirtualizedTable
                isFullScreen={isFullScreen}
                setIsFullScreen={setIsFullScreen}
              />
            </Box>
          </Box>
        ) : (
          <Box sx={{ my: 4 }}>
            <Typography align="center" variant="h6">
              Please select at least one branch and a valid date range to view the data
            </Typography>
          </Box>
        )}

        <Snackbar
          open={!!submitError}
          autoHideDuration={6000}
          onClose={() => setSubmitError(null)}
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
        >
          <Alert severity="error" onClose={() => setSubmitError(null)}>
            {submitError}
          </Alert>
        </Snackbar>
        <Snackbar
          open={submitSuccess}
          autoHideDuration={3000}
          onClose={() => setSubmitSuccess(false)}
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
        >
          <Alert severity="success" onClose={() => setSubmitSuccess(false)}>
            Fetched successfully!
          </Alert>
        </Snackbar>
      </Box>
    </>
  );
};

export default DispatchPage;