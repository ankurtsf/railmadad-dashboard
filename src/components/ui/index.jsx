import React from 'react'
import { Loader2 } from 'lucide-react'

// ── Stat Card ──────────────────────────────────────────────
export function StatCard({ title, value, subtitle, icon: Icon, color = 'blue', trend }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    red: 'bg-red-50 text-red-600 border-red-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    teal: 'bg-teal-50 text-teal-600 border-teal-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg border ${colors[color]}`}>
          {Icon && <Icon className="w-4 h-4" />}
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-1">{title}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  )
}

// ── Page Header ────────────────────────────────────────────
export function PageHeader({ title, subtitle, actions, banner, bannerColor = 'blue' }) {
  const bannerColors = {
    blue: 'bg-blue-700',
    green: 'bg-green-700',
    purple: 'bg-purple-700',
    indigo: 'bg-indigo-700',
  }

  return (
    <div className={`${bannerColors[bannerColor]} rounded-xl p-5 mb-6 text-white`}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{title}</h1>
          {subtitle && <p className="text-sm opacity-80 mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {banner && <div className="mt-3">{banner}</div>}
    </div>
  )
}

// ── Badge ──────────────────────────────────────────────────
export function Badge({ label, color = 'gray' }) {
  const colors = {
    gray: 'bg-gray-100 text-gray-700',
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    amber: 'bg-amber-100 text-amber-700',
    purple: 'bg-purple-100 text-purple-700',
    indigo: 'bg-indigo-100 text-indigo-700',
    teal: 'bg-teal-100 text-teal-700',
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[color]}`}>
      {label}
    </span>
  )
}

// ── Status Badge ───────────────────────────────────────────
export function StatusBadge({ status }) {
  const map = {
    'Open': { color: 'amber', label: '⚠ Open' },
    'Closed': { color: 'green', label: '✓ Closed' },
    'Pending': { color: 'blue', label: '● Pending' },
    'Forwarded': { color: 'purple', label: '→ Forwarded' },
  }
  const config = map[status] || { color: 'gray', label: status }
  return <Badge label={config.label} color={config.color} />
}

// ── Mode Badge ─────────────────────────────────────────────
export function ModeBadge({ mode }) {
  const map = {
    'T': { color: 'blue', label: 'Train' },
    'H': { color: 'green', label: 'Helpline' },
    'A': { color: 'purple', label: 'App' },
    'R': { color: 'indigo', label: 'Railmadad App' },
    'S': { color: 'teal', label: 'Social Media' },
  }
  const config = map[mode] || { color: 'gray', label: mode }
  return <Badge label={config.label} color={config.color} />
}

// ── Loading Spinner ────────────────────────────────────────
export function LoadingSpinner({ text = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-sm text-gray-500">{text}</p>
      </div>
    </div>
  )
}

// ── Empty State ────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && (
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-gray-400" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-800 mb-1">{title}</h3>
      {subtitle && <p className="text-sm text-gray-500 mb-4 max-w-sm">{subtitle}</p>}
      {action}
    </div>
  )
}

// ── Table ──────────────────────────────────────────────────
export function Table({ headers, children, className = '' }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="min-w-full border-collapse">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {children}
        </tbody>
      </table>
    </div>
  )
}

// ── Button ─────────────────────────────────────────────────
export function Button({ children, onClick, variant = 'primary', size = 'md', disabled, className = '', icon: Icon, type = 'button' }) {
  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white border-transparent',
    secondary: 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300',
    danger: 'bg-red-600 hover:bg-red-700 text-white border-transparent',
    success: 'bg-green-600 hover:bg-green-700 text-white border-transparent',
    ghost: 'bg-transparent hover:bg-gray-100 text-gray-600 border-transparent',
  }
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 font-medium border rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  )
}

// ── Input ──────────────────────────────────────────────────
export function Input({ label, error, className = '', ...props }) {
  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <input
        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          ${error ? 'border-red-300' : 'border-gray-300'}`}
        {...props}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

// ── Select ─────────────────────────────────────────────────
export function Select({ label, error, options = [], className = '', ...props }) {
  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <select
        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white
          ${error ? 'border-red-300' : 'border-gray-300'}`}
        {...props}
      >
        {options.map((opt, i) => (
          <option key={i} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

// ── Card ───────────────────────────────────────────────────
export function Card({ children, className = '', title, actions }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          {title && <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

// ── Modal ──────────────────────────────────────────────────
export function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  if (!isOpen) return null

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-6xl',
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`bg-white rounded-2xl shadow-xl w-full ${sizes[size]} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Filter Bar ─────────────────────────────────────────────
export function FilterBar({ children, onClear }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          Filters & Search
        </div>
        {onClear && (
          <button onClick={onClear} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
            Clear All
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {children}
      </div>
    </div>
  )
}

// ── Tab Bar ────────────────────────────────────────────────
export function TabBar({ tabs, activeTab, onChange }) {
  return (
    <div className="flex gap-1 border-b border-gray-200 mb-4 overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
            ${activeTab === tab.id
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
        >
          {tab.icon && <tab.icon className="w-3.5 h-3.5 inline mr-1.5" />}
          {tab.label}
        </button>
      ))}
    </div>
  )
}

// ── Toast ──────────────────────────────────────────────────
export function Toast({ message, type = 'success', onClose }) {
  if (!message) return null
  const colors = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600',
    warning: 'bg-amber-600',
  }
  return (
    <div className={`fixed bottom-6 right-6 ${colors[type]} text-white px-5 py-3 rounded-xl shadow-lg z-50 flex items-center gap-3 max-w-sm`}>
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="text-white/80 hover:text-white">×</button>
    </div>
  )
}
