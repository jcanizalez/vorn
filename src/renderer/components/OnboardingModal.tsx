import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../stores'
import { ONBOARDING_SECTIONS, ONBOARDING_TOPICS } from '../lib/onboarding-data'
import {
  LayoutGrid,
  Search,
  SlidersHorizontal,
  PanelLeft,
  FolderTree,
  Columns3,
  GitCompareArrows,
  FileDiff,
  Keyboard,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  ArrowRight
} from 'lucide-react'

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number; className?: string; style?: React.CSSProperties }>> = {
  LayoutGrid,
  Search,
  SlidersHorizontal,
  PanelLeft,
  FolderTree,
  Columns3,
  GitCompareArrows,
  FileDiff,
  Keyboard
}

export function OnboardingModal() {
  const [activeTopic, setActiveTopic] = useState('welcome')
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(ONBOARDING_SECTIONS.map((s) => s.key))
  )

  const topic = ONBOARDING_TOPICS.find((t) => t.id === activeTopic) ?? ONBOARDING_TOPICS[0]
  const topicIndex = ONBOARDING_TOPICS.findIndex((t) => t.id === activeTopic)
  const IconComponent = ICON_MAP[topic.icon]

  const close = () => {
    useAppStore.getState().setOnboardingOpen(false)
    const config = useAppStore.getState().config
    if (config) {
      const updated = {
        ...config,
        defaults: { ...config.defaults, hasSeenOnboarding: true }
      }
      useAppStore.getState().setConfig(updated)
      window.api.saveConfig(updated)
    }
  }

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const goTo = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'next'
      ? Math.min(topicIndex + 1, ONBOARDING_TOPICS.length - 1)
      : Math.max(topicIndex - 1, 0)
    setActiveTopic(ONBOARDING_TOPICS[newIndex].id)
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 bg-black/50 z-[60]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={close}
      />

      {/* Dialog */}
      <motion.div
        className="fixed top-[10%] left-1/2 z-[60] w-[720px] max-h-[75vh] border border-white/[0.08]
                   rounded-xl shadow-2xl overflow-hidden flex"
        style={{ background: 'rgba(12, 16, 28, 0.95)' }}
        initial={{ opacity: 0, scale: 0.98, x: '-50%', y: -8 }}
        animate={{ opacity: 1, scale: 1, x: '-50%', y: 0 }}
        exit={{ opacity: 0, scale: 0.98, x: '-50%', y: -8 }}
        transition={{ duration: 0.15 }}
      >
        {/* Left sidebar */}
        <div className="w-52 border-r border-white/[0.06] flex flex-col shrink-0"
             style={{ background: 'rgba(0, 0, 0, 0.15)' }}>
          {/* Sidebar header */}
          <div className="px-4 py-3.5 border-b border-white/[0.06]">
            <span className="text-sm font-medium text-white">Welcome Guide</span>
          </div>

          {/* Topic list */}
          <div className="flex-1 overflow-auto px-2.5 pt-3 pb-2 space-y-0.5">
            {ONBOARDING_SECTIONS.map((section) => {
              const sectionTopics = ONBOARDING_TOPICS.filter((t) => t.section === section.key)
              const isExpanded = expandedSections.has(section.key)

              return (
                <div key={section.key}>
                  <button
                    onClick={() => toggleSection(section.key)}
                    className="w-full flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium
                               text-gray-500 uppercase tracking-wider hover:text-gray-300 transition-colors"
                  >
                    {isExpanded
                      ? <ChevronDown size={11} strokeWidth={2} />
                      : <ChevronRight size={11} strokeWidth={2} />}
                    {section.label}
                  </button>

                  {isExpanded && (
                    <div className="space-y-0.5 mb-1.5">
                      {sectionTopics.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setActiveTopic(t.id)}
                          className={`w-full text-left px-3 py-1.5 rounded-md text-[13px] transition-colors ${
                            activeTopic === t.id
                              ? 'bg-white/[0.08]'
                              : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
                          }`}
                          style={activeTopic === t.id ? { color: '#00FFD4' } : undefined}
                        >
                          {t.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Get Started button */}
          <div className="p-2.5 border-t border-white/[0.06]">
            <button
              onClick={close}
              className="w-full px-3 py-1.5 text-black text-sm font-medium rounded-md transition-colors"
              style={{ background: '#00FFD4' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#00e6be')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#00FFD4')}
            >
              Get Started
            </button>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Content */}
          <div className="flex-1 overflow-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={topic.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.12 }}
                className="px-7 py-8"
              >
                {/* Icon */}
                <div className="flex justify-center mb-6">
                  <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
                       style={{ background: 'rgba(0, 255, 212, 0.04)' }}>
                    {IconComponent && (
                      <IconComponent size={40} strokeWidth={1} style={{ color: 'rgba(0, 255, 212, 0.6)' }} />
                    )}
                  </div>
                </div>

                {/* Title */}
                <h2 className="text-xl font-semibold text-white text-center mb-3">
                  {topic.title}
                </h2>

                {/* Shortcut hint */}
                {topic.shortcutHint && (
                  <div className="flex justify-center mb-3">
                    <kbd className="text-xs text-gray-400 bg-white/[0.06] border border-white/[0.08]
                                    px-2.5 py-1 rounded-md font-mono">
                      {topic.shortcutHint}
                    </kbd>
                  </div>
                )}

                {/* Description */}
                <p className="text-[14px] leading-relaxed text-gray-400 text-center max-w-md mx-auto">
                  {topic.description}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation footer */}
          <div className="px-5 py-3 border-t border-white/[0.06] flex items-center justify-between shrink-0">
            <button
              onClick={() => goTo('prev')}
              disabled={topicIndex === 0}
              className="flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-white
                         disabled:opacity-30 disabled:cursor-default transition-colors"
            >
              <ArrowLeft size={13} strokeWidth={1.5} />
              Previous
            </button>

            <span className="text-[11px] text-gray-600">
              {topicIndex + 1} / {ONBOARDING_TOPICS.length}
            </span>

            {topicIndex < ONBOARDING_TOPICS.length - 1 ? (
              <button
                onClick={() => goTo('next')}
                className="flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-white transition-colors"
              >
                Next
                <ArrowRight size={13} strokeWidth={1.5} />
              </button>
            ) : (
              <button
                onClick={close}
                className="flex items-center gap-1.5 text-[13px] transition-colors"
                style={{ color: '#00FFD4' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#33ffe0')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#00FFD4')}
              >
                Get Started
                <ArrowRight size={13} strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </>
  )
}
