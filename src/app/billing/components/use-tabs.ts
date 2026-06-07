'use client';

import { useState, useMemo, useEffect } from 'react';
import type { TabItem } from './types';

export function useTabs(config: any, tabsList: TabItem[], defaultTab?: string) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabsList[0]?.id || '');

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
