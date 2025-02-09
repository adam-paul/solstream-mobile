// src/components/ui/ChatWindow.tsx
'use client'

import React, { useState, useRef, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useChatStore } from '@/lib/ChatStore';
import { socketService } from '@/lib/socketService';
import { truncateWalletAddress, getWalletColor } from '@/lib/walletUtils';

export const ChatWindow: React.FC<{ streamId: string }> = ({ streamId }) => {
  const { connected, publicKey } = useWallet();
  const [messageInput, setMessageInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { getMessages, sendChatMessage } = useChatStore();
  const messages = getMessages(streamId);

  useEffect(() => {
    console.log('[ChatWindow] Requesting message history');
    socketService.requestChatHistory(streamId);
  }, [streamId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!connected || !messageInput.trim() || !publicKey) return;
    const username = truncateWalletAddress(publicKey);

    console.log('[ChatWindow] Sending message');
    sendChatMessage(streamId, messageInput.trim(), username);
    setMessageInput('');
  };

  const handleReply = (username: string) => {
    setMessageInput(prev => `@${username} ${prev}`);
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="bg-gray-900 h-full flex flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-4 space-y-3">
          {messages.map((message, index) => (
            <div 
              key={`${message.timestamp}-${index}`}
              className="bg-gray-800 rounded p-2 space-y-2"
            >
              <div className="flex items-center gap-3">
                <span 
                  style={{ backgroundColor: getWalletColor(message.username) }}
                  className="px-2 py-0.5 rounded text-sm text-black"
                >
                  {message.username}
                </span>
                <span className="text-gray-400 text-xs">
                  {formatTimestamp(message.timestamp)}
                </span>
                <button
                  onClick={() => handleReply(message.username)}
                  className="text-gray-400 text-sm group"
                >
                  [<span className="group-hover:underline">reply</span>]
                </button>
              </div>
              <div className="break-words text-white">
                {message.content}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <form 
        onSubmit={handleSendMessage}
        className="p-4 border-t border-gray-800"
      >
        {connected ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="type a message..."
              className="flex-1 bg-transparent text-white rounded px-3 py-2 border border-blue-500 focus:outline-none focus:ring-2 focus:ring-green-300"
            />
            <button
              type="submit"
              disabled={!messageInput.trim()}
              className="px-4 py-2 bg-green-300 text-black rounded hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              post
            </button>
          </div>
        ) : (
          <div className="text-center text-gray-500">
            connect wallet to chat
          </div>
        )}
      </form>
    </div>
  );
};

export default ChatWindow;
