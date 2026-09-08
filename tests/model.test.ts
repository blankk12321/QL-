import {test} from 'node:test';
import assert from 'node:assert/strict';
import {contribution,initialProfiles,inspectData} from '../lib/model';
import {parseCsv,validateRecords,validDate} from '../lib/validation';
const row={date:'2026-09-07',profile:'pop-1',source:'test',gmv:100,refunds:10,productCost:15,shipping:20,fees:6,commission:0,ads:10,otherCost:0};
void test('contribution requires all inputs, zero is known',()=>{assert.equal(contribution(row),39);assert.equal(contribution({...row,ads:null}),null);});
void test('strict dates and numeric validation',()=>{assert.equal(validDate('2026-02-30'),false);assert.equal(validDate('2026-09-07'),true);assert.throws(()=>validateRecords([{...row,orders:1.5}]));assert.throws(()=>validateRecords([{...row,gmv:Infinity}]));assert.throws(()=>validateRecords([row,row]));});
void test('CSV BOM, quoted commas, missing numeric values',()=>{const r=parseCsv('\uFEFFdate,profile,source,gmv,orders\n2026-09-07,pop-1,"后台,日报",0,\n');assert.equal(r[0].source,'后台,日报');assert.equal(r[0].gmv,0);assert.equal(r[0].orders,null);assert.throws(()=>parseCsv('date,profile,source,gmv\n2026-09-07,pop-1,a,not-a-number'));});
void test('missing rows never reported healthy and losing contribution flags',()=>{assert.equal(inspectData([],initialProfiles,'2026-09-07').length,7);const a=inspectData([{...row,ads:200,late:2,violations:1,orders:3,pending:2}],initialProfiles,'2026-09-07');assert(a.some(s=>s.includes('亏损')));assert(a.some(s=>s.includes('超时未揽收')));});
