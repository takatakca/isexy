import { useState } from 'react';
import { Globe } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import { languages } from '@/lib/languages';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface LanguageSelectorProps {
  variant?: 'icon' | 'full';
  className?: string;
}

export function LanguageSelector({ variant = 'icon', className = '' }: LanguageSelectorProps) {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);

  const handleSelect = async (lang: typeof languages[0]) => {
    await setLanguage(lang);
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        {variant === 'icon' ? (
          // English and French share the Canadian flag: the language code shows which one is on.
          <Button
            variant="ghost"
            size="icon"
            className={`relative ${className}`}
            aria-label={`Language: ${language.nativeName}. Change language`}
            title={language.nativeName}
          >
            <span className="text-xl leading-none" aria-hidden="true">{language.flag}</span>
            <span
              className="absolute -bottom-0.5 -right-0.5 rounded bg-foreground px-1 text-[9px] font-bold uppercase leading-tight text-background"
              aria-hidden="true"
            >
              {language.code}
            </span>
          </Button>
        ) : (
          <Button variant="outline" className={`gap-2 ${className}`} aria-label={`Language: ${language.nativeName}. Change language`}>
            <span className="text-lg" aria-hidden="true">{language.flag}</span>
            <span>{language.nativeName}</span>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <ScrollArea className="h-80">
          {languages.map((lang) => (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => handleSelect(lang)}
              className={`flex items-center gap-3 cursor-pointer ${
                language.code === lang.code ? 'bg-accent' : ''
              }`}
            >
              <span className="text-xl" aria-hidden="true">{lang.flag}</span>
              <div className="flex flex-col">
                <span className="font-medium" lang={lang.code}>{lang.nativeName}</span>
                <span className="text-xs text-muted-foreground">{lang.name}</span>
              </div>
            </DropdownMenuItem>
          ))}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
