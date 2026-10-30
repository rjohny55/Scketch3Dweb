/// <reference lib="webworker" />
import {importedShapeFromStl} from '@/lib/stlImport';
self.onmessage=async(event:MessageEvent<{url:string;name:string}>)=>{
 try{
  const response=await fetch(event.data.url);if(!response.ok)throw new Error(`Model download failed (${response.status})`);
  const length=Number(response.headers.get('content-length'));if(length>25*1024*1024)throw new Error('Model is too large');
  const bytes=await response.arrayBuffer();if(bytes.byteLength>25*1024*1024)throw new Error('Model is too large');
  const shape=importedShapeFromStl(event.data.name,bytes,'z-up'),mesh=shape.importedMesh!;
  const positions=new Float32Array(mesh.positions),normals=new Float32Array(mesh.normals??[]);
  mesh.positions=[];mesh.normals=[];
  self.postMessage({shape,positions,normals,bytes},{transfer:[positions.buffer,normals.buffer,bytes]});
 }catch(e){self.postMessage({error:e instanceof Error?e.message:String(e)});}
};
