import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Feedback {
  feedbackId: string;
  customerId: string;
  feedbackDate: string;
  feedbackType: 'Positive' | 'Negative' | 'Neutral';
  feedbackDetails: string;
  rating: number;
  followUpStatus: 'Pending' | 'In Progress' | 'Resolved';
}

interface FeedbackState {
  feedbacks: Feedback[];
}

const initialState: FeedbackState = {
  feedbacks: [],
};

const feedbackSlice = createSlice({
  name: 'feedback',
  initialState,
  reducers: {
    addFeedback: (state, action: PayloadAction<Feedback>) => {
      state.feedbacks.push(action.payload);
    },
    updateFeedback: (state, action: PayloadAction<{ index: number; feedback: Feedback }>) => {
      const { index, feedback } = action.payload;
      state.feedbacks[index] = feedback;
    },
    deleteFeedback: (state, action: PayloadAction<number>) => {
      state.feedbacks.splice(action.payload, 1);
    },
  },
});

export const { addFeedback, updateFeedback, deleteFeedback } = feedbackSlice.actions;

export default feedbackSlice.reducer;
