import { DropDownListComponent } from "@syncfusion/ej2-react-dropdowns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Column = {
  id: string;
  title: string;
};

type DialogTemplateProps = {
  data?: {
    title?: string;
    content?: string;
    columnId?: string;
    labels?: string;
  };
  columns: Column[];
};

export default function DialogTemplate({ data, columns }: DialogTemplateProps) {
  return (
    <div className="grid gap-4 p-4">
      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          className="e-field"
          defaultValue={data?.title ?? ""}
          autoFocus
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="content">Description</Label>
        <Textarea
          id="content"
          name="content"
          className="e-field min-h-[120px]"
          defaultValue={data?.content ?? ""}
        />
      </div>

      {/* Status */}
      <div className="space-y-2">
        <Label>Status</Label>

        <DropDownListComponent
          name="columnId"
          className="e-field w-full"
          dataSource={columns.map((c) => ({
            text: c.title,
            value: c.id,
          }))}
          fields={{ text: "text", value: "value" }}
          value={data?.columnId ?? columns[0]?.id}
          placeholder="Select status"
        />
      </div>

      {/* Labels */}
      <div className="space-y-2">
        <Label htmlFor="labels">Labels</Label>
        <Input
          id="labels"
          name="labels"
          className="e-field"
          defaultValue={data?.labels ?? ""}
          placeholder="ui,layout"
        />
      </div>
    </div>
  );
}
