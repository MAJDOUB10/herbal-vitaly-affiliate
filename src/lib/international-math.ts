/** Integer minor-unit arithmetic for international USD workflows.
 * Amounts are never derived using floating-point currency operations.
 */
export function totalUsdCents(lines: Array<{ quantity:number; unitCents:bigint|number }>):bigint{
 let total=BigInt(0);
 for(const line of lines){
  if(!Number.isSafeInteger(line.quantity)||line.quantity<=0)throw new Error('Invalid order quantity');
  const cents=BigInt(line.unitCents);
  if(cents<BigInt(0))throw new Error('Invalid unit amount');
  total+=BigInt(line.quantity)*cents;
 }
 return total;
}
export function unitCommissionUsdCents(quantity:number,rateCents:number|bigint):bigint{
 if(!Number.isSafeInteger(quantity)||quantity<0)throw new Error('Invalid eligible quantity');
 const rate=BigInt(rateCents);
 if(rate<BigInt(0))throw new Error('Invalid commission rate');
 return BigInt(quantity)*rate;
}
export function qualifiesForAccrual(total:bigint,paid:bigint,status:string):boolean{
 return total>BigInt(0)&&paid===total&&!['CANCELLED','RETURNED'].includes(status);
}
