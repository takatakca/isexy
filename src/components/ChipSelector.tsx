import { ReactNode } from "react";

interface ChipSelectorProps {
  options: string[];
  selected: string | string[];
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  maxSelections?: number;
  icon?: ReactNode;
  title?: string;
}

export function ChipSelector({
  options,
  selected,
  onChange,
  multiple = false,
  maxSelections,
  icon,
  title,
}: ChipSelectorProps) {
  const selectedArray = Array.isArray(selected) ? selected : selected ? [selected] : [];

  const handleSelect = (option: string) => {
    if (multiple) {
      const isSelected = selectedArray.includes(option);
      let newSelection: string[];
      
      if (isSelected) {
        newSelection = selectedArray.filter((s) => s !== option);
      } else {
        if (maxSelections && selectedArray.length >= maxSelections) {
          return;
        }
        newSelection = [...selectedArray, option];
      }
      
      onChange(newSelection);
    } else {
      onChange(selectedArray.includes(option) ? "" : option);
    }
  };

  return (
    <div className="space-y-3">
      {title && (
        <div className="flex items-center gap-2 text-foreground font-semibold">
          {icon}
          <span>{title}</span>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
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
    </div>
  );
}
