import { Separator } from "~/components/ui/separator";
import StatusSection from "./sections/StatusSection";
import AssigneeSection from "./sections/AssigneeSection";
import DueDateSection from "./sections/DueDateSection";
import LabelsSection from "./sections/LabelsSection";

export default function FilterBody() {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
      <div className="space-y-6">
        <StatusSection />
        <Separator />
        <AssigneeSection />
        <Separator />
        <DueDateSection />
        <Separator />
        <LabelsSection />
        <div className="h-4" />
      </div>
    </div>
  );
}
