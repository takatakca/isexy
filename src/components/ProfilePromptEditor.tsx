import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { 
  PROFILE_PROMPTS, 
  getPromptsByCategory, 
  PromptAnswer, 
  ProfilePrompt,
  getPromptById 
} from "@/lib/profilePrompts";

interface ProfilePromptEditorProps {
  prompts: PromptAnswer[];
  onChange: (prompts: PromptAnswer[]) => void;
  maxPrompts?: number;
}

export function ProfilePromptEditor({ 
  prompts, 
  onChange,
  maxPrompts = 3 
}: ProfilePromptEditorProps) {
  const [isSelectOpen, setIsSelectOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<{
    promptId: string;
    answer: string;
    isNew: boolean;
  } | null>(null);

  const categories = getPromptsByCategory();
  const usedPromptIds = prompts.map(p => p.promptId);

  const handleSelectPrompt = (prompt: ProfilePrompt) => {
    setIsSelectOpen(false);
    setEditingPrompt({
      promptId: prompt.id,
      answer: "",
      isNew: true,
    });
  };

  const handleSaveAnswer = () => {
    if (!editingPrompt || !editingPrompt.answer.trim()) return;

    const newPrompts = editingPrompt.isNew
      ? [...prompts, { promptId: editingPrompt.promptId, answer: editingPrompt.answer }]
      : prompts.map(p => 
          p.promptId === editingPrompt.promptId 
            ? { ...p, answer: editingPrompt.answer }
            : p
        );

    onChange(newPrompts as PromptAnswer[]);
    setEditingPrompt(null);
  };

  const handleDeletePrompt = (promptId: string) => {
    onChange(prompts.filter(p => p.promptId !== promptId));
  };

  const handleEditPrompt = (prompt: PromptAnswer) => {
    setEditingPrompt({
      promptId: prompt.promptId,
      answer: prompt.answer,
      isNew: false,
    });
  };

  return (
    <div className="space-y-3">
      {/* Existing Prompts */}
      {prompts.map((prompt) => {
        const promptData = getPromptById(prompt.promptId as any);
        if (!promptData) return null;

        return (
          <div
            key={prompt.promptId}
            className="bg-card border border-border rounded-xl p-4 relative group"
          >
            <button
              onClick={() => handleDeletePrompt(prompt.promptId)}
              className="absolute top-2 right-2 p-1.5 bg-destructive/10 text-destructive rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => handleEditPrompt(prompt)}
              className="w-full text-left"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{promptData.emoji}</span>
                <span className="font-semibold text-foreground text-sm">
                  {promptData.title}
                </span>
              </div>
              <p className="text-foreground">{prompt.answer}</p>
            </button>
          </div>
        );
      })}

      {/* Add Prompt Button */}
      {prompts.length < maxPrompts && (
        <button
          onClick={() => setIsSelectOpen(true)}
          className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Add a prompt</span>
        </button>
      )}

      {/* Prompt Selection Drawer */}
      <Drawer open={isSelectOpen} onOpenChange={setIsSelectOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="border-b border-border">
            <DrawerTitle>Select a Prompt</DrawerTitle>
          </DrawerHeader>
          
          <div className="overflow-y-auto p-4 space-y-6">
            {Object.entries(categories).map(([category, categoryPrompts]) => (
              <div key={category}>
                <h3 className="font-bold text-foreground mb-3">{category}</h3>
                <div className="space-y-2">
                  {categoryPrompts.map((prompt) => {
                    const isUsed = usedPromptIds.includes(prompt.id);
                    return (
                      <button
                        key={prompt.id}
                        onClick={() => !isUsed && handleSelectPrompt(prompt)}
                        disabled={isUsed}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                          isUsed 
                            ? "bg-muted text-muted-foreground cursor-not-allowed"
                            : "bg-card border border-border hover:border-primary"
                        }`}
                      >
                        <span className="text-xl">{prompt.emoji}</span>
                        <span className="font-medium text-left">{prompt.title}</span>
                        {isUsed && (
                          <span className="ml-auto text-xs text-muted-foreground">Added</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Answer Editor Drawer */}
      <Drawer open={!!editingPrompt} onOpenChange={() => setEditingPrompt(null)}>
        <DrawerContent className="max-h-[85vh]">
          {editingPrompt && (() => {
            const promptData = getPromptById(editingPrompt.promptId as any);
            if (!promptData) return null;

            return (
              <>
                <DrawerHeader className="border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{promptData.emoji}</span>
                    <DrawerTitle className="text-left">{promptData.title}</DrawerTitle>
                  </div>
                </DrawerHeader>
                
                <div className="p-4 space-y-4">
                  <textarea
                    value={editingPrompt.answer}
                    onChange={(e) => setEditingPrompt({
                      ...editingPrompt,
                      answer: e.target.value
                    })}
                    placeholder={promptData.placeholder}
                    maxLength={promptData.maxLength}
                    rows={5}
                    className="w-full bg-card border border-border rounded-xl p-4 text-foreground placeholder:text-muted-foreground outline-none focus:border-primary resize-none"
                    autoFocus
                  />
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {editingPrompt.answer.length}/{promptData.maxLength}
                    </span>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingPrompt(null)}
                        className="px-6 py-2 rounded-full border border-border text-foreground font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveAnswer}
                        disabled={!editingPrompt.answer.trim()}
                        className="px-6 py-2 rounded-full bg-primary text-primary-foreground font-semibold disabled:opacity-50"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
