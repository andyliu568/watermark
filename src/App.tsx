/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Upload, 
  Download, 
  Type, 
  Settings2, 
  Image as ImageIcon, 
  Video as VideoIcon, 
  Trash2, 
  RefreshCw,
  LayoutGrid,
  Grid3X3,
  ChevronRight,
  ChevronLeft,
  Languages
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type WatermarkPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'tile';
type MovementType = 'static' | 'bounce' | 'scroll-h' | 'scroll-v';

interface WatermarkSettings {
  type: 'text' | 'image';
  text: string;
  fontSize: number;
  color: string;
  opacity: number;
  position: WatermarkPosition;
  padding: number;
  imageScale: number;
  movement: MovementType;
  movementSpeed: number;
}

const translations = {
  en: {
    title: 'Watermark Studio',
    clearFile: 'Clear File',
    dropMedia: 'Drop your media here',
    supportText: 'Support for high-res images and MP4 videos',
    images: 'Images',
    videos: 'Videos',
    settingsTitle: 'Watermark Settings',
    text: 'Text',
    image: 'Image',
    watermarkText: 'Watermark Text',
    enterText: 'Enter text...',
    watermarkImage: 'Watermark Image',
    uploadImage: 'Upload Image',
    movement: 'Movement',
    static: 'Static',
    bounce: 'Bounce',
    scrollH: 'Scroll H',
    scrollV: 'Scroll V',
    speed: 'Speed',
    position: 'Position',
    fontSize: 'Font Size',
    imageScale: 'Image Scale',
    opacity: 'Opacity',
    padding: 'Padding',
    color: 'Color',
    processing: 'Processing',
    downloadImage: 'Download Image',
    downloadVideo: 'Download Video'
  },
  zh: {
    title: '水印工作室',
    clearFile: '清除文件',
    dropMedia: '将媒体文件拖放到此处',
    supportText: '支持高清图片和 MP4 视频',
    images: '图片',
    videos: '视频',
    settingsTitle: '水印设置',
    text: '文字',
    image: '图片',
    watermarkText: '水印文字',
    enterText: '输入文字...',
    watermarkImage: '水印图片',
    uploadImage: '上传图片',
    movement: '动态效果',
    static: '静态',
    bounce: '反弹',
    scrollH: '水平滚动',
    scrollV: '垂直滚动',
    speed: '速度',
    position: '位置',
    fontSize: '字体大小',
    imageScale: '图片缩放',
    opacity: '透明度',
    padding: '边距',
    color: '颜色',
    processing: '处理中',
    downloadImage: '下载图片',
    downloadVideo: '下载视频'
  }
};

