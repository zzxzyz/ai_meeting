# 跨平台方案设计

## 1. 背景与目标

### 1.1 业务背景
视频会议系统需要支持 Web、iOS、Android、Windows、macOS、Linux 多个平台,需要设计统一的 SDK 架构和构建系统。

### 1.2 技术目标
- **代码复用**：核心逻辑跨平台共享
- **平台适配**：充分利用各平台特性
- **统一接口**：一致的 API 设计
- **易于维护**：清晰的模块划分

### 1.3 平台清单
- **Web**：Chrome、Firefox、Safari、Edge
- **移动端**：iOS 13+、Android 8+
- **桌面端**：Windows 10+、macOS 11+、Ubuntu 20.04+

---

## 2. SDK 分层架构

```
┌─────────────────────────────────────────────────┐
│         Application Layer (各平台)              │
│  Web App | iOS App | Android App | Desktop App  │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│         Platform Adapter Layer                  │
│  (平台特定实现)                                  │
│  ┌──────────┬──────────┬──────────┬──────────┐ │
│  │ Web SDK  │ iOS SDK  │Android SDK│Desktop │ │
│  │(TypeScript)│(Swift/ObjC)│(Kotlin/Java)│(Electron)│
│  └──────────┴──────────┴──────────┴──────────┘ │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│         Core SDK Layer (C/C++)                  │
│  (跨平台核心逻辑)                                 │
│  ┌────────────────────────────────────────┐    │
│  │ WebRTC (libwebrtc)                     │    │
│  │ - 音视频采集、编解码、传输             │    │
│  │ - 网络传输、拥塞控制                   │    │
│  └────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────┐    │
│  │ Signaling Client                       │    │
│  │ - WebSocket 通信                       │    │
│  │ - 协议编解码                           │    │
│  └────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────┐    │
│  │ Media Processing                       │    │
│  │ - 音频处理（降噪、回声消除）           │    │
│  │ - 视频处理（美颜、滤镜）               │    │
│  └────────────────────────────────────────┘    │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│         Third-party Libraries                   │
│  OpenSSL | FFmpeg | Opus | VP8/VP9             │
└─────────────────────────────────────────────────┘
```

---

## 3. 核心 SDK 设计 (C++)

### 3.1 模块划分

```
core/
├── webrtc/              # WebRTC 封装
│   ├── peer_connection.h
│   ├── media_stream.h
│   ├── video_capturer.h
│   └── audio_device.h
│
├── signaling/           # 信令模块
│   ├── signaling_client.h
│   ├── websocket.h
│   └── protocol/
│       ├── join.proto
│       └── publish.proto
│
├── media/               # 媒体处理
│   ├── audio_processor.h
│   ├── video_processor.h
│   └── codec/
│
├── network/             # 网络模块
│   ├── http_client.h
│   └── socket.h
│
└── utils/               # 工具类
    ├── logger.h
    ├── thread_pool.h
    └── json.h
```

---

### 3.2 核心接口设计

#### 3.2.1 SDK 主接口

```cpp
// include/open_meeting_sdk.h

namespace open_meeting {

// SDK 配置
struct Config {
  std::string server_url;
  std::string api_key;
  bool enable_audio_processing = true;
  bool enable_video_processing = false;
  LogLevel log_level = LogLevel::kInfo;
};

// SDK 主类
class SDK {
 public:
  // 单例模式
  static SDK* GetInstance();

  // 初始化
  bool Initialize(const Config& config);

  // 释放资源
  void Shutdown();

  // 创建 RoomClient
  std::unique_ptr<RoomClient> CreateRoomClient();

  // 设备管理
  DeviceManager* GetDeviceManager();

  // 版本信息
  static std::string GetVersion();

 private:
  SDK() = default;
  ~SDK() = default;
};

// 房间客户端
class RoomClient {
 public:
  // 加入房间
  void JoinRoom(const std::string& room_id,
                const std::string& user_id,
                JoinCallback callback);

  // 离开房间
  void LeaveRoom();

  // 发布本地流
  void PublishStream(MediaStreamTrack* track,
                     PublishCallback callback);

  // 订阅远端流
  void SubscribeStream(const std::string& stream_id,
                       SubscribeCallback callback);

  // 事件监听
  void SetEventListener(RoomEventListener* listener);

 private:
  class Impl;
  std::unique_ptr<Impl> impl_;
};

// 事件监听器
class RoomEventListener {
 public:
  virtual ~RoomEventListener() = default;

  // 参会者加入
  virtual void OnParticipantJoined(const Participant& participant) {}

  // 参会者离开
  virtual void OnParticipantLeft(const std::string& user_id) {}

  // 新流发布
  virtual void OnStreamPublished(const StreamInfo& stream) {}

  // 流移除
  virtual void OnStreamRemoved(const std::string& stream_id) {}

  // 连接状态变化
  virtual void OnConnectionStateChanged(ConnectionState state) {}

  // 错误
  virtual void OnError(ErrorCode code, const std::string& message) {}
};

// 设备管理
class DeviceManager {
 public:
  // 枚举设备
  std::vector<Device> EnumerateAudioInputDevices();
  std::vector<Device> EnumerateAudioOutputDevices();
  std::vector<Device> EnumerateVideoDevices();

  // 选择设备
  void SelectAudioInputDevice(const std::string& device_id);
  void SelectAudioOutputDevice(const std::string& device_id);
  void SelectVideoDevice(const std::string& device_id);

  // 测试设备
  void TestAudioInput(TestCallback callback);
  void TestAudioOutput(TestCallback callback);
};

}  // namespace open_meeting
```

