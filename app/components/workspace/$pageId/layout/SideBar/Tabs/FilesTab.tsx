import {
  Ellipsis,
  File,
  FilePlus,
  Folder,
  FolderPlus,
  Image,
  Plus,
  Upload,
} from "lucide-react";
import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { DocumentTextIcon, PhotoIcon } from "@heroicons/react/24/outline";
import { FolderIcon } from "@heroicons/react/24/solid";
const tools = [
  { icon: FilePlus, label: "New File" },
  { icon: FolderPlus, label: "New Folder" },
  { icon: Upload, label: "Upload File" },
];

const fileIcons: { [key: string]: React.ElementType } = {
  document: DocumentTextIcon,
  image: PhotoIcon,
  folder: FolderIcon,
  // Add more mappings for different file types if needed
};
const files = [
  {
    type: "document",
    name: "Document1.txt",
  },
  {
    type: "image",
    name: "Image1.png",
  },
  {
    type: "folder",
    name: "Projects",
  },
];
export default function FilesTab() {
  return (
    <div className="w-full h-full">
      <div className="flex w-full text-primary justify-between items-center px-3 py-3">
        <span className="font-semibold">Files</span>
        <ul className="flex gap-1">
          {tools.map((tool) => (
            <Tooltip key={tool.label}>
              <TooltipTrigger>
                <li
                  key={tool.label}
                  className="p-1 hover:bg-primary/10 rounded cursor-pointer"
                >
                  <tool.icon className="size-4" />
                </li>
              </TooltipTrigger>
              <TooltipContent side="bottom">{tool.label}</TooltipContent>
            </Tooltip>
          ))}
        </ul>
      </div>
      <div>
        <ul className="flex flex-col gap-1 px-1">
          {files.map((file) => {
            const Icon = fileIcons[file.type] || File;
            return (
              <li
                key={file.name}
                className="py-1 px-2 group flex justify-between items-center hover:bg-primary/10 rounded cursor-pointer text-sm text-primary"
              >
                <div className="flex items-center ">
                  <Icon className="size-4 inline-block mr-2" />
                  {file.name}
                </div>
                <div>
                  <Ellipsis className="size-4 ml-auto  group-hover:opacity-100 opacity-0" />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
