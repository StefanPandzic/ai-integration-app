import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  ProductionLineState,
  PrinterState,
} from '../../features/production/types';

/**
 * Production line state slice
 * Manages 3 production lines and their associated printers
 */
interface ProductionState {
  lines: ProductionLineState[];
  printers: PrinterState[];
}

const initialState: ProductionState = {
  // Initialize 3 production lines, all starting in off state
  lines: [
    { id: 1, isActive: false },
    { id: 2, isActive: false },
    { id: 3, isActive: false },
  ],
  // Initialize 3 barcode printers (one per line), all starting in off state
  printers: [
    { lineId: 1, isActive: false },
    { lineId: 2, isActive: false },
    { lineId: 3, isActive: false },
  ],
};

const productionSlice = createSlice({
  name: 'production',
  initialState,
  reducers: {
    // Toggle production line switch state (on/off)
    toggleLine: (state, action: PayloadAction<number>) => {
      const lineId = action.payload;

      // Validate line ID is within range
      if (lineId < 1 || lineId > 3) {
        return;
      }

      // Update line state by flipping isActive for matching line
      const line = state.lines.find((l) => l.id === lineId);
      if (line) {
        line.isActive = !line.isActive;
      }
    },

    // Toggle barcode printer state (on/off) for specified production line
    togglePrinter: (state, action: PayloadAction<number>) => {
      const lineId = action.payload;

      // Validate line ID is within range
      if (lineId < 1 || lineId > 3) {
        return;
      }

      // Update printer state by flipping isActive for matching printer
      const printer = state.printers.find((p) => p.lineId === lineId);
      if (printer) {
        printer.isActive = !printer.isActive;
      }
    },
  },
});

export const { toggleLine, togglePrinter } = productionSlice.actions;

export default productionSlice.reducer;
