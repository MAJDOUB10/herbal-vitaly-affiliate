import test from 'node:test';
import assert from 'node:assert/strict';
import { isApprovedAffiliate, canAssignCoupon, eligibleReferralCodes } from '../src/lib/hv-coupon-assignment.ts';
const active={role:'AFFILIATE',status:'ACTIVE',emailVerifiedAt:new Date('2026-10-29T12:00:00Z')};
test('only active approved and verified affiliate users are assignable',()=>{
  assert.equal(isApprovedAffiliate(active),true);
  assert.equal(isApprovedAffiliate({...active,status:'PENDING'}),false);
  assert.equal(isApprovedAffiliate({...active,emailVerifiedAt:null}),false);
  assert.equal(isApprovedAffiliate({...active,role:'ADMIN'}),false);
});
test('Shopify coupon can be unassigned even when expired, but not assigned when expired',()=>{
  assert.equal(canAssignCoupon({source:'SHOPIFY',isActive:true},'partner1'),true);
  assert.equal(canAssignCoupon({source:'SHOPIFY',isActive:false},'partner1'),false);
  assert.equal(canAssignCoupon({source:'SHOPIFY',isActive:false},null),true);
  assert.equal(canAssignCoupon({source:'REFFERQ',isActive:true},'partner1'),false);
});
test('COD preview recognizes manually mapped coupon only for approved affiliate',()=>{
  const approved=[{id:'a1',referralCode:'TESTOR-915C'}];
  const codes=[
    {code:'MR14',affiliateId:'a1',isActive:true},
    {code:'EXPIRED',affiliateId:'a1',isActive:false},
    {code:'UNKNOWN',affiliateId:'a2',isActive:true},
    {code:'GENERAL',affiliateId:null,isActive:true}
  ];
  const eligible=eligibleReferralCodes(approved,codes);
  assert.equal(eligible.has('MR14'),true);
  assert.equal(eligible.has('TESTOR-915C'),true);
  assert.equal(eligible.has('EXPIRED'),false);
  assert.equal(eligible.has('UNKNOWN'),false);
  assert.equal(eligible.has('GENERAL'),false);
});
