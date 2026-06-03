'use client';

type Props = {
  sessionId: string;
  insertAfterOrder: number;
  active: boolean;
  onDragOver: (e: React.DragEvent, sessionId: string, insertAfterOrder: number) => void;
  onDrop: (e: React.DragEvent, sessionId: string, insertAfterOrder: number) => void;
};

export function DropZone({ sessionId, insertAfterOrder, active, onDragOver, onDrop }: Props) {
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); onDragOver(e, sessionId, insertAfterOrder); }}
      onDrop={(e) => { e.stopPropagation(); onDrop(e, sessionId, insertAfterOrder); }}
      className={`mx-1 rounded transition-all duration-100 ${active ? 'h-1.5 bg-[var(--color-primary)]' : 'h-0.5 bg-transparent'}`}
    />
  );
}
