import React from 'react';

export type ConnectionStatusType = 'connecting' | 'connected' | 'disconnected' | 'failed';

export interface ConnectionStatusProps {
  status: ConnectionStatusType;
  message?: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ status, message }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'connecting':
        return {
          icon: '⏳',
          text: '连接中...',
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-100',
          borderColor: 'border-yellow-300'
        };
      case 'connected':
        return {
          icon: '✅',
          text: '已连接',
          color: 'text-green-500',
          bgColor: 'bg-green-100',
          borderColor: 'border-green-300'
        };
      case 'disconnected':
        return {
          icon: '🔌',
          text: '连接断开',
          color: 'text-orange-500',
          bgColor: 'bg-orange-100',
          borderColor: 'border-orange-300'
        };
      case 'failed':
        return {
          icon: '❌',
          text: '连接失败',
          color: 'text-red-500',
          bgColor: 'bg-red-100',
          borderColor: 'border-red-300'
        };
      default:
        return {
          icon: '❓',
          text: '未知状态',
          color: 'text-gray-500',
          bgColor: 'bg-gray-100',
          borderColor: 'border-gray-300'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div
      className={`
        inline-flex items-center px-3 py-1 rounded-full text-sm font-medium
        ${config.bgColor} ${config.borderColor} border
        transition-all duration-200
      `}
      data-testid="connection-status"
    >
      <span className={`mr-2 ${config.color}`}>{config.icon}</span>
      <span className={config.color}>{message || config.text}</span>
    </div>
  );
};