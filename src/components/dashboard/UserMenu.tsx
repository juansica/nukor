'use client'

import { useState, useRef, useEffect } from 'react'
import { LogOut, ChevronDown, Settings } from 'lucide-react'
import Link from 'next/link'
import SignOutButton from '@/components/auth/SignOutButton'

interface UserMenuProps {
  userName: string
  userEmail: string
}

export default function UserMenu({ userName, userEmail }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const initials = userName.slice(0, 2).toUpperCase()

  const handleOpen = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPos({
        top: rect.bottom + 6,
        right: window.innerWidth - rect.right,
      })
    }
    setOpen(o => !o)
  }

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 flex-shrink-0">
          {initials}
        </div>
        <span className="hidden sm:block text-sm font-medium text-gray-700 max-w-[120px] truncate">{userName}</span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform hidden sm:block ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          ref={dropdownRef}
          style={{ top: dropdownPos.top, right: dropdownPos.right }}
          className="fixed w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-[200] overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-950 truncate">{userName}</p>
            <p className="text-xs text-gray-400 truncate mt-0.5">{userEmail}</p>
          </div>
          <div className="p-1">
            <Link
              href="/dashboard/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Settings size={14} className="text-gray-400 flex-shrink-0" />
              Configuración
            </Link>
            <div className="flex items-center gap-2.5 px-3 rounded-lg hover:bg-red-50 transition-colors">
              <LogOut size={14} className="text-red-500 flex-shrink-0" />
              <SignOutButton className="py-2 text-sm font-medium text-red-600 transition-colors text-left flex-1" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
