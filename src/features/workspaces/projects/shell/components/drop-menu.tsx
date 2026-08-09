'use client';

import { useParams } from 'next/navigation';

import React from "react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/shared/components/ui";
import type { Project } from "@/features/workspaces/types/project.types";
import { Pen, Trash } from "lucide-react";

export default function DropMenu({ project }: { project: Project }) {
  const { workspaceId } = useParams();

  return (
    <DropdownMenuContent>
      <DropdownMenuItem asChild className="cursor-pointer">
        <Link href={`/${workspaceId}/projects/${project._id}/settings`}>
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
