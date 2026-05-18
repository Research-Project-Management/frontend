import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowUp } from "lucide-react";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { useProjects } from "~/hooks/useWorkspace";
import HomeSection from "../HomeSection";

export default function ChatAi() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { projects, isLoading } = useProjects();
  const [message, setMessage] = useState("");
  const [webSearch, setWebSearch] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 150) + "px";
    }
  }, [message]);

  const handleSend = () => {
    if (!message.trim()) return;
    const pid = selectedProject || projects?.[0]?._id;
    navigate(
      `/${workspaceId}/ai?q=${encodeURIComponent(message.trim())}${pid ? `&project=${pid}` : ""}`,
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isLoading || !projects || projects.length === 0) return null;

  return (
    <HomeSection title="Ask Flux AI">
      <div className="relative rounded-2xl border border-border bg-background transition-shadow duration-300 focus-within:border-primary/30">
        {/* Top: project selector */}
        <div className="flex items-center gap-2 px-3 pt-3">
          <Select
            value={selectedProject || projects[0]?._id}
            onValueChange={setSelectedProject}
          >
            <SelectTrigger
              size="sm"
              className="min-w-[100px] data-[size=sm]:h-7 px-2 text-xs focus-visible:ring-transparent hover:ring-1 ring-primary/10 focus-visible:border-transparent bg-secondary/50 rounded-sm border-none"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project: (typeof projects)[0]) => (
                <SelectItem key={project._id} value={project._id}>
                  <div className="flex items-center gap-2">
                    {project.avatar}
                    <span className="font-medium">{project.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Textarea */}
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          className="border-none shadow-none focus-visible:ring-0 resize-none min-h-[44px] max-h-[150px] px-4 py-3 text-sm placeholder:text-muted-foreground/50"
          placeholder="Ask anything about your research..."
        />

        {/* Bottom row */}
        <div className="flex items-center justify-between px-3 pb-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={webSearch}
              onCheckedChange={setWebSearch}
              className="data-[state=checked]:bg-primary scale-[0.7]"
            />
            <span className="text-[11px] font-medium text-muted-foreground">
              Web
            </span>
          </div>

          <button
            onClick={handleSend}
            disabled={!message.trim()}
            className="size-8 flex items-center justify-center rounded-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
          >
            <ArrowUp className="size-4" />
          </button>
        </div>
      </div>
    </HomeSection>
  );
}
