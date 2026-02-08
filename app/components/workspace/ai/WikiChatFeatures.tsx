import { Upload, FileText, Trash2, Plus, FileUp, Database } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useState } from "react";
import { Switch } from "~/components/ui/switch";

type Document = {
  id: string;
  name: string;
  size: number;
  type: string;
};

export default function WikiChatFeatures() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [useRpmData, setUseRpmData] = useState(true);

  const handleUpload = () => {
    const mockDoc: Document = {
      id: Date.now().toString(),
      name: "Lecture_Notes_Unit_1.pdf",
      size: 1024 * 1024 * 1.2,
      type: "application/pdf",
    };
    setDocuments([...documents, mockDoc]);
  };

  const handleRemove = (id: string) => {
    setDocuments(documents.filter((doc) => doc.id !== id));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="space-y-6">
      {/* RPM Data Toggle */}
      <div
        className="flex items-center justify-between p-4 bg-secondary/20 rounded-xl border border-border group hover:border-primary/20 transition-all cursor-pointer"
        onClick={() => setUseRpmData(!useRpmData)}
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg transition-colors ${useRpmData ? "bg-highlight text-primary" : "bg-secondary text-primary/40"}`}
          >
            <Database className="size-4" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-foreground uppercase tracking-tight">
              Use RPM Data
            </p>
            <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-tighter mt-0.5">
              Integrate RPM context
            </p>
          </div>
        </div>
        <Switch
          checked={useRpmData}
          onCheckedChange={setUseRpmData}
          className="data-[state=checked]:bg-primary scale-75"
        />
      </div>

      {/* Upload Button */}
      <Button
        type="button"
        variant="outline"
        className="w-full h-12 border-dashed border-border bg-secondary/30 hover:bg-secondary/50 text-foreground transition-all group"
        onClick={handleUpload}
      >
        <div className="flex items-center gap-2">
          <FileUp className="size-4 group-hover:scale-110 transition-transform text-primary" />
          <span className="font-bold text-[11px] uppercase tracking-wider">
            Add Source
          </span>
        </div>
      </Button>

      {/* Document List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Current Sources ({documents.length})
          </h3>
        </div>

        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4 bg-secondary/10 rounded-xl border border-dashed border-border">
            <FileText className="size-8 text-muted-foreground/20 mb-3" />
            <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-tight">
              No documents yet
            </p>
          </div>
        ) : (
          <div className="grid gap-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 bg-background border border-border rounded-xl group hover:border-primary/30 transition-all"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="shrink-0 size-8 rounded-lg bg-secondary text-primary flex items-center justify-center border border-border">
                    <FileText className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate text-foreground group-hover:text-primary transition-colors">
                      {doc.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">
                      {formatFileSize(doc.size)}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(doc.id)}
                  className="size-7 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-secondary hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
