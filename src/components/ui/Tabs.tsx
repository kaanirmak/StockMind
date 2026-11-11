'use client';

import React, { useRef } from 'react';
import { getNextRovingTabIndex } from '@/lib/accessibility/keyboard';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'underline' | 'pills' | 'segmented';
  ariaLabel?: string;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  variant = 'segmented',
  ariaLabel = 'Bölüm sekmeleri',
  className = '',
}) => {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleTabKeyDown = (index: number, event: React.KeyboardEvent<HTMLButtonElement>) => {
    const nextIndex = getNextRovingTabIndex(index, event.key, tabs.length);
    if (nextIndex === null) return;
    event.preventDefault();
    const targetTab = tabs[nextIndex];
    if (targetTab) {
      onChange(targetTab.id);
      tabRefs.current[nextIndex]?.focus();
    }
  };

  if (variant === 'segmented') {
    return (
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={`flex w-full sm:w-fit max-w-full overflow-x-auto no-scrollbar p-1 bg-bg-secondary rounded-xl border border-border/80 ${className}`}
      >
        {tabs.map((tab, index) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(el) => { tabRefs.current[index] = el; }}
              type="button"
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={(e) => handleTabKeyDown(index, e)}
              className={`flex shrink-0 items-center justify-center gap-2 px-3.5 py-2 min-h-10 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-accent text-white shadow-md shadow-accent/20'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover/60'
              }`}
            >
              {tab.icon && <span className="w-3.5 h-3.5">{tab.icon}</span>}
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-white/20 text-white' : 'bg-bg-tertiary text-text-muted'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  if (variant === 'pills') {
    return (
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={`flex max-w-full overflow-x-auto no-scrollbar sm:flex-wrap gap-2 pb-1 sm:pb-0 ${className}`}
      >
        {tabs.map((tab, index) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(el) => { tabRefs.current[index] = el; }}
              type="button"
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={(e) => handleTabKeyDown(index, e)}
              className={`flex shrink-0 items-center gap-2 px-4 py-2 min-h-10 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer border ${
                isActive
                  ? 'bg-accent/15 border-accent text-accent shadow-sm'
                  : 'bg-bg-card border-border text-text-secondary hover:text-text-primary hover:border-border-hover'
              }`}
            >
              {tab.icon && <span>{tab.icon}</span>}
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-accent/30 text-accent' : 'bg-bg-tertiary text-text-muted'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // Underline variant
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`flex max-w-full overflow-x-auto no-scrollbar border-b border-border/80 gap-5 ${className}`}
    >
      {tabs.map((tab, index) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            ref={(el) => { tabRefs.current[index] = el; }}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => handleTabKeyDown(index, e)}
            className={`flex shrink-0 items-center gap-2 px-1 pb-3 text-sm font-medium whitespace-nowrap transition-all relative cursor-pointer ${
              isActive
                ? 'text-accent font-semibold'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.icon && <span>{tab.icon}</span>}
            <span>{tab.label}</span>
            {typeof tab.count === 'number' && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-bg-tertiary text-text-muted">
                {tab.count}
              </span>
            )}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full animate-fade-in" />
            )}
          </button>
        );
      })}
    </div>
  );
};
