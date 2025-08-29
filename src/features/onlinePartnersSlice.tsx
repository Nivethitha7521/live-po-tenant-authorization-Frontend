import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Offer {
  name: string;
  currentPrice: number;
  percentage: string;
  partnerPrice: string;
  active: boolean;
}

interface PartnerOffer {
  partner: string;
  offer: Offer[];
}

interface OnlinePartnersState {
  partners: Record<string, Offer[]>;
}

const initialState: OnlinePartnersState = {
  partners: {},
};

const onlinePartnersSlice = createSlice({
  name: 'onlinePartners',
  initialState,
  reducers: {
    addPartnerOffer(state, action: PayloadAction<PartnerOffer>) {
      const { partner, offer } = action.payload;
      state.partners[partner] = offer;
    },
    updatePartnerOffer(state, action: PayloadAction<PartnerOffer>) {
      const { partner, offer } = action.payload;
      if (state.partners[partner]) {
        state.partners[partner] = offer;
      }
    },
    removePartnerOffer(state, action: PayloadAction<string>) {
      const partner = action.payload;
      delete state.partners[partner];
    },
  },
});

export const { addPartnerOffer, updatePartnerOffer, removePartnerOffer } = onlinePartnersSlice.actions;

export default onlinePartnersSlice.reducer;
