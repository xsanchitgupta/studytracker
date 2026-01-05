// Privacy settings context
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface PrivacySettings {
  showReadReceipts: boolean;
  showTypingIndicator: boolean;
  showLastSeen: boolean;
  allowMessageForwarding: boolean;
}

const defaultSettings: PrivacySettings = {
  showReadReceipts: true,
  showTypingIndicator: true,
  showLastSeen: true,
  allowMessageForwarding: true,
};

interface PrivacyContextType {
  settings: PrivacySettings;
  updateSettings: (newSettings: Partial<PrivacySettings>) => Promise<void>;
  loading: boolean;
}

const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined);

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<PrivacySettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setSettings(defaultSettings);
      setLoading(false);
      return;
    }

    const loadSettings = async () => {
      try {
        const docRef = doc(db, 'users', user.uid, 'settings', 'privacy');
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setSettings({ ...defaultSettings, ...docSnap.data() });
        } else {
          setSettings(defaultSettings);
        }
      } catch (error) {
        console.error('Error loading privacy settings:', error);
        setSettings(defaultSettings);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [user?.uid]);

  const updateSettings = async (newSettings: Partial<PrivacySettings>) => {
    if (!user?.uid) return;

    const updated = { ...settings, ...newSettings };
    setSettings(updated);

    try {
      await setDoc(doc(db, 'users', user.uid, 'settings', 'privacy'), updated);
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      throw error;
    }
  };

  return (
    <PrivacyContext.Provider value={{ settings, updateSettings, loading }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  const context = useContext(PrivacyContext);
  if (!context) {
    throw new Error('usePrivacy must be used within PrivacyProvider');
  }
  return context;
}
