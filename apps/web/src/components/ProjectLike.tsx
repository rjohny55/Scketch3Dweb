"use client";
import {useEffect,useState} from 'react';
import {Heart} from 'lucide-react';
import {T} from '@/components/Localization';
export function ProjectLike({fileName,likes=0,liked=0}:{fileName:string;likes?:number;liked?:number}){
 const [value,setValue]=useState({likes,liked}),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>setValue({likes,liked}),[fileName,likes,liked]);
 return <><button className="project-like" type="button" aria-pressed={!!value.liked} disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const r=await fetch('/api/project-likes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fileName,liked:!value.liked})}),body=await r.json();if(!r.ok)throw Error(body.error);setValue(body);}catch(e){setError(e instanceof Error?e.message:'Could not update the project like.');}finally{setBusy(false);}}}><Heart size={15} fill={value.liked?'currentColor':'none'}/><T text="Like"/> {value.likes}</button>{error&&<span className="project-like-error" role="alert"><T text={error}/></span>}</>;
}
