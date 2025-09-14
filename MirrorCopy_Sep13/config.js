// config.js

/**
 * Configuration for the planning horizon.
 * This object contains the anchor date for planning and the number of 
 * forward-looking quarters to display in the UI.
 */
export const planConfig = {
  // The anchor date for the plan run. The UI will calculate the quarters starting from this date.
  // Format: YYYY-MM-DD
  planStartDate: '2025-09-05',

  // The number of forward quarters to generate and display in the filter bar.
  numberOfQuarters: 8
};
