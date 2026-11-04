import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Row = Record<string, unknown>;
type Product = { sku: string; unit_price_cents: bigint };
type Quote = { id: string; client_id: string; total_cents: bigint; status: string };
type Order = { id: string; total_cents: bigint; paid_cents: bigint; order_status: string };
class InputError extends Error {}
function fail(message: string): never { throw new InputError(message); }
function str(v: unknown, max=250): string { return typeof v === 'string' ? v.trim().slice(0,max) : ''; }
function req(v: unknown, name: string, max=250): string { const s=str(v,max); if(!s) fail(name+' required'); return s; }
function id(v: unknown): string { const s=req(v,'ID',50); if(!/^[a-f0-9-]{36}$/i.test(s)) fail('Invalid ID'); return s; }
function day(v: unknown): string {
 const s=req(v,'Date',10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s)) || new Date(s+'T00:00:00Z').toISOString().slice(0,10)!==s) fail('Invalid date');
 return s;
}
function qty(v: unknown,max=1000000): number {
 const n=Number(v); if(!Number.isSafeInteger(n)||n<=0||n>max) fail('Invalid positive amount'); return n;
}
function minor(v: unknown): number {
 const n=Number(v);if(!Number.isSafeInteger(n)||n<0||n>1000000)fail('Invalid commission rate in cents');return n;
}
function json(v: unknown) { return JSON.parse(JSON.stringify(v,(_k,x)=>typeof x==='bigint'?Number(x):x)); }
function ref(prefix: string, uid: string) { return prefix+'-'+new Date().getUTCFullYear()+'-'+uid.replace(/-/g,'').slice(0,10).toUpperCase(); }
async function auth(request: NextRequest) {
 if(process.env.INTERNATIONAL_SALES_ENABLED!=='true')fail('International Sales is disabled in this environment');
 const uid=request.headers.get('x-user-id');
 if(!uid || request.headers.get('x-authenticated-role')!=='ADMIN') fail('Unauthorized');
 // Trusted headers are overwritten by src/proxy.ts from the signed HttpOnly session.
 const user=await prisma.user.findUnique({where:{id:uid},select:{role:true,status:true}});
 if(user?.role!=='ADMIN'||user.status!=='ACTIVE') fail('Unauthorized');
 return uid;
}
async function audit(tx:any,actor:string,action:string,type:string,entityId:string,meta:Record<string,unknown>={}) {
 await tx.$executeRawUnsafe('INSERT INTO intl_audit(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,$4,$5::jsonb)',actor,action,type,entityId,JSON.stringify(meta));
}
function errorResponse(e:unknown) {
 if(e instanceof InputError)return NextResponse.json({error:e.message},{status:e.message==='Unauthorized'?403:e.message.includes('disabled')?503:400});
 console.error('International Sales error:',e instanceof Error?e.message:'unknown');
 return NextResponse.json({error:'International Sales database is not ready. Apply the reviewed SQL migration to the Preview database.'},{status:503});
}

