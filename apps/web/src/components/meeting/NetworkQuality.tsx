import React from 'react';

export type NetworkQualityType = 'excellent' | 'good' | 'fair' | 'poor' | 'bad';

interface NetworkQualityProps {
  quality: NetworkQualityType;
  showDetails?: boolean;
}

export const NetworkQuality: React.FC<NetworkQualityProps> = ({ quality, showDetails = false }) => {
  const getQualityConfig = () => {
    switch (quality) {
      case 'excellent':
        return {
          icon: '📶',
          text: '网络极佳',
          color: 'text-green-500',
          bgColor: 'bg-green-100',
          borderColor: 'border-green-300',
          signalBars: 4,
          description: '延迟 < 50ms，丢包率 < 1%'
        };
      case 'good':
        return {
          icon: '📶',
          text: '网络良好',
          color: 'text-blue-500',
          bgColor: 'bg-blue-100',
          borderColor: 'border-blue-300',
          signalBars: 3,
          description: '延迟 50-100ms，丢包率 1-3%'
        };
      case 'fair':
        return {
          icon: '📶',
          text: '网络一般',
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-100',
          borderColor: 'border-yellow-300',
          signalBars: 2,
          description: '延迟 100-200ms，丢包率 3-5%'
        };
      case 'poor':
        return {
          icon: '📶',
          text: '网络较差',
          color: 'text-orange-500',
          bgColor: 'bg-orange-100',
          borderColor: 'border-orange-300',
          signalBars: 1,
          description: '延迟 200-500ms，丢包率 5-10%'
        };
      case 'bad':
        return {
          icon: '📶',
          text: '网络很差',
          color: 'text-red-500',
          bgColor: 'bg-red-100',
          borderColor: 'border-red-300',
          signalBars: 0,
          description: '延迟 > 500ms，丢包率 > 10%'
        };
      default:
        return {
          icon: '📶',
          text: '未知',
          color: 'text-gray-500',
          bgColor: 'bg-gray-100',
          borderColor: 'border-gray-300',
          signalBars: 0,
          description: '网络状态未知'
        };
    }
  };

  const config = getQualityConfig();

  const renderSignalBars = () => {
    const bars = [];
    for (let i = 0; i < 4; i++) {
      const isActive = i < config.signalBars;
      bars.push(
        <div
          key={i}
          className={`w-1 h-${2 + i} rounded-sm ${
            isActive ? config.color.replace('text-', 'bg-') : 'bg-gray-300'
          }`}
        />
      );
    }
    return <div className="flex items-end space-x-0.5 mr-2">{bars}</div>;
  };

  return (
    <div
      className={`
        inline-flex items-center px-3 py-1 rounded-full text-sm font-medium
        ${config.bgColor} ${config.borderColor} border
        transition-all duration-200
        hover:shadow-md cursor-help
      `}
      title={config.description}
      data-testid="network-quality"
    >
      {renderSignalBars()}
      <span className={config.color}>
        {showDetails ? config.text : config.icon}
      </span>

      {showDetails && (
        <span className="ml-1 text-xs text-gray-600">
          {config.description}
        </span>
      )}
    </div>
  );
};