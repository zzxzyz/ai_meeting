// 平台检测和工具函数

/**
 * 检测是否在 Electron 环境中运行
 */
export const isElectron = (): boolean => {
  return typeof window !== 'undefined' && window.electronAPI?.isElectron === true;
};

/**
 * 检测是否在 Web 环境中运行
 */
export const isWeb = (): boolean => {
  return !isElectron();
};

/**
 * 获取 Electron API（如果可用）
 */
export const getElectronAPI = () => {
  if (isElectron()) {
    return window.electronAPI!;
  }
  return null;
};

/**
 * 获取应用版本
 */
export const getAppVersion = async (): Promise<string> => {
  const electronAPI = getElectronAPI();
  if (electronAPI) {
    return electronAPI.getAppVersion();
  }
  // Web 环境返回 package.json 版本
  return '0.1.0';
};

/**
 * 获取平台信息
 */
export const getPlatform = (): string => {
  const electronAPI = getElectronAPI();
  if (electronAPI) {
    return electronAPI.platform;
  }
  return 'web';
};

/**
 * 最小化窗口（仅 Electron）
 */
export const minimizeWindow = async (): Promise<void> => {
  const electronAPI = getElectronAPI();
  if (electronAPI) {
    await electronAPI.minimizeWindow();
  }
};

/**
 * 最大化窗口（仅 Electron）
 */
export const maximizeWindow = async (): Promise<void> => {
  const electronAPI = getElectronAPI();
  if (electronAPI) {
    await electronAPI.maximizeWindow();
  }
};

/**
 * 关闭窗口（仅 Electron）
 */
export const closeWindow = async (): Promise<void> => {
  const electronAPI = getElectronAPI();
  if (electronAPI) {
    await electronAPI.closeWindow();
  }
};
