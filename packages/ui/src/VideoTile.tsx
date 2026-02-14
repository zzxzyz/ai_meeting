import React from 'react';

export interface VideoTileProps {
  stream?: MediaStream;
  name: string;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isLocal?: boolean;
  className?: string;
}

export const VideoTile: React.FC<VideoTileProps> = ({
  stream,
  name,
  isMuted = false,
  isVideoOff = false,
  isLocal = false,
  className = '',
}) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className={`relative bg-gray-900 rounded-lg overflow-hidden ${className}`}>
      {isVideoOff ? (
        <div className="flex items-center justify-center w-full h-full">
          <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center text-white text-2xl font-bold">
            {name.charAt(0).toUpperCase()}
          </div>
        </div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      )}

      <div className="absolute bottom-2 left-2 flex items-center gap-2">
        <span className="text-white text-sm bg-black bg-opacity-50 px-2 py-1 rounded">
          {name}
          {isLocal && ' (You)'}
        </span>
        {isMuted && (
          <span className="text-white text-xs bg-red-600 px-2 py-1 rounded">
            Muted
          </span>
        )}
      </div>
    </div>
  );
};
