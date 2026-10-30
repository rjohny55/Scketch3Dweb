"use client";

import { Palette } from "lucide-react";
import { L, T } from '@/components/Localization';
import { APP_THEME_OPTIONS, type AppThemePreference } from '@/lib/appTheme';

export function AppAppearanceSettings({value,onChange}:{value:AppThemePreference;onChange:(value:AppThemePreference)=>void}) {
 return <L><section className="dashboard-update-settings dashboard-appearance-settings" aria-label="Appearance">
  <div className="dashboard-settings-card-heading"><span className="dashboard-settings-card-icon"><Palette size={21} aria-hidden="true" /></span><strong><T text="Appearance"/></strong><span><T text="Theme applies across Scketch3Dweb and all projects."/></span></div>
  <label className="dashboard-setting-row"><span><T text="Theme"/></span><L><select aria-label="Theme" value={value} onChange={event=>onChange(event.currentTarget.value as AppThemePreference)}>
   {APP_THEME_OPTIONS.map(option=><option key={option.value} value={option.value}><T text={option.label}/></option>)}
  </select></L></label>
 </section></L>;
}
