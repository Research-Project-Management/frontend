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
import { Pen, Trash } from "lucide-react";

export default function DropMenu({ project }: { project: Project }) {
  const { workspaceId } = useParams();

  return (
    <DropdownMenuContent>
      <DropdownMenuItem asChild className="cursor-pointer">
        <Link to={`/${workspaceId}/projects/${project._id}/settings`}>
          <Pen className="size-4 mr-2" />
          Edit
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem className="cursor-pointer">
        <Trash className="size-4 mr-2" />
        Delete
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}
