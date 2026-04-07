// redux/slices/dateFilterSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

const today = new Date();
const defaultYear = [today.getFullYear().toString()];
const defaultMonth = [String(today.getMonth() + 1).padStart(2, '0')];
const defaultDay = [String(today.getDate()).padStart(2, '0')];

interface DateFilterState {
    year: string[];
    month: string[];
    day: string[];
}

const initialState: DateFilterState = {
    year: defaultYear,
    month: defaultMonth,
    day: defaultDay,
};

const dateFilterSlice = createSlice({
    name: 'dateFilter',
    initialState,
    reducers: {
        setYear: (state, action: PayloadAction<string[]>) => {
            state.year = action.payload;
        },
        setMonth: (state, action: PayloadAction<string[]>) => {
            state.month = action.payload;
        },
        setDay: (state, action: PayloadAction<string[]>) => {
            state.day = action.payload;
        },
        resetDateFilter: (state) => {
            state.year = defaultYear;
            state.month = defaultMonth;
            state.day = defaultDay;
        },
    },
});

export const { setYear, setMonth, setDay, resetDateFilter } = dateFilterSlice.actions;
export default dateFilterSlice.reducer;