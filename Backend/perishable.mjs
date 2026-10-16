export function orderingStatus(product, now = Date.now()) {
  if (!product.perishable) return {open:true};
  const start=product.orderStart || '08:00';
  const cutoff=product.orderCutoff || '14:00';
  const time=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Lagos',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(now));
  return {open:time>=start && time<cutoff, start, cutoff, timezone:'Africa/Lagos'};
}
