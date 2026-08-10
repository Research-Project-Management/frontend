import { Avatar as UIAvatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";

interface AvatarProps {
  src?: string | null;
  name: string;
  className?: string;
  fallbackType?: "user" | "workspace" | "project";
}

export default function Avatar({ src, name, className, fallbackType = "user" }: AvatarProps) {
  const initials = name ? name.substring(0, 2).toUpperCase() : (fallbackType === "user" ? "U" : "W");
  
  return (
    <UIAvatar className={className}>
      {src ? <AvatarImage src={src} alt={name} /> : null}
      <AvatarFallback>{initials}</AvatarFallback>
    </UIAvatar>
  );
}
