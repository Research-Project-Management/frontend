import React, { useState, useRef } from "react";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Paperclip,
  Send,
  Upload,
  X,
  FileText,
  Plus,
  ArrowUp,
} from "lucide-react";
import { Switch } from "~/components/ui/switch";
import { useProjects } from "~/hooks/useWorkspace";
import { Button } from "~/components/ui/button";

export default function ChatAi() {
  const { projects, isLoading } = useProjects();
  const [message, setMessage] = useState("");
  const [webSearch, setWebSearch] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("gpt-4o");

  const models = [
    { id: "gpt-4o", name: "GPT-4o" },
    { id: "claude-3-5", name: "Claude 3.5" },
    { id: "gemini-1-5", name: "Gemini 1.5" },
  ];

  const handleFileUpload = () => {
    setUploadedDocs([...uploadedDocs, "New_Document.pdf"]);
  };

  const handleSend = () => {
    if (!message.trim()) return;
    setMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isLoading || !projects) return null;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-6">
      <div className="relative w-full">
        {/* Top Controls: Absolute Positioned */}
        <div className="absolute h-12 px-2 flex items-center top-0 z-10 gap-2 w-full overflow-hidden">
          {/* Project Selector */}
          <Select defaultValue={projects[0]?._id}>
            <SelectTrigger
              size="sm"
              className="min-w-[100px] data-[size=sm]:h-8 p-2 focus-visible:ring-transparent hover:ring-1 ring-primary/10 focus-visible:border-transparent bg-background/50 backdrop-blur-sm"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project._id} value={project._id}>
                  <div className="flex items-center gap-2">
                    {project.avatar}
                    <span className="font-semibold">{project.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Textarea: Large vertical padding to accommodate top/bottom bars */}
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          className="py-14 placeholder:opacity-80 resize-none min-h-[140px] bg-background border-border focus-visible:ring-primary/5 focus-visible:border-primary/30 rounded-xl"
          placeholder="Ask questions about your documents..."
        />

        {/* Bottom Controls: Absolute Positioned */}
        <div className="absolute h-12 bottom-0 flex items-center w-full justify-between px-4">
          <div className="flex h-full gap-2 items-center">
            <Switch
              checked={webSearch}
              onCheckedChange={setWebSearch}
              className="data-[state=checked]:bg-primary scale-75"
            />
            <span className="select-none text-sm font-medium text-foreground">
              Web Search
            </span>
          </div>
          <div className="flex gap-2 items-center h-full">
            <button
              onClick={handleSend}
              disabled={!message.trim()}
              className="size-8 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-30"
            >
              <ArrowUp className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <p className="text-[9px] text-center text-muted-foreground/50 mt-3 font-bold uppercase tracking-[0.2em]">
        AI-Generated content may be inaccurate
      </p>
    </div>
  );
}
