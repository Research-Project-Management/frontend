import { useState } from "react";
import { Filter, ArrowDownUp, Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import NewSectionModal from "./modals/SectionModal";
import FilterModal from "./modals/FilterModal/index";
import type { CreateSection } from "./modals/SectionModal";

type TopBarProps = {
  onCreateSection: (payload: CreateSection) => void;
};

type ActiveModal = "section" | "filter" | null;

export default function TopBar({ onCreateSection }: TopBarProps) {
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const closeModal = () => setActiveModal(null);
  const openModal = (modal: ActiveModal) => {
    setActiveModal(modal);
  };

  return (
    <>
      <header className="shrink-0 border-b bg-white">
        <div className="flex items-center p-2 gap-2">
          <h1 className="font-semibold text-primary">Task</h1>

          <div className="ml-auto flex items-center gap-2">
            <Input placeholder="Search..." className="w-64" />

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openModal("filter")}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>

            <Button type="button" variant="outline" size="sm">
              <ArrowDownUp className="h-4 w-4 mr-2" />
              Sort
            </Button>

            <Button type="button" onClick={() => openModal("section")}>
              <Plus className="h-4 w-4 mr-2" />
              New Section
            </Button>
          </div>
        </div>
      </header>

      <NewSectionModal
        isOpen={activeModal === "section"}
        onClose={closeModal}
        onCreate={onCreateSection}
        onSubmit={(payload) => {
          onCreateSection(payload);
          closeModal();
        }}
      />

      <FilterModal
        isOpen={activeModal === "filter"}
        onClose={closeModal}
        onApply={closeModal}
      />
    </>
  );
}
