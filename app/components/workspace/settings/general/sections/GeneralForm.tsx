import { useEffect, useState } from "react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

type GeneralFormProps = {
  id: string;
  name: string;
  url: string;
  avatar?: string | null;
  companySize?: string;
  timezone?: string;
  onSubmit?: (data: {
    name: string;
    url?: string;
    avatar?: string | null;
    companySize?: string;
    timezone?: string;
  }) => void;
  isSubmitting?: boolean;
};

const COMPANY_SIZES = [
  { value: "1", label: "Just me" },
  { value: "2-10", label: "2-10" },
  { value: "11-50", label: "11-50" },
  { value: "51-200", label: "51-200" },
  { value: "201-500", label: "201-500" },
  { value: "500+", label: "500+" },
] as const;

const TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "PST", label: "PST" },
  { value: "EST", label: "EST" },
] as const;

export default function GeneralForm({
  id,
  name,
  url,
  avatar,
  companySize,
  timezone,
  onSubmit,
  isSubmitting = false,
}: GeneralFormProps) {
  const [workspaceName, setWorkspaceName] = useState(name || "");
  const [selectedCompanySize, setCompanySize] = useState(companySize || "2-10");
  const [selectedTimezone, setTimezone] = useState(timezone || "UTC");

  // keep local copy of original values to detect changes
  const original = {
    name,
    url,
    avatar: avatar || "",
    companySize: companySize || "",
    timezone: timezone || "",
  };

  const [formValues, setFormValues] = useState({
    name: name || "",
    url,
    avatar: avatar || "",
    companySize: companySize || "",
    timezone: timezone || "",
  });

  useEffect(() => {
    setWorkspaceName(name || "");
    setCompanySize(companySize || "2-10");
    setTimezone(timezone || "UTC");

    setFormValues({
      name: name || "",
      url,
      avatar: avatar || "",
      companySize: companySize || "",
      timezone: timezone || "",
    });
  }, [url, name, avatar, companySize, timezone]);

  const workspaceUrl = `app.flux/${url || "untitled"}`;

  const hasChanges =
    formValues.name !== original.name ||
    formValues.avatar !== original.avatar ||
    formValues.companySize !== original.companySize ||
    formValues.timezone !== original.timezone;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof onSubmit === "function") {
      onSubmit(formValues);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-2">
        {/* Workspace Name */}
        <div className="space-y-2">
          <label
            htmlFor="workspace-name"
            className="block text-sm font-medium text-gray-600"
          >
            Workspace name
          </label>
          <Input
            id="workspace-name"
            value={workspaceName}
            onChange={(e) => {
              setWorkspaceName(e.target.value);
              setFormValues((f) => ({ ...f, name: e.target.value }));
            }}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        {/* Company Size */}
        <div className="space-y-2">
          <label
            htmlFor="company-size"
            className="block text-sm font-medium text-gray-600"
          >
            Company size
          </label>

          <Select
            value={selectedCompanySize}
            onValueChange={(val) => {
              setCompanySize(val);
              setFormValues((f) => ({ ...f, companySize: val }));
            }}
          >
            <SelectTrigger
              id="company-size"
              size="sm"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none"
            >
              <SelectValue placeholder="Select company size" />
            </SelectTrigger>

            <SelectContent>
              {COMPANY_SIZES.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Workspace URL */}
        <div className="space-y-2">
          <label
            htmlFor="workspace-url"
            className="block text-sm font-medium text-gray-600"
          >
            Workspace URL
          </label>
          <Input
            id="workspace-url"
            readOnly
            value={workspaceUrl}
            className="w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-500 cursor-not-allowed focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="timezone"
            className="block text-sm font-medium text-gray-600"
          >
            Workspace Timezone
          </label>

          <Select
            value={selectedTimezone}
            onValueChange={(val) => {
              setTimezone(val);
              setFormValues((f) => ({ ...f, timezone: val }));
            }}
          >
            <SelectTrigger
              id="timezone"
              size="sm"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none"
            >
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>

            <SelectContent>
              {TIMEZONES.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Button
          type="submit"
          disabled={!hasChanges || isSubmitting}
          className="rounded-md bg-[#0F5F96] px-4 py-2 text-sm font-medium text-white hover:bg-[#0c4b77] focus:outline-none disabled:opacity-50"
        >
          {isSubmitting ? "Saving..." : "Update workspace"}
        </Button>
      </div>
    </form>
  );
}
