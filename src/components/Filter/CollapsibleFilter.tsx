'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import Select, {
  components,
  OptionProps,
  StylesConfig,
  MenuListProps,
  SelectInstance,
  ControlProps,
  GroupBase
} from 'react-select';
import { FaTimes } from 'react-icons/fa';
import { createPortal } from 'react-dom';

// ============================================================================
// TYPES
// ============================================================================

interface OptionType {
  label: string;
  value: string;
}

export type FilterType =
  | "year"
  | "month"
  | "day"
  | "locations"
  | "warehouse"
  | "branch"
  | "department"
  | "category"
  | "status"
  | "employee"
  | "vendor"
  | "customer"
  | "itemCode"
  | "variance"

interface CollapsibleFilterProps {
  id: string;
  title: string;
  type: FilterType;
  options: OptionType[];
  selectedOptions: string[];
  onChange: (selected: string[]) => void;
  onClear: () => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onSearch?: (q: string) => void;
  inputType?: 'multi-select' | 'single-select' | 'date';
  showSelectedCount?: boolean;
  showRemoveOption?: boolean;
  restrictToTodayOnly?: boolean;
  displayLabel?: string;
  disabled?: boolean;
  active: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  otherYear?: string[];
  otherMonth?: string[];
  otherDay?: string[];
}

interface ExtendedMenuListProps extends MenuListProps<OptionType, true, GroupBase<OptionType>> {
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  scrollTopRef: React.MutableRefObject<number>;
}

// ============================================================================
// DEBOUNCE HOOK
// ============================================================================

const useDebounce = <T extends (...args: any[]) => void>(
  callback: T,
  delay: number
) => {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const debouncedFn = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  );

  const cancel = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  return { debouncedFn, cancel };
};

// ============================================================================
// CLICK OUTSIDE HOOK
// ============================================================================

const useOnClickOutside = (
  ref: React.RefObject<HTMLElement | null>,
  handler: () => void,
  excludeRefs: React.RefObject<HTMLElement | null>[] = [],
  isOpen: boolean
) => {
  useEffect(() => {
    if (!isOpen) return;

    const listener = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (!ref.current || ref.current.contains(target)) return;
      for (const ex of excludeRefs) {
        if (ex.current && ex.current.contains(target)) return;
      }
      handler();
    };

    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', listener, true);
      document.addEventListener('touchstart', listener, true);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', listener, true);
      document.removeEventListener('touchstart', listener, true);
    };
  }, [ref, handler, excludeRefs, isOpen]);
};

// ============================================================================
// CUSTOM COMPONENTS
// ============================================================================

const CustomMenuList = memo<ExtendedMenuListProps>(function CustomMenuList(props) {
  const {
    children,
    onLoadMore,
    hasMore,
    loadingMore,
    innerRef,
    innerProps,
    scrollTopRef
  } = props;

  const listRef = useRef<HTMLDivElement | null>(null);
  const loadingTriggeredRef = useRef(false);

  useEffect(() => {
    if (!listRef.current) return;
    if (scrollTopRef.current > 0) {
      listRef.current.scrollTop = scrollTopRef.current;
      return;
    }
    const firstSelected = listRef.current.querySelector('[aria-selected="true"]');
    if (firstSelected) {
      (firstSelected as HTMLElement).scrollIntoView({ block: 'nearest' });
    }
  }, [scrollTopRef, children]);

  const onScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      scrollTopRef.current = el.scrollTop;
      if (!hasMore || loadingMore || !onLoadMore) return;
      const bottomOffset = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (bottomOffset < 50 && !loadingTriggeredRef.current) {
        loadingTriggeredRef.current = true;
        onLoadMore();
        setTimeout(() => {
          loadingTriggeredRef.current = false;
        }, 500);
      }
    },
    [hasMore, loadingMore, onLoadMore, scrollTopRef]
  );

  return (
    <div
      ref={(node) => {
        if (innerRef) {
          if (typeof innerRef === 'function') innerRef(node);
          else innerRef.current = node;
        }
        listRef.current = node;
      }}
      {...innerProps}
      onScroll={onScroll}
      style={{
        maxHeight: 220,
        overflowY: 'auto',
        paddingLeft: 4,
        paddingRight: 4,
      }}
    >
      {children}
      {loadingMore && (
        <div style={{ padding: '8px', textAlign: 'center', fontSize: 12, color: '#666' }}>
          Loading more...
        </div>
      )}
    </div>
  );
});

const CustomControl = memo<ControlProps<OptionType, true, GroupBase<OptionType>>>(function CustomControl(props) {
  return <components.Control {...props}>{props.children}</components.Control>;
});

/**
 * REMOVED CHECKBOX OPTION
 * Now just displays the label. Visual selection is handled by background color in styles.
 */
const CustomOption = memo<OptionProps<OptionType, true, GroupBase<OptionType>>>(function CustomOption(props) {
  return (
    <components.Option {...props}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={{ flex: 1 }}>{props.label}</span>
      </div>
    </components.Option>
  );
});

