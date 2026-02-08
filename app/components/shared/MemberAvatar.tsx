import { memo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

interface MemberAvatarProps {
  name: string;
  avatar?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-9 w-9 text-sm",
  lg: "h-12 w-12 text-base",
};

export const MemberAvatar = memo(
  ({ name, avatar, size = "md" }: MemberAvatarProps) => {
    const getInitials = (name: string) => {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .substring(0, 2);
    };

    return (
      <Avatar className={sizeClasses[size]}>
        <AvatarImage src={avatar} alt={name} />
        <AvatarFallback className={size === "sm" ? "text-[10px]" : ""}>
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
    );
  },
);

MemberAvatar.displayName = "MemberAvatar";
