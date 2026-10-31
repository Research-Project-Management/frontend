"use client";

import { useState, useEffect } from "react";
import { ExternalLink, Copy, CheckCircle2 } from "lucide-react";
import { SchemaFieldDefinition } from "@/features/library/domain/types/core.types";
import { isValidValue } from "@/features/library/domain/metadata-mapper";
import { InlineField } from "./InlineField";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";

export interface DynamicInspectorFieldProps {
  fieldDef: SchemaFieldDefinition;
  val: string;
  displayDoi: string;
  copiedKey: string | null;
  canEdit?: boolean;
  onSave: (newVal: string) => void;
  onCopy: (text: string, label: string) => void;
}

/** Check if a string represents an external link / URL */
function isUrlLike(str?: string | null): boolean {
  if (!str || typeof str !== "string") return false;
  const trimmed = str.trim();
  if (!trimmed || trimmed === "http://" || trimmed === "https://") return false;
  if (/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(trimmed)) return true;
  if (/^www\.[a-z0-9-]+(\.[a-z0-9-]+)+/i.test(trimmed)) return true;
  if (/^(dx\.)?doi\.org\//i.test(trimmed)) return true;
  if (
    /^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/[^\s]*)?$/i.test(trimmed) &&
    trimmed.includes(".")
  ) {
    const hasDomainExtension =
      /\.(org|com|net|edu|gov|io|ai|app|dev|co|uk|de|fr|vn|jp|cn|info|me|tech|xyz)(\/|$)/i.test(
        trimmed,
      );
    return hasDomainExtension;
  }
  return false;
}

