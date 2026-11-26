import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { RadarJob } from '@healthcare-system/shared';
import {
  declineRadar,
  getOnlineStatus,
  setOnline as apiSetOnline,
} from './radar.api';
import {
  initPushNotifications,
  setChatNavigationHandler,
  setForegroundRadarListener,
  setNavigationHandler,
  setNotificationRouteHandler,
  type RadarPushPayload,
} from '../../lib/push';
import { navigationRef } from '../../navigation/RootNavigator';

interface RadarContextType {
  isOnline: boolean;
  toggleOnline: () => Promise<boolean>;
  setOnlineStatus: (status: boolean) => Promise<void>;
  activeRadarOffer: RadarJob | null;
  triggerRadarOffer: (offer: RadarJob, notificationId?: string) => void;
  dismissRadarOffer: (offerId: string) => Promise<void>;
}

const RadarContext = createContext<RadarContextType | null>(null);

export const RadarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [activeRadarOffer, setActiveRadarOffer] = useState<RadarJob | null>(null);

  // Initialize online state from storage/API
  useEffect(() => {
    let isMounted = true;
    void (async () => {
      try {
        const status = await getOnlineStatus();
        if (isMounted) {
          setIsOnline(status);
        }
      } catch {
        // Fallback default true
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const triggerRadarOffer = useCallback(
    (offer: RadarJob, notificationId?: string) => {
      if (!isOnline) {
        // Do not display if nurse is offline
        return;
      }

      setActiveRadarOffer(offer);

      // Navigate to Radar screen if navigation container is ready
      if (navigationRef.isReady()) {
        (navigationRef as any).navigate('Radar', {
          offerId: offer.id,
          offer,
          notificationId,
        });
      }
    },
    [isOnline]
  );

  const dismissRadarOffer = useCallback(
    async (offerId: string) => {
      setActiveRadarOffer(null);
      try {
        await declineRadar(offerId);
      } catch {
        // Ignore decline error
      }
    },
    []
  );

  const setOnlineStatus = useCallback(async (status: boolean) => {
    setIsOnline(status);
    try {
      await apiSetOnline(status);
    } catch {
      // Ignore API failure in offline mode
    }
  }, []);

  const toggleOnline = useCallback(async (): Promise<boolean> => {
    const nextStatus = !isOnline;
    await setOnlineStatus(nextStatus);
    return nextStatus;
  }, [isOnline, setOnlineStatus]);

  // Setup push notifications and navigation callbacks
  useEffect(() => {
    // Register notification tap handler
    setNavigationHandler((offerId, notificationId) => {
      if (!isOnline) return;
      if (navigationRef.isReady()) {
        (navigationRef as any).navigate('Radar', {
          offerId,
          notificationId,
        });
      }
    });

    setChatNavigationHandler((bookingId) => {
      if (navigationRef.isReady()) {
        (navigationRef as any).navigate('Chat', {
          bookingId,
        });
      }
    });

    setNotificationRouteHandler((routeName, params) => {
      if (navigationRef.isReady()) {
        (navigationRef as any).navigate(routeName, params);
      }
    });

    // Register foreground push arrival listener
    setForegroundRadarListener((payload: RadarPushPayload) => {
      if (!isOnline) return;
      if (payload.offerId) {
        if (navigationRef.isReady()) {
          (navigationRef as any).navigate('Radar', {
            offerId: payload.offerId,
            notificationId: payload.notificationId,
          });
        }
      }
    });

    void initPushNotifications();

    return () => {
      setNavigationHandler(null);
      setChatNavigationHandler(null);
      setNotificationRouteHandler(null);
      setForegroundRadarListener(null);
    };
  }, [isOnline]);

  return (
    <RadarContext.Provider
      value={{
        isOnline,
        toggleOnline,
        setOnlineStatus,
        activeRadarOffer,
        triggerRadarOffer,
        dismissRadarOffer,
      }}
    >
      {children}
    </RadarContext.Provider>
  );
};

export function useRadar(): RadarContextType {
  const context = useContext(RadarContext);
  if (!context) {
    throw new Error('useRadar must be used within a RadarProvider');
  }
  return context;
}
