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
import { Loader2 } from "lucide-react";

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
  { value: "2-10", label: "2–10" },
  { value: "11-50", label: "11–50" },
  { value: "51-200", label: "51–200" },
  { value: "201-500", label: "201–500" },
  { value: "500+", label: "500+" },
] as const;

const TIMEZONES = [
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
  { value: "PST", label: "PST (Pacific Standard Time)" },
  { value: "EST", label: "EST (Eastern Standard Time)" },
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
  const [formValues, setFormValues] = useState({
    name: name || "",
    url,
    avatar: avatar || "",
    companySize: companySize || "2-10",
    timezone: timezone || "UTC",
  });

  useEffect(() => {
    setFormValues({
      name: name || "",
      url,
      avatar: avatar || "",
      companySize: companySize || "2-10",
      timezone: timezone || "UTC",
    });
  }, [url, name, avatar, companySize, timezone]);

  const workspaceUrl = `app.flux/${url || "untitled"}`;

  const hasChanges =
    formValues.name !== (name || "") ||
    formValues.companySize !== (companySize || "") ||
    formValues.timezone !== (timezone || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.(formValues);
  };

  const update = (key: string, value: string) =>
    setFormValues((f) => ({ ...f, [key]: value }));

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Workspace Name */}
        <div className="space-y-1.5">
          <label
            htmlFor="workspace-name"
            className="text-sm font-medium text-foreground"
          >
            Workspace name
          </label>
          <Input
            id="workspace-name"
            value={formValues.name}
            onChange={(e) => update("name", e.target.value)}
          />
        </div>

        {/* Company Size */}
        <div className="space-y-1.5">
          <label
            htmlFor="company-size"
            className="text-sm font-medium text-foreground"
          >
            Team size
          </label>
          <Select
            value={formValues.companySize}
            onValueChange={(val) => update("companySize", val)}
          >
            <SelectTrigger id="company-size" className="w-full">
              <SelectValue placeholder="Select team size" />
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
        <div className="space-y-1.5">
          <label
            htmlFor="workspace-url"
            className="text-sm font-medium text-foreground"
          >
            Workspace URL
          </label>
          <Input
            id="workspace-url"
            readOnly
            value={workspaceUrl}
            className="bg-muted text-muted-foreground cursor-not-allowed"
          />
        </div>

        {/* Timezone */}
        <div className="space-y-1.5">
          <label
            htmlFor="timezone"
            className="text-sm font-medium text-foreground"
          >
            Timezone
          </label>
          <Select
            value={formValues.timezone}
            onValueChange={(val) => update("timezone", val)}
          >
            <SelectTrigger id="timezone" className="w-full">
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
        <Button type="submit" disabled={!hasChanges || isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 mr-2 animate-spin" />}
          {isSubmitting ? "Saving…" : "Update workspace"}
        </Button>
      </div>
    </form>
  );
}
