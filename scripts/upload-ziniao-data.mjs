import { readFile } from 'node:fs/promises';

const input = process.argv[2];
if (!input) throw new Error('用法: node scripts/upload-ziniao-data.mjs <抓取结果.json>');

const token = process.env.QINGLAN_INGEST_TOKEN;
if (!token) throw new Error('缺少 QINGLAN_INGEST_TOKEN');
const sitesToken = process.env.QINGLAN_SITES_TOKEN;
if (!sitesToken) throw new Error('缺少 QINGLAN_SITES_TOKEN');

const origin =
  process.env.QINGLAN_SITE_ORIGIN ||
  'https://qinglan-crossborder.skillsam6688.chatgpt.site';
const source = JSON.parse(await readFile(input, 'utf8'));
const payload = {
  ingestToken: token,
  records: source.daily || [],
  snapshots: source.snapshots || [],
  products: source.products || source.topProducts || [],
  insights: source.insights || [],
};
const headers = {
  'OAI-Sites-Authorization': `Bearer ${sitesToken}`,
  'Content-Type': 'application/json',
};

const uploaded = await fetch(`${origin}/api/ingest`, {
  method: 'POST',
  headers,
  body: JSON.stringify(payload),
});
const uploadedText = await uploaded.text();
let uploadedBody;
try {
  uploadedBody = JSON.parse(uploadedText);
} catch {
  throw new Error(`上传端点返回非 JSON（HTTP ${uploaded.status}）`);
}
if (!uploaded.ok || !uploadedBody.ok)
  throw new Error(`上传失败: ${uploadedBody.error || uploaded.status}`);

const checked = await fetch(`${origin}/api/ingest`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ ingestToken: token, readDate: source.businessDate }),
});
const checkedBody = await checked.json();
if (!checked.ok || !checkedBody.ok)
  throw new Error(`回读失败: ${checkedBody.error || checked.status}`);

const expectedProfiles = new Set(payload.records.map((row) => row.profile));
const actualProfiles = new Set(checkedBody.records.map((row) => row.profile));
if (
  expectedProfiles.size !== actualProfiles.size ||
  [...expectedProfiles].some((profile) => !actualProfiles.has(profile))
)
  throw new Error('回读记录与上传店铺不一致');

console.log(
  JSON.stringify(
    {
      ok: true,
      uploaded: uploadedBody.counts,
      verifiedDate: source.businessDate,
      verifiedProfiles: [...actualProfiles].sort(),
    },
    null,
    2,
  ),
);
