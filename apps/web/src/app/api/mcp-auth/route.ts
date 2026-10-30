import {NextResponse} from 'next/server';
import {accountJson} from '@/lib/serverAccounts';
import {requireMcpKey} from '@/lib/serverMcpAccounts';
import {mcpAccessError} from '@/lib/scketch3dwebMcpAccess';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request){
 const blocked=mcpAccessError(request);if(blocked)return NextResponse.json({error:blocked.error},{status:blocked.status,headers:{'Cache-Control':'no-store'}});
 const user=requireMcpKey(request);if(user instanceof NextResponse)return user;
 return accountJson({user:{id:user.id,legacyOwner:user.legacyOwner}});
}
