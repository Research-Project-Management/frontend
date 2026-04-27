import React from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Trash2, AlertTriangle } from "lucide-react";

interface DeleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title?: string;
}

export const DeleteModal = ({
  open,
  onOpenChange,
  onConfirm,
  title = "this cycle"
}: DeleteModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden rounded-2xl border-0 shadow-2xl bg-white">
        <div className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="size-12 rounded-full bg-red-50 flex items-center justify-center shrink-0">
              <AlertTriangle className="size-6 text-red-500" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#172b4d]">Delete Cycle?</h3>
              <p className="text-sm text-[#44546f]">
                Are you sure you want to delete <span className="font-semibold">{title}</span>? This action cannot be undone.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 bg-gray-50/50 flex items-center justify-end gap-2 border-t border-gray-100">
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)} 
            className="h-9 px-4 text-[#44546f] hover:bg-black/5 transition-colors font-medium"
          >
            Cancel
          </Button>
          <Button 
            onClick={() => { onConfirm(); onOpenChange(false); }} 
            className="h-9 bg-[#c9372c] px-5 text-white hover:bg-[#ae2e24] shadow-none font-medium transition-all active:scale-95"
          >
            <Trash2 className="size-3.5 mr-2" />
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
