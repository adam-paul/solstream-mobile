// src/lib/StreamStore.ts

import React from 'react';
import { create } from 'zustand';
import { socketService } from './socketService';
import { sessionManager } from './sessionManager';
import { Stream } from '@/types/stream';
import { useChatStore } from './ChatStore';

type UserRole = 'host' | 'audience' | null;

interface StreamState {
  streams: Map<string, Stream>;
  userRoles: Map<string, UserRole>;
  isInitialized: boolean;
  
  // Core state accessors
  getStream: (id: string) => Stream | undefined;
  getAllStreams: () => Stream[];
  isStreamHost: (streamId: string) => boolean;
  
  // Role management
  getUserRole: (streamId: string) => UserRole;
  setUserRole: (streamId: string, role: UserRole) => void;
  getHostedStreams: () => Stream[];
  
  // Stream actions
  setStreamLiveStatus: (streamId: string, isLive: boolean) => void;
  startStream: (streamData: Omit<Stream, 'id'>) => Promise<string>;
  endStream: (id: string) => void;
  
  // Store initialization
  initializeStore: () => Promise<void>;
}

const useStreamStore = create<StreamState>()((set, get) => ({
  streams: new Map(),
  userRoles: new Map(),
  messages: new Map(),
  isInitialized: false,

  getStream: (id) => get().streams.get(id),
  
  getAllStreams: () => Array.from(get().streams.values()),
  
  isStreamHost: (streamId) => {
    const stream = get().streams.get(streamId);
    return stream ? stream.creator === sessionManager.getUserId() : false;
  },

  getUserRole: (streamId) => get().userRoles.get(streamId) || null,

  setUserRole: (streamId, role) => set(state => {
    const newRoles = new Map(state.userRoles);
    if (role === null) {
      newRoles.delete(streamId);
    } else {
      newRoles.set(streamId, role);
    }
    return { userRoles: newRoles };
  }),

  getHostedStreams: () => {
    const state = get();
    return Array.from(state.streams.values()).filter(stream => 
      state.userRoles.get(stream.id) === 'host' || stream.creator === sessionManager.getUserId()
    );
  },

  setStreamLiveStatus: (streamId: string, isLive: boolean) => {
    socketService.updateStreamLiveStatus({ streamId, isLive });
  },

  initializeStore: async () => {
    try {
      const socket = await socketService.connect();
      
      if (!socket.connected) {
        throw new Error('Socket failed to connect');
      }
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/streams`
      );
      if (!response.ok) throw new Error('Failed to fetch streams');
      
      const streams: Stream[] = await response.json();

      // Initialize chat store after stream store is ready
      await useChatStore.getState().initializeStore();

      // Set up socket listeners
      socketService.onStreamStarted((stream) => {
        set(state => {
          const newStreams = new Map(state.streams);
          newStreams.set(stream.id, stream);
          return { streams: newStreams };
        });
      });

      socketService.onStreamLiveStatusChanged(({ streamId, isLive }) => {
        const stream = get().streams.get(streamId);
        if (!stream || stream.isLive === isLive) return;
        
        set(state => {
          const newStreams = new Map(state.streams);
          newStreams.set(streamId, { ...stream, isLive });
          return { streams: newStreams };
        });
      });

      socketService.onStreamEnded((id) => {
        set(state => {
          const newStreams = new Map(state.streams);
          const newUserRoles = new Map(state.userRoles);
          newStreams.delete(id);
          newUserRoles.delete(id);
          return { 
            streams: newStreams, 
            userRoles: newUserRoles,
          };
        });
      });

      socketService.onViewerJoined(({ streamId, count }) => {
        set(state => {
          const newStreams = new Map(state.streams);
          const stream = newStreams.get(streamId);
          if (stream) {
            newStreams.set(streamId, { ...stream, viewers: count });
            return { streams: newStreams };
          }
          return state;
        });
      });

      socketService.onViewerLeft(({ streamId, count }) => {
        set(state => {
          const newStreams = new Map(state.streams);
          const stream = newStreams.get(streamId);
          if (stream) {
            newStreams.set(streamId, { ...stream, viewers: count });
            return { streams: newStreams };
          }
          return state;
        });
      });

      // Initialize state with fetched streams
      set(state => {
        const newStreams = new Map(state.streams);

        streams.forEach(stream => {
          newStreams.set(stream.id, stream);
        });

        return {
          streams: newStreams,
          isInitialized: true
        };
      });
    } catch (error) {
      throw error;
    }
  },

  startStream: async (streamData) => {
    const streamId = `stream-${crypto.randomUUID()}`;
    get().setUserRole(streamId, 'host');
  
    try {
      const newStream: Stream = {
        ...streamData,
        id: streamId,
        viewers: 0,
        isLive: false,
      };

      socketService.startStream(newStream);
      return streamId;
    } catch (error) {
      get().setUserRole(streamId, null);
      throw error;
    }
  },

  endStream: (id) => {
    socketService.endStream(id);
  }
}));

export const useInitializedStreamStore = () => {
  const store = useStreamStore();
  
  React.useEffect(() => {
    if (!store.isInitialized) {
      store.initializeStore().catch(console.error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return store;
};

export { useStreamStore };
