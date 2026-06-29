'use client';

import { useState, useEffect } from 'react';

interface TabItem {
  id: string;
  key: string;
}

export function useTabs(config: any, tabsList: TabItem[], defaultTab?: string) {
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const urlTab = new URLSearchParams(window.location.search).get('tab');
      if (urlTab && tabsList.some(t => t.id === urlTab)) {
        return urlTab;
      }
    }
    return defaultTab || tabsList[0]?.id || '';
  });

  useEffect(() => {
    if (!config) return;
    const currentTabObj = tabsList.find(t => t.id === activeTab);
    if (currentTabObj && config[currentTabObj.key] === false) {
      const firstEnabled = tabsList.find(t => config[t.key] !== false);
      if (firstEnabled) {
        setActiveTab(firstEnabled.id);
      }
    }
  }, [config, activeTab, tabsList]);

  return { activeTab, setActiveTab, tabsList };
}