// ============================================================================
// STYLES
// ============================================================================

const customStyles: StylesConfig<OptionType, true, GroupBase<OptionType>> = {
  control: (base) => ({
    ...base,
    minHeight: 36,
    fontSize: 12,
    borderRadius: 6,
    borderColor: '#d1d5db',
    '&:hover': {
      borderColor: '#9ca3af',
    },
  }),
  valueContainer: (base) => ({
    ...base,
    padding: '4px 8px',
  }),
  input: (base) => ({
    ...base,
    margin: 0,
    padding: 0,
  }),
  placeholder: (base) => ({
    ...base,
    margin: 0,
    color: '#9ca3af',
  }),
  multiValue: () => ({
    display: 'none',
  }),
  clearIndicator: () => ({
    display: 'none',
  }),
  menu: (base) => ({
    ...base,
    position: 'static',
    boxShadow: 'none',
    border: 'none',
    margin: 0,
  }),
  menuList: (base) => ({
    ...base,
    paddingTop: 6,
    paddingBottom: 6,
  }),
  option: (base, state) => ({
    ...base,
    // Highlight selected options with background color instead of checkbox
    backgroundColor: state.isSelected 
      ? '#dbeafe' 
      : state.isFocused 
        ? '#f3f4f6' 
        : 'transparent',
    color: state.isSelected ? '#1e40af' : '#111827',
    fontWeight: state.isSelected ? 600 : 400,
    fontSize: 11,
    whiteSpace: 'normal',
    padding: '8px 12px',
    cursor: 'pointer',
    transition: 'all 0.1s ease',
    '&:active': {
      backgroundColor: '#e5e7eb',
    },
  }),
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const CollapsibleFilter: React.FC<CollapsibleFilterProps> = memo((props) => {
  const {
    title,
    type,
    options,
    selectedOptions,
    onChange,
    onClear,
    onLoadMore,
    hasMore = false,
    loadingMore = false,
    onSearch,
    inputType = 'multi-select',
    showSelectedCount = true,
    showRemoveOption = true,
    restrictToTodayOnly,
    displayLabel,
    disabled = false,
    active,
    onActivate,
  } = props;

  const [isOpen, setIsOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 240 });

  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const selectRef = useRef<SelectInstance<OptionType, true, GroupBase<OptionType>> | null>(null);
  const scrollTopRef = useRef(0);
  const prevSearchRef = useRef('');
  const positionCalculatedRef = useRef(false);
  const didInitRef = useRef(false);

  const optionsMap = useMemo(() => {
    const map = new Map<string, OptionType>();
    options.forEach((o) => map.set(o.value, o));
    return map;
  }, [options]);

  const selectedValues = useMemo(() => {
    return selectedOptions.map((v) => optionsMap.get(v) || { value: v, label: v });
  }, [selectedOptions, optionsMap]);

  const filteredOptions = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    const selectedSet = new Set(selectedOptions);
    const selectedItems = selectedOptions.map((v) => optionsMap.get(v) || { label: v, value: v });
    let unselectedItems = options.filter((o) => !selectedSet.has(o.value));

    if (q) {
      unselectedItems = unselectedItems.filter(
        (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
      );
    }
    return [...selectedItems, ...unselectedItems];
  }, [options, searchInput, selectedOptions, optionsMap]);

  const { debouncedFn: debouncedSearch } = useDebounce(onSearch || (() => { }), 350);

  useEffect(() => {
    if (!type || !['year', 'month', 'day'].includes(type)) return;
    const allEmpty =
      type === 'year'
        ? selectedOptions.length === 0 && props.otherMonth?.length === 0 && props.otherDay?.length === 0
        : type === 'month'
          ? selectedOptions.length === 0 && props.otherYear?.length === 0 && props.otherDay?.length === 0
          : selectedOptions.length === 0 && props.otherYear?.length === 0 && props.otherMonth?.length === 0;

    if (!allEmpty || didInitRef.current) return;
    didInitRef.current = true;

    const loadDefaultDate = async () => {
      const today = new Date();
      const defaultVal = type === 'year' ? today.getFullYear().toString() : type === 'month' ? String(today.getMonth() + 1).padStart(2, '0') : String(today.getDate()).padStart(2, '0');
      try {
        const response = await fetch('https://yenerp.com/liveapi/datetime');
        const { current_date } = await response.json();
        if (current_date) {
          const parts = current_date.split('-');
          const value = type === 'year' ? parts[2] : type === 'month' ? parts[1] : parts[0];
          onChange([value]);
        } else {
          onChange([defaultVal]);
        }
      } catch {
        onChange([defaultVal]);
      }
    };
    loadDefaultDate();
  }, [type, onChange, selectedOptions, props.otherYear, props.otherMonth, props.otherDay]);

  const updateDropdownPosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const viewportW = window.innerWidth;
    let width = Math.max(220, rect.width);
    const maxWidth = Math.min(520, viewportW - 20);
    if (width > maxWidth) width = maxWidth;
    let left = rect.left + window.scrollX;
    if (rect.left + width > viewportW) {
      left = Math.max(10, viewportW - width - 10) + window.scrollX;
    }
    setDropdownPos({ top: rect.bottom + window.scrollY + 6, left, width });
    positionCalculatedRef.current = true;
  }, []);

  useEffect(() => {
    if (!isOpen) { positionCalculatedRef.current = false; return; }
    if (!positionCalculatedRef.current) updateDropdownPosition();
    window.addEventListener('resize', updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition, true);
    return () => {
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
    };
  }, [isOpen, updateDropdownPosition]);

  const handleClickOutside = useCallback(() => {
    setIsOpen(false);
    setSearchInput('');
    if (selectRef.current) selectRef.current.blur();
  }, []);

  useOnClickOutside(dropdownRef, handleClickOutside, [buttonRef], isOpen);

  useEffect(() => {
    if (isOpen && selectRef.current && inputType !== 'date') {
      setTimeout(() => selectRef.current?.focus(), 50);
    }
  }, [isOpen, inputType]);

  const handleSelectChange = useCallback((selected: readonly OptionType[]) => {
    onChange(selected.map((s) => s.value));
  }, [onChange]);

  const onInputChange = useCallback((value: string, meta: { action: string }) => {
    if (meta.action === 'input-change') {
      setSearchInput(value);
      if (value !== prevSearchRef.current) {
        scrollTopRef.current = 0;
        debouncedSearch(value);
        prevSearchRef.current = value;
      }
    }
  }, [debouncedSearch]);

  const selectComponents = useMemo(() => ({
    Control: CustomControl,
    Option: CustomOption,
    MenuList: (props: any) => (
      <CustomMenuList {...props} onLoadMore={onLoadMore} hasMore={hasMore} loadingMore={loadingMore} scrollTopRef={scrollTopRef} />
    ),
  }), [onLoadMore, hasMore, loadingMore]);

  const dateInputProps = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return { today, value: selectedOptions[0] || '', onChange: (e: any) => onChange([e.target.value]), max: today };
  }, [selectedOptions, onChange]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    if (!isOpen) updateDropdownPosition();
    if (!active) { onActivate(); setIsOpen(true); } else { setIsOpen(!isOpen); }
  }, [disabled, isOpen, active, onActivate, updateDropdownPosition]);

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    setSearchInput('');
    didInitRef.current = true;
    onClear();
  }, [onClear]);

  const dropdownContent = useMemo(() => {
    if (inputType === 'date') {
      return (
        <input
          type="date"
          value={restrictToTodayOnly ? dateInputProps.today : dateInputProps.value}
          onChange={dateInputProps.onChange}
          readOnly={restrictToTodayOnly}
          max={dateInputProps.max}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      );
    }
    return (
      <Select
        ref={selectRef}
        isMulti
        value={selectedValues}
        options={filteredOptions}
        onChange={(val) => handleSelectChange(val as OptionType[])}
        onInputChange={onInputChange}
        inputValue={searchInput}
        placeholder={`Search ${title}`}
        closeMenuOnSelect={false}
        hideSelectedOptions={false}
        isSearchable
        menuIsOpen
        controlShouldRenderValue={false}
        components={selectComponents}
        styles={customStyles}
        blurInputOnSelect={false}
      />
    );
  }, [inputType, restrictToTodayOnly, dateInputProps, selectedValues, filteredOptions, handleSelectChange, onInputChange, searchInput, title, selectComponents]);

  const hasSelection = selectedOptions.length > 0;
  const showRemove = inputType === 'date' ? !!selectedOptions[0] : showRemoveOption && hasSelection;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        style={{
          backgroundColor: hasSelection ? '#dbeafe' : 'white',
          borderColor: hasSelection ? '#3b82f6' : active ? '#3b82f6' : '#d1d5db',
          borderWidth: hasSelection ? '2px' : '1px',
          color: hasSelection ? '#1e40af' : '#374151',
          fontWeight: hasSelection ? 600 : 400,
        }}
        className={`w-full px-3 py-2 text-sm text-left rounded-md border transition-all duration-200 flex items-center justify-between gap-2 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-gray-400'}`}
      >
        <span className="flex-1 truncate">
          {hasSelection && (inputType === 'date' || displayLabel) ? displayLabel || selectedOptions[0] : title}
          {showSelectedCount && hasSelection && ` (${selectedOptions.length})`}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {showRemove && <FaTimes className="text-red-400 hover:text-red-500 transition-colors" size={12} onClick={handleClear} />}
          <span className="text-gray-400 text-xs">▼</span>
        </div>
      </button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'absolute', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 9999 }}
          className="bg-white rounded-lg shadow-xl border border-gray-200 p-3"
        >
          {dropdownContent}
        </div>,
        document.body
      )}
    </div>
  );
});

CollapsibleFilter.displayName = 'CollapsibleFilter';
export default CollapsibleFilter;