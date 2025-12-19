'use client';

import { useState, useRef } from 'react';
import { useAccount, useConnect } from 'wagmi';
import { metaMask, coinbaseWallet } from '@wagmi/connectors';
import styles from './nftMinter.module.css';

interface GradientPreset {
  name: string;
  colors: [string, string];
}

const GRADIENT_PRESETS: GradientPreset[] = [
  { name: 'Sunset', colors: ['#FF6B6B', '#FFE66D'] },
  { name: 'Ocean', colors: ['#667eea', '#764ba2'] },
  { name: 'Forest', colors: ['#134E5E', '#71B280'] },
  { name: 'Neon', colors: ['#FF006E', '#00F5FF'] },
  { name: 'Purple Dream', colors: ['#a8edea', '#fed6e3'] },
  { name: 'Fire', colors: ['#FF0000', '#FFA500'] },
];

interface NFTMinterProps {
  onMintComplete?: (ipfsUrl: string, tokenId: string) => void;
}

export default function NFTMinter({ onMintComplete }: NFTMinterProps) {
  const { address } = useAccount();
  const connectResult = useConnect();
  const { connect } = connectResult;
  const connectError = connectResult.error;
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const formatError = (e: unknown) => {
    if (!e) return '';
    if (typeof e === 'string') return e;
    if (e instanceof Error) return e.message;
    return String((e as Record<string, unknown>)?.message ?? e);
  };
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [selectedGradient, setSelectedGradient] = useState<[string, string]>(GRADIENT_PRESETS[0].colors);
  const [processedImage, setProcessedImage] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [error, setError] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const applyGradient = async () => {
    if (!imagePreview || !canvasRef.current) return;

    setIsProcessing(true);
    try {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current!;
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;

        ctx.drawImage(img, 0, 0);

        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, selectedGradient[0]);
        gradient.addColorStop(1, selectedGradient[1]);

        ctx.globalAlpha = 0.4;
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const processedUrl = canvas.toDataURL('image/png');
        setProcessedImage(processedUrl);
      };
      img.src = imagePreview;
    } catch (err) {
      console.error('Error applying gradient:', err);
      setError('Ошибка при применении градиента');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMint = async () => {
    setError('');
    
    if (!processedImage) {
      setError('Сначала примените градиент');
      return;
    }

    // Allow IPFS upload even if wallet is not connected — on-chain mint can be done later

    setIsMinting(true);
    try {
      const response = await fetch(processedImage);
      const blob = await response.blob();
      const file = new File([blob], 'gradient-nft.png', { type: 'image/png' });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('metadata', JSON.stringify({
        name: `Gradient NFT #${Date.now()}`,
        description: 'Generated with gradient effect on Base',
        gradient: selectedGradient,
        imageSize: { width: canvasRef.current?.width, height: canvasRef.current?.height },
      }));

      const uploadRes = await fetch('/api/ipfs/upload', {
        method: 'POST',
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadData.success) {
        throw new Error(uploadData.error || uploadData.detail || 'Unknown upload error');
      }

      const ipfsUrl = uploadData.ipfsUrl || (uploadData.result && (uploadData.result.url || uploadData.result.ipnft)) || null;

      alert(`✅ Изображение загружено на IPFS!\nIPFS URL: ${ipfsUrl}`);
      
      if (onMintComplete) {
        onMintComplete(ipfsUrl, `token-${Date.now()}`);
      }

      setSelectedFile(null);
      setImagePreview('');
      setProcessedImage('');
    } catch (err) {
      console.error('Mint error:', err);
      setError('Ошибка при создании NFT');
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>🎨 Создай свой Gradient NFT</h2>

      <div className={styles.section}>
        <label className={styles.fileInput}>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            disabled={isProcessing || isMinting}
          />
          <span>{selectedFile ? '✓ Фото выбрано' : '📸 Выберите фото'}</span>
        </label>
      </div>

      {!address && (
        <div className={styles.section}>
          <p className={styles.label}>Подключите кошелёк для on‑chain действий</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className={styles.connectButton}
              onClick={async () => {
                try {
                  setConnectingId('metaMask');
                  await connect({ connector: metaMask() });
                } finally {
                  setConnectingId(null);
                }
              }}
              disabled={Boolean(connectingId)}
            >
              {connectingId === 'metaMask' ? 'Подключаю...' : 'MetaMask'}
            </button>
            <button
              className={styles.connectButton}
              onClick={async () => {
                try {
                  setConnectingId('coinbaseWallet');
                  await connect({ connector: coinbaseWallet() });
                } finally {
                  setConnectingId(null);
                }
              }}
              disabled={Boolean(connectingId)}
            >
              {connectingId === 'coinbaseWallet' ? 'Подключаю...' : 'Coinbase Wallet'}
            </button>
          </div>
          {connectError && <p className={styles.error}>Ошибка подключения: {formatError(connectError)}</p>}
        </div>
      )}

      {imagePreview && (
        <div className={styles.section}>
          <p className={styles.label}>Оригинальное фото:</p>
          <img src={imagePreview} alt="Preview" className={styles.previewImage} />
        </div>
      )}

      {imagePreview && (
        <div className={styles.section}>
          <p className={styles.label}>Выберите градиент:</p>
          <div className={styles.gradientGrid}>
            {GRADIENT_PRESETS.map((preset) => (
              <button
                key={preset.name}
                className={`${styles.gradientButton} ${
                  selectedGradient === preset.colors ? styles.active : ''
                }`}
                style={{
                  background: `linear-gradient(135deg, ${preset.colors[0]}, ${preset.colors[1]})`,
                }}
                onClick={() => setSelectedGradient(preset.colors)}
                title={preset.name}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {imagePreview && !processedImage && (
        <button
          className={styles.button}
          onClick={applyGradient}
          disabled={isProcessing || isMinting}
        >
          {isProcessing ? '⏳ Применяю...' : '✨ Применить градиент'}
        </button>
      )}

      {processedImage && (
        <div className={styles.section}>
          <p className={styles.label}>Результат:</p>
          <img src={processedImage} alt="Processed" className={styles.previewImage} />
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {processedImage && (
        <button
          className={styles.mintButton}
          onClick={handleMint}
          disabled={isMinting}
        >
          {isMinting ? '⏳ Создаю NFT...' : address ? '🚀 MINT NFT' : '⬆️ Загрузить на IPFS'}
        </button>
      )}
    </div>
  );
}
