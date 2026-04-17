import React, { useState } from 'react';
import { useLanguage } from '../LanguageContext';
import { GlobeIcon } from './icons/GlobeIcon';
import { BrazilFlagIcon } from './icons/BrazilFlagIcon';
import { UsaFlagIcon } from './icons/UsaFlagIcon';
import { Locale } from '../locales';

interface LanguageSwitcherProps {
  fixed?: boolean;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ fixed = true }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { locale, setLocale } = useLanguage();

  const handleSetLocale = (newLocale: Locale) => {
    setLocale(newLocale);
    setIsOpen(false);
  };

  const languages: { code: Locale; Icon: React.FC<React.SVGProps<SVGSVGElement>> }[] = [
    { code: 'pt-BR', Icon: BrazilFlagIcon },
    { code: 'en-US', Icon: UsaFlagIcon },
  ];

  return (
    <div className={fixed ? 'fixed bottom-24 right-5 z-50' : 'relative'}>
      <div className={`relative flex ${fixed ? 'flex-col items-center' : 'items-center gap-3'}`}>
        {isOpen && (
          <div className={`${fixed ? 'mb-3 flex flex-col items-center' : 'absolute right-0 top-14 flex'} gap-3 rounded-full border border-white/10 bg-slate-800/95 p-3 shadow-xl backdrop-blur`}>
            {languages.filter(language => language.code !== locale).map(({ code, Icon }) => (
              <button key={code} onClick={() => handleSetLocale(code)} className="h-10 w-10 overflow-hidden rounded-full transition-transform hover:scale-110" aria-label={`Switch to ${code}`}>
                <Icon className="h-full w-full" />
              </button>
            ))}
          </div>
        )}
        <button onClick={() => setIsOpen(value => !value)} className="rounded-full border border-white/10 bg-slate-800/90 p-3 text-slate-100 shadow-lg transition-transform hover:scale-105" aria-label="Change language">
          {isOpen ? <GlobeIcon className="h-6 w-6 animate-pulse" /> : <GlobeIcon className="h-6 w-6" />}
        </button>
      </div>
    </div>
  );
};

export default LanguageSwitcher;
