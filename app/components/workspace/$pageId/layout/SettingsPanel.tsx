import { useEffect } from "react";
import { toast } from "sonner";
import {
  useEditorSettingsStore,
  type CompileMode,
  type LaTeXEngine,
} from "~/stores/editor-settings";
import { usePageContext } from "./PageContext";
import { usePageFiles, useSetPageMainFile } from "~/query/page";
import {
  X,
  Cpu,
  Zap,
  RefreshCw,
  Moon,
  Sun,
  FileText,
  HardDrive,
  WrapText,
  Hash,
  Type,
  Minus,
  Plus,
  ChevronDown,
} from "lucide-react";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";

// ── Setting row components ──────────────────────────────────────────────────

function SettingGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-4">
        {label}
      </h3>
      <div>{children}</div>
    </div>
  );
}

function SettingRow({
  icon: Icon,
  label,
  description,
  children,
}: {
  icon: React.ElementType;
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-secondary/50 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <Icon className="size-4 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <div className="text-sm">{label}</div>
          {description && (
            <div className="text-[11px] text-muted-foreground truncate">
              {description}
            </div>
          )}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        "relative w-9 h-5 rounded-full transition-colors",
        checked ? "bg-primary" : "bg-muted-foreground/20",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition-transform",
          checked && "translate-x-4",
        )}
      />
    </button>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as T)} variant="pill">
      <TabsList className="h-7 p-0.5 border-none bg-secondary/80">
        {options.map((opt) => (
          <TabsTrigger 
            key={opt.value} 
            value={opt.value}
            className="text-[11px] px-2 py-1"
          >
            {opt.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

// ── Main File Select ────────────────────────────────────────────────────────

function MainFileSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  if (options.length === 0) {
    return (
      <input
        type="text"
        aria-label="Root document filename"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-28 text-xs bg-secondary border border-border rounded px-2 py-1 text-foreground text-right focus:outline-none focus:ring-1 focus:ring-primary"
      />
    );
  }

  return (
    <div className="relative">
      <select
        aria-label="Select root document"
        value={options.includes(value) ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-28 text-xs bg-secondary border border-border rounded px-2 py-1 pr-6",
          "text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary",
          "cursor-pointer truncate",
          !options.includes(value) && "text-muted-foreground",
        )}
      >
        {!options.includes(value) && (
          <option value="" disabled>
            Select file…
          </option>
        )}
        {options.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
    </div>
  );
}

// ── Main Panel ──────────────────────────────────────────────────────────────

export default function SettingsPanel() {
  const {
    engine,
    setEngine,
    compileMode,
    setCompileMode,
    autoCompile,
    setAutoCompile,
    editorTheme,
    setEditorTheme,
    useCache,
    setUseCache,
    mainFile,
    setMainFile,
    fontSize,
    setFontSize,
    wordWrap,
    setWordWrap,
    lineNumbers,
    setLineNumbers,
    toggleSettingsPanel,
  } = useEditorSettingsStore();

  const { texFiles, currentPage } = usePageContext();

  const setMainFileMutation = useSetPageMainFile();
  const { data: files } = usePageFiles(currentPage?._id ?? null);

  const dbMainFile =
    currentPage?.mainFile && typeof currentPage.mainFile === "object"
      ? (currentPage.mainFile as any).title
      : null;
  const currentMainFile = dbMainFile || mainFile || "main.tex";

  useEffect(() => {
    if (texFiles.length === 0) return;

    if (texFiles.includes("main.tex")) {
      setMainFile("main.tex");
    } else if (!texFiles.includes(currentMainFile)) {
      toast.warning("Please select a main file for compilation", {
        description: "No \"main.tex\" found. Choose the root .tex file from the Settings panel.",
        duration: 6000,
        id: "select-main-file",
      });
    }
  }, [texFiles, currentMainFile]);

  const handleMainFileChange = (newTitle: string) => {
    setMainFile(newTitle);
    if (files && currentPage) {
      const matchedPage = files.find((f) => f.title === newTitle);
      if (matchedPage) {
        setMainFileMutation.mutate({
          pageId: currentPage._id,
          fileId: matchedPage._id,
        });
        toast.success(`Main file updated to "${newTitle}"!`);
      }
    }
  };

  return (
    <div className="h-full w-[280px] border-l border-border bg-background flex flex-col shrink-0">
      <div className="flex items-center justify-between px-4 h-12 border-b border-border shrink-0">
        <span className="text-sm font-semibold">Settings</span>
        <button
          onClick={toggleSettingsPanel}
          className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-3 space-y-4">
        <SettingGroup label="Compiler">
          <SettingRow icon={Cpu} label="Engine" description="LaTeX compiler">
            <SegmentedControl<LaTeXEngine>
              options={[
                { value: "pdflatex", label: "pdf" },
                { value: "xelatex", label: "Xe" },
                { value: "lualatex", label: "Lua" },
              ]}
              value={engine}
              onChange={setEngine}
            />
          </SettingRow>

          <SettingRow icon={Zap} label="Compile mode" description="Full = renders images">
            <SegmentedControl<CompileMode>
              options={[
                { value: "full", label: "Full" },
                { value: "draft", label: "Draft" },
              ]}
              value={compileMode}
              onChange={setCompileMode}
            />
          </SettingRow>

          <SettingRow icon={RefreshCw} label="Auto compile" description="Compile on save">
            <Toggle checked={autoCompile} onChange={setAutoCompile} />
          </SettingRow>

          <SettingRow icon={HardDrive} label="Use cache" description="Incremental builds">
            <Toggle checked={useCache} onChange={setUseCache} />
          </SettingRow>

          <SettingRow icon={FileText} label="Main file" description="Root document">
            <MainFileSelect value={currentMainFile} options={texFiles} onChange={handleMainFileChange} />
          </SettingRow>
        </SettingGroup>

        <Separator />

        <SettingGroup label="Editor">
          <SettingRow icon={editorTheme === "light" ? Sun : Moon} label="Theme">
            <SegmentedControl<"light" | "dark">
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
              value={editorTheme}
              onChange={setEditorTheme}
            />
          </SettingRow>

          <SettingRow icon={Type} label="Font size">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setFontSize(Math.max(10, fontSize - 1))}
                className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              >
                <Minus className="size-3" />
              </button>
              <span className="text-xs font-mono w-6 text-center">{fontSize}</span>
              <button
                onClick={() => setFontSize(Math.min(24, fontSize + 1))}
                className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="size-3" />
              </button>
            </div>
          </SettingRow>

          <SettingRow icon={WrapText} label="Word wrap">
            <Toggle checked={wordWrap} onChange={setWordWrap} />
          </SettingRow>

          <SettingRow icon={Hash} label="Line numbers">
            <Toggle checked={lineNumbers} onChange={setLineNumbers} />
          </SettingRow>
        </SettingGroup>
      </div>
    </div>
  );
}
