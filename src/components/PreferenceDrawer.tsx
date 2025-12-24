import { X } from "lucide-react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PreferenceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  options: string[];
  selected: string | string[];
  onSelect: (value: string | string[]) => void;
  multiple?: boolean;
}

export function PreferenceDrawer({
  isOpen,
  onClose,
  title,
  options,
  selected,
  onSelect,
  multiple = false,
}: PreferenceDrawerProps) {
  const selectedArray = Array.isArray(selected) ? selected : selected ? [selected] : [];

  const handleSelect = (option: string) => {
    if (multiple) {
      const isSelected = selectedArray.includes(option);
      if (isSelected) {
        onSelect(selectedArray.filter((s) => s !== option));
      } else {
        onSelect([...selectedArray, option]);
      }
    } else {
      onSelect(selectedArray.includes(option) ? "" : option);
    }
  };

  const handleDone = () => {
    onClose();
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="relative">
          <DrawerClose asChild>
            <button className="absolute left-4 top-4 text-muted-foreground hover:text-foreground">
              <X className="w-6 h-6" />
            </button>
          </DrawerClose>
          <DrawerTitle className="text-center text-xl font-bold">{title}</DrawerTitle>
        </DrawerHeader>
        
        <ScrollArea className="flex-1 px-4 max-h-[50vh]">
          <div className="flex flex-wrap gap-2 pb-4">
            {options.map((option) => {
              const isSelected = selectedArray.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleSelect(option)}
                  className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                    isSelected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-foreground hover:border-muted-foreground"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </ScrollArea>

        <DrawerFooter className="pt-4">
          <Button
            onClick={handleDone}
            className="w-full h-14 rounded-full text-lg font-bold bg-gradient-to-r from-primary to-rose-400 hover:opacity-90"
          >
            DONE
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
