import {describe,it,expect} from 'vitest';
import {UTILITY_SHAPES,utilityShapeAssets} from '@/lib/utilityShapes';
import {makeShapeFromAsset,toolbarShapeAssets} from '@/lib/shapeCatalog';
import {meshPrintReport} from '@/lib/meshPrintReport';
import {exportMeshesToStl} from '@/lib/stlExport';
import {importedShapeFromStl} from '@/lib/stlImport';
import {exportSkfProject,importSkfProject} from '@/lib/skfProject';
import {DEFAULT_SNAP_GRID,DEFAULT_WORKPLANE_WORKSPACE} from '@/lib/workplaneSettings';
function mesh(positions:number[]) {
 const vertices=Array.from({length:positions.length/3},(_,i)=>positions.slice(i*3,i*3+3) as [number,number,number]);
 const faces=Array.from({length:positions.length/9},(_,i)=>[3*i,3*i+1,3*i+2] as [number,number,number]);return{vertices,faces};
}
describe('printable utility shapes',()=>{
 it.each(UTILITY_SHAPES)('$name creates a closed solid at the requested bounds and survives binary STL export',preset=>{
  const asset=utilityShapeAssets.find(a=>a.id===preset.id)!,shape=makeShapeFromAsset(asset),report=meshPrintReport([mesh(shape.importedMesh!.positions)]);
  expect(toolbarShapeAssets.some(a=>a.id===preset.id)).toBe(true);
  expect(report,preset.id).toMatchObject({basicChecksPass:true,boundaryEdges:0,nonManifoldEdges:0,degenerateTriangles:0});
  for(const[actual,wanted]of report.bounds!.size.map((v,i)=>[v,[preset.width,preset.depth,preset.height][i]]))expect(actual).toBeCloseTo(wanted,4);
  expect(report.bounds!.min[2]).toBeCloseTo(0,5);
  const reopened=importedShapeFromStl('utility.stl',exportMeshesToStl([mesh(shape.importedMesh!.positions)]));
  expect(meshPrintReport([mesh(reopened.importedMesh!.positions)]).basicChecksPass).toBe(true);
 });
 it('keeps hollow profiles hollow and material volumes agree with their cross-sections',()=>{
  const volume=(id:string)=>meshPrintReport([mesh(makeShapeFromAsset(utilityShapeAssets.find(a=>a.id===id)!).importedMesh!.positions)]).signedVolumeMm3;
  expect(volume('utility-rect-tube')).toBeCloseTo((30*20-24*14)*30,3);
  expect(volume('utility-u-channel')).toBeCloseTo((30*3+2*17*3)*40,3);
  expect(volume('utility-angle')).toBeCloseTo((24*3+21*3)*24,3);
  expect(volume('utility-frustum')).toBeCloseTo(20/3*(24*24+12*12+24*12),3);
  expect(volume('utility-flange')).toBeGreaterThan(4700);expect(volume('utility-flange')).toBeLessThan(5050);
 });
 it('creates independent geometry for custom sizes and placement',()=>{
  const asset=utilityShapeAssets[0],a=makeShapeFromAsset(asset,{x:12,z:-8,elevation:3},{width:80,depth:48,height:8}),b=makeShapeFromAsset(asset);
  expect(a).toMatchObject({width:80,depth:48,height:8,x:12,z:-8,elevation:3});expect(a.id).not.toBe(b.id);
  const report=meshPrintReport([mesh(a.importedMesh!.positions)]);expect(report.basicChecksPass).toBe(true);expect(report.bounds!.size).toEqual([80,48,8]);
  const old=b.importedMesh!.positions[0];a.importedMesh!.positions[0]=1234;expect(b.importedMesh!.positions[0]).toBe(old);
 });
 it('round-trips all ten presets through SKF without changing geometry or names',async()=>{
  const shapes=utilityShapeAssets.map(asset=>makeShapeFromAsset(asset));
  const bytes=await exportSkfProject({projectId:'utility-shapes',projectName:'Utility shapes',createdAt:1,modifiedAt:2,shapes,assets:[],history:[],historyIndex:0,workspace:DEFAULT_WORKPLANE_WORKSPACE,snapGrid:DEFAULT_SNAP_GRID,placementElevation:0});
  const restored=await importSkfProject(bytes);expect(restored.shapes.map(s=>s.name)).toEqual(shapes.map(s=>s.name));
  for(let i=0;i<shapes.length;i++)expect(restored.shapes[i].importedMesh!.positions).toEqual(shapes[i].importedMesh!.positions);
 });
});
