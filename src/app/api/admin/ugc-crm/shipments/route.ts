import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ugcAdmin, fail, textField, dateField, budget, enumField, payloadObject, UGC_DELIVERY } from '@/lib/ugc-crm';

const input = (b: Record<string, unknown>) => ({
  contactId: textField(b.contactId,120),
  trackingNumber: textField(b.trackingNumber,90),
  recipientName: textField(b.recipientName,160) || '',
  phone: textField(b.phone,32),
  governorate: textField(b.governorate,160),
  district: textField(b.district,250),
  deliveryStatus: enumField(b.deliveryStatus,UGC_DELIVERY,'UNKNOWN'),
  deliveryType: textField(b.deliveryType,160),
  collectionType: enumField(b.collectionType,['NO_COLLECTION','COD','PREPAID'],'NO_COLLECTION'),
  amountEGP: budget(b.amountEGP),
  capturedAt: dateField(b.capturedAt),
  source: textField(b.source,160),
  notes: textField(b.notes,1500),
});
async function validContact(id: string | null) {
  return !id || !!(await prisma.ugcContact.findUnique({where:{id},select:{id:true}}));
}
export async function GET(req: NextRequest) {
  if (!(await ugcAdmin(req))) return fail('Admin access required',403);
  try {
    const shipments = await prisma.ugcShipment.findMany({
      orderBy:{updatedAt:'desc'},take:1000,
      include:{contact:{select:{id:true,externalId:true,name:true}}},
    });
    return NextResponse.json({success:true,shipments,limited:shipments.length===1000},
      {headers:{'Cache-Control':'private, no-store'}});
  } catch{return fail('Shipment CRM unavailable or database migration missing',503)}
}
export async function POST(req: NextRequest) {
  const user = await ugcAdmin(req);
  if (!user) return fail('Admin access required',403);
  try {
    const b=payloadObject(await req.json()), data=input(b);
    if(!data.recipientName) return fail('Recipient name required',422);
    if (!(await validContact(data.contactId))) return fail('Unknown CRM contact',422);
    const s=await prisma.ugcShipment.create({data});
    if (s.contactId) await prisma.ugcContactActivity.create({data:{
      contactId:s.contactId,actorId:user.id,action:'SHIPMENT_ADDED',
      details:'UGC sample shipment record created',
    }});
    return NextResponse.json({success:true,shipment:s},{status:201});
  } catch(e){return fail(e instanceof Error && /Invalid/i.test(e.message)?e.message:'Unable to create shipment; check tracking number uniqueness',422)}
}
export async function PATCH(req: NextRequest) {
  const user=await ugcAdmin(req);
  if(!user)return fail('Admin access required',403);
  try{
    const b=payloadObject(await req.json()),id=textField(b.id,120);
    if(!id)return fail('Shipment ID required',422);
    const existing=await prisma.ugcShipment.findUnique({where:{id}});
    if(!existing)return fail('Shipment not found',404);
    const data=input({...existing,...b});
    if(!data.recipientName||!(await validContact(data.contactId)))return fail('Valid recipient and contact required',422);
    const row=await prisma.ugcShipment.update({where:{id},data});
    if(row.contactId)await prisma.ugcContactActivity.create({data:{
      contactId:row.contactId,actorId:user.id,action:'SHIPMENT_UPDATED',details:'UGC sample shipment details updated',
    }});
    return NextResponse.json({success:true,shipment:row});
  }catch(e){return fail(e instanceof Error&&/Invalid/i.test(e.message)?e.message:'Unable to update shipment',422)}
}
