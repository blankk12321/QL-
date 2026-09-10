export type ProductDay = {
  date: string;
  profile: string;
  productId: string;
  title: string;
  model: string;
  sku?: string;
  imageUrl?: string;
  orders: number | null;
  units: number | null;
  gmv: number | null;
  refunds: number | null;
  refundOrders: number | null;
  refundUnits?: number | null;
  confirmedRefundUnits?: number | null;
  quantityAmbiguousOrders?: number | null;
  source: string;
};
export function rankProducts(
  items: ProductDay[],
  start: string,
  end: string,
  profile: string,
) {
  const groups = new Map<string, ProductDay[]>();
  for (const p of items) {
    if (
      p.date < start ||
      p.date > end ||
      (profile !== 'all' && p.profile !== profile)
    )
      continue;
    const key = p.profile + ':' + p.productId;
    groups.set(key, [...(groups.get(key) || []), p]);
  }
  return [...groups.values()]
    .map((rows) => {
      const total = (
        k:
          | 'orders'
          | 'units'
          | 'gmv'
          | 'refunds'
          | 'refundOrders'
          | 'refundUnits'
          | 'confirmedRefundUnits'
          | 'quantityAmbiguousOrders',
      ) =>
        rows.every((r) => typeof r[k] === 'number')
          ? rows.reduce((n, r) => n + Number(r[k]), 0)
          : null;
      return {
        ...rows[0],
        orders: total('orders'),
        units: total('units'),
        gmv: total('gmv'),
        refunds: total('refunds'),
        refundOrders: total('refundOrders'),
        refundUnits: total('refundUnits'),
        confirmedRefundUnits: total('confirmedRefundUnits'),
        quantityAmbiguousOrders: total('quantityAmbiguousOrders'),
      };
    })
    .sort((a, b) => (b.orders ?? -1) - (a.orders ?? -1));
}