---

### 3.3 平台适配层

#### 3.3.1 iOS SDK (Swift)

```swift
// OpenMeetingSDK.swift

@objc public class OpenMeetingSDK: NSObject {
    // 单例
    @objc public static let shared = OpenMeetingSDK()

    // 初始化
    @objc public func initialize(config: SDKConfig) -> Bool {
        // 调用 C++ 核心
        return OpenMeetingCoreSDK.initialize(config.toCoreConfig())
    }

    // 创建房间客户端
    @objc public func createRoomClient() -> RoomClient {
        return RoomClient()
    }
}

@objc public class RoomClient: NSObject {
    private var coreClient: OpenMeetingCoreRoomClient

    // 加入房间
    @objc public func joinRoom(roomId: String,
                                userId: String,
                                completion: @escaping (Error?) -> Void) {
        coreClient.joinRoom(roomId, userId) { error in
            DispatchQueue.main.async {
                completion(error)
            }
        }
    }

    // 发布本地流
    @objc public func publishStream(track: RTCMediaStreamTrack,
                                     completion: @escaping (String?, Error?) -> Void) {
        coreClient.publishStream(track) { streamId, error in
            DispatchQueue.main.async {
                completion(streamId, error)
            }
        }
    }

    // 事件监听
    @objc public weak var delegate: RoomClientDelegate?
}

// 事件代理
@objc public protocol RoomClientDelegate {
    @objc optional func roomClient(_ client: RoomClient,
                                     didJoinParticipant participant: Participant)

    @objc optional func roomClient(_ client: RoomClient,
                                     didLeaveParticipant userId: String)

    @objc optional func roomClient(_ client: RoomClient,
                                     didPublishStream stream: StreamInfo)

    @objc optional func roomClient(_ client: RoomClient,
                                     didError error: Error)
}
```

**桥接头文件**：
```objc
// OpenMeetingSDK-Bridging-Header.h

#import "open_meeting_sdk.h"

// C++ 包装类
@interface OpenMeetingCoreSDK : NSObject
+ (BOOL)initialize:(NSDictionary *)config;
@end

@interface OpenMeetingCoreRoomClient : NSObject
- (void)joinRoom:(NSString *)roomId
          userId:(NSString *)userId
      completion:(void (^)(NSError *))completion;
@end
```

---

#### 3.3.2 Android SDK (Kotlin)

```kotlin
// OpenMeetingSDK.kt

class OpenMeetingSDK private constructor() {
    companion object {
        @Volatile
        private var instance: OpenMeetingSDK? = null

        fun getInstance(): OpenMeetingSDK {
            return instance ?: synchronized(this) {
                instance ?: OpenMeetingSDK().also { instance = it }
            }
        }

        // 加载 JNI 库
        init {
            System.loadLibrary("open_meeting_core")
        }
    }

    // 初始化
    fun initialize(config: SDKConfig): Boolean {
        return nativeInitialize(config.serverUrl, config.apiKey)
    }

    // 创建房间客户端
    fun createRoomClient(): RoomClient {
        return RoomClient(nativeCreateRoomClient())
    }

    // Native 方法
    private external fun nativeInitialize(serverUrl: String, apiKey: String): Boolean
    private external fun nativeCreateRoomClient(): Long
}

class RoomClient internal constructor(private val nativePtr: Long) {
    // 加入房间
    fun joinRoom(roomId: String, userId: String, callback: (Error?) -> Unit) {
        nativeJoinRoom(nativePtr, roomId, userId, callback)
    }

    // 发布本地流
    fun publishStream(track: MediaStreamTrack, callback: (String?, Error?) -> Unit) {
        nativePublishStream(nativePtr, track, callback)
    }

    // 事件监听
    var eventListener: RoomEventListener? = null
        set(value) {
            field = value
            nativeSetEventListener(nativePtr, value)
        }

    // Native 方法
    private external fun nativeJoinRoom(ptr: Long, roomId: String, userId: String,
                                        callback: (Error?) -> Unit)
    private external fun nativePublishStream(ptr: Long, track: MediaStreamTrack,
                                             callback: (String?, Error?) -> Unit)
    private external fun nativeSetEventListener(ptr: Long, listener: RoomEventListener?)

    // 析构
    protected fun finalize() {
        nativeDestroy(nativePtr)
    }

    private external fun nativeDestroy(ptr: Long)
}

// 事件监听接口
interface RoomEventListener {
    fun onParticipantJoined(participant: Participant) {}
    fun onParticipantLeft(userId: String) {}
    fun onStreamPublished(stream: StreamInfo) {}
    fun onError(code: Int, message: String) {}
}
```

