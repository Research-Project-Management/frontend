type DangerZoneProps = {
  onDelete: () => void;
};
export default function DangerZone({ onDelete }: DangerZoneProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-base font-medium text-gray-900">
            Delete this workspace
          </h3>
          <p className="text-sm text-gray-500 max-w-2xl">
            Tread carefully here. You delete your workspace, you lose all your
            data, your members can't access projects and pages, and we can't
            retrieve any of it for you. Proceed only if you are sure you want
            your workspace deleted.
          </p>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md border border-red-500 px-4 py-2 text-sm font-medium text-red-600 focus:outline-none hover:bg-red-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
