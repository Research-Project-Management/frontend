import React from "react";

export default function ModelSettings() {
  return (
    <div className="p-8 max-w-2xl">
      <h2 className="text-xl font-bold mb-4">Model Settings</h2>
      <p className="text-muted-foreground mb-6">
        Configure the AI models and parameters for this project.
      </p>
      
      <div className="space-y-6">
        <div className="grid gap-2">
          <label className="text-sm font-medium">Primary Model</label>
          <div className="p-3 rounded-lg border border-border bg-muted/50 text-sm">
            Gemini Pro (Default)
          </div>
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium">Temperature</label>
          <div className="p-3 rounded-lg border border-border bg-muted/50 text-sm">
            0.7
          </div>
        </div>

        <div className="pt-4">
          <button disabled className="bg-primary text-primary-foreground px-4 py-2 rounded-sm text-sm font-medium opacity-50">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
