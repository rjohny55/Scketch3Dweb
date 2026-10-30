import {MAX_PLASTIC_COORDINATES,plasticMeshMetrics} from '@/lib/plasticMeshMetrics';
export type PlasticSettings={density:number;diameter:number;infill:number;wallThickness:number;extraPercent:number;costPerKg:number};
export type PlasticOptions={allowApproximateMeshes?:boolean};
export type PlasticBody={id:string;name:string;positions:Float64Array};
export type PlasticGeometry={bodies:PlasticBody[];warnings:string[]};
export type PlasticBodyResult={id:string;name:string;status:'validated'|'approximate'|'excluded';reason?:string;volumeCm3?:number;originSensitivityCm3?:number};
export type PlasticEstimate={objectCount:number;requestedObjectCount:number;approximateObjectCount:number;excludedObjectCount:number;isPartial:boolean;bodyResults:PlasticBodyResult[];volumeCm3:number;surfaceCm2:number;estimatedVolumeCm3:number;massG:number;materialCost:number;filamentM:number;solidMassG:number;warnings:string[]};
export const DEFAULT_PLASTIC_SETTINGS:PlasticSettings={density:1.24,diameter:1.75,infill:20,wallThickness:1.2,extraPercent:0,costPerKg:0};
export function validatePlasticSettings(settings:PlasticSettings){
 const fields:[keyof PlasticSettings,number,number,string][]=[['density',.01,30,'плотность'],['diameter',.1,10,'диаметр филамента'],['infill',0,100,'заполнение'],['wallThickness',0,100,'толщина оболочки'],['extraPercent',0,1000,'дополнительный расход'],['costPerKg',0,1e12,'стоимость 1 кг']];
 for(const[key,min,max,name]of fields)if(!Number.isFinite(settings[key])||settings[key]<min||settings[key]>max)throw new Error(`Проверьте ${name}: допустимо от ${min} до ${max}.`);
}
/** Valid bodies contribute independently. Defective meshes require explicit approximate mode. */
export function estimatePlastic(geometry:PlasticGeometry,settings:PlasticSettings,options:PlasticOptions={}):PlasticEstimate{
 validatePlasticSettings(settings);
 if(!geometry.bodies.length)throw new Error('Нет видимых деталей для расчёта.');
 const coordinates=geometry.bodies.reduce((n,b)=>n+b.positions.length,0);
 if(coordinates>MAX_PLASTIC_COORDINATES)throw Error('Лимит расчёта — 3 миллиона треугольников. Выберите часть сборки.');
 let volume=0,surface=0,estimated=0;const bodyResults:PlasticBodyResult[]=[],warnings=[...geometry.warnings];
 for(const body of geometry.bodies){
  try{
   const report=plasticMeshMetrics(body.positions),solid=Math.abs(report.signedVolumeMm3),area=report.areaMm2;
   let reason='';if(!report.basicChecksPass)reason=`Сетка содержит дефекты: открытых рёбер ${report.boundaryEdges}, неманифолдных ${report.nonManifoldEdges}, нарушений ориентации ${report.inconsistentWindingEdges}, вырожденных треугольников ${report.degenerateTriangles}${report.signedVolumeMm3<0?', обратная ориентация оболочки':''}.`;
   if(!Number.isFinite(solid)||!Number.isFinite(area)||solid<=1e-9||area<=0)throw Error('По этой сетке нельзя определить ненулевой объём.');
   if(!report.basicChecksPass&&!options.allowApproximateMeshes)throw Error(reason+' Включите приблизительную оценку сеток с дефектами либо исправьте геометрию.');
   if(!report.basicChecksPass&&report.originSensitivityMm3>solid*.5)throw Error(reason+' Объём слишком неустойчив для приблизительной оценки.');
   bodyResults.push({id:body.id,name:body.name,status:report.basicChecksPass?'validated':'approximate',...(reason?{reason}:{}),volumeCm3:solid/1000,originSensitivityCm3:report.originSensitivityMm3/1000});
   const shell=Math.min(solid,area*settings.wallThickness);volume+=solid;surface+=area;estimated+=shell+(solid-shell)*settings.infill/100;
  }catch(error){bodyResults.push({id:body.id,name:body.name,status:'excluded',reason:error instanceof Error?error.message:String(error)});}
 }
 const excludedObjectCount=bodyResults.filter(b=>b.status==='excluded').length,approximateObjectCount=bodyResults.filter(b=>b.status==='approximate').length,objectCount=bodyResults.length-excludedObjectCount;
 if(!objectCount)throw Error(`Нет сеток, пригодных для расчёта. «${bodyResults[0].name}»: ${bodyResults[0].reason}`);
 if(excludedObjectCount)warnings.push(`Частичный расчёт: учтено ${objectCount} из ${bodyResults.length} деталей. ${excludedObjectCount} исключено из суммы; причины указаны ниже.`);
 if(approximateObjectCount)warnings.push(`Для ${approximateObjectCount} деталей с дефектами сетки объём оценён приблизительно. Это не подтверждение пригодности к печати; расход после исправления и нарезки может существенно отличаться.`);
 estimated*=1+settings.extraPercent/100;
 const massG=estimated/1000*settings.density,filamentM=estimated/(Math.PI*(settings.diameter/2)**2)/1000;
 if(![volume,surface,estimated,massG,filamentM,massG/1000*settings.costPerKg].every(Number.isFinite))throw Error('Числовые параметры модели выходят за пределы расчёта.');
 return{objectCount,requestedObjectCount:bodyResults.length,approximateObjectCount,excludedObjectCount,isPartial:excludedObjectCount>0,bodyResults,volumeCm3:volume/1000,surfaceCm2:surface/100,estimatedVolumeCm3:estimated/1000,massG,materialCost:massG/1000*settings.costPerKg,filamentM,solidMassG:volume/1000*settings.density,warnings};
}
