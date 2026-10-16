export const naira = (n: number) => "₦" + Math.round(n).toLocaleString("en-NG");

export const discountPct = (price: number, old?: number) =>
  old && old > price ? Math.round(((old - price) / old) * 100) : 0;