export default function App() {
  const [lang, setLang] = useState<'en' | 'zh'>('zh');
  const t = translations[lang];

  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'image' | 'video' | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [watermarkImage, setWatermarkImage] = useState<HTMLImageElement | null>(null);
  const [watermarkImageUrl, setWatermarkImageUrl] = useState<string | null>(null);
  const [settings, setSettings] = useState<WatermarkSettings>({
    type: 'text',
    text: 'Watermark Studio',
    fontSize: 24,
    color: '#ffffff',
    opacity: 0.5,
    position: 'bottom-right',
    padding: 20,
    imageScale: 0.2,
    movement: 'static',
    movementSpeed: 30,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Update current time for preview animation
  useEffect(() => {
    let rafId: number;
    const updateTime = () => {
      if (videoRef.current && !videoRef.current.paused) {
        setCurrentTime(videoRef.current.currentTime);
      }
      rafId = requestAnimationFrame(updateTime);
    };
    rafId = requestAnimationFrame(updateTime);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      
      const type = selectedFile.type.startsWith('video/') ? 'video' : 'image';
      setFile(selectedFile);
      setFileType(type);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  // Handle watermark image upload
  const handleWatermarkImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (watermarkImageUrl) URL.revokeObjectURL(watermarkImageUrl);
      
      const url = URL.createObjectURL(selectedFile);
      const img = new Image();
      img.onload = () => {
        setWatermarkImage(img);
        setWatermarkImageUrl(url);
        setSettings(s => ({ ...s, type: 'image' }));
      };
      img.src = url;
    }
  };

  const clearFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setFileType(null);
    setPreviewUrl(null);
    setExportProgress(0);
  };

  // Calculate watermark position (including dynamic movement)
  const getWatermarkCoords = (
    canvasWidth: number, 
    canvasHeight: number, 
    contentWidth: number, 
    contentHeight: number, 
    padding: number, 
    position: WatermarkPosition,
    movement: MovementType,
    time: number = 0,
    movementSpeed: number = 30
  ) => {
    if (movement === 'static') {
      switch (position) {
        case 'top-left':
          return { x: padding, y: padding };
        case 'top-right':
          return { x: canvasWidth - contentWidth - padding, y: padding };
        case 'bottom-left':
          return { x: padding, y: canvasHeight - contentHeight - padding };
        case 'bottom-right':
          return { x: canvasWidth - contentWidth - padding, y: canvasHeight - contentHeight - padding };
        case 'center':
          return { x: (canvasWidth - contentWidth) / 2, y: (canvasHeight - contentHeight) / 2 };
        default:
          return { x: padding, y: padding };
      }
    }

    if (movement === 'bounce') {
      const speedX = canvasWidth * (movementSpeed / 500);
      const speedY = canvasHeight * (movementSpeed / 500);
      const rangeX = Math.max(0, canvasWidth - contentWidth - padding * 2);
      const rangeY = Math.max(0, canvasHeight - contentHeight - padding * 2);
      
      // Triangle wave for bouncing effect
      const getBounce = (t: number, range: number, speed: number) => {
        if (speed === 0 || range <= 0) return padding;
        const period = (range * 2) / speed;
        const phase = (t % period) / period;
        return range * (1 - Math.abs(phase * 2 - 1)) + padding;
      };

      return {
        x: getBounce(time, rangeX, speedX),
        y: getBounce(time, rangeY, speedY * 0.85) // Slightly different speed for Y
      };
    }

    if (movement === 'scroll-h') {
      const speed = canvasWidth * (movementSpeed / 400);
      const totalWidth = canvasWidth + contentWidth;
      const x = (time * speed) % totalWidth - contentWidth;
      const y = position.includes('top') ? padding : position.includes('bottom') ? canvasHeight - contentHeight - padding : (canvasHeight - contentHeight) / 2;
      return { x, y };
    }

    if (movement === 'scroll-v') {
      const speed = canvasHeight * (movementSpeed / 400);
      const totalHeight = canvasHeight + contentHeight;
      const y = (time * speed) % totalHeight - contentHeight;
      const x = position.includes('left') ? padding : position.includes('right') ? canvasWidth - contentWidth - padding : (canvasWidth - contentWidth) / 2;
      return { x, y };
    }

    return { x: padding, y: padding };
  };

  // Draw watermark on canvas
  const drawWatermark = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, time: number = 0) => {
    const { type, text, fontSize, color, opacity, position, padding, imageScale, movement, movementSpeed } = settings;
    
    ctx.save();
    ctx.globalAlpha = opacity;

    if (type === 'text') {
      ctx.font = `${fontSize}px sans-serif`;
      const metrics = ctx.measureText(text);
      const textWidth = metrics.width;
      const textHeight = fontSize;

      const { x, y } = getWatermarkCoords(width, height, textWidth, textHeight, padding, position, movement, time, movementSpeed);
      
      ctx.fillStyle = color;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 4;
      
      if (position === 'tile') {
        const stepX = textWidth + padding * 2;
        const stepY = textHeight + padding * 2;
        let offsetX = x % stepX;
        let offsetY = y % stepY;
        if (offsetX > 0) offsetX -= stepX;
        if (offsetY > 0) offsetY -= stepY;
        
        for (let i = offsetX; i < width; i += stepX) {
          for (let j = offsetY; j < height; j += stepY) {
            ctx.fillText(text, i, j + textHeight);
          }
        }
      } else {
        ctx.fillText(text, x, y + textHeight);
      }
    } else if (type === 'image' && watermarkImage) {
      const wWidth = width * imageScale;
      const wHeight = (watermarkImage.height / watermarkImage.width) * wWidth;
      
      const { x, y } = getWatermarkCoords(width, height, wWidth, wHeight, padding, position, movement, time, movementSpeed);
      
      if (position === 'tile') {
        const stepX = wWidth + padding * 2;
        const stepY = wHeight + padding * 2;
        let offsetX = x % stepX;
        let offsetY = y % stepY;
        if (offsetX > 0) offsetX -= stepX;
        if (offsetY > 0) offsetY -= stepY;
        
        for (let i = offsetX; i < width; i += stepX) {
          for (let j = offsetY; j < height; j += stepY) {
            ctx.drawImage(watermarkImage, i, j, wWidth, wHeight);
          }
        }
      } else {
        ctx.drawImage(watermarkImage, x, y, wWidth, wHeight);
      }
    }

    ctx.restore();
  }, [settings, watermarkImage]);

  // Update image canvas
  useEffect(() => {
    if (fileType === 'image' && previewUrl && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        drawWatermark(ctx, img.width, img.height);
      };
      img.src = previewUrl;
    }
  }, [fileType, previewUrl, drawWatermark]);

  // Download image
  const downloadImage = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    const originalName = file?.name.split('.')[0] || 'image';
    link.download = `watermarked_${originalName}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  // Export video (Canvas + MediaRecorder)
  const exportVideo = async () => {
    if (!videoRef.current || !file) return;
    
    setIsProcessing(true);
    setExportProgress(0);
    
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const stream = canvas.captureStream(30); // 30 FPS
    
    // Capture audio from the original video and add it to the stream
    try {
      const videoStream = (video as any).captureStream ? (video as any).captureStream() : (video as any).mozCaptureStream ? (video as any).mozCaptureStream() : null;
      if (videoStream) {
        const audioTracks = videoStream.getAudioTracks();
        audioTracks.forEach((track: MediaStreamTrack) => stream.addTrack(track));
      }
    } catch (err) {
      console.warn("Failed to capture audio:", err);
    }
    
    // Try to use MP4 if supported, fallback to WebM
    let mimeType = 'video/webm;codecs=vp9';
    if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1.42E01E')) {
      mimeType = 'video/mp4;codecs=avc1.42E01E';
    } else if (MediaRecorder.isTypeSupported('video/mp4')) {
      mimeType = 'video/mp4';
    }
    
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];
    
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => {
      const blobType = mimeType.split(';')[0];
      const blob = new Blob(chunks, { type: blobType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const ext = blobType === 'video/mp4' ? 'mp4' : 'webm';
      link.download = `watermarked_${file.name.split('.')[0]}.${ext}`;
      link.href = url;
      link.click();
      setIsProcessing(false);
      setExportProgress(0);
    };

    video.currentTime = 0;
    video.play();
    recorder.start();

    const processFrame = () => {
      if (video.paused || video.ended) {
        recorder.stop();
        return;
      }
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      drawWatermark(ctx, canvas.width, canvas.height, video.currentTime);
      
      setExportProgress((video.currentTime / video.duration) * 100);
      requestAnimationFrame(processFrame);
    };

    requestAnimationFrame(processFrame);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-[#1A1A1A] font-sans selection:bg-[#1A1A1A] selection:text-white">
      {/* Header */}
      <header className="border-b border-black/5 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#1A1A1A] rounded-lg flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">{t.title}</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => setLang(l => l === 'en' ? 'zh' : 'en')}
              className="flex items-center gap-2 text-sm font-medium text-[#1A1A1A]/60 hover:text-[#1A1A1A] transition-colors"
            >
              <Languages className="w-4 h-4" />
              {lang === 'en' ? '中文' : 'English'}
            </button>
            
            {file && (
              <button 
                onClick={clearFile}
                className="text-sm font-medium text-red-500 hover:text-red-600 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {t.clearFile}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {!file ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto"
          >
            <label className="relative group block cursor-pointer">
              <input 
                type="file" 
                className="hidden" 
                accept="image/*,video/*"
                onChange={handleFileChange}
              />
              <div className="border-2 border-dashed border-black/10 rounded-3xl p-12 text-center transition-all group-hover:border-black/20 group-hover:bg-white/50">
                <div className="w-16 h-16 bg-[#1A1A1A]/5 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                  <Upload className="w-8 h-8 text-[#1A1A1A]/40" />
                </div>
                <h2 className="text-2xl font-semibold mb-2">{t.dropMedia}</h2>
                <p className="text-[#1A1A1A]/50 mb-8">{t.supportText}</p>
                <div className="inline-flex items-center gap-4 text-sm font-medium">
                  <span className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-black/5">
                    <ImageIcon className="w-4 h-4" /> {t.images}
                  </span>
                  <span className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-black/5">
                    <VideoIcon className="w-4 h-4" /> {t.videos}
                  </span>
                </div>
              </div>
            </label>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Controls */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-black/5">
                <div className="flex items-center gap-2 mb-6">
                  <Settings2 className="w-5 h-5" />
                  <h3 className="font-semibold">{t.settingsTitle}</h3>
                </div>

                <div className="space-y-6">
                  {/* Watermark Type Toggle */}
                  <div className="flex bg-[#F5F5F5] p-1 rounded-xl">
                    <button
                      onClick={() => setSettings(s => ({ ...s, type: 'text' }))}
                      className={cn(
                        "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                        settings.type === 'text' ? "bg-white shadow-sm" : "text-[#1A1A1A]/40"
                      )}
                    >
                      {t.text}
                    </button>
                    <button
                      onClick={() => setSettings(s => ({ ...s, type: 'image' }))}
                      className={cn(
                        "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                        settings.type === 'image' ? "bg-white shadow-sm" : "text-[#1A1A1A]/40"
                      )}
                    >
                      {t.image}
                    </button>
                  </div>

                  {settings.type === 'text' ? (
                    /* Text Input */
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[#1A1A1A]/40">{t.watermarkText}</label>
                      <div className="relative">
                        <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1A1A1A]/30" />
                        <input 
                          type="text"
                          value={settings.text}
                          onChange={(e) => setSettings(s => ({ ...s, text: e.target.value }))}
                          className="w-full pl-10 pr-4 py-3 bg-[#F5F5F5] rounded-xl border-none focus:ring-2 focus:ring-[#1A1A1A] transition-all outline-none"
                          placeholder={t.enterText}
                        />
                      </div>
                    </div>
                  ) : (
                    /* Image Upload */
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[#1A1A1A]/40">{t.watermarkImage}</label>
                      <label className="block">
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*"
                          onChange={handleWatermarkImageChange}
                        />
                        <div className="border-2 border-dashed border-black/5 rounded-xl p-4 text-center cursor-pointer hover:bg-[#F5F5F5] transition-all">
                          {watermarkImageUrl ? (
                            <img src={watermarkImageUrl} alt="Watermark" className="max-h-12 mx-auto rounded" />
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <ImageIcon className="w-5 h-5 text-[#1A1A1A]/20" />
                              <span className="text-xs text-[#1A1A1A]/40">{t.uploadImage}</span>
                            </div>
                          )}
                        </div>
                      </label>
                    </div>
                  )}

                  {/* Movement Selection (Only for Video) */}
                  {fileType === 'video' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-[#1A1A1A]/40">{t.movement}</label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { id: 'static', label: t.static },
                            { id: 'bounce', label: t.bounce },
                            { id: 'scroll-h', label: t.scrollH },
                            { id: 'scroll-v', label: t.scrollV },
                          ].map((m) => (
                            <button
                              key={m.id}
                              onClick={() => setSettings(s => ({ ...s, movement: m.id as MovementType }))}
                              className={cn(
                                "py-2 text-xs font-bold rounded-xl transition-all",
                                settings.movement === m.id 
                                  ? "bg-[#1A1A1A] text-white" 
                                  : "bg-[#F5F5F5] text-[#1A1A1A]/40 hover:bg-[#EAEAEA]"
                              )}
                            >
                              {m.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {settings.movement !== 'static' && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-[#1A1A1A]/40">
                            <span>{t.speed}</span>
                            <span>{settings.movementSpeed}</span>
                          </div>
                          <input 
                            type="range" min="1" max="100" step="1"
                            value={settings.movementSpeed}
                            onChange={(e) => setSettings(s => ({ ...s, movementSpeed: parseInt(e.target.value) }))}
                            className="w-full accent-[#1A1A1A]"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Position Grid */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#1A1A1A]/40">{t.position}</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'top-left', icon: <LayoutGrid className="w-4 h-4 rotate-0" /> },
                        { id: 'top-right', icon: <LayoutGrid className="w-4 h-4 rotate-90" /> },
                        { id: 'center', icon: <LayoutGrid className="w-4 h-4" /> },
                        { id: 'bottom-left', icon: <LayoutGrid className="w-4 h-4 -rotate-90" /> },
                        { id: 'bottom-right', icon: <LayoutGrid className="w-4 h-4 180" /> },
                        { id: 'tile', icon: <Grid3X3 className="w-4 h-4" /> },
                      ].map((pos) => (
                        <button
                          key={pos.id}
                          onClick={() => setSettings(s => ({ ...s, position: pos.id as WatermarkPosition }))}
                          className={cn(
                            "flex items-center justify-center p-3 rounded-xl transition-all",
                            settings.position === pos.id 
                              ? "bg-[#1A1A1A] text-white" 
                              : "bg-[#F5F5F5] text-[#1A1A1A]/40 hover:bg-[#EAEAEA]"
                          )}
                        >
                          {pos.icon}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sliders */}
                  <div className="space-y-4">
                    {settings.type === 'text' ? (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-[#1A1A1A]/40">
                          <span>{t.fontSize}</span>
                          <span>{settings.fontSize}px</span>
                        </div>
                        <input 
                          type="range" min="10" max="200" step="1"
                          value={settings.fontSize}
                          onChange={(e) => setSettings(s => ({ ...s, fontSize: parseInt(e.target.value) }))}
                          className="w-full accent-[#1A1A1A]"
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-[#1A1A1A]/40">
                          <span>{t.imageScale}</span>
                          <span>{Math.round(settings.imageScale * 100)}%</span>
                        </div>
                        <input 
                          type="range" min="0.05" max="1" step="0.01"
                          value={settings.imageScale}
                          onChange={(e) => setSettings(s => ({ ...s, imageScale: parseFloat(e.target.value) }))}
                          className="w-full accent-[#1A1A1A]"
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-[#1A1A1A]/40">
                        <span>{t.opacity}</span>
                        <span>{Math.round(settings.opacity * 100)}%</span>
                      </div>
                      <input 
                        type="range" min="0" max="1" step="0.01"
                        value={settings.opacity}
                        onChange={(e) => setSettings(s => ({ ...s, opacity: parseFloat(e.target.value) }))}
                        className="w-full accent-[#1A1A1A]"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-[#1A1A1A]/40">
                        <span>{t.padding}</span>
                        <span>{settings.padding}px</span>
                      </div>
                      <input 
                        type="range" min="0" max="100" step="1"
                        value={settings.padding}
                        onChange={(e) => setSettings(s => ({ ...s, padding: parseInt(e.target.value) }))}
                        className="w-full accent-[#1A1A1A]"
                      />
                    </div>
                  </div>

                  {/* Color Picker (Only for Text) */}
                  {settings.type === 'text' && (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[#1A1A1A]/40">{t.color}</label>
                      <div className="flex gap-2">
                        {['#ffffff', '#000000', '#F27D26', '#3B82F6', '#EF4444'].map((c) => (
                          <button
                            key={c}
                            onClick={() => setSettings(s => ({ ...s, color: c }))}
                            className={cn(
                              "w-8 h-8 rounded-full border-2 transition-all",
                              settings.color === c ? "border-[#1A1A1A] scale-110" : "border-transparent"
                            )}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                        <input 
                          type="color"
                          value={settings.color}
                          onChange={(e) => setSettings(s => ({ ...s, color: e.target.value }))}
                          className="w-8 h-8 rounded-full overflow-hidden border-none p-0 cursor-pointer"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <button 
                onClick={fileType === 'image' ? downloadImage : exportVideo}
                disabled={isProcessing}
                className={cn(
                  "w-full py-4 rounded-3xl font-bold flex items-center justify-center gap-3 transition-all active:scale-95",
                  isProcessing 
                    ? "bg-[#F5F5F5] text-[#1A1A1A]/30 cursor-not-allowed" 
                    : "bg-[#1A1A1A] text-white hover:bg-black shadow-xl shadow-black/10"
                )}
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    {t.processing} {Math.round(exportProgress)}%
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    {fileType === 'image' ? t.downloadImage : t.downloadVideo}
                  </>
                )}
              </button>
            </div>

            {/* Preview Area */}
            <div className="lg:col-span-8">
              <div className="bg-white rounded-[2rem] p-4 shadow-sm border border-black/5 overflow-hidden">
                <div className="aspect-video bg-[#F5F5F5] rounded-[1.5rem] relative overflow-hidden flex items-center justify-center group">
                  {fileType === 'image' ? (
                    <canvas 
                      ref={canvasRef}
                      className="max-w-full max-h-full object-contain shadow-2xl"
                    />
                  ) : (
                    <div className="relative w-full h-full flex items-center justify-center">
                      <video 
                        ref={videoRef}
                        src={previewUrl!}
                        controls
                        className="max-w-full max-h-full"
                      />
                      {/* Overlay for real-time preview (CSS based) */}
                      {(() => {
                        // Estimate preview dimensions (container is aspect-video)
                        const containerWidth = 800; // Arbitrary base for scaling
                        const containerHeight = 450;
                        
                        // Estimate content size
                        let contentWidth = 100;
                        let contentHeight = 20;
                        if (settings.type === 'image' && watermarkImage) {
                          contentWidth = settings.imageScale * containerWidth;
                          contentHeight = (watermarkImage.height / watermarkImage.width) * contentWidth;
                        } else {
                          contentWidth = settings.text.length * (settings.fontSize / 4);
                          contentHeight = settings.fontSize / 2;
                        }

                        const coords = getWatermarkCoords(
                          100, 100, // Use percentages for CSS
                          (contentWidth / containerWidth) * 100,
                          (contentHeight / containerHeight) * 100,
                          (settings.padding / containerWidth) * 100,
                          settings.position,
                          settings.movement,
                          currentTime,
                          settings.movementSpeed
                        );

                        const renderContent = () => (
                          settings.type === 'text' ? (
                            <div style={{
                              color: settings.color,
                              fontSize: `${settings.fontSize / 2}px`, // Scaled for preview
                              fontFamily: 'sans-serif',
                              whiteSpace: 'nowrap',
                              textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                            }}>
                              {settings.text}
                            </div>
                          ) : (
                            watermarkImageUrl && (
                              <img 
                                src={watermarkImageUrl} 
                                alt="Watermark Preview" 
                                style={{ width: `${settings.imageScale * 200}px`, height: 'auto' }} 
                              />
                            )
                          )
                        );

                        if (settings.position === 'tile') {
                          const stepX = ((contentWidth + settings.padding * 2) / containerWidth) * 100;
                          const stepY = ((contentHeight + settings.padding * 2) / containerHeight) * 100;
                          
                          let offsetX = coords.x % stepX;
                          let offsetY = coords.y % stepY;
                          if (offsetX > 0) offsetX -= stepX;
                          if (offsetY > 0) offsetY -= stepY;

                          const cols = Math.ceil(100 / stepX) + 1;
                          const rows = Math.ceil(100 / stepY) + 1;
                          const items = [];

                          for (let i = 0; i < cols; i++) {
                            for (let j = 0; j < rows; j++) {
                              items.push(
                                <div 
                                  key={`${i}-${j}`}
                                  className="absolute pointer-events-none"
                                  style={{
                                    left: `${offsetX + i * stepX}%`,
                                    top: `${offsetY + j * stepY}%`,
                                    opacity: settings.opacity,
                                  }}
                                >
                                  {renderContent()}
                                </div>
                              );
                            }
                          }
                          return <>{items}</>;
                        }

                        return (
                          <div 
                            className="absolute pointer-events-none"
                            style={{
                              left: `${coords.x}%`,
                              top: `${coords.y}%`,
                              opacity: settings.opacity,
                            }}
                          >
                            {renderContent()}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                  
                  {/* Info Badge */}
                  <div className="absolute top-6 left-6 px-4 py-2 bg-white/90 backdrop-blur rounded-full text-xs font-bold shadow-sm border border-black/5 flex items-center gap-2">
                    {fileType === 'image' ? <ImageIcon className="w-3 h-3" /> : <VideoIcon className="w-3 h-3" />}
                    {file?.name}
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex items-center justify-between px-4">
                <div className="flex items-center gap-4 text-sm text-[#1A1A1A]/40 font-medium">
                  <span className="flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Real-time Preview</span>
                  <span className="flex items-center gap-1"><Download className="w-3 h-3" /> High Quality Export</span>
                </div>
                <div className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/20">
                  Powered by Browser Canvas API
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
