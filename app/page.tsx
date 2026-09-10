'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Download,
  RefreshCw,
  Plus,
  Store,
  Video,
  ShieldCheck,
  Clock3,
  LockKeyhole,
  TrendingUp,
} from 'lucide-react';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { rankProducts, type ProductDay } from '@/lib/products';
import {
  AdsPanel,
  IntelligencePanels,
  OperationsResources,
} from '@/components/intelligence-panels';
import { PeriodDetails } from '@/components/period-details';
import {
  CoveragePanel,
  RefundIntelligence,
  SameTimePanel,
} from '@/components/operations-analysis';
import { type InsightRow } from '@/lib/intelligence';
import { registerWorkspaceTool } from '@/lib/webmcp';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  initialProfiles,
  fields,
  laToday,
  shiftDate,
  datesBetween,
  aggregateRecords,
  inspectData,
  type Profile,
  type Daily,
  type Report,
  type Snapshot,
} from '@/lib/model';
const num = (v: unknown) =>
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
type Range = 'today' | 'yesterday' | 'before' | '7d' | '30d' | 'custom';
export default function Home() {
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles),
    [records, setRecords] = useState<Daily[]>([]),
    [reports, setReports] = useState<Report[]>([]),
    [snapshots, setSnapshots] = useState<Snapshot[]>([]),
    [products, setProducts] = useState<ProductDay[]>([]),
    [insights, setInsights] = useState<InsightRow[]>([]);
  const [range, setRange] = useState<Range>('7d'),
    [customStart, setCustomStart] = useState(shiftDate(laToday(), -6)),
    [customEnd, setCustomEnd] = useState(laToday()),
    [filter, setFilter] = useState('all'),
    [tab, setTab] = useState('overview'),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [authorized, setAuthorized] = useState<boolean | null>(null),
    [password, setPassword] = useState('');
  const [edit, setEdit] = useState(false),
    [chosen, setChosen] = useState('pop-1'),
    [form, setForm] = useState<Record<string, string>>({}),
    [importOpen, setImportOpen] = useState(false),
    [csv, setCsv] = useState(''),
    [now, setNow] = useState(() => new Date());
  const period = useMemo(() => {
    const today = laToday();
    if (range === 'today') return { start: today, end: today, label: '今天' };
    if (range === 'yesterday')
      return {
        start: shiftDate(today, -1),
        end: shiftDate(today, -1),
        label: '昨天',
      };
    if (range === 'before')
      return {
        start: shiftDate(today, -2),
        end: shiftDate(today, -2),
        label: '前天',
      };
    if (range === '7d')
      return { start: shiftDate(today, -6), end: today, label: '近 7 天' };
    if (range === '30d')
      return { start: shiftDate(today, -29), end: today, label: '近 30 天' };
    return { start: customStart, end: customEnd, label: '自定义区间' };
  }, [range, customStart, customEnd]);
  const rangeDates = useMemo(
    () =>
      period.start <= period.end ? datesBetween(period.start, period.end) : [],
    [period],
  );
  const entryDate = period.end;
  async function load() {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/workspace');
      if (r.status === 401) {
        setAuthorized(false);
        return;
      }
      if (!r.ok) throw Error('工作台数据暂时无法读取，请稍后刷新。');
      const d = (await r.json()) as {
        profiles: Profile[];
        records: Daily[];
        reports: Report[];
        snapshots?: Snapshot[];
        products?: ProductDay[];
        insights?: InsightRow[];
      };
      setProfiles(d.profiles);
      setRecords(d.records);
      setReports(d.reports);
      setSnapshots(d.snapshots || []);
      setProducts(d.products || []);
      setInsights(d.insights || []);
      setLoaded(true);
      setAuthorized(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => registerWorkspaceTool(), []);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  async function save(payload: unknown) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const r = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = (await r.json()) as { error?: string; message?: string };
      if (!r.ok) throw Error(d.error || '保存失败');
      await load();
      setNotice(d.message || '已保存');
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const shops = profiles.filter(
    (p) => p.kind === '店铺' && (filter === 'all' || p.id === filter),
  );
  const rows = shops.map((p) => ({
    p,
    r: aggregateRecords(records, p.id, rangeDates),
  }));
  const coverage = rows.filter((x) => x.r).length;
  const sum = (key: string) =>
    rows.length && rows.every((x) => typeof x.r?.[key] === 'number')
      ? rows.reduce((n, x) => n + Number(x.r![key]), 0)
      : null;
  const chartData = rangeDates.map((date) => {
    const perShop = shops.map((p) =>
      records.find((r) => r.profile === p.id && r.date === date),
    );
    const all = (key: string) =>
      perShop.length && perShop.every((r) => typeof r?.[key] === 'number')
        ? perShop.reduce((n, r) => n + Number(r![key]), 0)
        : undefined;
    return { date: date.slice(5), gmv: all('gmv'), orders: all('orders') };
  });
  const alerts = inspectData(records, profiles, entryDate).filter(
    (a) => !a.includes('利润') && !a.includes('亏损'),
  );
  const previousDates = rangeDates.length
    ? datesBetween(
        shiftDate(period.start, -rangeDates.length),
        shiftDate(period.start, -1),
      )
    : [];
  const previous = (key: string) => {
    const rs = shops.map((p) => aggregateRecords(records, p.id, previousDates));
    return rs.length && rs.every((r) => typeof r?.[key] === 'number')
      ? rs.reduce((n, r) => n + Number(r![key]), 0)
      : null;
  };
  const change = (key: string) => {
    if (period.end >= laToday()) return '今日未结束，暂不比较';
    const now = sum(key),
      prior = previous(key);
    return now === null || prior === null
      ? '上期数据不足'
      : prior === 0
        ? now === 0
          ? '较上期持平'
          : '上期为 0'
        : `较上期 ${now >= prior ? '+' : ''}${(((now - prior) / prior) * 100).toFixed(1)}%`;
  };
  const gmv = sum('gmv'),
    orders = sum('orders'),
    refunds = sum('refunds'),
    visitors = sum('visitors'),
    productImpressions = sum('productImpressions'),
    productViews = sum('productViews');
  const aov =
    gmv !== null && orders !== null && orders > 0 ? gmv / orders : null;
  const productRows = rankProducts(products, period.start, period.end, filter);
  const currentRows = shops.map((p) => ({
    p,
    s: snapshots.find((s) => s.profile === p.id),
    r: records.find((r) => r.profile === p.id && r.date === entryDate),
  }));
  function openEntry(id = 'pop-1') {
    setChosen(id);
    const r = records.find((r) => r.profile === id && r.date === entryDate);
    setForm(
      Object.fromEntries([
        ['source', String(r?.source || '后台人工记录')],
        ...fields.map(([k]) => [k, r?.[k] == null ? '' : String(r[k])]),
      ]),
    );
    setEdit(true);
  }
  function download() {
    const blob = new Blob(
      [
        '\uFEFF' +
          [
            'date,profile,source,' + fields.map((f) => f[0]).join(','),
            entryDate + ',pop-1,后台导出,' + fields.map(() => '').join(','),
          ].join('\r\n'),
      ],
      { type: 'text/csv;charset=utf-8' },
    );
    const u = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = u;
    a.download = 'QL每日数据模板.csv';
    a.click();
    URL.revokeObjectURL(u);
  }
  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw Error(d.error || '无法验证密码');
      setPassword('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const laClock = now.toLocaleString('zh-CN', {
    timeZone: 'America/Los_Angeles',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const cnClock = now.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const timeLabel = (value?: string) =>
    value
      ? new Date(value).toLocaleString('zh-CN', {
          timeZone: 'America/Los_Angeles',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }) + ' PT'
      : '未同步';
  if (authorized !== true)
    return (
      <main className="accessgate">
        <section>
          <LockKeyhole size={28} />
          <p className="eyebrow">QL OPERATIONS</p>
          <h1>清澜跨境</h1>
          <p>请输入访问密码后继续。</p>
          <form onSubmit={unlock}>
            <Input
              aria-label="访问密码"
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="访问密码"
              required
            />
            <Button type="submit" disabled={busy || authorized === null}>
              {authorized === null ? '正在检查…' : '进入工作台'}
            </Button>
          </form>
          {error && (
            <div className="feedback error" role="alert">
              {error}
            </div>
          )}
        </section>
      </main>
    );
  return (
    <div className="workspace">
      <header className="topbar">
        <div className="brand">
          <span className="brandmark">QL</span>
          <span>清澜跨境</span>
        </div>
        <div className="header-times">
          <span>美西 {laClock} PT</span>
          <span>北京时间 {cnClock}</span>
          <span className="private">
            <ShieldCheck size={16} />
            密码保护
          </span>
        </div>
      </header>
      <main>
        <div className="pageheading">
          <div>
            <p className="eyebrow">美国市场 · 3 店 / 4 账号</p>
            <h1>
              经营总览<span className="accentdot">.</span>
            </h1>
          </div>
          <div className="actions">
            <Button
              variant="outline"
              onClick={() => void load()}
              disabled={busy}
            >
              <RefreshCw size={16} />
              刷新
            </Button>
          </div>
        </div>
        {error && (
          <div className="feedback error" role="alert">
            {error}
          </div>
        )}
        {notice && <output className="feedback">{notice}</output>}
        <div className="filterbar">
          <div className="actions rangebuttons">
            {(
              [
                ['today', '今天'],
                ['yesterday', '昨天'],
                ['before', '前天'],
                ['7d', '近7天'],
                ['30d', '近30天'],
                ['custom', '自定义'],
              ] as [Range, string][]
            ).map(([v, label]) => (
              <button
                className={range === v ? 'active' : ''}
                key={v}
                onClick={() => setRange(v)}
              >
                {label}
              </button>
            ))}
            {range === 'custom' && (
              <>
                <Input
                  aria-label="开始日期"
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
                <span>至</span>
                <Input
                  aria-label="结束日期"
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </>
            )}
          </div>
          <div className="actions">
            <Select value={filter} onValueChange={(v) => v && setFilter(v)}>
              <SelectTrigger>
                <SelectValue>
                  {filter === 'all'
                    ? '全部店铺'
                    : profiles.find((p) => p.id === filter)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部店铺</SelectItem>
                {profiles
                  .filter((p) => p.kind === '店铺')
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <span className="coverage">
              美西时间 · USD · 覆盖 {coverage}/{rows.length} 店
            </span>
          </div>
        </div>
        <section className="metrics owner-metrics">
          {[
            {
              title: '支付销售额',
              value: money(gmv),
              note: change('gmv'),
              Icon: Store,
            },
            {
              title: '支付订单',
              value: num(orders),
              note: change('orders'),
              Icon: Activity,
            },
            {
              title: '访客数',
              value: num(visitors),
              note: '店铺后台访客口径',
              Icon: Store,
            },
            {
              title: '商品曝光',
              value: num(productImpressions),
              note: '商品被展示的次数',
              Icon: TrendingUp,
            },
            {
              title: '商品浏览',
              value: num(productViews),
              note: '进入商品页或商品卡浏览',
              Icon: TrendingUp,
            },
            {
              title: '访客支付转化',
              value:
                typeof orders === 'number' &&
                typeof visitors === 'number' &&
                visitors > 0
                  ? ((orders / visitors) * 100).toFixed(2) + '%'
                  : '—',
              note: '支付订单 ÷ 访客；用于趋势观察',
              Icon: Activity,
            },
            {
              title: '售出件数',
              value: num(sum('units')),
              note: change('units'),
              Icon: Store,
            },
            {
              title: '客单价',
              value: money(aov),
              note: '销售额 ÷ 支付订单',
              Icon: TrendingUp,
            },
            {
              title: '退款金额',
              value: money(refunds),
              note: change('refunds'),
              Icon: Clock3,
            },
          ].map(({ title, value, note, Icon }) => (
            <article className="metric" key={title}>
              <div>
                {title}
                <Icon size={18} />
              </div>
              <strong>{value}</strong>
              <p>{note}</p>
            </article>
          ))}
        </section>
        <section className="owner-strip">
          <span>
            经营区间{' '}
            <b>
              {period.start} — {period.end}
            </b>
          </span>
          <span>
            比较口径 <b>前一个等长区间</b>
          </span>
          <span>
            统计时区 <b>America / Los Angeles</b>
          </span>
          <span>
            店铺日报 <b>按美西自然日归属</b>
          </span>
        </section>
        <CoveragePanel
          records={records}
          insights={insights}
          products={products}
          profiles={shops}
          start={period.start}
          end={period.end}
        />
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList variant="line" className="worktabs">
            <TabsTrigger value="overview">店铺总览</TabsTrigger>
            <TabsTrigger value="ads">广告投放</TabsTrigger>
            <TabsTrigger value="details">经营明细</TabsTrigger>
            <TabsTrigger value="resources">运营工具箱</TabsTrigger>
            <TabsTrigger value="products">商品表现</TabsTrigger>
            <TabsTrigger value="health">履约与健康</TabsTrigger>
            <TabsTrigger value="refunds">退款分析</TabsTrigger>
            <TabsTrigger value="content">内容账号</TabsTrigger>
            <TabsTrigger value="reports">每日巡检</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <section className="chartgrid">
              <Chart
                title="支付销售额趋势"
                data={chartData}
                dataKey="gmv"
                format={money}
              />
              <Chart
                title="支付订单趋势"
                data={chartData}
                dataKey="orders"
                format={num}
              />
            </section>
            <div className="twocol">
              <section className="panel">
                <div className="panelheading">
                  <h2>店铺表现</h2>
                  <span>
                    {period.label} · {period.start} 至 {period.end}
                  </span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {[
                        '店铺',
                        '销售额',
                        '订单',
                        '客单价',
                        '销售占比',
                        '数据状态',
                        '同步时间',
                        '',
                      ].map((h, i) => (
                        <TableHead key={i}>{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map(({ p, r }) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <strong>{p.name}</strong>
                          <small>{p.type} · 美国</small>
                        </TableCell>
                        <TableCell>{money(r?.gmv)}</TableCell>
                        <TableCell>{num(r?.orders)}</TableCell>
                        <TableCell>
                          {money(
                            typeof r?.gmv === 'number' &&
                              typeof r.orders === 'number' &&
                              r.orders > 0
                              ? r.gmv / r.orders
                              : null,
                          )}
                        </TableCell>
                        <TableCell>
                          {typeof r?.gmv === 'number' &&
                          gmv !== null &&
                          gmv > 0 ? (
                            <div className="share-cell">
                              <b>{((r.gmv / gmv) * 100).toFixed(1)}%</b>
                              <progress max="100" value={(r.gmv / gmv) * 100} />
                            </div>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={r ? 'pill good' : 'pill'}>
                            {r ? '已覆盖' : '不完整'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <small>{r ? timeLabel(r.updatedAt) : '未同步'}</small>
                        </TableCell>
                        <TableCell>
                          <button
                            className="textbutton"
                            disabled={!loaded}
                            onClick={() => openEntry(p.id)}
                          >
                            录入
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="footnote">
                  展示销售规模、出单节奏与履约风险；趋势图只绘制完整日报，缺失数据不补零。
                </p>
              </section>
              <section className="panel focus">
                <div className="panelheading">
                  <h2>优先关注</h2>
                  <span className="pill">{alerts.length} 项</span>
                </div>
                {alerts.slice(0, 4).map((item, i) => (
                  <div className="step" key={i}>
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    <p>{item}</p>
                  </div>
                ))}
              </section>
            </div>
          </TabsContent>
          <TabsContent value="ads">
            <AdsPanel records={rows.map((x) => x.r)} />
          </TabsContent>
          <TabsContent value="details">
            <PeriodDetails
              records={records}
              profiles={shops}
              start={period.start}
              end={period.end}
            />
            <SameTimePanel
              rows={insights}
              start={period.start}
              end={period.end}
              profile={filter}
            />
            <IntelligencePanels
              rows={insights}
              records={rows.map((x) => x.r)}
              start={period.start}
              end={period.end}
              profile={filter}
            />
          </TabsContent>
          <TabsContent value="resources">
            <OperationsResources />
          </TabsContent>
          <TabsContent value="products">
            <section className="panel">
              <div className="panelheading">
                <div>
                  <h2>出单商品排行</h2>
                  <p className="muted">
                    按已记录支付订单排序，查看哪些图案与机型在出单。
                  </p>
                </div>
                <span>{productRows.length} 款有记录商品</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    {[
                      '商品 / 机型',
                      '店铺',
                      '订单',
                      '件数',
                      '销售额',
                      '退款订单',
                      '退款件数',
                      '退款金额',
                    ].map((h) => (
                      <TableHead key={h}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productRows.map((p) => (
                    <TableRow key={p.profile + p.productId}>
                      <TableCell>
                        <div className="product-cell">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt="" loading="lazy" />
                          ) : (
                            <span className="product-placeholder">QL</span>
                          )}
                          <div>
                            <strong className="product-title">{p.title}</strong>
                            <small>
                              {p.model || '机型未提供'} · {p.sku || p.productId}
                            </small>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {profiles.find((s) => s.id === p.profile)?.name}
                      </TableCell>
                      <TableCell>{num(p.orders)}</TableCell>
                      <TableCell>{num(p.units)}</TableCell>
                      <TableCell>{money(p.gmv)}</TableCell>
                      <TableCell>{num(p.refundOrders)}</TableCell>
                      <TableCell>{num(p.confirmedRefundUnits ?? p.refundUnits)}</TableCell>
                      <TableCell>{money(p.refunds)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!productRows.length && (
                <div className="empty">
                  <Store size={28} />
                  <h3>该区间暂无商品明细</h3>
                  <p>获取商品级订单后，可查看出单排行和退款商品。</p>
                </div>
              )}
              <p className="footnote">
                仅汇总已记录商品明细；明细未覆盖的日期和商品不视为零销量。
              </p>
            </section>
          </TabsContent>
          <TabsContent value="health">
            <section className="store-health-grid">
              {currentRows.map(({ p, s, r }) => (
                <section className="panel" key={p.id}>
                  <div className="panelheading">
                    <h2>{p.name}</h2>
                    <span className="pill">
                      {s
                        ? new Date(s.checkedAt).toLocaleDateString('zh-CN', {
                            timeZone: 'America/Los_Angeles',
                          })
                        : '暂无快照'}
                    </span>
                  </div>
                  <div className="health-score">
                    <ShieldCheck size={26} />
                    <strong>{num(s?.healthScore)}</strong>
                    <span>平台健康分</span>
                  </div>
                  <dl className="store-facts">
                    {[
                      ['待发货', s?.ordersToShip],
                      ['待处理退货', s?.pendingReturns],
                      ['未读违规', s?.violations],
                      ['在售商品', s?.activeProducts],
                      ['商品上限', s?.listingLimit],
                      ['被拒商品', s?.rejectedProducts],
                      ['低库存商品', s?.lowStockProducts],
                      ['近7天访客', s?.visitors],
                      ['近7天商品浏览', s?.productViews],
                      ['待处理样品申请', s?.pendingSampleRequests],
                      ['未读工单', s?.unreadTickets],
                      ['差评待办', s?.negativeReviews],
                      ['当日订单 / 上限',
                        s?.dailyOrders != null && s?.dailyOrderLimit != null
                          ? `${s.dailyOrders} / ${s.dailyOrderLimit}`
                          : null],
                      ['截止日超时未揽收', r?.late],
                    ].map(([label, value]) => (
                      <div key={String(label)}>
                        <dt>{label}</dt>
                        <dd>{num(value)}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="footnote">
                    {s?.note || '暂无店铺状态记录，不能据此判断店铺健康。'}
                  </p>
                </section>
              ))}
            </section>
            <p className="footnote">
              待发货与健康分为最近一次快照；超时未揽收取区间截止日日报，不跨天累加。
            </p>
          </TabsContent>
          <TabsContent value="refunds">
            <RefundIntelligence
              rows={insights}
              products={productRows}
              start={period.start}
              end={period.end}
              profile={filter}
            />
            <div className="chartgrid">
              <section className="panel">
                <div className="panelheading">
                  <h2>退款与取消</h2>
                  <span>{period.label}</span>
                </div>
                <dl className="store-facts">
                  {[
                    ['退款金额', money(refunds)],
                    ['退款订单', num(sum('refundOrders'))],
                    ['取消订单', num(sum('cancelled'))],
                    ['样品订单', num(sum('sampleOrders'))],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="footnote">
                  退款按本期发生时间统计，可能涉及以前的订单；不直接当作本期订单退款率。
                </p>
              </section>
              <section className="panel">
                <div className="panelheading">
                  <h2>店铺退款分布</h2>
                </div>
                {rows.map(({ p, r }) => (
                  <div className="refund-row" key={p.id}>
                    <strong>{p.name}</strong>
                    <span>{money(r?.refunds)}</span>
                    <small>{num(r?.refundOrders)} 笔退款</small>
                  </div>
                ))}
              </section>
            </div>
            <section className="panel">
              <h2>退款原因与商品问题</h2>
              {productRows.some((p) => (p.refunds ?? 0) > 0) ? (
                productRows
                  .filter((p) => (p.refunds ?? 0) > 0)
                  .sort((a, b) => (b.refunds ?? 0) - (a.refunds ?? 0))
                  .map((p) => (
                    <div className="refund-row" key={p.profile + p.productId}>
                      <strong>{p.title}</strong>
                      <span>{money(p.refunds)}</span>
                      <small>{num(p.refundOrders)} 笔退款</small>
                    </div>
                  ))
              ) : (
                <div className="empty">
                  <Clock3 size={28} />
                  <h3>暂无可展示的退款商品</h3>
                  <p>退款原因和处理阶段明细尚未获取，暂时无法归因。</p>
                </div>
              )}
            </section>
          </TabsContent>
          <TabsContent value="content">
            <section className="panel">
              <div className="panelheading">
                <h2>内容账号表现</h2>
                <span>{period.label}</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    {['账号', '视频发布', '播放', '商品点击', '点击率', ''].map(
                      (h, i) => (
                        <TableHead key={i}>{h}</TableHead>
                      ),
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles
                    .filter((p) => p.kind === '账号')
                    .map((p) => {
                      const r = aggregateRecords(records, p.id, rangeDates);
                      return (
                        <TableRow key={p.id}>
                          <TableCell>
                            <Video size={16} className="inlineicon" />
                            {p.name}
                          </TableCell>
                          <TableCell>{num(r?.videos)}</TableCell>
                          <TableCell>{num(r?.views)}</TableCell>
                          <TableCell>{num(r?.clicks)}</TableCell>
                          <TableCell>
                            {typeof r?.views === 'number' &&
                            r.views > 0 &&
                            typeof r.clicks === 'number'
                              ? ((r.clicks / r.views) * 100).toFixed(2) + '%'
                              : '—'}
                          </TableCell>
                          <TableCell>
                            <button
                              className="textbutton"
                              disabled={!loaded}
                              onClick={() => openEntry(p.id)}
                            >
                              录入
                            </button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </section>
          </TabsContent>
          <TabsContent value="reports">
            <section className="panel">
              <div className="panelheading">
                <div>
                  <h2>每日巡检记录</h2>
                  <p className="muted">
                    每天 09:00
                    美西时间读取三家店铺当前状态，并检查前一完整自然日。
                  </p>
                </div>
                <Button
                  disabled={!loaded || busy}
                  onClick={() =>
                    void save({ action: 'inspect', date: entryDate })
                  }
                >
                  <Activity size={16} />
                  检查 {entryDate}
                </Button>
              </div>
              {reports.length ? (
                reports.map((r, i) => (
                  <article className="report" key={i}>
                    <strong>{r.date}</strong>
                    <small>
                      检查时间{' '}
                      {new Date(r.at).toLocaleString('zh-CN', {
                        timeZone: 'America/Los_Angeles',
                      })}{' '}
                      PT
                    </small>
                    {r.alerts
                      .filter((a) => !a.includes('利润') && !a.includes('亏损'))
                      .map((a, j) => (
                        <p key={j}>{a}</p>
                      ))}
                  </article>
                ))
              ) : (
                <div className="empty">
                  <Clock3 size={30} />
                  <h3>还没有巡检记录</h3>
                  <p>选择日期后可查看缺数与履约提醒。</p>
                </div>
              )}
            </section>
          </TabsContent>
        </Tabs>
        <footer>
          清澜跨境 · 统计口径：美西时间 / 美元
          <span>{loaded ? '工作台数据已读取' : '正在连接工作台'}</span>
        </footer>
      </main>
      <Dialog open={edit} onOpenChange={setEdit}>
        <DialogContent className="entrydialog">
          <DialogTitle>
            {profiles.find((p) => p.id === chosen)?.name} · {entryDate}
          </DialogTitle>
          <DialogDescription>
            空白表示未知；确认没有发生的项目填 0。保存会更新这一天的记录。
          </DialogDescription>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const row = {
                date: entryDate,
                profile: chosen,
                source: form.source,
                ...Object.fromEntries(
                  fields.map(([k]) => [
                    k,
                    form[k] === '' || form[k] == null ? null : Number(form[k]),
                  ]),
                ),
              };
              if (await save({ action: 'records', records: [row] }))
                setEdit(false);
            }}
          >
            <label htmlFor="data-source">
              数据来源
              <Input
                id="data-source"
                required
                value={form.source || ''}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
              />
            </label>
            <div className="formgrid">
              {fields
                .filter(([k]) =>
                  chosen.startsWith('account')
                    ? ['views', 'clicks', 'videos'].includes(k)
                    : !['views', 'clicks', 'videos'].includes(k),
                )
                .map(([k, label]) => (
                  <label key={k} htmlFor={k}>
                    {label}
                    <Input
                      id={k}
                      type="number"
                      min="0"
                      step={
                        [
                          'orders',
                          'pending',
                          'late',
                          'violations',
                          'views',
                          'clicks',
                          'videos',
                        ].includes(k)
                          ? '1'
                          : '0.01'
                      }
                      value={form[k] || ''}
                      onChange={(e) =>
                        setForm({ ...form, [k]: e.target.value })
                      }
                      placeholder="未知"
                    />
                  </label>
                ))}
            </div>
            <Button type="submit" disabled={busy}>
              保存日报
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="entrydialog">
          <DialogTitle>导入日报 CSV</DialogTitle>
          <DialogDescription>
            最多 500
            行，USD。空白保留为未知。同一天同一账号覆盖更新。导入失败时不会部分写入。
          </DialogDescription>
          <input
            type="file"
            accept=".csv,text/csv"
            aria-label="选择日报 CSV"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) {
                if (f.size > 1000000) {
                  setError('文件请小于 1 MB');
                  return;
                }
                setCsv(await f.text());
              }
            }}
          />
          <textarea
            aria-label="CSV 内容"
            rows={8}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder="date,profile,source,gmv,orders,..."
          />
          <Button
            disabled={busy || !csv.trim()}
            onClick={async () => {
              if (await save({ action: 'csv', csv })) setImportOpen(false);
            }}
          >
            验证并导入
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function Chart({
  title,
  data,
  dataKey,
  format,
}: {
  title: string;
  data: { date: string; gmv?: number; orders?: number }[];
  dataKey: 'gmv' | 'orders';
  format: (v: unknown) => string;
}) {
  const known = data.some((d) => typeof d[dataKey] === 'number');
  return (
    <section className="panel chart">
      <div className="panelheading">
        <h2>{title}</h2>
        <span>{known ? '完整日报' : '暂无完整日报'}</span>
      </div>
      {known ? (
        <div className="chartbox">
          <ResponsiveContainer width="100%" height={225}>
            <LineChart data={data}>
              <CartesianGrid stroke="#e9edf4" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: '#758095' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#758095' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(v) => format(v)}
                labelFormatter={(v) => `日期 ${v}`}
              />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke="#485de0"
                strokeWidth={3}
                dot={{ r: 3 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="chartempty">
          <TrendingUp size={26} />
          <p>补齐对应日期的日报后展示趋势曲线。</p>
        </div>
      )}
    </section>
  );
}
