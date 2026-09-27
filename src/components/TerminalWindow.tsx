import type { ReactNode } from 'react'

export function TerminalWindow({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-[0_0_40px_-12px_rgba(0,255,162,0.25)]">
      <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-3 py-2">
        <span className="h-3 w-3 rounded-full bg-[#ff5f56]" />
        <span className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
        <span className="h-3 w-3 rounded-full bg-[#27c93f]" />
        <span className="ml-2 truncate text-xs text-muted">{title}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}
