import React from "react";
import { Textarea } from "~/components/ui/textarea";
import useGetUser from "~/hooks/useAuth";
import { useUserStore } from "~/stores/user";
import HomeSection from "../HomeSection";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaperClipIcon, PaperAirplaneIcon } from "@heroicons/react/24/solid";
import { Switch } from "~/components/ui/switch";
import { useProjects } from "~/hooks/useWorkspace";

export default function ChatAi() {
  const { projects, isLoading } = useProjects();
  if (isLoading || !projects || projects.length === 0) {
    return null;
  }

  return (
    <HomeSection title="Ask AI">
      <div className="relative w-full">
        <div className="absolute h-12 px-2 flex items-center top-0">
          <Select defaultValue={projects[0]._id}>
            <SelectTrigger
              size="sm"
              className="min-w-[100px] data-[size=sm]:h-8 p-2 focus-visible:ring-transparent hover:ring-1 ring-primary/10 focus-visible:border-transparent"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project: (typeof projects)[0]) => (
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
        <Textarea
          className="py-14 placeholder:opacity-80 resize-none"
          placeholder="Ask AI to help you with your project..."
        ></Textarea>
        <div className="absolute h-12 bottom-0 flex items-center w-full justify-between px-4">
          <div className="flex h-full gap-2 items-center">
            <Switch />
            <span className="select-none text-sm font-medium">Web Search</span>
          </div>
          <div className="flex gap-3 items-start h-full">
            <button className="size-9">
              <PaperClipIcon className="size-5  " />
            </button>
            <button className="size-9 flex items-center justify-center rounded-sm bg-primary text-white">
              <PaperAirplaneIcon className="size-4  " />
            </button>
          </div>
        </div>
      </div>
    </HomeSection>
  );
}
