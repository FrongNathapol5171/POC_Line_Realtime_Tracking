'use client'

import {
  DndContext, closestCenter, PointerSensor,
  useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Clinic } from '@/lib/types'
import { GripVertical, Lock, MapPin } from 'lucide-react'

const P = '#22394d'

interface Props {
  clinicIds: string[]
  clinicMap: Record<string, Clinic>
  onChange: (ordered: string[]) => void
}

function SortableItem({ id, index, name, detail }: { id: string; index: number; name: string; detail: string }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={{ ...style }}
      className="flex items-center gap-3 p-4 bg-white rounded-2xl mb-2.5 border border-gray-100 cursor-grab active:cursor-grabbing active:shadow-md transition-all"
      {...attributes}
      {...listeners}
    >
      <span
        className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
        style={{ background: `linear-gradient(135deg,#2c4d67,${P})` }}
      >
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-base text-gray-800 leading-tight">{name}</p>
        {detail && (
          <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1">
            <MapPin size={10} /> {detail}
          </p>
        )}
      </div>
      <GripVertical size={18} className="text-gray-300 flex-shrink-0" />
    </div>
  )
}

export default function SequenceList({ clinicIds, clinicMap, onChange }: Props) {
  const sensors = useSensors(useSensor(PointerSensor))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id)
      onChange(arrayMove(clinicIds, clinicIds.indexOf(active.id as string), clinicIds.indexOf(over.id as string)))
  }

  if (clinicIds.length === 0) return null

  return (
    <div>
      <p className="text-sm text-gray-400 mb-3 font-medium uppercase tracking-wide">Drag to reorder</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={clinicIds} strategy={verticalListSortingStrategy}>
          {clinicIds.map((id, i) => (
            <SortableItem key={id} id={id} index={i} name={clinicMap[id]?.name ?? id} detail={clinicMap[id]?.detail ?? ''} />
          ))}
        </SortableContext>
      </DndContext>

      {/* Billing locked */}
      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200 cursor-not-allowed opacity-60">
        <span className="w-8 h-8 rounded-xl bg-gray-300 flex items-center justify-center font-bold text-white text-sm flex-shrink-0">
          {clinicIds.length + 1}
        </span>
        <div className="flex-1">
          <p className="font-semibold text-base text-gray-500">Cashier / Billing</p>
          <p className="text-sm text-gray-400">Always last (mandatory)</p>
        </div>
        <Lock size={14} className="text-gray-400" />
      </div>
    </div>
  )
}
