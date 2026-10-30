import {NextResponse} from 'next/server';
export const dynamic='force-dynamic';
function disabled(){return NextResponse.json({error:'Automatic updates are not configured for this Scketch3Dweb distribution.'},{status:410,headers:{'Cache-Control':'no-store'}});}
export async function GET(){return disabled();}
export async function POST(){return disabled();}
