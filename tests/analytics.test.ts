import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateRecords,datesBetween} from '../lib/model';
import {rankProducts} from '../lib/products';
import {validateProducts} from '../lib/validation';
test('missing dates and empty ranges cannot become zero sales',()=>{assert.equal(aggregateRecords([],'pop-1',[]),undefined);assert.deepEqual(datesBetween('','2026-09-09'),[]);assert.equal(aggregateRecords([{date:'2026-09-08',profile:'pop-1',source:'test',gmv:10}],'pop-1',['2026-09-08','2026-09-09']),undefined);});
test('product grouping stays isolated by shop and date',()=>{const row={date:'2026-09-09',profile:'pop-1',productId:'same',title:'Case',source:'test',orders:2,gmv:10};const rows=validateProducts([row,{...row,profile:'accu-1',orders:5},{...row,date:'2026-09-08',orders:9}]);const ranked=rankProducts(rows,'2026-09-09','2026-09-09','all');assert.equal(ranked.length,2);assert.equal(ranked[0].orders,5);assert.equal(ranked[0].refunds,null);assert.throws(()=>validateProducts([{...row,orders:-1}]));});
