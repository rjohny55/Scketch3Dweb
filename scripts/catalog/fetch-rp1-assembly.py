"""Fetch the official RP1 zero-pose visual assembly; pin every source byte."""
import json,pathlib,urllib.request,hashlib,concurrent.futures,xml.etree.ElementTree as ET
root=pathlib.Path(__file__).resolve().parents[2];folder=root/'apps/web/public/assets/robot-rp1/assembly';folder.mkdir(exist_ok=True)
sha='d8c6dd03aeecc7f7ead3d962e09fedba4c8460f0';repo='Roboparty/rp1_description'
def download(path):
 url='https://raw.githubusercontent.com/'+repo+'/'+sha+'/'+path
 target=folder/path;target.parent.mkdir(parents=True,exist_ok=True)
 data=target.read_bytes() if target.exists() else urllib.request.urlopen(url,timeout=120).read();target.write_bytes(data)
 return {'path':path,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'url':url}
urdf=download('urdf/rp1_hand.urdf');robot=ET.parse(folder/urdf['path']).getroot();files=sorted({visual.find('geometry/mesh').attrib['filename'].removeprefix('../') for link in robot.findall('link') for visual in link.findall('visual') if visual.find('geometry/mesh') is not None})
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool: meshes=list(pool.map(download,files))
manifest={'sourceRepository':'https://github.com/'+repo,'sourceCommit':sha,'pose':'All URDF joint coordinates zero; visual and joint origins composed exactly; meters converted to millimeters.','urdf':urdf,'meshes':meshes}
(folder/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
(folder/'NOTICE.txt').write_text('RP1 visual assembly from https://github.com/'+repo+'/tree/'+sha+'\nOriginal URDF and STL sources are included unchanged. Transform origins are evaluated at zero joint positions and units converted from meters to millimeters for the demo. This repository does not include a separate license file; no additional license is asserted here. The manufacturing parts elsewhere in this catalog carry their own CERN-OHL-W-2.0 notice.\n')
print(json.dumps({'status':'PASS','meshes':len(meshes),'sourceBytes':sum(x['bytes'] for x in meshes)}))
