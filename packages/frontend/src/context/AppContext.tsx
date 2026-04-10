import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { AppConfig, Merchant } from '../types';
import { merchantApi } from '../services/merchantApi';

interface AppContextValue {
  config: AppConfig | null;
  refreshConfig: () => Promise<void>;
  merchants: Merchant[];
  currentMerchant: Merchant | null;
  setCurrentMerchant: (merchant: Merchant | null) => void;
  refreshMerchants: () => Promise<void>;
}

const AppContext = createContext<AppContextValue>({
  config: null,
  refreshConfig: async () => {},
  merchants: [],
  currentMerchant: null,
  setCurrentMerchant: () => {},
  refreshMerchants: async () => {},
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [currentMerchant, setCurrentMerchant] = useState<Merchant | null>(null);

  const refreshConfig = async () => {
    try {
      const res = await merchantApi.getConfig();
      setConfig(res.data);
    } catch (err) {
      console.error('Failed to load config:', err);
    }
  };

  const refreshMerchants = async () => {
    try {
      const res = await merchantApi.list();
      const freshMerchants = res.data.data;
      setMerchants(freshMerchants);
      // Sync currentMerchant with latest data from server
      if (currentMerchant) {
        const updated = freshMerchants.find(m => m.id === currentMerchant.id);
        if (updated) {
          setCurrentMerchant(updated);
        }
      }
    } catch (err) {
      console.error('Failed to load merchants:', err);
    }
  };

  useEffect(() => {
    refreshConfig();
    refreshMerchants();
  }, []);

  // Auto-select first merchant when merchants load and none is selected
  useEffect(() => {
    if (merchants.length > 0 && !currentMerchant) {
      setCurrentMerchant(merchants[0]);
    }
    // If current merchant was removed from list, select first available
    if (merchants.length > 0 && currentMerchant && !merchants.find(m => m.id === currentMerchant.id)) {
      setCurrentMerchant(merchants[0]);
    }
  }, [merchants]);

  return (
    <AppContext.Provider value={{ config, refreshConfig, merchants, currentMerchant, setCurrentMerchant, refreshMerchants }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}
