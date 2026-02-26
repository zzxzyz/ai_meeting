import React, { useState, useEffect } from 'react';
import { ControlBar } from '@web/components/meeting/ControlBar';

/**
 * REQ-004 音视频控制演示页面
 * 验证 ControlBar 组件在 Electron 中的集成效果
 */
export const MediaControlDemo: React.FC = () => {
  const [audioMuted, setAudioMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [devices, setDevices] = useState({
    audioInputs: [],
    videoInputs: [],
    audioOutputs: []
  });

  // 模拟加载媒体设备
  useEffect(() => {
    const loadDevices = async () => {
      try {
        if (window.electronAPI) {
          const deviceList = await window.electronAPI.getMediaDevices();
          setDevices(deviceList);
        }
      } catch (error) {
        console.error('加载媒体设备失败:', error);
      }
    };

    loadDevices();
  }, []);

  // 音频控制处理
  const handleToggleAudio = async () => {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.toggleAudio(!audioMuted);
        if (result.success) {
          setAudioMuted(!audioMuted);
        }
      } else {
        // 降级到 Web API
        setAudioMuted(!audioMuted);
      }
    } catch (error) {
      console.error('音频控制失败:', error);
    }
  };

  // 视频控制处理
  const handleToggleVideo = async () => {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.toggleVideo(!videoOff);
        if (result.success) {
          setVideoOff(!videoOff);
        }
      } else {
        // 降级到 Web API
        setVideoOff(!videoOff);
      }
    } catch (error) {
      console.error('视频控制失败:', error);
    }
  };

  // 结束通话处理
  const handleEndCall = () => {
    console.log('结束通话');
    // 这里可以添加实际的结束通话逻辑
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-8">
      <div className="max-w-4xl w-full">
        <h1 className="text-3xl font-bold text-white mb-8 text-center">
          REQ-004 Electron 音视频控制演示
        </h1>

        {/* 状态显示区域 */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">当前状态</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-700 rounded p-4">
              <span className="text-white">音频状态: </span>
              <span className={audioMuted ? 'text-red-400' : 'text-green-400'}>
                {audioMuted ? '静音 🔇' : '正常 🎙️'}
              </span>
            </div>
            <div className="bg-gray-700 rounded p-4">
              <span className="text-white">视频状态: </span>
              <span className={videoOff ? 'text-red-400' : 'text-green-400'}>
                {videoOff ? '关闭 📷✕' : '开启 📹'}
              </span>
            </div>
          </div>
        </div>

        {/* 设备信息显示 */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">检测到的设备</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <h3 className="text-white font-medium mb-2">音频输入</h3>
              <ul className="text-gray-300 text-sm">
                {devices.audioInputs.map((device, index) => (
                  <li key={index} className="mb-1">• {device.label}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-white font-medium mb-2">视频输入</h3>
              <ul className="text-gray-300 text-sm">
                {devices.videoInputs.map((device, index) => (
                  <li key={index} className="mb-1">• {device.label}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-white font-medium mb-2">音频输出</h3>
              <ul className="text-gray-300 text-sm">
                {devices.audioOutputs.map((device, index) => (
                  <li key={index} className="mb-1">• {device.label}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* ControlBar 组件演示 */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">ControlBar 组件</h2>
          <div className="flex justify-center">
            <ControlBar
              onEndCall={handleEndCall}
              onToggleAudio={handleToggleAudio}
              onToggleVideo={handleToggleVideo}
              isAudioMuted={audioMuted}
              isVideoOff={videoOff}
              showChatButton={false}
              showSettingsButton={false}
            />
          </div>
        </div>

        {/* Electron API 状态 */}
        <div className="mt-6 text-center">
          <span className="text-gray-400 text-sm">
            Electron API 状态: {window.electronAPI ? '✅ 可用' : '❌ 不可用'}
          </span>
        </div>
      </div>
    </div>
  );
};