import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface PFESI {
  id: string;
  employeeId: string;
  contribution: number;
  // Add other fields as needed
}

interface UpdatePFESIPayload {
  index: number;
  pfesi: PFESI;
}

interface HrmState {
  pfesi: PFESI[];
  currentSection: string;
}

const initialState: HrmState = {
  pfesi: [],
  currentSection: 'pfesi',
};

const hrmSlice = createSlice({
  name: 'hrm',
  initialState,
  reducers: {
    addPFESI: (state, action: PayloadAction<PFESI>) => {
      state.pfesi.push(action.payload);
    },
    updatePFESI: (state, action: PayloadAction<UpdatePFESIPayload>) => {
      const { index, pfesi } = action.payload;
      state.pfesi[index] = pfesi;
    },
    deletePFESI: (state, action: PayloadAction<number>) => {
      state.pfesi.splice(action.payload, 1);
    },
    setCurrentSection: (state, action: PayloadAction<string>) => {
      state.currentSection = action.payload;
    },
  },
});

export const { addPFESI, updatePFESI, deletePFESI, setCurrentSection } = hrmSlice.actions;
export default hrmSlice.reducer;
