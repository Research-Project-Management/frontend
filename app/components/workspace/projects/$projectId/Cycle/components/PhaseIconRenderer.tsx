import React from "react";
import { getPhaseIcon } from "./ScientificIcons";

interface PhaseIconRendererProps {
  phaseId: string;
  icon: string | React.ReactNode;
  color: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const PhaseIconRenderer = ({
  phaseId,
  icon,
  color,
  className = "",
  size = "md"
}: PhaseIconRendererProps) => {
  const svgIcon = getPhaseIcon(phaseId, icon);
  
  const sizeClass = {
    sm: "size-4",
    md: "size-6",
    lg: "size-8"
  }[size];

  const containerSizeClass = {
    sm: "size-7",
    md: "size-9",
    lg: "size-11"
  }[size];

  if (typeof svgIcon === "string") {
    const textSize = size === "sm" ? "text-[14px]" : size === "md" ? "text-[20px]" : "text-[26px]";
    return (
      <div 
        className={`${containerSizeClass} flex items-center justify-center rounded-lg ${className}`}
        style={{ backgroundColor: `${color}15` }}
      >
        <span className={`${textSize} leading-none select-none`} style={{ color }}>
          {svgIcon}
        </span>
      </div>
    );
  }

  return (
    <div 
      className={`${containerSizeClass} flex items-center justify-center rounded-lg ${className}`}
      style={{ backgroundColor: `${color}15` }}
    >
      {React.cloneElement(svgIcon as React.ReactElement, { 
        ...{className: sizeClass},
        ...{size: size === "sm" ? 16 : size === "md" ? 22 : 28 }
      })}
    </div>
  );
};