export async function GET(request:NextRequest) {
 try {
  await auth(request);
  const [clients,products,contracts,quotes,quoteLines,orders,rules,commissions,payments]=await Promise.all([
   prisma.$queryRawUnsafe<Row[]>('SELECT * FROM intl_clients ORDER BY created_at DESC LIMIT 250'),
   prisma.$queryRawUnsafe<Row[]>('SELECT * FROM intl_products ORDER BY product_name'),
   prisma.$queryRawUnsafe<Row[]>('SELECT c.*,cl.display_name AS client_name FROM intl_contracts c JOIN intl_clients cl ON cl.id=c.client_id ORDER BY c.created_at DESC LIMIT 250'),
   prisma.$queryRawUnsafe<Row[]>('SELECT q.*,cl.display_name AS client_name FROM intl_quotes q JOIN intl_clients cl ON cl.id=q.client_id ORDER BY q.created_at DESC LIMIT 250'),
   prisma.$queryRawUnsafe<Row[]>('SELECT l.* FROM intl_quote_lines l JOIN (SELECT id FROM intl_quotes ORDER BY created_at DESC LIMIT 250) q ON q.id=l.quote_id'),
   prisma.$queryRawUnsafe<Row[]>('SELECT o.*,cl.display_name AS client_name FROM intl_orders o JOIN intl_clients cl ON cl.id=o.client_id ORDER BY o.created_at DESC LIMIT 250'),
   prisma.$queryRawUnsafe<Row[]>('SELECT r.*,cl.display_name AS client_name,a.full_name AS agent_name FROM intl_commission_rules r JOIN intl_clients cl ON cl.id=r.client_id JOIN intl_agents a ON a.id=r.agent_id ORDER BY r.created_at DESC LIMIT 250'),
   prisma.$queryRawUnsafe<Row[]>('SELECT c.*,a.full_name AS agent_name,o.reference AS order_reference FROM intl_commissions c JOIN intl_agents a ON a.id=c.agent_id JOIN intl_orders o ON o.id=c.order_id ORDER BY c.created_at DESC LIMIT 250'),
   prisma.$queryRawUnsafe<Row[]>('SELECT p.* FROM intl_payments p ORDER BY p.created_at DESC LIMIT 250'),
  ]);
  return NextResponse.json(json({success:true,clients,products,contracts,quotes,quoteLines,orders,rules,commissions,payments}),{headers:{'Cache-Control':'private, no-store'}});
 } catch(e){return errorResponse(e);}
}

