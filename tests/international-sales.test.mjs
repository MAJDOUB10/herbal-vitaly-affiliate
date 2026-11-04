import test from 'node:test';
import assert from 'node:assert/strict';
import { totalUsdCents, unitCommissionUsdCents, qualifiesForAccrual } from '../src/lib/international-math.ts';

test('USD quote total calculated in integer cents',()=>{
 assert.equal(totalUsdCents([{quantity:2000,unitCents:368}]),BigInt(736000));
 assert.equal(totalUsdCents([{quantity:1,unitCents:296},{quantity:2,unitCents:303}]),BigInt(902));
});
test('Mahmoud Alam example: 2000 units x 40 cents is USD 800',()=>{
 assert.equal(unitCommissionUsdCents(2000,40),BigInt(80000));
});
test('Reject non-integer quantities and negative currency amounts',()=>{
 assert.throws(()=>totalUsdCents([{quantity:1.5,unitCents:368}]));
 assert.throws(()=>totalUsdCents([{quantity:1,unitCents:-1}]));
 assert.throws(()=>unitCommissionUsdCents(-1,40));
});
test('Accrual requires full payment on a non-returned order',()=>{
 assert.equal(qualifiesForAccrual(BigInt(1000),BigInt(500),'CONFIRMED'),false);
 assert.equal(qualifiesForAccrual(BigInt(1000),BigInt(1000),'CONFIRMED'),true);
 assert.equal(qualifiesForAccrual(BigInt(1000),BigInt(1000),'RETURNED'),false);
 assert.equal(qualifiesForAccrual(BigInt(1000),BigInt(1000),'CANCELLED'),false);
});
