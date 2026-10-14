'use client';

import React from 'react';

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
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  variant = 'segmented',
  className = '',
}) => {
  if (variant === 'segmented') {
    return (
      <div className={`flex w-full sm:w-fit max-w-full overflow-x-auto no-scrollbar p-1 bg-bg-secondary rounded-xl border border-border/80 ${className}`}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
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
      <div className={`flex max-w-full overflow-x-auto no-scrollbar sm:flex-wrap gap-2 pb-1 sm:pb-0 ${className}`}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
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
    <div className={`flex max-w-full overflow-x-auto no-scrollbar border-b border-border/80 gap-5 ${className}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
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