export async function POST(request:NextRequest) {
 try {
  const actor=await auth(request);
  const b=await request.json().catch(()=>fail('Invalid JSON body'));
  if(!b||typeof b!=='object'||Array.isArray(b))fail('Invalid form data');
  const action=str(b.action,60);
  let result:Record<string,unknown>={};
  switch(action){
   case 'client': {
    const uid=randomUUID();
    const legal=req(b.legalName,'Legal name'), name=req(b.displayName,'Display name'), country=req(b.country,'Country',100);
    const address=str(b.address,1000),reg=str(b.registrationNo),tax=str(b.taxNo),contact=str(b.contactName),email=str(b.contactEmail),notes=str(b.notes,1000);
    if(email&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))fail('Invalid email');
    await prisma.$transaction(async tx=>{
     await tx.$executeRawUnsafe('INSERT INTO intl_clients(id,legal_name,display_name,country,address,registration_no,tax_no,contact_name,contact_email,notes) VALUES($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10)',uid,legal,name,country,address,reg||null,tax||null,contact||null,email||null,notes||null);
     await audit(tx,actor,action,'client',uid);
    });
    result={id:uid};break;
   }
   case 'contract': {
    const uid=randomUUID(),client=id(b.clientId),title=req(b.title,'Contract title'),start=day(b.effectiveDate),end=day(b.expiryDate);
    if(end<start)fail('Contract expiry precedes commencement');
    const url=str(b.documentUrl,1000),notes=str(b.termsNotes,2000),status=str(b.status);
    if(url&&!/^https:\/\/(drive\.google\.com|docs\.google\.com)\//.test(url))fail('Provide a Google Drive contract URL');
    if(!['DRAFT','ACTIVE'].includes(status))fail('Invalid contract status');
    if(status==='ACTIVE'&&!url)fail('An active contract requires a signed document URL');
    const reference=ref('HVC',uid);
    await prisma.$transaction(async tx=>{
     await tx.$executeRawUnsafe('INSERT INTO intl_contracts(id,client_id,reference,title,effective_date,expiry_date,status,document_url,terms_notes,created_by) VALUES($1::uuid,$2::uuid,$3,$4,$5::date,$6::date,$7,$8,$9,$10)',uid,client,reference,title,start,end,status,url||null,notes||null,actor);
     await audit(tx,actor,action,'contract',uid,{reference});
    });
    result={id:uid,reference};break;
   }
   case 'quote': {
    const uid=randomUUID(),client=id(b.clientId),contract=b.contractId?id(b.contractId):null,valid=day(b.validUntil);
    const today=new Date().toISOString().slice(0,10);
    if(valid<today)fail('Quote validity cannot be in the past');
    if(!Array.isArray(b.lines)||b.lines.length<1||b.lines.length>30)fail('Choose 1–30 product lines');
    const catalogue=await prisma.$queryRawUnsafe<Product[]>('SELECT sku,unit_price_cents FROM intl_products WHERE active=TRUE');
    const products=new Map(catalogue.map(p=>[p.sku,p]));
    const seen=new Set<string>();
    const lines:Array<{sku:string;quantity:number;unitCents:bigint;total:bigint}>=[];
    for(const item of b.lines){
     const sku=req(item?.sku,'Product',80),quantity=qty(item?.quantity);
     if(seen.has(sku))fail('Duplicate SKU '+sku);
     seen.add(sku);const p=products.get(sku);if(!p)fail('Unknown or disabled SKU '+sku);
     const unitCents=BigInt(p.unit_price_cents);lines.push({sku,quantity,unitCents,total:BigInt(quantity)*unitCents});
    }
    const total=lines.reduce((n,l)=>n+l.total,0n),reference=ref('HVQ',uid),notes=str(b.notes,1200);
    await prisma.$transaction(async tx=>{
     const clients=await tx.$queryRawUnsafe<Row[]>('SELECT id FROM intl_clients WHERE id=$1::uuid',client);
     if(!clients.length)fail('Client not found');
     if(contract){
      const matches=await tx.$queryRawUnsafe<Row[]>('SELECT id FROM intl_contracts WHERE id=$1::uuid AND client_id=$2::uuid',contract,client);
      if(!matches.length)fail('Contract does not belong to client');
     }
     await tx.$executeRawUnsafe('INSERT INTO intl_quotes(id,client_id,contract_id,reference,issued_at,valid_until,total_cents,notes,created_by) VALUES($1::uuid,$2::uuid,$3::uuid,$4,$5::date,$6::date,$7::bigint,$8,$9)',uid,client,contract,reference,today,valid,total.toString(),notes||null,actor);
     for(const l of lines)
      await tx.$executeRawUnsafe('INSERT INTO intl_quote_lines(quote_id,sku,quantity,unit_price_cents,line_total_cents) VALUES($1::uuid,$2,$3,$4::bigint,$5::bigint)',uid,l.sku,l.quantity,l.unitCents.toString(),l.total.toString());
     await audit(tx,actor,action,'quote',uid,{reference,totalCents:total.toString()});
    });
    result={id:uid,reference,totalCents:total.toString()};break;
   }
   case 'quote_status': {
    const quoteId=id(b.quoteId),status=req(b.status,'Status');
    const moves:Record<string,string[]>={DRAFT:['SENT','REJECTED'],SENT:['ACCEPTED','REJECTED']};
    await prisma.$transaction(async tx=>{
     const r=await tx.$queryRawUnsafe<Quote[]>('SELECT id,status FROM intl_quotes WHERE id=$1::uuid FOR UPDATE',quoteId);
     if(!r.length||!moves[r[0].status]?.includes(status))fail('Invalid quote status transition');
     await tx.$executeRawUnsafe('UPDATE intl_quotes SET status=$2 WHERE id=$1::uuid',quoteId,status);
     await audit(tx,actor,action,'quote',quoteId,{status});
    });
    result={id:quoteId,status};break;
   }
   case 'order': {
    const quoteId=id(b.quoteId),uid=randomUUID(),reference=ref('HVO',uid);
    await prisma.$transaction(async tx=>{
     const q=await tx.$queryRawUnsafe<Quote[]>('SELECT id,client_id,total_cents,status FROM intl_quotes WHERE id=$1::uuid FOR UPDATE',quoteId);
     if(!q.length||q[0].status!=='ACCEPTED')fail('Quote must be accepted');
     const existing=await tx.$queryRawUnsafe<Row[]>('SELECT id FROM intl_orders WHERE quote_id=$1::uuid',quoteId);
     if(existing.length)fail('Order already created from this quote');
     await tx.$executeRawUnsafe('INSERT INTO intl_orders(id,client_id,quote_id,reference,total_cents,created_by) VALUES($1::uuid,$2::uuid,$3::uuid,$4,$5::bigint,$6)',uid,q[0].client_id,quoteId,reference,String(q[0].total_cents),actor);
     await tx.$executeRawUnsafe('INSERT INTO intl_order_lines(order_id,sku,quantity,unit_price_cents) SELECT $1::uuid,sku,quantity,unit_price_cents FROM intl_quote_lines WHERE quote_id=$2::uuid',uid,quoteId);
     await audit(tx,actor,action,'order',uid,{reference});
    });
    result={id:uid,reference};break;
   }
   case 'order_status': {
    const orderId=id(b.orderId),next=req(b.status,'Order status');
    const allowed:Record<string,string[]>={CONFIRMED:['SHIPPED','CANCELLED','RETURNED'],SHIPPED:['DELIVERED','RETURNED'],DELIVERED:['RETURNED']};
    await prisma.$transaction(async tx=>{
     const rows=await tx.$queryRawUnsafe<Order[]>('SELECT * FROM intl_orders WHERE id=$1::uuid FOR UPDATE',orderId),order=rows[0];
     if(!order||!allowed[order.order_status]?.includes(next))fail('Invalid order status transition');
     if(next==='CANCELLED'&&BigInt(order.paid_cents)>0n)fail('Reconcile recorded receipts before cancelling an order');
     if(next==='RETURNED'){
      const paid=await tx.$queryRawUnsafe<Array<{id:string}>>("SELECT id FROM intl_commissions WHERE order_id=$1::uuid AND status='PAID'",orderId);
      if(paid.length)fail('Paid commissions require a documented manual clawback before return processing');
      await tx.$executeRawUnsafe("UPDATE intl_commissions SET status='VOID' WHERE order_id=$1::uuid AND status IN ('PENDING','APPROVED')",orderId);
     }
     await tx.$executeRawUnsafe('UPDATE intl_orders SET order_status=$2 WHERE id=$1::uuid',orderId,next);
     await audit(tx,actor,action,'order',orderId,{from:order.order_status,to:next});
    });
    result={id:orderId,status:next};break;
   }
   case 'payment': {
    const orderId=id(b.orderId),amount=qty(b.amountCents,1000000000),paymentRef=req(b.paymentReference,'Bank reference',150),paidAt=day(b.paidAt);
    await prisma.$transaction(async tx=>{
     const orders=await tx.$queryRawUnsafe<Order[]>('SELECT * FROM intl_orders WHERE id=$1::uuid FOR UPDATE',orderId),order=orders[0];
     if(!order||['CANCELLED','RETURNED'].includes(order.order_status))fail('Order is unavailable for payment');
     if(BigInt(order.paid_cents)+BigInt(amount)>BigInt(order.total_cents))fail('Payment exceeds balance due');
     const old=await tx.$queryRawUnsafe<Row[]>('SELECT id FROM intl_payments WHERE order_id=$1::uuid AND reference=$2',orderId,paymentRef);
     if(old.length)fail('Duplicate payment reference');
     await tx.$executeRawUnsafe('INSERT INTO intl_payments(order_id,reference,amount_cents,paid_at,recorded_by) VALUES($1::uuid,$2,$3::bigint,$4::date,$5)',orderId,paymentRef,String(amount),paidAt,actor);
     await tx.$executeRawUnsafe('UPDATE intl_orders SET paid_cents=paid_cents+$2::bigint WHERE id=$1::uuid',orderId,String(amount));
     if(BigInt(order.paid_cents)+BigInt(amount)===BigInt(order.total_cents)){
      // Only fully collected B2B orders accrue pending commissions. No automatic payouts.
      await tx.$executeRawUnsafe("INSERT INTO intl_commissions(order_id,order_line_id,rule_id,agent_id,eligible_quantity,rate_cents,amount_cents) SELECT o.id,l.id,r.id,r.agent_id,l.quantity,r.rate_cents,l.quantity*r.rate_cents FROM intl_orders o JOIN intl_order_lines l ON l.order_id=o.id JOIN intl_commission_rules r ON r.client_id=o.client_id AND r.active=TRUE WHERE o.id=$1::uuid AND o.order_status NOT IN ('CANCELLED','RETURNED') ON CONFLICT(order_line_id,rule_id) DO NOTHING",orderId);
     }
     await audit(tx,actor,action,'order',orderId,{paymentRef,amountCents:amount});
    });
    result={id:orderId};break;
   }
   case 'rule': {
    const client=id(b.clientId),name=req(b.agentName,'Beneficiary'),rate=minor(b.rateCents);
    await prisma.$transaction(async tx=>{
     const clients=await tx.$queryRawUnsafe<Row[]>('SELECT id FROM intl_clients WHERE id=$1::uuid',client);
     if(!clients.length)fail('Client not found');
     const agents=await tx.$queryRawUnsafe<Array<{id:string}>>('SELECT id FROM intl_agents WHERE LOWER(full_name)=LOWER($1) LIMIT 1',name);
     const agentId=agents.length?agents[0].id:randomUUID();
     if(!agents.length)await tx.$executeRawUnsafe('INSERT INTO intl_agents(id,full_name) VALUES($1::uuid,$2)',agentId,name);
     const uid=randomUUID();
     await tx.$executeRawUnsafe('INSERT INTO intl_commission_rules(id,client_id,agent_id,rate_cents) VALUES($1::uuid,$2::uuid,$3::uuid,$4::bigint) ON CONFLICT(client_id,agent_id) DO UPDATE SET rate_cents=EXCLUDED.rate_cents,active=TRUE',uid,client,agentId,String(rate));
     await audit(tx,actor,action,'commission_rule',client,{agentName:name,rateCents:rate});
    });
    result={clientId:client,agentName:name,rateCents:rate};break;
   }
   case 'commission_status': {
    const commissionId=id(b.commissionId),status=req(b.status,'Status'),payoutRef=str(b.payoutReference,160);
    if(!['APPROVED','PAID','VOID'].includes(status))fail('Invalid commission action');
    if(status==='PAID'&&!payoutRef)fail('Provide payment evidence reference');
    await prisma.$transaction(async tx=>{
     const rows=await tx.$queryRawUnsafe<Array<{status:string}>>('SELECT status FROM intl_commissions WHERE id=$1::uuid FOR UPDATE',commissionId);
     if(!rows.length||!((rows[0].status==='PENDING'&&['APPROVED','VOID'].includes(status))||(rows[0].status==='APPROVED'&&status==='PAID')))
      fail('Invalid commission status transition');
     if(status==='APPROVED')await tx.$executeRawUnsafe("UPDATE intl_commissions SET status='APPROVED',approved_by=$2,approved_at=now() WHERE id=$1::uuid",commissionId,actor);
     if(status==='VOID')await tx.$executeRawUnsafe("UPDATE intl_commissions SET status='VOID' WHERE id=$1::uuid",commissionId);
     if(status==='PAID')await tx.$executeRawUnsafe("UPDATE intl_commissions SET status='PAID',payout_reference=$2,paid_at=now() WHERE id=$1::uuid",commissionId,payoutRef);
     await audit(tx,actor,action,'commission',commissionId,{status,payoutRef});
    });
    result={id:commissionId,status};break;
   }
   default:fail('Unknown operation');
  }
  return NextResponse.json(json({success:true,...result}),{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return errorResponse(e);}
}
