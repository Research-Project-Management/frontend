import { Camera, Loader2 } from "lucide-react";
import { useRef } from "react";
import { Avatar } from "../../../layout/Avatar";

type ProfileSectionProps = {
  name: string;
  url: string;
  avatar?: string | null;
  onAvatarUpload?: (file: File) => void;
  isUploadingAvatar?: boolean;
};

export default function ProfileSection({
  name,
  url,
  avatar,
  onAvatarUpload,
  isUploadingAvatar = false,
}: ProfileSectionProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const slug = `app.flux/${url}`;
  const initial = (name || "X").charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-5">
      {/* Avatar */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={isUploadingAvatar}
        className="relative group size-16 shrink-0 rounded-xl flex items-center justify-center text-2xl font-semibold overflow-hidden transition-opacity hover:opacity-90 cursor-pointer"
      >
        <Avatar
          src={avatar}
          name={name}
          className="size-full"
          fallbackType="workspace"
        />
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          {isUploadingAvatar ? (
            <Loader2 className="size-5 text-white animate-spin" />
          ) : (
            <Camera className="size-5 text-white" />
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && onAvatarUpload) onAvatarUpload(file);
          }}
        />
      </button>

      {/* Info */}
      <div className="flex flex-col gap-0.5">
        <h2 className="text-base font-semibold text-foreground">
          {name || "Untitled"}
        </h2>
        <p className="text-sm text-muted-foreground">{slug}</p>
      </div>
    </div>
  );
}