**JNI 实现**：
```cpp
// jni/open_meeting_jni.cpp

#include <jni.h>
#include "open_meeting_sdk.h"

extern "C" {

JNIEXPORT jboolean JNICALL
Java_com_openmeeting_sdk_OpenMeetingSDK_nativeInitialize(
    JNIEnv* env, jobject obj, jstring server_url, jstring api_key) {

  const char* url = env->GetStringUTFChars(server_url, nullptr);
  const char* key = env->GetStringUTFChars(api_key, nullptr);

  open_meeting::Config config;
  config.server_url = url;
  config.api_key = key;

  bool result = open_meeting::SDK::GetInstance()->Initialize(config);

  env->ReleaseStringUTFChars(server_url, url);
  env->ReleaseStringUTFChars(api_key, key);

  return result;
}

JNIEXPORT jlong JNICALL
Java_com_openmeeting_sdk_OpenMeetingSDK_nativeCreateRoomClient(
    JNIEnv* env, jobject obj) {

  auto client = open_meeting::SDK::GetInstance()->CreateRoomClient();
  return reinterpret_cast<jlong>(client.release());
}

}  // extern "C"
```

---

## 4. 构建系统

### 4.1 CMake 配置

```cmake
# CMakeLists.txt

cmake_minimum_required(VERSION 3.15)
project(OpenMeetingCore VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# 平台检测
if(APPLE)
  set(PLATFORM_NAME "macOS")
elseif(WIN32)
  set(PLATFORM_NAME "Windows")
elseif(UNIX)
  set(PLATFORM_NAME "Linux")
endif()

# 第三方库
find_package(OpenSSL REQUIRED)
find_package(WebRTC REQUIRED)

# 源文件
file(GLOB_RECURSE CORE_SOURCES
  "src/webrtc/*.cpp"
  "src/signaling/*.cpp"
  "src/media/*.cpp"
  "src/network/*.cpp"
  "src/utils/*.cpp"
)

# 核心库（静态库）
add_library(open_meeting_core STATIC ${CORE_SOURCES})

target_include_directories(open_meeting_core
  PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/include
  PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/src
    ${WEBRTC_INCLUDE_DIRS}
)

target_link_libraries(open_meeting_core
  PRIVATE
    OpenSSL::SSL
    OpenSSL::Crypto
    ${WEBRTC_LIBRARIES}
)

# 平台特定构建
if(APPLE)
  # iOS Framework
  add_subdirectory(platforms/ios)
elseif(ANDROID)
  # Android AAR
  add_subdirectory(platforms/android)
elseif(WIN32)
  # Windows DLL
  add_subdirectory(platforms/windows)
endif()

# 测试
option(BUILD_TESTS "Build tests" ON)
if(BUILD_TESTS)
  add_subdirectory(tests)
endif()
```

---

### 4.2 iOS Framework 构建

```cmake
# platforms/ios/CMakeLists.txt

add_library(OpenMeetingSDK SHARED
  OpenMeetingSDK.mm
  RoomClient.mm
)

target_link_libraries(OpenMeetingSDK
  PRIVATE
    open_meeting_core
    "-framework Foundation"
    "-framework AVFoundation"
    "-framework CoreMedia"
)

set_target_properties(OpenMeetingSDK PROPERTIES
  FRAMEWORK TRUE
  FRAMEWORK_VERSION A
  MACOSX_FRAMEWORK_IDENTIFIER com.openmeeting.sdk
  VERSION ${PROJECT_VERSION}
  SOVERSION ${PROJECT_VERSION_MAJOR}
  PUBLIC_HEADER "OpenMeetingSDK.h;RoomClient.h"
  XCODE_ATTRIBUTE_CODE_SIGN_IDENTITY "iPhone Developer"
)
```

