// One-time source migration: React components translate text without mutating DOM.
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
const files=[];
function walk(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){const n=path.join(p,e.name);if(e.isDirectory())walk(n);else if(n.endsWith('.tsx'))files.push(n);}}
walk('apps/web/src/components');files.push('apps/web/src/app/page.tsx');
const catalog=new Set();
const attrNames=new Set(['title','aria-label','aria-description','placeholder','alt','label','description','tooltip','hint']);
function jsxText(s){const lines=s.replace(/\t/g,' ').split(/\r?\n/);let out='';for(let i=0;i<lines.length;i++){let l=lines[i];if(i>0)l=l.replace(/^ +/,'');if(i<lines.length-1)l=l.replace(/ +$/,'');if(l){out+=l;if(i<lines.length-1&&lines.slice(i+1).some(x=>x.trim()))out+=' ';}}return out;}
for(const file of files){let text=fs.readFileSync(file,'utf8');if(text.includes('@/components/Localization'))continue;const source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const edits=[];let usedT=false,usedL=false;
 function visit(n){
  if(ts.isStringLiteral(n)&&/[A-Za-z]/.test(n.text)&&!/[\n]/.test(n.text)&&n.text.length<260)catalog.add(n.text);
  if(ts.isJsxText(n)&&/[A-Za-z]/.test(n.text)){const s=jsxText(n.text);catalog.add(s);edits.push({a:n.pos,b:n.end,s:`<T text={${JSON.stringify(s)}} />`});usedT=true;return;}
  if(ts.isJsxExpression(n)&&n.expression&&!ts.isJsxAttribute(n.parent)){const e=n.expression;const raw=e.getText(source);const dynamic=/^(notice|updateMessage|importMessage|error|message|label|title|description|hint|tooltip|edgeModifierError)$/.test(raw)||/\.(label|description|tooltip|hint|title)$/.test(raw);const conditional=ts.isConditionalExpression(e)&&[e.whenTrue,e.whenFalse].some(x=>ts.isStringLiteral(x)||ts.isTemplateExpression(x));if(dynamic||conditional){edits.push({a:n.pos,b:n.pos,s:'<T text='},{a:n.end,b:n.end,s:' />'});usedT=true;}}
  if(ts.isJsxElement(n)||ts.isJsxSelfClosingElement(n)){const opening=ts.isJsxElement(n)?n.openingElement:n;const localized=opening.attributes.properties.some(a=>ts.isJsxAttribute(a)&&attrNames.has(a.name.getText(source)));if(localized){edits.push({a:n.getStart(source),b:n.getStart(source),s:'<L>'},{a:n.end,b:n.end,s:'</L>'});usedL=true;}}
  ts.forEachChild(n,visit);
 }
 visit(source);
 if(edits.length){edits.sort((a,b)=>b.a-a.a||b.b-a.b||Number(b.s.startsWith("<T text="))-Number(a.s.startsWith("<T text=")));for(const e of edits)text=text.slice(0,e.a)+e.s+text.slice(e.b);const imp=`import { ${[usedT?'T':null,usedL?'L':null].filter(Boolean).join(', ')} } from "@/components/Localization";\n`;const directive=text.match(/^(["']use client["'];?\s*)/);const at=directive?directive[0].length:0;text=text.slice(0,at)+imp+text.slice(at);fs.writeFileSync(file,text);console.log(file,edits.length);}
}
fs.writeFileSync('verification/ui-source-strings.json',JSON.stringify([...catalog].sort(),null,2));
