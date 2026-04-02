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
  teamSize?: string;
  onSubmit?: (data: {
    name: string;
    url?: string;
    avatar?: string | null;
    teamSize?: string;
  }) => void;
  isSubmitting?: boolean;
};

const TEAM_SIZES = [
  { value: "1", label: "Just me" },
  { value: "2-10", label: "2–10" },
  { value: "11-50", label: "11–50" },
  { value: "51-200", label: "51–200" },
  { value: "201-500", label: "201–500" },
  { value: "500+", label: "500+" },
] as const;

export default function GeneralForm({
  id,
  name,
  url,
  avatar,
  teamSize,
  onSubmit,
  isSubmitting = false,
}: GeneralFormProps) {
  const [formValues, setFormValues] = useState({
    name: name || "",
    url,
    avatar: avatar || "",
    teamSize: teamSize || "2-10",
  });

  useEffect(() => {
    setFormValues({
      name: name || "",
      url,
      avatar: avatar || "",
      teamSize: teamSize || "2-10",
    });
  }, [url, name, avatar, teamSize]);

  const workspaceUrl = `app.flux/${url || "untitled"}`;

  const hasChanges =
    formValues.name !== (name || "") ||
    formValues.teamSize !== (teamSize || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.(formValues);
  };

  const update = (key: string, value: string) =>
    setFormValues((f) => ({ ...f, [key]: value }));

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            className="h-10"
          />
        </div>

        {/* Team Size */}
        <div className="space-y-1.5">
          <label
            htmlFor="team-size"
            className="text-sm font-medium text-foreground"
          >
            Team size
          </label>
          <Select
            value={formValues.teamSize}
            onValueChange={(val) => update("teamSize", val)}
          >
            <SelectTrigger id="team-size" size="sm" className="w-full">
              <SelectValue placeholder="Select team size" />
            </SelectTrigger>
            <SelectContent>
              {TEAM_SIZES.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Workspace URL - Sized to match other inputs */}
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
            className="bg-muted/50 text-muted-foreground cursor-not-allowed h-10 font-medium"
          />
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
