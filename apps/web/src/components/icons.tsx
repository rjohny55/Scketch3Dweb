import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

/** A shared, theme-aware outline language for editor commands. */
function ToolbarGlyph({children,className,...props}:IconProps & {children:ReactNode}) {
  return <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className={["toolbar-line-icon",className].filter(Boolean).join(" ")} {...props}>{children}</svg>;
}

export function ToolbarHomeIcon(props:IconProps) {
  return <ToolbarGlyph {...props}><path d="m3 10 9-7 9 7M5 9v11h5v-6h4v6h5V9"/></ToolbarGlyph>;
}
export function ToolbarCopyIcon(props:IconProps) {
  return <ToolbarGlyph {...props}><rect x="8" y="7" width="12" height="14" rx="2"/><path d="M15 3H5a2 2 0 0 0-2 2v11M12 11h4m-4 4h4"/></ToolbarGlyph>;
}
export function ToolbarPasteIcon(props:IconProps) {
  return <ToolbarGlyph {...props}><rect x="8" y="3" width="8" height="4" rx="1.3"/><path d="M8 5H5v16h14V5h-3M8 12h8m-8 4h5"/></ToolbarGlyph>;
}
export function ToolbarDuplicateIcon(props:IconProps) {
  return <ToolbarGlyph {...props}><rect x="3" y="3" width="12" height="12" rx="2"/><rect x="9" y="9" width="12" height="12" rx="2" fill="var(--panel)"/><path d="M12 15h6m-3-3v6"/></ToolbarGlyph>;
}
export function ToolbarTrashIcon(props:IconProps) {
  return <ToolbarGlyph {...props}><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></ToolbarGlyph>;
}
export function ToolbarUndoIcon(props:IconProps) {
  return <ToolbarGlyph {...props}><path d="m8 4-5 5 5 5M3 9h10a7 7 0 0 1 7 7v3"/></ToolbarGlyph>;
}
export function ToolbarRedoIcon(props:IconProps) {
  return <ToolbarGlyph {...props}><path d="m16 4 5 5-5 5m5-5H11a7 7 0 0 0-7 7v3"/></ToolbarGlyph>;
}
export function ToolbarImportIcon(props:IconProps) {
  return <ToolbarGlyph {...props}><path d="M12 3v12m-4-4 4 4 4-4M4 14v7h16v-7"/></ToolbarGlyph>;
}
export function ToolbarVectorExportIcon(props:IconProps) {
  return <ToolbarGlyph {...props}><path d="M12 15V3m-4 4 4-4 4 4M4 14v7h16v-7"/></ToolbarGlyph>;
}
export function ToolbarExportIcon(props:IconProps) {
  return <ToolbarVectorExportIcon {...props}/>;
}
export function ToolbarSettingsIcon(props:IconProps) {
  return <ToolbarGlyph {...props}><path d="m9 3-.6 2.4-2 .9-2.2-.7-2 3.4 1.7 1.7v2.6L2.2 15l2 3.4 2.3-.7 1.9.9L9 21h4l.6-2.4 2-.9 2.2.7 2-3.4-1.7-1.7v-2.6L19.8 9l-2-3.4-2.3.7-1.9-.9L13 3Z"/><circle cx="11" cy="12" r="3"/></ToolbarGlyph>;
}
export function ToolbarShapeAddIcon(props:IconProps) {
  return <ToolbarGlyph {...props}><rect x="3" y="4" width="8" height="8" rx="1.4"/><circle cx="17" cy="8" r="4"/><path d="m7 15-4 6h8Z"/><path d="M17 15v6m-3-3h6"/></ToolbarGlyph>;
}
export function ToolbarHideSelectedIcon(props:IconProps) {
  return <ToolbarGlyph {...props}><path d="M3 3l18 18M9 5.5A11 11 0 0 1 12 5c6 0 10 7 10 7a18 18 0 0 1-4 4.5M6 6.5A18 18 0 0 0 2 12s4 7 10 7a11 11 0 0 0 3-.5"/><path d="M10 10a3 3 0 0 0 4 4"/></ToolbarGlyph>;
}
export function ToolbarCaretDownIcon(props:IconProps) {
  return <ToolbarGlyph {...props}><path d="m7 10 5 5 5-5"/></ToolbarGlyph>;
}
export function ToolbarGroupIcon(props:IconProps) {
  return <ToolbarGlyph {...props}><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><rect x="6" y="6" width="8" height="8" rx="1"/><rect x="10" y="10" width="8" height="8" rx="1" fill="var(--panel)"/></ToolbarGlyph>;
}
export function ToolbarUngroupIcon(props:IconProps) {
  return <ToolbarGlyph {...props}><rect x="3" y="4" width="7" height="7" rx="1"/><rect x="14" y="13" width="7" height="7" rx="1"/><path d="M14 7h7m-3-3 3 3-3 3M10 17H3m3-3-3 3 3 3"/></ToolbarGlyph>;
}
export function ToolbarIntersectionIcon(props:IconProps) {
  return <ToolbarGlyph {...props}><rect x="3" y="3" width="12" height="12" rx="2"/><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M9 9h6v6H9Z" fill="currentColor" fillOpacity=".28"/></ToolbarGlyph>;
}
export function ToolbarAlignIcon(props:IconProps) {
  return <ToolbarGlyph {...props}><path d="M3 3v18"/><rect x="7" y="5" width="14" height="5" rx="1"/><rect x="7" y="14" width="9" height="5" rx="1"/></ToolbarGlyph>;
}
export function ToolbarMirrorIcon(props:IconProps) {
  return <ToolbarGlyph {...props}><path d="M12 2v20" strokeDasharray="2 3"/><path d="M3 18V6l6 12Zm18 0V6l-6 12Z"/></ToolbarGlyph>;
}
export function ToolbarChamferIcon(props:IconProps) {
  return <ToolbarGlyph {...props}><path d="M4 20V4h9l7 7v9Z"/><path d="M13 4v7h7" strokeDasharray="2 3"/><path d="m13 4 7 7" strokeWidth="2.5"/></ToolbarGlyph>;
}
export function ToolbarFilletIcon(props:IconProps) {
  return <ToolbarGlyph {...props}><path d="M4 20V4h7a9 9 0 0 1 9 9v7Z"/><path d="M11 4h9v9" strokeDasharray="2 3"/><path d="M11 4a9 9 0 0 1 9 9" strokeWidth="2.5"/></ToolbarGlyph>;
}
export function ToolbarPreserveEdgeIcon(props:IconProps) {
  return <ToolbarGlyph {...props}><path d="M4 20V9a5 5 0 0 1 5-5h11v16ZM9 14h7m-7-2v4m7-4v4"/><path d="M4 9a5 5 0 0 1 5-5" strokeWidth="2.5"/></ToolbarGlyph>;
}
export function ToolbarSnapGridIcon(props:IconProps) {
  return <ToolbarGlyph {...props}><path d="M3 3h4M3 3v4m18-4h-4m4 0v4M3 21h4m-4 0v-4m18 4h-4m4 0v-4"/><path d="M8 8h8v8H8Z"/><path d="m12 2 0 3m0 14v3M2 12h3m14 0h3"/></ToolbarGlyph>;
}
export function ToolbarWorkplaneIcon(props:IconProps) {
  return <ToolbarGlyph {...props}><path d="m2 15 10-5 10 5-10 6ZM7 12.5l10 5m-10 0 10-5M12 3v4"/></ToolbarGlyph>;
}
export function ToolbarDropToWorkplaneIcon(props:IconProps) {
  return <ToolbarGlyph {...props}><path d="M12 3v10m-4-4 4 4 4-4M3 17h18M5 21h14"/></ToolbarGlyph>;
}
