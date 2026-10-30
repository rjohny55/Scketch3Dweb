import {NextResponse} from 'next/server';
import {accountDb,accountError,hash,publicUser,requireAccount,type AccountUser} from '@/lib/serverAccounts';

export function requireMcpBrowserAccount(request:Request):AccountUser|NextResponse {
 const user=requireAccount(request);if(user instanceof NextResponse)return user;
 return user.mcpAllowed?user:accountError('MCP access has not been allowed by an administrator.',403);
}
export function requireMcpKey(request:Request):AccountUser|NextResponse {
 const authorization=request.headers.get('authorization')??'';
 if(!authorization.startsWith('Bearer ')||authorization.length<39||authorization.length>300)return accountError('A valid personal MCP key is required.',401);
 const db=accountDb(),row=db.prepare('SELECT u.*,k.id AS key_id FROM mcp_keys k JOIN users u ON u.id=k.user_id WHERE k.token_hash=? AND k.revoked_at IS NULL AND u.active=1 AND u.mcp_allowed=1').get(hash(authorization.slice(7)));
 if(!row)return accountError('A valid personal MCP key is required.',401);
 db.prepare('UPDATE mcp_keys SET last_used_at=? WHERE id=? AND (last_used_at IS NULL OR last_used_at<?)').run(Date.now(),row.key_id!,Date.now()-60000);
 return publicUser(row as unknown as Parameters<typeof publicUser>[0]);
}
