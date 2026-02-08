import React from "react";
import { useParams } from "react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import Menu from "./Menu";
import Flux from "@/assets/Flux.svg?react";
import { History, Layout, Users } from "lucide-react";
export default function ToolBar() {
  const { pageId } = useParams<{ pageId: string }>();
  return (
    <nav className="flex justify-between items-center px-2 py-1 border-b border-secondary">
      <div className="flex gap-2 items-center">
        <Flux className="size-7" />
        <Menu />
      </div>
      <div className="flex gap-4 items-center">
        <div>
          <Layout
            strokeWidth={1.5}
            className="size-7 p-1  hover:bg-primary/5 rounded"
          />
        </div>
        <Button
          size={"sm"}
          className="bg-transparent px-3 hover:bg-transparent rounded-full hover:ring-1 ring-0 ring-primary/80 text-primary"
        >
          <Users className="mr-.5" />
          Share
        </Button>
        <Button className="" size={"sm"}>
          <History className="mr-.5" />
          Version
        </Button>
      </div>
    </nav>
  );
}