/** Ensure link starts with valid protocol */
function toValidUrl(str: string): string {
  const trimmed = str.trim();
  if (/^(https?:\/\/|ftp:\/\/|mailto:)/i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

const MONO_FIELD_KEYS = new Set<string>([
  "doi",
  "citationkey",
  "citekey",
  "isbn",
  "issn",
  "pmid",
  "pmcid",
  "arxiv",
  "arxivid",
  "year",
  "volume",
  "issue",
  "pages",
  "date",
  "citationcount",
]);

export interface InspectorFieldActionDescriptor {
  type: "external-link" | "copy-cite";
  href?: string;
  copyText?: string;
  title: string;
  label: string;
}

export interface InspectorFieldDescriptor {
  isMono: boolean;
  isCitationKey: boolean;
  action?: InspectorFieldActionDescriptor;
}

interface FieldActionStrategy {
  matches(fieldKeyLower: string, value: string, options?: { displayDoi?: string; fieldDef?: SchemaFieldDefinition }): boolean;
  resolve(fieldKeyLower: string, value: string, options?: { displayDoi?: string; fieldDef?: SchemaFieldDefinition }): InspectorFieldActionDescriptor;
}

const INSPECTOR_FIELD_ACTION_STRATEGIES: readonly FieldActionStrategy[] = [
  {
    matches: (key, val, opts) =>
      key === "doi" && Boolean(opts?.displayDoi || isValidValue(val)),
    resolve: (_key, val, opts) => {
      const targetDoi = (opts?.displayDoi || val).trim();
      return {
        type: "external-link",
        href: `https://doi.org/${targetDoi}`,
        title: "Open DOI",
        label: "Open DOI",
      };
    },
  },
  {
    matches: (key, val) =>
      (key === "citationkey" || key === "citekey") && isValidValue(val),
    resolve: (_key, val) => ({
      type: "copy-cite",
      copyText: `\\cite{${val}}`,
      title: "Copy citation key",
      label: "Citation Key",
    }),
  },
  {
    matches: (key, val) =>
      (key === "pmid" || key === "pmcid") && Boolean(val && val.trim()),
    resolve: (key, val) => ({
      type: "external-link",
      href:
        key === "pmid"
          ? `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(val)}/`
          : `https://www.ncbi.nlm.nih.gov/pmc/articles/${encodeURIComponent(val)}/`,
      title: "Open in PubMed",
      label: "Open in PubMed",
    }),
  },
  {
    matches: (key, val) =>
      (key === "arxivid" || key === "arxiv") && Boolean(val && val.trim()),
    resolve: (_key, val) => ({
      type: "external-link",
      href: `https://arxiv.org/abs/${encodeURIComponent(val.replace(/^arxiv:/i, ""))}`,
      title: "Open in arXiv",
      label: "Open in arXiv",
    }),
  },
  {
    matches: (key, val, opts) => {
      if (
        key === "doi" ||
        key === "pmid" ||
        key === "pmcid" ||
        key === "arxivid" ||
        key === "arxiv"
      ) {
        return false;
      }
      const isUrlField = key === "url" || opts?.fieldDef?.type === "url";
      return (
        isUrlLike(val) ||
        (isUrlField &&
          isValidValue(val) &&
          val.trim() !== "http://" &&
          val.trim() !== "https://")
      );
    },
    resolve: (_key, val, opts) => {
      const fieldLabel = opts?.fieldDef?.label || "URL";
      return {
        type: "external-link",
        href: toValidUrl(val),
        title: `Open ${fieldLabel.toLowerCase()} link`,
        label: `Open ${fieldLabel} link`,
      };
    },
  },
];

export function resolveInspectorFieldAction(
  fieldKeyOrDef: string | SchemaFieldDefinition,
  value: string,
  displayDoi?: string,
): InspectorFieldDescriptor {
  const fieldDef =
    typeof fieldKeyOrDef === "object" && fieldKeyOrDef !== null
      ? fieldKeyOrDef
      : undefined;
  const rawKey = typeof fieldKeyOrDef === "string" ? fieldKeyOrDef : fieldDef?.field || "";
  const keyLower = rawKey.trim().toLowerCase();
  const isCitationKey = keyLower === "citationkey" || keyLower === "citekey";
  const isMono = Boolean(fieldDef?.mono || MONO_FIELD_KEYS.has(keyLower));

  for (const strategy of INSPECTOR_FIELD_ACTION_STRATEGIES) {
    if (strategy.matches(keyLower, value, { displayDoi, fieldDef })) {
      return {
        isMono,
        isCitationKey,
        action: strategy.resolve(keyLower, value, { displayDoi, fieldDef }),
      };
    }
  }

  return { isMono, isCitationKey };
}

export function DynamicInspectorField({
  fieldDef,
  val,
  displayDoi,
  copiedKey,
  canEdit = true,
  onSave,
  onCopy,
}: DynamicInspectorFieldProps) {
  const [liveValue, setLiveValue] = useState(val);

  useEffect(() => {
    setLiveValue(val);
  }, [val]);

  const currentVal = liveValue ?? val;
  const descriptor = resolveInspectorFieldAction(fieldDef, currentVal, displayDoi);
  const { isMono, isCitationKey, action } = descriptor;

  return (
    <div className="grid grid-cols-[84px_1fr] gap-2 items-center py-0.5 group">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-muted-foreground text-right font-medium select-none pr-1 text-11 leading-normal whitespace-nowrap truncate">
            {fieldDef.label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="start" sideOffset={6}>
          {fieldDef.label}
        </TooltipContent>
      </Tooltip>
      <div className="flex items-center gap-1 min-w-0 w-full">
        <InlineField
          itemKey={fieldDef.field}
          value={val}
          onChange={setLiveValue}
          ariaLabel={isCitationKey ? "BibTeX Citation Key" : fieldDef.label}
          onSave={onSave}
          mono={isMono}
          readOnly={!canEdit}
          className="flex-1 w-full"
        />

        {action && (
          <div className="invisible group-hover:visible group-focus-within:visible max-md:visible flex items-center gap-0.5 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                {action.type === "external-link" && action.href ? (
                  <a
                    href={action.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="size-6 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer focus-visible:outline-none transition-colors relative before:absolute before:-inset-2 md:before:hidden"
                    aria-label={action.label}
                  >
                    <ExternalLink
                      className="size-3.5 shrink-0"
                      aria-hidden="true"
                      strokeWidth={1.5}
                    />
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      action.copyText && onCopy(action.copyText, action.label)
                    }
                    className="size-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer focus-visible:outline-none transition-colors relative before:absolute before:-inset-2 md:before:hidden"
                    aria-label={action.title}
                  >
                    {copiedKey === action.label ? (
                      <CheckCircle2
                        className="size-3.5 text-primary shrink-0"
                        aria-hidden="true"
                        strokeWidth={1.5}
                      />
                    ) : (
                      <Copy
                        className="size-3.5 shrink-0"
                        aria-hidden="true"
                        strokeWidth={1.5}
                      />
                    )}
                  </button>
                )}
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                align="start"
                sideOffset={6}
                alignOffset={2}
              >
                {action.title}
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  );
}

export default DynamicInspectorField;
