import { Brain, X } from "lucide-react";
import ChatAi from "../chatAi";
import Flux from "~/assets/Flux.svg?react";

export default function EmptyState() {
  return (
    <div className="h-full min-h-0 w-full flex flex-col items-center justify-center py-12">
      <div className="flex flex-col items-center justify-center mb-16 w-full max-w-xl px-4">
        <div>
          <Flux className="h-16 w-16 mb-2" />
        </div>
        <div className="max-w-sm w-full p-5 rounded-xl  text-center">
          <h3 className="font-bold text-2xl mb-1">Ask Flux AI</h3>
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
