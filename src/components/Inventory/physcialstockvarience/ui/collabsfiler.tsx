



"use client";
import React, { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { MultiValueRemoveProps } from "react-select";
import {
  components,
  OptionProps,
  MultiValueGenericProps,
  GroupBase,
  SingleValueProps,
  StylesConfig,
  SelectInstance,
  ClearIndicatorProps,
} from "react-select";
import { FaTimes, FaCheck } from "react-icons/fa";
import { TextField } from "@mui/material";
import Select from "react-select";
import { createPortal } from "react-dom";
import useOnClickOutside from "./useonclik";
import { debounce } from "lodash";

interface Option {
  label: string;
  value: string;
}

interface CollapsibleFilterProps {
  title: string;
  options?: Option[];
  selectedOptions: string[] | string | null;
  onChange: (selectedOptions: string[] | string) => void;
  onClear: () => void;
  onScrollBottom?: () => void;
  onSearch?: (searchTerm: string) => void;
  inputType: "multi-select" | "single-select" | "date";
  isMulti?: boolean;
  loading?: boolean;
  searchValue?: string;
  showSelectedCount?: boolean;
  showRemoveOption?: boolean;
  restrictToTodayOnly?: boolean;
  displayLabel?: string;
  disabled?: boolean;
}

const CollapsibleFilter: React.FC<CollapsibleFilterProps> = ({
  title,
  options = [],
  selectedOptions,
  onChange,
  onClear,
  onScrollBottom,
  onSearch,
  inputType,
  isMulti = false,
  loading = false,
  searchValue = "",
  showSelectedCount = true,
  showRemoveOption = true,
  restrictToTodayOnly,
  displayLabel,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchInput, setSearchInput] = useState<string>(searchValue);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  const ref = useRef<HTMLDivElement | null>(null);
  const selectRef = useRef<SelectInstance<Option, boolean> | null>(null);
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const prevSearchInput = useRef<string>(searchValue);
  const keepFocusRef = useRef(false);

  // ✅ Ref to cache Value -> Label mapping so we show Name even if item is not in current options
  const selectedLabelMapRef = useRef<Map<string, string>>(new Map());

  useOnClickOutside(ref, () => setIsOpen(false), buttonRef);

  const updateDropdownPosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setDropdownPosition({
      top: rect.bottom + window.scrollY,
      left: rect.left + window.scrollX,
      width: Math.max(200, rect.width),
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updateDropdownPosition();
    const onResize = () => updateDropdownPosition();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [isOpen, updateDropdownPosition]);

  useEffect(() => {
    if (isOpen && selectRef.current) {
      selectRef.current.focus();
    }
  }, [isOpen]);

  const selectedValues = useMemo(
    () => (Array.isArray(selectedOptions) ? selectedOptions : selectedOptions ? [selectedOptions] : []),
    [selectedOptions]
  );

  // ✅ Update cache whenever current options change (to catch new names)
  useEffect(() => {
    options.forEach((o) => {
      if (o.label) {
        selectedLabelMapRef.current.set(o.value, o.label);
      }
    });
  }, [options]);

  const getTodayDate = useCallback(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const isPastDate = useCallback(
    (dateString: string) => {
      if (!dateString) return false;
      const sel = new Date(dateString);
      const today = new Date(getTodayDate());
      today.setHours(0, 0, 0, 0);
      return sel < today;
    },
    [getTodayDate]
  );

  const hasSelection = useMemo(() => {
    return Array.isArray(selectedOptions) ? selectedOptions.length > 0 : !!selectedOptions;
  }, [selectedOptions]);

  const shouldShowRemoveIcon = useMemo(() => {
    if (inputType === "date") return false;

    if (!showRemoveOption) return false;

    return hasSelection;
  }, [inputType, showRemoveOption, hasSelection]);


  const debouncedSearch = useMemo(
    () =>
      onSearch
        ? debounce((v: string) => {
          if (v !== prevSearchInput.current) {
            onSearch(v);
            prevSearchInput.current = v;
          }
        }, 400)
        : undefined,
    [onSearch]
  );

  const handleInputChange = useCallback(
    (v: string) => {
      setSearchInput(v);
      if (onSearch && v !== prevSearchInput.current) debouncedSearch?.(v);
    },
    [onSearch, debouncedSearch]
  );

  const handleClearSearch = useCallback(() => {
    setSearchInput("");
    if (onSearch) onSearch("");
  }, [onSearch]);

  // ✅ HANDLE SELECTION: Save Label to Cache immediately upon selection
  const handleSelectChange = useCallback(
    (sel: Option | readonly Option[] | null) => {
      if (inputType === "multi-select") {
        const selectedArray = Array.isArray(sel) ? sel : [];

        // 1. Update Cache: Store label for newly selected items
        selectedArray.forEach((o) => {
          if (o.label) selectedLabelMapRef.current.set(o.value, o.label);
        });

        // 2. Dispatch value changes
        const vals = selectedArray.map((o) => o.value);
        onChange(vals);
        setSearchInput("");
      } else if (inputType === "single-select") {
        const option = sel && !Array.isArray(sel) ? (sel as Option) : null;

        // 1. Update Cache
        if (option?.label) {
          selectedLabelMapRef.current.set(option.value, option.label);
        }

        // 2. Dispatch value changes
        const val = option ? option.value : "";
        onChange(val);
        setSearchInput("");
        setIsOpen(false);
      }
    },
    [inputType, onChange]
  );

  const handleDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      if (!v || v <= getTodayDate()) onChange(v);
    },
    [onChange, getTodayDate]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (inputType === "date") {
        onChange(getTodayDate());
      } else {
        onClear();
        setSearchInput("");
        onSearch?.("");
      }
    },
    [inputType, onClear, onSearch, getTodayDate, onChange]
  );

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (disabled) return;
      setIsOpen((p) => !p);
    },
    [disabled]
  );

  const handleScrollBottom = useCallback(() => {
    if (loading) return;
    if (onScrollBottom) {
      keepFocusRef.current = true;
      onScrollBottom();
    }
  }, [loading, onScrollBottom]);

  const customStyles: StylesConfig<Option, boolean> = {
    control: (provided) => ({
      ...provided,
      minHeight: "26px",
      minWidth: "130px",
      fontSize: "0.9rem",
      overflow: "hidden",
      whiteSpace: "nowrap",
      border: "1px solid #d1d5db",
    }),
    valueContainer: (provided) => ({
      ...provided,
      maxHeight: "100px",
      overflowY: "auto",
      overflowX: "hidden",
      padding: "0 2px",
      flexWrap: "wrap",
    }),
    menu: (provided) => ({ ...provided, position: "static", boxShadow: "none", border: "none", borderRadius: 0, margin: 0 }),
    menuList: (provided) => ({
      ...provided,
      maxHeight: "200px",
      overflowY: "auto",
      paddingBottom: "5px",
      "&::-webkit-scrollbar": { width: "4px", height: "2px" },
      "&::-webkit-scrollbar-track": { background: "#f1f1f1", borderRadius: "4px" },
      "&::-webkit-scrollbar-thumb": { background: "#c1c1c1", borderRadius: "4px" },
      "&::-webkit-scrollbar-thumb:hover": { background: "#a1a1a1" },
    }),
    multiValue: (provided) => ({ ...provided, backgroundColor: "#10b981", color: "white", margin: "2px", borderRadius: "4px", display: "flex", alignItems: "center" }),
    multiValueLabel: (provided) => ({ ...provided, color: "white", fontSize: "0.7rem", whiteSpace: "normal", overflow: "visible", textOverflow: "unset" }),
    multiValueRemove: (provided) => ({
      ...provided,
      color: "white",
      paddingLeft: "4px",
      paddingRight: "4px",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      ":hover": { backgroundColor: "#ef4444", color: "white" },
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected ? "#d4edda" : state.isFocused ? "#f0f0f0" : "transparent",
      color: "black",
      fontSize: "0.7rem",
      whiteSpace: "normal",
      display: "flex",
      alignItems: "center",
      padding: "6px 8px",
      cursor: "pointer",
    }),
    singleValue: (provided) => ({ ...provided, color: "black", fontSize: "0.75rem" }),
  };

  const CustomOption = (props: OptionProps<Option>) => (
    <components.Option {...props}>
      {props.isSelected && <FaCheck className="mr-2 text-green-600" />}
      {props.label}
    </components.Option>
  );

  const MultiValueContainer = (props: MultiValueGenericProps<Option, true, GroupBase<Option>>) => (
    <components.MultiValueContainer {...props}>{props.children}</components.MultiValueContainer>
  );

  const CustomMultiValueRemove = (props: MultiValueRemoveProps<Option>) => (
    <components.MultiValueRemove {...props}>
      <FaTimes style={{ fontSize: "0.65rem", color: "white" }} />
    </components.MultiValueRemove>
  );

  const CustomMultiValue = () => null;

  const SingleValue = (props: SingleValueProps<Option>) => (
    <components.SingleValue {...props}>
      <span className="text-sm font-medium">{props.data.label}</span>
    </components.SingleValue>
  );

  const ClearIndicator = <OptionType extends Option>({
    innerProps,
  }: ClearIndicatorProps<OptionType, boolean>) => {
    return (
      <div
        {...innerProps}
        onMouseDown={(e) => {
          e.preventDefault();
          handleClearSearch();
        }}
        style={{ cursor: "pointer", padding: "0 4px", fontSize: "0.8rem" }}
      >
        ✕
      </div>
    );
  };

  // ✅ MEMO: Construct display objects using Cached Labels
  // Priority: Cached Label -> Current Option Label -> Value (ID)
  const selectedOptionObjects = useMemo(() => {
    return selectedValues.map(v => {
      // Check cache first
      const cachedLabel = selectedLabelMapRef.current.get(v);
      // Check current options list
      const currentOption = options.find(o => o.value === v);

      return {
        value: v,
        // Use cached label if found, else current option label, else fallback to ID
        label: cachedLabel || currentOption?.label || v,
      };
    });
  }, [selectedValues, options]);


  const filteredOptions = useMemo(() => {
    // Start with selected items (using our cached objects)
    const selectedOpts = selectedOptionObjects;

    // Filter unselected options from current page
    const unselectedOpts = options.filter(
      (o) =>
        !selectedValues.includes(o.value) &&
        (!searchInput.trim() ||
          o.label.toLowerCase().includes(searchInput.toLowerCase()) ||
          o.value.toLowerCase().includes(searchInput.toLowerCase()))
    );

    return [...selectedOpts, ...unselectedOpts];
  }, [options, searchInput, selectedValues, selectedOptionObjects]);


  const renderDropdownContent = () => {
    if (inputType === "date") {
      const today = getTodayDate();
      if (restrictToTodayOnly) {
        return (
          <TextField
            type="date"
            value={today}
            onChange={() => { }}
            inputProps={{ readOnly: true, disabled: true }}
            InputLabelProps={{ shrink: true }}
            sx={{
              width: "100%",
              "& .MuiInputBase-root": { height: 40, fontSize: "0.875rem" },
              "& input": { padding: "8.5px 14px", cursor: "not-allowed" },
            }}
          />
        );
      }
      return (
        <TextField
          type="date"
          value={selectedOptions || ""}
          onChange={handleDateChange}
          inputProps={{ max: getTodayDate() }}
          InputLabelProps={{ shrink: true }}
          sx={{
            width: "100%",
            "& .MuiInputBase-root": { height: 40, fontSize: "0.875rem" },
            "& input": { padding: "8.5px 14px" },
          }}
        />
      );
    }

    return (
      <Select
        ref={selectRef}
        isMulti={isMulti}
        options={filteredOptions}
        components={{
          Option: CustomOption,
          MultiValueContainer,
          MultiValueRemove: CustomMultiValueRemove,
          MultiValue: CustomMultiValue,
          SingleValue,
          ClearIndicator,
        }}
        value={isMulti ? selectedOptionObjects : selectedOptionObjects[0] ?? null}
        onChange={handleSelectChange}
        onInputChange={handleInputChange}
        inputValue={searchInput}
        placeholder={`Search ${title}...`}
        styles={customStyles}
        closeMenuOnSelect={!isMulti}
        hideSelectedOptions={false}
        onMenuScrollToBottom={handleScrollBottom}
        isSearchable
        menuIsOpen={isOpen}
      />
    );
  };

  return (
    <div className="relative" style={{ zIndex: isOpen ? 9999 : 1 }}>
      <div
        ref={buttonRef}
        className={`flex justify-between items-center border rounded transition-all border-gray-400 ${disabled
          ? "bg-gray-200 text-gray-400 border-gray-100 cursor-not-allowed"
          : hasSelection
            ? "bg-green-100 border-green-250 cursor-pointer"
            : "bg-gray-200 hover:bg-gray-200 cursor-pointer"
          }`}
        style={{ width: "160px", height: "40px", padding: "2px 8px" }}
        onClick={handleToggle}
      >
        <span className="text-sm font-medium">
          {hasSelection && (inputType === "single-select" || inputType === "date")
            ? displayLabel || (inputType === "date" ? selectedOptions : title)
            : title}
          {showSelectedCount &&
            hasSelection &&
            inputType === "multi-select" &&
            (Array.isArray(selectedOptions) ? ` (${selectedOptions.length})` : " (1)")}
        </span>
        <div className="flex items-center gap-1">
          {shouldShowRemoveIcon && <FaTimes className="text-gray-600 hover:text-red-600" onClick={handleClear} />}
          <div className={`transform transition-transform ${isOpen ? "rotate-90" : ""}`}>▼</div>
        </div>
      </div>

      {isOpen &&
        createPortal(
          <div
            ref={ref}
            className="bg-white border border-gray-300 rounded-lg shadow-xl"
            style={{
              position: "absolute",
              top: dropdownPosition.top + 2,
              left: dropdownPosition.left,
              width: dropdownPosition.width * 1.2,
              zIndex: 999999,
              maxHeight: "350px",
              overflow: "hidden",
            }}
          >
            <div className="p-3">{renderDropdownContent()}</div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default CollapsibleFilter;