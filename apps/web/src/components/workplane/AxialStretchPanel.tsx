"use client";
import { useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";
import { L, T } from "@/components/Localization";
import type { AxialStretchOptions } from "@/lib/axialStretch";
import type { WorkplaneShape } from "@/types/scketch3dweb";

export function AxialStretchPanel({ shape, onStretch, onPreview, openRequest=0 }: {
  openRequest?:number;
  shape: WorkplaneShape;
  onStretch: (options: AxialStretchOptions) => void | Promise<void>;
  onPreview: (options: AxialStretchOptions | null) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [axis, setAxis] = useState<AxialStretchOptions["axis"]>("x");
  const length = axis === "x" ? shape.width : axis === "y" ? shape.height : shape.depth;
  const [target, setTarget] = useState(String(length));
  const [start, setStart] = useState("2"), [end, setEnd] = useState("2");
  const [anchor, setAnchor] = useState<AxialStretchOptions["anchor"]>("start");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  useEffect(() => { setTarget(String(Number(length.toFixed(6)))); setError(""); setPreview(false); }, [shape.id, length]);
  // The viewport clears previews when selection changes or the panel unmounts.
  const clear = () => { onPreview(null); setPreview(false); setError(""); };
  const run = async (apply: boolean) => {
    try {
      const number = (value: string) => value.trim() ? Number(value.replace(",", ".")) : NaN;
      const options = { axis, target: number(target), keepStart: number(start), keepEnd: number(end), anchor };
      if (apply) { await onStretch(options); setPreview(false); } else { setPreview(true); await onPreview(options); }
      setError("");
    } catch (e) {
      if(e instanceof Error&&e.name==="AbortError")return; setError(e instanceof Error ? e.message : String(e)); }
  };
 useEffect(()=>{if(openRequest)setOpen(true);},[openRequest]);
  return <div className={`property-card axial-stretch-panel ${open ? "" : "collapsed"}`}>
    <L><button className="property-card-header" type="button" aria-label="Stretch body" aria-expanded={open} onClick={() => { clear(); setOpen(v => !v); }}><span><T text="Stretch body" /></span><ChevronUp className={open ? "" : "collapsed"} size={25} strokeWidth={2.8} /></button></L>
    {open && <form className="property-list" onSubmit={e => { e.preventDefault(); run(true); }}>
      <p className="stretch-hint"><T text="Resize the middle while preserving the two end regions. Dimensions follow the object's local axes, in mm." /></p>
      <L><label className="select-property"><span><T text="Stretch axis" /></span><select aria-label="Stretch axis" value={axis} disabled={shape.locked} onChange={e => { clear(); setAxis(e.target.value as typeof axis); }}><option value="x">X — <T text="Width" /></option><option value="y">Y — <T text="Height" /></option><option value="z">Z — <T text="Length" /></option></select></label></L>
      <p className="stretch-current"><T text="Current axial size" />: {Number(length.toFixed(4))} <T text="mm" /></p>
      {[["New axial size (mm)", target, setTarget], ["Preserve start (mm)", start, setStart], ["Preserve end (mm)", end, setEnd]].map(([label, value, setter]) => <L key={label as string}><label className="text-property"><span><T text={label as string} /></span><L><input aria-label={label as string} inputMode="decimal" value={value as string} disabled={shape.locked} onChange={e => { clear(); (setter as (v: string) => void)(e.target.value); }} /></L></label></L>)}
      <L><label className="select-property"><span><T text="Fixed reference" /></span><select aria-label="Fixed reference" value={anchor} disabled={shape.locked} onChange={e => { clear(); setAnchor(e.target.value as typeof anchor); }}><option value="start"><T text="Start (−)" /></option><option value="center"><T text="Center" /></option><option value="end"><T text="End (+)" /></option></select></label></L>
      <p className="stretch-hint"><T text="Keep holes and mounts inside the protected ends. Features in the middle change size. The new size must exceed the sum of the protected ends." /></p>
      {preview && <p role="status" className="stretch-hint"><T text="Preview only. Apply to keep this change." /></p>}
      {error && <p className="face-annotation-error" role="alert">{error}</p>}
      <div className="stretch-actions"><L><button className="inspector-action-button" type="button" disabled={shape.locked} onClick={() => run(false)}><T text="Preview stretch" /></button></L><L><button className="inspector-action-button" type="submit" disabled={shape.locked}><T text="Apply stretch" /></button></L></div>
      {preview && <button className="inspector-action-button" type="button" onClick={clear}><T text="Cancel preview" /></button>}
      <p className="stretch-hint"><T text="Apply creates one undo step. Ctrl+Z restores the previous shape." /></p>
    </form>}
  </div>;
}
