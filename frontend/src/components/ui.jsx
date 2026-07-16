import React from 'react'

export function Button({ as: Tag = 'button', variant = 'primary', size = 'md', className = '', children, ...props }) {
  const variants = {
    primary: 'bg-indigo-600 hover:bg-indigo-500 text-white',
    secondary: 'bg-slate-700 hover:bg-slate-600 text-slate-100',
    danger: 'bg-rose-700 hover:bg-rose-600 text-white',
    ghost: 'bg-transparent hover:bg-slate-800 text-slate-300',
    outline: 'border border-slate-600 hover:border-slate-400 text-slate-200',
  }
  const sizes = { sm: 'px-2.5 py-1 text-xs', md: 'px-3.5 py-2 text-sm', lg: 'px-5 py-2.5 text-base' }
  return (
    <Tag
      className={`rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </Tag>
  )
}

export function Card({ title, right, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-slate-800 bg-slate-900/60 ${className}`}>
      {title && (
        <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold tracking-wide text-slate-200">{title}</h2>
          {right}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  )
}

export function Badge({ children, color = 'slate' }) {
  const map = {
    slate: 'bg-slate-700/60 text-slate-300',
    green: 'bg-emerald-700/40 text-emerald-300',
    amber: 'bg-amber-700/40 text-amber-300',
    red: 'bg-rose-700/40 text-rose-300',
    indigo: 'bg-indigo-700/40 text-indigo-300',
  }
  return <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${map[color]}`}>{children}</span>
}

export function Spinner({ label }) {
  return (
    <div className="flex items-center gap-2 text-slate-400 text-sm">
      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      {label}
    </div>
  )
}

export function Empty({ text }) {
  return <p className="text-slate-500 text-sm italic">{text}</p>
}

export function ErrorBanner({ message }) {
  if (!message) return null
  return (
    <div className="rounded-md border border-rose-800 bg-rose-900/30 px-3 py-2 text-sm text-rose-300">
      {typeof message === 'string' ? message : JSON.stringify(message)}
    </div>
  )
}