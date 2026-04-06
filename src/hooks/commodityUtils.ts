// Commodity pricing utility constants and helpers.
// Kept in a separate file so CommoditySheetModal.tsx can satisfy Vite's
// fast-refresh requirement of only exporting React components.

export const COMMODITY_SETTING_KEY_BID = "commodity_prices_bid";
export const COMMODITY_SETTING_KEY_PCO = "commodity_prices_pco";
export const COMMODITY_UPLOAD_TS_BID   = "commodity_upload_ts_bid";
export const COMMODITY_UPLOAD_TS_PCO   = "commodity_upload_ts_pco";

export function commoditySettingKey(type: "bid" | "pco"): string {
  return type === "pco" ? COMMODITY_SETTING_KEY_PCO : COMMODITY_SETTING_KEY_BID;
}

export function commodityUploadTsKey(type: "bid" | "pco"): string {
  return type === "pco" ? COMMODITY_UPLOAD_TS_PCO : COMMODITY_UPLOAD_TS_BID;
}
