import { env } from 'cloudflare:workers';
import { database } from '@/lib/db';
import {
  validateInsights,
  validateProducts,
  validateRecords,
  validateSnapshots,
} from '@/lib/validation';

function bytes(value: string) {
  return new TextEncoder().encode(value);
}

async function same(left: string, right: string) {
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', bytes(left)),
    crypto.subtle.digest('SHA-256', bytes(right)),
  ]);
  const a = new Uint8Array(leftHash);
  const b = new Uint8Array(rightHash);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

async function authorizedToken(token: string | null | undefined) {
  const configured = (env as unknown as { INGEST_TOKEN?: string }).INGEST_TOKEN;
  if (!configured || !token) return false;
  return same(token, configured);
}

function jsonError(error: string, status: number) {
  return Response.json({ ok: false, error }, { status });
}

export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return jsonError('须使用 JSON 请求', 415);

  let body: any;
  try {
    const text = await request.text();
    if (text.length > 1_500_000) return jsonError('请求过大', 413);
    body = JSON.parse(text);
  } catch {
    return jsonError('JSON 格式无效', 400);
  }

  if (!(await authorizedToken(typeof body.ingestToken === 'string' ? body.ingestToken : null)))
    return jsonError('未授权', 401);

  if (typeof body.readDate === 'string') {
    const db = database();
    const rows = await db
      .prepare("SELECT key,value,updated_at FROM workspace WHERE key LIKE ? ORDER BY key")
      .bind(`daily:${body.readDate}:%`)
      .all<{ key: string; value: string; updated_at: string }>();
    return Response.json({
      ok: true,
      date: body.readDate,
      records: rows.results.map((row) => ({ ...JSON.parse(row.value), storedAt: row.updated_at })),
    });
  }

  try {
    const records = body.records ? validateRecords(body.records) : [];
    const snapshots = body.snapshots ? validateSnapshots(body.snapshots) : [];
    const products = body.products ? validateProducts(body.products) : [];
    const insights = body.insights ? validateInsights(body.insights) : [];
    if (!records.length && !snapshots.length && !products.length && !insights.length)
      return jsonError('没有可写入的数据', 400);

    const checkedAt = new Date().toISOString();
    const writes: { key: string; value: unknown }[] = [
      ...records.map((row) => ({ key: `daily:${row.date}:${row.profile}`, value: row })),
      ...products.map((row) => ({
        key: `product:${row.date}:${row.profile}:${row.productId}`,
        value: row,
      })),
      ...insights.map((row) => ({
        key:
          'insight:' +
          JSON.stringify([
            row.date,
            row.profile,
            row.category,
            row.category === 'hourly' ? row.hour : row.label,
          ]),
        value: row,
      })),
    ];
    if (snapshots.length) writes.push({ key: 'snapshots', value: snapshots });

    const db = database();
    await db.batch(
      writes.map(({ key, value }) =>
        db
          .prepare(
            'INSERT INTO workspace (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at',
          )
          .bind(key, JSON.stringify(value), checkedAt),
      ),
    );

    return Response.json({
      ok: true,
      syncedAt: checkedAt,
      counts: {
        records: records.length,
        snapshots: snapshots.length,
        products: products.length,
        insights: insights.length,
      },
    });
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}

export async function GET(request: Request) {
  if (!(await authorizedToken(request.headers.get('x-ingest-token'))))
    return jsonError('未授权', 401);
  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  if (!date) return jsonError('缺少 date', 400);
  const db = database();
  const rows = await db
    .prepare("SELECT key,value,updated_at FROM workspace WHERE key LIKE ? ORDER BY key")
    .bind(`daily:${date}:%`)
    .all<{ key: string; value: string; updated_at: string }>();
  return Response.json({
    ok: true,
    date,
    records: rows.results.map((row) => ({
      ...JSON.parse(row.value),
      storedAt: row.updated_at,
    })),
  });
}
