export const SELECTED_DRAW_GESTURE_DRAW_OR_DESELECT = "draw-or-deselect";
export const SELECTED_DRAW_GESTURE_MANIPULATE = "manipulate";

export function resolveSelectedDrawGesture({
  toolMode,
  hasSelection,
  hitStrokeIndex = -1,
  insideSelectionFrame = false
} = {}) {
  if (toolMode !== "draw" || !hasSelection) {
    return null;
  }
  if (hitStrokeIndex >= 0 || insideSelectionFrame) {
    return SELECTED_DRAW_GESTURE_MANIPULATE;
  }
  return SELECTED_DRAW_GESTURE_DRAW_OR_DESELECT;
}
