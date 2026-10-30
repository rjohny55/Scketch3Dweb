"""Resolve URDF origins at q=0. No inferred or manually guessed placements."""
import pathlib,json,xml.etree.ElementTree as ET,math,struct
root=pathlib.Path(__file__).resolve().parents[2];folder=root/'apps/web/public/assets/robot-rp1/assembly';robot=ET.parse(folder/json.loads((folder/'manifest.json').read_text())['urdf']['path']).getroot()
def identity():return [[int(i==j) for j in range(4)] for i in range(4)]
def mul(a,b):return [[sum(a[i][k]*b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]
def origin(e):
 if e is None:return identity()
 x,y,z=map(float,e.get('xyz','0 0 0').split());r,p,yaw=map(float,e.get('rpy','0 0 0').split());cr,sr,cp,sp,cy,sy=math.cos(r),math.sin(r),math.cos(p),math.sin(p),math.cos(yaw),math.sin(yaw)
 return [[cy*cp,cy*sp*sr-sy*cr,cy*sp*cr+sy*sr,x],[sy*cp,sy*sp*sr+cy*cr,sy*sp*cr-cy*sr,y],[-sp,cp*sr,cp*cr,z],[0,0,0,1]]
joints={j.find('child').get('link'):j for j in robot.findall('joint')};cache={}
def world(link):
 if link in cache:return cache[link]
 j=joints.get(link);result=identity() if j is None else mul(world(j.find('parent').get('link')),origin(j.find('origin')));cache[link]=result;return result
models=[]
for link in robot.findall('link'):
 for visual in link.findall('visual'):
  mesh=visual.find('geometry/mesh')
  if mesh is None:continue
  path=mesh.get('filename').removeprefix('../');data=(folder/path).read_bytes();count=struct.unpack_from('<I',data,80)[0];assert len(data)==84+count*50
  matrix=mul(world(link.get('name')),origin(visual.find('origin')))
  models.append({'link':link.get('name'),'path':path,'matrix':matrix,'scale':list(map(float,mesh.get('scale','1 1 1').split())),'triangleCount':count})
(folder/'layout.json').write_text(json.dumps({'units':'meter','jointPosition':0,'models':models},indent=2)+'\n');print(json.dumps({'models':len(models),'triangles':sum(m['triangleCount'] for m in models)}))
