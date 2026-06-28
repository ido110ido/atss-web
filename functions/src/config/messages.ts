export const MORNING_HEADER_TEMPLATE = "morning_list";
export const DELIVERY_ITEM_TEMPLATE = "delivery_item_action";

export const DEFAULT_LANGUAGE = "en";

/**
 * Formats deliveries into a numbered string for the WhatsApp message body.
 * @param {Array<{driverName: string, expectedTime: string}>} deliveries list
 * @return {string} numbered list, one delivery per line
 */
export function formatDeliveryList(
  deliveries: Array<{ driverName: string; expectedTime: string }>,
): string {
  return deliveries.map((d, i) => `${i + 1}. ${d.expectedTime} - ${d.driverName}`).join("\n");
}

/**
 * Converts a YYYY-MM-DD date string to the DD.MM.YY format used in messages.
 * @param {string} isoDate date in YYYY-MM-DD format
 * @return {string} date in DD.MM.YY format
 */
export function formatDateForMessage(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}.${month}.${year.slice(2)}`;
}