**Xcode 构建脚本**：
```bash
#!/bin/bash
# build_ios.sh

# 清理
xcodebuild clean

# 构建 iOS 设备
xcodebuild archive \
  -scheme OpenMeetingSDK \
  -archivePath build/ios-device.xcarchive \
  -sdk iphoneos \
  -destination "generic/platform=iOS" \
  SKIP_INSTALL=NO \
  BUILD_LIBRARY_FOR_DISTRIBUTION=YES

# 构建模拟器
xcodebuild archive \
  -scheme OpenMeetingSDK \
  -archivePath build/ios-simulator.xcarchive \
  -sdk iphonesimulator \
  -destination "generic/platform=iOS Simulator" \
  SKIP_INSTALL=NO \
  BUILD_LIBRARY_FOR_DISTRIBUTION=YES

# 创建 XCFramework
xcodebuild -create-xcframework \
  -framework build/ios-device.xcarchive/Products/Library/Frameworks/OpenMeetingSDK.framework \
  -framework build/ios-simulator.xcarchive/Products/Library/Frameworks/OpenMeetingSDK.framework \
  -output build/OpenMeetingSDK.xcframework
```

---

### 4.3 Android AAR 构建

```gradle
// platforms/android/build.gradle

apply plugin: 'com.android.library'
apply plugin: 'kotlin-android'

android {
    compileSdk 33
    ndkVersion "25.1.8937393"

    defaultConfig {
        minSdk 21
        targetSdk 33

        externalNativeBuild {
            cmake {
                cppFlags "-std=c++17 -fexceptions -frtti"
                arguments "-DANDROID_STL=c++_shared"
            }
        }

        ndk {
            abiFilters 'armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64'
        }
    }

    externalNativeBuild {
        cmake {
            path "../../CMakeLists.txt"
        }
    }

    buildFeatures {
        prefabPublishing true
    }
}

dependencies {
    implementation "org.jetbrains.kotlin:kotlin-stdlib:1.8.0"
    implementation "org.webrtc:google-webrtc:1.0.+"
}
```

**构建脚本**：
```bash
#!/bin/bash
# build_android.sh

cd platforms/android

# 清理
./gradlew clean

# 构建 AAR
./gradlew assembleRelease

# 输出
echo "AAR: build/outputs/aar/OpenMeetingSDK-release.aar"
```

---

## 5. CI/CD 流程

### 5.1 GitHub Actions 配置

```yaml
# .github/workflows/build.yml

name: Build Multi-Platform

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  build-ios:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Xcode
        uses: maxim-lobanov/setup-xcode@v1
        with:
          xcode-version: '14.3'

      - name: Build iOS SDK
        run: |
          cd platforms/ios
          bash build_ios.sh

      - name: Upload Artifact
        uses: actions/upload-artifact@v3
        with:
          name: OpenMeetingSDK-iOS
          path: platforms/ios/build/OpenMeetingSDK.xcframework

  build-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup JDK
        uses: actions/setup-java@v3
        with:
          java-version: '11'
          distribution: 'temurin'

      - name: Setup NDK
        uses: nttld/setup-ndk@v1
        with:
          ndk-version: r25b

      - name: Build Android SDK
        run: |
          cd platforms/android
          bash build_android.sh

      - name: Upload Artifact
        uses: actions/upload-artifact@v3
        with:
          name: OpenMeetingSDK-Android
          path: platforms/android/build/outputs/aar/*.aar

  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup MSVC
        uses: ilammy/msvc-dev-cmd@v1

      - name: Build Windows SDK
        run: |
          mkdir build && cd build
          cmake .. -G "Visual Studio 17 2022" -A x64
          cmake --build . --config Release

      - name: Upload Artifact
        uses: actions/upload-artifact@v3
        with:
          name: OpenMeetingSDK-Windows
          path: build/Release/*.dll
```

---

## 6. 版本管理

### 6.1 语义化版本

```
major.minor.patch

major: 不兼容的 API 变更
minor: 向后兼容的功能新增
patch: 向后兼容的问题修复

示例: 1.2.3
```

---

### 6.2 发布流程

```bash
# 1. 更新版本号
bash scripts/bump_version.sh 1.2.3

# 2. 构建所有平台
bash scripts/build_all.sh

# 3. 创建 Git Tag
git tag v1.2.3
git push origin v1.2.3

# 4. GitHub Release
gh release create v1.2.3 \
  --title "v1.2.3" \
  --notes "Release notes..." \
  build/OpenMeetingSDK-iOS.xcframework \
  build/OpenMeetingSDK-Android.aar \
  build/OpenMeetingSDK-Windows.zip
```

---

## 7. 参考资料

- [CMake 官方文档](https://cmake.org/documentation/)
- [Android NDK](https://developer.android.com/ndk)
- [Xcode Build Settings](https://developer.apple.com/documentation/xcode/build-settings-reference)
- [WebRTC Native Code](https://webrtc.googlesource.com/src/)
