'use client';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { groupInsights, type InsightRow } from '@/lib/intelligence';
import { datesBetween, shiftDate, type Daily, type Profile } from '@/lib/model';
import type { ProductDay } from '@/lib/products';

const number = (v: unknown) =>
  typeof v === 'number'
    ? v.toLocaleString('en-US', { maximumFractionDigits: 2 })
    : '—';
const money = (v: unknown) =>
  typeof v === 'number'
    ? '$' +
      v.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '—';

export function SameTimePanel({
  rows,
  start,
  end,
  profile,
}: {
  rows: InsightRow[];
  start: string;
  end: string;
  profile: string;
}) {
  const days = datesBetween(start, end);
  const priorStart = shiftDate(start, -days.length),
    priorEnd = shiftDate(start, -1);
  const current = groupInsights(rows, 'hourly', start, end, profile),
    previous = groupInsights(rows, 'hourly', priorStart, priorEnd, profile);
  const currentHours = new Map(current.map((r) => [r.hour, r])),
    previousHours = new Map(previous.map((r) => [r.hour, r]));
  const comparable = [...currentHours.keys()]
    .filter((h) => previousHours.has(h))
    .sort((a, b) => (a ?? 0) - (b ?? 0));
  const cutoff = comparable.at(-1);
  const sum = (items: InsightRow[], key: 'orders' | 'gmv' | 'units') =>
    items.length && items.every((r) => typeof r[key] === 'number')
      ? items.reduce((n, r) => n + Number(r[key]), 0)
      : null;
  const currentComparable =
    cutoff == null ? [] : current.filter((r) => (r.hour ?? 24) <= cutoff);
  const previousComparable =
    cutoff == null ? [] : previous.filter((r) => (r.hour ?? 24) <= cutoff);
  const delta = (a: number | null, b: number | null) =>
    a === null || b === null
      ? '—'
      : b === 0
        ? a === 0
          ? '持平'
          : '上期为 0'
        : `${a >= b ? '+' : ''}${(((a - b) / b) * 100).toFixed(1)}%`;
  const chart = comparable.map((hour) => ({
    hour: `${String(hour).padStart(2, '0')}:00`,
    current: currentHours.get(hour)?.orders ?? undefined,
    previous: previousHours.get(hour)?.orders ?? undefined,
  }));
  const cg = sum(currentComparable, 'gmv'),
    pg = sum(previousComparable, 'gmv'),
    co = sum(currentComparable, 'orders'),
    po = sum(previousComparable, 'orders'),
    cu = sum(currentComparable, 'units'),
    pu = sum(previousComparable, 'units');
  return (
    <section className="panel">
      <div className="panelheading">
        <div>
          <h2>同一时刻经营对比</h2>
          <p className="muted">
            本期与前一个等长区间，只比较双方都有明细的小时。
          </p>
        </div>
        <span>
          {cutoff == null
            ? '暂无可比小时'
            : `截止 ${String(cutoff).padStart(2, '0')}:59 PT`}
        </span>
      </div>
      {chart.length ? (
        <>
          <div className="chartbox">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="hour" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line
                  dataKey="current"
                  name="本期订单"
                  stroke="#4059d7"
                  connectNulls={false}
                />
                <Line
                  dataKey="previous"
                  name="上期订单"
                  stroke="#9aa6ba"
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="detail-grid compact-details">
            {[
              ['支付订单', number(co), number(po), delta(co, po)],
              ['售出件数', number(cu), number(pu), delta(cu, pu)],
              ['销售额', money(cg), money(pg), delta(cg, pg)],
              [
                '客单价',
                money(cg !== null && co ? cg / co : null),
                money(pg !== null && po ? pg / po : null),
                delta(
                  cg !== null && co ? cg / co : null,
                  pg !== null && po ? pg / po : null,
                ),
              ],
            ].map(([label, value, prior, change]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>
                  上期 {prior} · {change}
                </small>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="empty">
          本期与上期小时明细尚未同时覆盖，暂时不能做同期判断。
        </div>
      )}
      <p className="footnote">
        缺少小时数据时保持未知；不同截止时刻的数据不会直接比较。
      </p>
    </section>
  );
}

export function CoveragePanel({
  records,
  insights,
  products,
  profiles,
  start,
  end,
}: {
  records: Daily[];
  insights: InsightRow[];
  products: ProductDay[];
  profiles: Profile[];
  start: string;
  end: string;
}) {
  const dates = datesBetween(start, end),
    expected = dates.length * profiles.length;
  const count = (rows: { date: string; profile: string }[]) =>
    new Set(
      rows
        .filter(
          (r) =>
            r.date >= start &&
            r.date <= end &&
            profiles.some((p) => p.id === r.profile),
        )
        .map((r) => r.date + ':' + r.profile),
    ).size;
  const daily = count(records),
    hourly = count(insights.filter((r) => r.category === 'hourly')),
    product = count(products);
  const refund = count(insights.filter((r) => r.category.startsWith('refund')));
  const latest = records
    .filter((r) => r.date >= start && r.date <= end)
    .map((r) => r.updatedAt)
    .filter((v): v is string => typeof v === 'string')
    .sort()
    .at(-1);
  const item = (label: string, value: number, total: number) => (
    <div>
      <span>{label}</span>
      <strong>
        {value}/{total}
      </strong>
      <small>
        {value === total && total > 0
          ? '完整覆盖'
          : value === 0
            ? '尚未获取'
            : '部分覆盖'}
      </small>
      <progress max={Math.max(total, 1)} value={value} />
    </div>
  );
  return (
    <section className="panel">
      <div className="panelheading">
        <div>
          <h2>数据覆盖与新鲜度</h2>
          <p className="muted">先判断数据是否完整，再判断店铺涨跌。</p>
        </div>
        <span>
          {latest
            ? `最近入库 ${new Date(latest).toLocaleString('zh-CN', { timeZone: 'America/Los_Angeles', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })} PT`
            : '尚无同步时间'}
        </span>
      </div>
      <div className="detail-grid coverage-grid">
        {item('店铺日报', daily, expected)}
        {item('小时明细', hourly, expected)}
        {item('商品明细', product, expected)}
        {item('退款归因', refund, expected)}
      </div>
      <p className="footnote">
        覆盖按“日期 × 店铺”计算；商品无销量也需要明确记录为空，才能判定完整。
      </p>
    </section>
  );
}

export function RefundIntelligence({
  rows,
  products,
  start,
  end,
  profile,
}: {
  rows: InsightRow[];
  products: ProductDay[];
  start: string;
  end: string;
  profile: string;
}) {
  const groups = [
    ['refundReason', '退款原因'],
    ['refundStage', '处理阶段'],
    ['refundType', '退款类型'],
  ] as const;
  const affected = products.filter(
    (p) =>
      p.date >= start &&
      p.date <= end &&
      (profile === 'all' || p.profile === profile) &&
      ((p.refundOrders ?? 0) > 0 || (p.refunds ?? 0) > 0),
  );
  return (
    <div className="intelligence-stack">
      <div className="chartgrid">
        {groups.map(([category, title]) => {
          const data = groupInsights(rows, category, start, end, profile);
          return (
            <section className="panel" key={category}>
              <div className="panelheading">
                <h2>{title}</h2>
                <span>{data.length ? `${data.length} 项` : '明细未覆盖'}</span>
              </div>
              {data.length ? (
                <div className="insight-table">
                  <table>
                    <thead>
                      <tr>
                        <th>项目</th>
                        <th>事件/订单</th>
                        <th>退款金额</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((r) => (
                        <tr key={r.label}>
                          <td>{r.label}</td>
                          <td>{number(r.orders)}</td>
                          <td>{money(r.refunds)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty">尚未获得该项退款明细。</div>
              )}
            </section>
          );
        })}
      </div>
      <section className="panel">
        <div className="panelheading">
          <h2>退款商品归因</h2>
          <span>
            {affected.length ? `${affected.length} 款` : '暂无可确认商品'}
          </span>
        </div>
        {affected.length ? (
          <div className="insight-table">
            <table>
              <thead>
                <tr>
                  <th>商品</th>
                  <th>退款订单</th>
                  <th>确认退款件数</th>
                  <th>数量存疑订单</th>
                  <th>退款金额</th>
                </tr>
              </thead>
              <tbody>
                {affected.map((p) => (
                  <tr key={p.profile + p.productId}>
                    <td>
                      {p.title}
                      <small>{p.sku || p.productId}</small>
                    </td>
                    <td>{number(p.refundOrders)}</td>
                    <td>{number(p.confirmedRefundUnits)}</td>
                    <td>{number(p.quantityAmbiguousOrders)}</td>
                    <td>{money(p.refunds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">退款事件尚未与商品稳定关联。</div>
        )}
        <p className="footnote">
          “确认退款件数”只统计数量明确的退款；多商品订单或数量无法确认时单独列入存疑订单。
        </p>
      </section>
    </div>
  );
}
