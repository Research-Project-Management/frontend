import React from "react";
import { Link, useParams } from "react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { Project } from "~/types/project";
import { Pen, Settings, Trash } from "lucide-react";

export default function DropMenu({ project }: { project: Project }) {
  const { workspaceId } = useParams();

  return (
    <DropdownMenuContent>
      <DropdownMenuLabel>Options</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem className="cursor-pointer">
        <Pen className="size-4 mr-2" />
        Edit
      </DropdownMenuItem>
      <DropdownMenuItem asChild className="cursor-pointer">
        <Link to={`/${workspaceId}/projects/${project._id}/settings`}>
          <Settings className="size-4 mr-2" />
          Settings
        </Link>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        className="cursor-pointer text-destructive focus:text-destructive"
        variant="destructive"
      >
        <Trash className="size-4 mr-2" />
        Delete
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}
