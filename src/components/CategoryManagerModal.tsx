import React, { useState } from 'react';
import { ConsumptionGroup } from '../types';
import { StorageService } from '../services/storage';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoriesUpdated: () => void;
}

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  onCategoriesUpdated,
}) => {
  const [groups, setGroups] = useState<ConsumptionGroup[]>(() => StorageService.getGroups());
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#006a61');
  const [icon, setIcon] = useState('category');
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartEdit = (group: ConsumptionGroup) => {
    setEditingGroupId(group.id);
    setName(group.name);
    setDescription(group.description || '');
    setColor(group.color || '#006a61');
    setIcon(group.icon || 'category');
  };

  const handleCancelEdit = () => {
    setEditingGroupId(null);
    setName('');
    setDescription('');
    setColor('#006a61');
    setIcon('category');
  };

  const handleSaveGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingGroupId) {
      const existing = groups.find((g) => g.id === editingGroupId);
      if (existing) {
        const updated: ConsumptionGroup = {
          ...existing,
          name: name.trim(),
          description: description.trim(),
          color,
          icon,
        };
        StorageService.saveGroup(updated);
        setFeedback(`Categoria "${updated.name}" atualizada com sucesso!`);
      }
    } else {
      const newGroup: ConsumptionGroup = {
        id: `grp-custom-${Date.now()}`,
        name: name.trim(),
        description: description.trim(),
        color,
        icon,
        isCustom: true,
      };
      StorageService.saveGroup(newGroup);
      setFeedback(`Nova categoria "${newGroup.name}" criada com sucesso!`);
    }

    setGroups(StorageService.getGroups());
    handleCancelEdit();
    onCategoriesUpdated();
  };

  const handleDeleteGroup = (groupId: string) => {
    const res = StorageService.deleteGroup(groupId);
    setGroups(StorageService.getGroups());
    setFeedback(res.message);
    onCategoriesUpdated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="bg-[#ffffff] rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-[#eff4ff] flex flex-col gap-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-[#eff4ff]">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[24px] text-[#006a61]">category</span>
            <div>
              <h3 className="text-base font-bold text-[#0b1c30]">Gerenciador de Grupos e Categorias</h3>
              <p className="text-xs text-[#76777d]">Crie, renomeie ou personalize categorias de consumo para a cesta</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#76777d] hover:bg-[#eff4ff] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {feedback && (
          <div className="p-3 bg-[#86f2e4]/20 border border-[#006a61]/30 rounded-xl text-xs font-mono text-[#005049] flex items-center justify-between">
            <span>{feedback}</span>
            <button onClick={() => setFeedback(null)} className="text-[#005049] hover:text-black">
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        )}

        {/* Form: Add or Edit */}
        <form onSubmit={handleSaveGroup} className="bg-[#eff4ff] rounded-xl p-4 flex flex-col gap-3 border border-[#e5eeff]">
          <span className="font-mono text-xs text-[#45464d] uppercase font-semibold">
            {editingGroupId ? 'Editar Categoria' : 'Adicionar Nova Categoria Personalizada'}
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#45464d] font-medium">Nome da Categoria *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Cuidados com Pets, Streaming & Lazer..."
                className="h-9 px-3 bg-[#ffffff] rounded-lg border border-[#c6c6cd] text-xs focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#45464d] font-medium">Cor de Identificação</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-9 h-9 rounded-lg border border-[#c6c6cd] cursor-pointer p-0.5 bg-white"
                />
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-9 px-3 flex-1 bg-[#ffffff] rounded-lg border border-[#c6c6cd] text-xs font-mono"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#45464d] font-medium">Descrição</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descrição dos tipos de produtos e despesas inclusos..."
              className="h-9 px-3 bg-[#ffffff] rounded-lg border border-[#c6c6cd] text-xs focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            {editingGroupId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="h-8 px-3 rounded-lg text-xs font-mono text-[#76777d] hover:bg-[#ffffff] cursor-pointer"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              className="h-8 px-4 rounded-lg bg-[#000000] hover:bg-[#213145] text-white text-xs font-mono font-semibold transition-all cursor-pointer"
            >
              {editingGroupId ? 'Salvar Alteração' : 'Criar Categoria'}
            </button>
          </div>
        </form>

        {/* Existing Categories List */}
        <div className="flex flex-col gap-2">
          <span className="font-mono text-xs text-[#45464d] uppercase font-semibold">
            Categorias Cadastradas ({groups.length})
          </span>
          <div className="divide-y divide-[#eff4ff] border border-[#eff4ff] rounded-xl overflow-hidden max-h-64 overflow-y-auto">
            {groups.map((grp) => (
              <div key={grp.id} className="p-3 flex items-center justify-between hover:bg-[#eff4ff]/40 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: grp.color || '#565e74' }} />
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-[#0b1c30]">
                      {grp.name} {grp.isCustom && <span className="font-mono text-[10px] text-[#006a61] bg-[#86f2e4]/30 px-1.5 py-0.2 rounded font-normal">Personalizada</span>}
                    </span>
                    <span className="text-[11px] text-[#76777d] truncate max-w-sm">{grp.description}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(grp)}
                    className="w-7 h-7 rounded flex items-center justify-center text-[#76777d] hover:bg-[#eff4ff] hover:text-[#0b1c30] cursor-pointer"
                    title="Editar nome ou descrição"
                  >
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                  </button>
                  {grp.isCustom && (
                    <button
                      type="button"
                      onClick={() => handleDeleteGroup(grp.id)}
                      className="w-7 h-7 rounded flex items-center justify-center text-[#ba1a1a] hover:bg-[#ffdad6] cursor-pointer"
                      title="Excluir categoria"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-[#eff4ff]">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-5 rounded-lg bg-[#eff4ff] hover:bg-[#e5eeff] text-[#0b1c30] text-xs font-mono font-semibold cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
