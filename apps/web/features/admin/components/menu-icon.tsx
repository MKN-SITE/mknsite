import React from "react";
import { PortalIcon, PRESET_MENU_ICONS, type PresetMenuItem } from "@/features/portal/components/portal-icons";

export { PRESET_MENU_ICONS, type PresetMenuItem };
export type PresetMenuIconName = typeof PRESET_MENU_ICONS[number]["name"];

export type MenuIconProps = {
  name: string | null | undefined;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
};

export function MenuIcon({ name, size = 18, className, style }: MenuIconProps) {
  return <PortalIcon name={name} size={size} className={className} style={style} />;
}
