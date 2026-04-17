import React, { useState } from 'react';
import { useLanguage } from '../LanguageContext';
import { CustomCategory } from '../types';
import { TrashIcon } from './icons/TrashIcon';

interface ManageCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  customCategories: CustomCategory[];
  onAddCategory: (category: Omit<CustomCategory, 'id' | 'key'>) => void;
  onDeleteCategory: (id: string) => void;
}

const generateRandomColor = () => {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let index = 0; index < 6; index += 1) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
};

const ManageCategoriesModal: React.FC<ManageCategoriesModalProps> = ({
  isOpen,
  onClose,
  customCategories,
  onAddCategory,
  onDeleteCategory,
}) => {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [color, setColor] = useState(generateRandomColor());

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }
    onAddCategory({ name: name.trim(), color });
    setName('');
    setColor(generateRandomColor());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-slate-800 p-8 text-slate-100 shadow-2xl">
        <h2 className="mb-6 text-2xl font-bold text-slate-50">{t('categories_table_title')}</h2>

        <form onSubmit={handleSubmit} className="mb-6 flex items-end gap-3">
          <div className="flex-1">
            <label htmlFor="category-name" className="mb-2 block text-sm font-medium text-slate-300">{t('category_name')}</label>
            <input
              id="category-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="input-base"
              placeholder={t('category_name_placeholder')}
              required
            />
          </div>
          <div>
            <label htmlFor="category-color" className="mb-2 block text-center text-sm font-medium text-slate-300">{t('color')}</label>
            <input
              id="category-color"
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              className="mt-1 block h-11 w-14 cursor-pointer rounded-2xl border border-white/10 bg-slate-900 p-1"
            />
          </div>
          <button type="submit" className="button-primary h-11">{t('add_category')}</button>
        </form>

        <div className="max-h-64 space-y-2 overflow-y-auto pr-2">
          {customCategories.length > 0 ? (
            customCategories.map(category => (
              <div key={category.id} className="group flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/60 p-3">
                <div className="flex items-center gap-3">
                  <span className="h-4 w-4 rounded-full" style={{ backgroundColor: category.color }} />
                  <span className="text-slate-100">{category.name}</span>
                </div>
                <button
                  onClick={() => onDeleteCategory(category.id)}
                  className="p-1 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-rose-400"
                  aria-label={`${t('delete')} ${category.name}`}
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </div>
            ))
          ) : (
            <p className="py-4 text-center text-slate-400">{t('no_custom_categories')}</p>
          )}
        </div>

        <div className="flex justify-end pt-6">
          <button type="button" onClick={onClose} className="button-secondary">{t('close')}</button>
        </div>
      </div>
    </div>
  );
};

export default ManageCategoriesModal;
