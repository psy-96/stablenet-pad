'use client'

import type { TemplateDefinition } from '@/lib/template-registry'

interface Props {
  templates: TemplateDefinition[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export default function TemplateCatalog({ templates, selectedId, onSelect }: Props) {
  return (
    <div className="grid grid-cols-1 gap-2">
      {templates.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          className={`
            text-left p-3 rounded-lg border transition-colors
            ${selectedId === t.id
              ? 'border-blue-500 bg-blue-900/20 text-white'
              : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-600'}
          `}
        >
          <p className="text-sm font-medium">{t.label}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {t.params.map((p) => p.label).join(' · ')}
          </p>
        </button>
      ))}
    </div>
  )
}
