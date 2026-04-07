// import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// export interface TableData {
//   id: string;
//   name: string;
//   location: string;
//   seatNumber: number;
//   seatDetails: string[];
// }

// interface TableState {
//   tables: TableData[];
//   currentTable: {
//     tableId: string;
//     tableNameType: string;
//     tableName: string;
//     tableCount: number;
//     locationName: string;
//     areas: { name: string; count: number }[];
//     areaName?: string;
//     areaCount?: number;
//   };
// }

// const initialState: TableState = {
//   tables: [],
//   currentTable: {
//     tableId: '',
//     tableNameType: 'predefined',
//     tableName: '',
//     tableCount: 0,
//     locationName: '',
//     areas: [],
//     areaName: '',
//     areaCount: 0,
//   },
// };

// const tableSlice = createSlice({
//   name: 'table',
//   initialState,
//   reducers: {
//     addTable(state, action: PayloadAction<TableData[]>) {
//       state.tables.push(...action.payload);
//     },
//     setCurrentTableField(
//       state,
//       action: PayloadAction<{ field: string; value: any }>
//     ) {
//       state.currentTable = {
//         ...state.currentTable,
//         [action.payload.field]: action.payload.value,
//       };
//     },
//     addArea(state, action: PayloadAction<{ name: string; count: number }>) {
//       state.currentTable.areas.push(action.payload);
//     },
//     resetCurrentTable(state) {
//       state.currentTable = initialState.currentTable;
//     },
//     updateTableSeat(
//       state,
//       action: PayloadAction<{ id: string; seatNumber: number; seatDetails: string[] }>
//     ) {
//       const table = state.tables.find((table) => table.id === action.payload.id);
//       if (table) {
//         table.seatNumber = action.payload.seatNumber;
//         table.seatDetails = action.payload.seatDetails;
//       }
//     },
//   },
// });

// export const { addTable, setCurrentTableField, addArea, resetCurrentTable, updateTableSeat } =
//   tableSlice.actions;
// export default tableSlice.reducer;
