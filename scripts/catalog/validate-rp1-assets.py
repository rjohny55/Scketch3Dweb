import pathlib,json,struct,hashlib,math
root=pathlib.Path(__file__).resolve().parents[2];folder=root/'apps/web/public/assets/robot-rp1';manifest=json.loads((folder/'manifest.json').read_text());reports=[]
for model in manifest['models']:
 source=folder/'source'/(model['code']+'.step');mesh=folder/'meshes'/(model['code']+'.stl');preview=folder/'previews'/(model['code']+'.svg');data=mesh.read_bytes();count=struct.unpack_from('<I',data,80)[0]
 assert len(data)==84+count*50 and count==model['triangleCount'];assert hashlib.sha256(data).hexdigest()==model['meshSha256'];assert hashlib.sha256(source.read_bytes()).hexdigest()==model['sourceSha256'];assert '<svg' in preview.read_text()
 vertices={};edges={};volume=0.;degenerate=0;minimum=[math.inf]*3;maximum=[-math.inf]*3
 for row in struct.iter_unpack('<12fH',data[84:]):
  points=[row[3:6],row[6:9],row[9:12]];ids=[]
  for point in points:
   assert all(math.isfinite(v) for v in point)
   for axis,v in enumerate(point):minimum[axis]=min(minimum[axis],v);maximum[axis]=max(maximum[axis],v)
   key=tuple(math.floor(v/1e-5+.5) for v in point)
   if key not in vertices:vertices[key]=len(vertices)
   ids.append(vertices[key])
  a,b,c=points;u=[b[i]-a[i] for i in range(3)];v=[c[i]-a[i] for i in range(3)];cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
  if len(set(ids))<3 or math.hypot(*cross)<=1e-10:degenerate+=1
  volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6
  for i in range(3):
   start,end=ids[i],ids[(i+1)%3];key=tuple(sorted((start,end)));number,direction=edges.get(key,(0,0));edges[key]=(number+1,direction+(1 if start<end else -1))
 boundary=sum(n==1 for n,_ in edges.values());nonmanifold=sum(n>2 for n,_ in edges.values());winding=sum(n==2 and d!=0 for n,d in edges.values());size=[maximum[i]-minimum[i] for i in range(3)]
 assert all(abs(a-b)<.002 for a,b in zip(size,[model['width'],model['depth'],model['height']])),model['code']
 assert abs(minimum[2])<.001 and volume>0,model['code']
 reports.append({'code':model['code'],'triangleCount':count,'boundaryEdges':boundary,'nonManifoldEdges':nonmanifold,'inconsistentWindingEdges':winding,'degenerateTriangles':degenerate,'signedVolumeMm3':volume,'basicChecksPass':not(boundary or nonmanifold or winding or degenerate)})
result={'status':'PASS','models':len(reports),'allSourceAndMeshHashesMatch':True,'allPreviewsReadable':True,'allBoundsAndScalesMatch':True,'strictClosedMeshes':sum(x['basicChecksPass'] for x in reports),'reports':reports}
(root/'verification/RP1_ASSET_VALIDATION.json').write_text(json.dumps(result,indent=2));print(json.dumps({k:v for k,v in result.items() if k!='reports'}))

for model,report in zip(manifest['models'],reports):
 model['meshValidation']={k:report[k] for k in ['basicChecksPass','boundaryEdges','nonManifoldEdges','inconsistentWindingEdges','degenerateTriangles']}
(folder/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
(root/'apps/web/src/lib/robotCatalogData.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
