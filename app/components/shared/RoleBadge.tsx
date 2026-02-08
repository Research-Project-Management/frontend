import { memo } from "react";
import { Badge } from "~/components/ui/badge";

interface RoleBadgeProps {
  roleName: string;
  roleColor?: string;
}

export const RoleBadge = memo(({ roleName, roleColor }: RoleBadgeProps) => {
  return (
    <Badge
      variant="secondary"
      className="capitalize font-normal"
      style={
        roleColor
          ? {
              backgroundColor: `${roleColor}20`,
              color: roleColor,
              borderColor: `${roleColor}40`,
            }
          : undefined
      }
    >
      {roleName}
    </Badge>
  );
});

RoleBadge.displayName = "RoleBadge";
