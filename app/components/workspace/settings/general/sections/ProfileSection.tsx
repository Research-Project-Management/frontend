type ProfileSectionProps = {
  name: string;
  url: string;
  avatar?: string | null;
};
export default function ProfileSection({
  name,
  url,
  avatar,
}: ProfileSectionProps) {
  const slug = `app.flux/${url}`;
  const initial = (name || "X").charAt(0).toUpperCase();

  return (
    <div className="flex items-start gap-5">
      <div className="h-16 w-16 shrink-0 rounded-lg bg-[#0F4C81] text-white flex items-center justify-center text-2xl font-medium">
        {avatar ? (
          <img
            src={avatar}
            alt="Workspace logo"
            className="h-full w-full object-cover"
          />
        ) : (
          <span>{initial}</span>
        )}
      </div>

      <div className="flex flex-col pt-0.5">
        <h2 className="text-lg font-medium text-gray-900 leading-6">
          {name || "Untitled"}
        </h2>
        <p className="text-sm text-gray-500 leading-5">{slug}</p>

        <button
          type="button"
          className="mt-1 inline-flex w-fit text-sm font-medium text-blue-600 hover:underline"
        >
          Upload logo
        </button>
      </div>
    </div>
  );
}
