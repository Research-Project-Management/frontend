import { Brain } from "lucide-react";
import ChatAi from "../chatAi";
import Flux from "~/assets/Flux.svg?react";

export default function EmptyState() {
  return (
    <div className="h-full min-h-0 w-full flex flex-col items-center justify-center py-12">
      <div className="flex flex-col items-center mb-12 text-center">
        <div className="size-14 rounded-2xl bg-secondary flex items-center justify-center text-primary mb-6">
          <Flux className="size-8" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          How can I help you today?
        </h1>
        <p className="text-muted-foreground mt-2 max-w-md">
          Chat with your project documentation and data.
        </p>
      </div>

      <div className="flex justify-center mb-16 w-full max-w-xl px-4">
        <div className="max-w-sm w-full p-5 rounded-xl border border-primary bg-secondary/50">
          <div className="size-10 rounded-lg flex items-center justify-center mb-4 bg-primary text-white">
            <Brain className="size-5" />
          </div>
          <h3 className="font-bold text-base mb-1">Wiki Mode</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Chat with your project documentation and Flux data.
          </p>
        </div>
      </div>

      <div className="w-full">
        <ChatAi />
      </div>
    </div>
  );
}
