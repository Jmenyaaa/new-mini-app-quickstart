'use client';

import { useState, useRef } from 'react';
import MintNFTAbi from '../../public/MintNFT.abi.json' assert { type: 'json' };
import { useAccount, useConnect, usePublicClient, useWriteContract } from 'wagmi';
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
  const publicClient = usePublicClient();
  const writeContractResult = useWriteContract();
  const connectResult = useConnect();
  const { connect } = connectResult;
  const connectError = connectResult.error;
  const [connectingId, setConnectingId] = useState<string | null>(null);

  type MintStage = 'idle' | 'uploading' | 'awaitingWallet' | 'txPending' | 'done';
  const [mintStage, setMintStage] = useState<MintStage>('idle');
  const [mintIpfsUrl, setMintIpfsUrl] = useState<string>('');
  const [mintTxHash, setMintTxHash] = useState<`0x${string}` | ''>('');

  const stageText = (stage: MintStage) => {
    switch (stage) {
      case 'uploading':
        return 'Загрузка на IPFS...';
      case 'awaitingWallet':
        return 'Подтвердите транзакцию в кошельке...';
      case 'txPending':
        return 'Транзакция в сети, ждём подтверждения...';
      case 'done':
        return 'Готово: NFT создан!';
      default:
        return '';
    }
  };
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
    setMintStage('idle');
    setMintIpfsUrl('');
    setMintTxHash('');
    if (!processedImage) {
      setError('Сначала примените градиент');
      return;
    }
    if (!address) {
      setError('Подключите кошелёк для минта NFT');
      return;
    }
    setIsMinting(true);
    try {
      setMintStage('uploading');
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

      const contentType = uploadRes.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await uploadRes.text();
        throw new Error(`IPFS upload returned non-JSON (${uploadRes.status}): ${text.slice(0, 200) || 'empty response'}`);
      }

      const uploadData: unknown = await uploadRes.json();
      const asObj = uploadData as Record<string, unknown>;
      if (!uploadRes.ok || asObj.success !== true) {
        const errMsg = (asObj.error as string | undefined) || (asObj.detail as string | undefined) || `Upload failed (${uploadRes.status})`;
        throw new Error(errMsg);
      }

      const ipfsUrl = (asObj.ipfsUrl as string | undefined) || null;
      if (!ipfsUrl || typeof ipfsUrl !== 'string') {
        throw new Error('IPFS URL не получен');
      }
      setMintIpfsUrl(ipfsUrl);

      setMintStage('awaitingWallet');

      // On-chain mint
      const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
      if (!contractAddress) throw new Error('Контракт не настроен');

      const txHash = await writeContractResult.writeContractAsync({
        address: contractAddress as `0x${string}`,
        abi: MintNFTAbi,
        functionName: 'mintNFT',
        args: [address, ipfsUrl],
      });

      setMintTxHash(txHash);
      setMintStage('txPending');

      if (!publicClient) throw new Error('Public client не настроен');
      await publicClient.waitForTransactionReceipt({ hash: txHash });

      setMintStage('done');
      if (onMintComplete) {
        onMintComplete(ipfsUrl, `token-${Date.now()}`);
      }
      setSelectedFile(null);
      setImagePreview('');
      setProcessedImage('');
    } catch (err) {
      console.error('Mint error:', err);
      let msg = 'Ошибка при создании NFT';
      if (err instanceof Error) msg += ': ' + err.message;
      else if (typeof err === 'string') msg += ': ' + err;
      else if (err && typeof err === 'object') msg += ': ' + JSON.stringify(err);
      setError(msg);
      setMintStage('idle');
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>🎨 Создай свой Gradient NFT</h2>

      {/* Информация о коллекции */}
      <div className={styles.section}>
        <div className={styles.collectionInfo}>
          <strong>Коллекция:</strong> Gradient NFT<br />
          <strong>Сеть:</strong> Base<br />
          <strong>Контракт:</strong> <span style={{wordBreak:'break-all'}}>{process.env.NEXT_PUBLIC_CONTRACT_ADDRESS}</span><br />
          <a href={`https://opensea.io/assets/base/${process.env.NEXT_PUBLIC_CONTRACT_ADDRESS}`} target="_blank" rel="noopener noreferrer">Opensea</a>
        </div>
      </div>

      {/* Кнопка подключения кошелька всегда видна */}
      <div className={styles.section}>
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
            disabled={Boolean(connectingId) || !!address}
          >
            {address ? 'MetaMask подключён' : connectingId === 'metaMask' ? 'Подключаю...' : 'MetaMask'}
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
            disabled={Boolean(connectingId) || !!address}
          >
            {address ? 'Coinbase подключён' : connectingId === 'coinbaseWallet' ? 'Подключаю...' : 'Coinbase Wallet'}
          </button>
        </div>
        {connectError && <p className={styles.error}>Ошибка подключения: {formatError(connectError)}</p>}
        {address && <p className={styles.label}>Кошелёк: {address}</p>}
      </div>

      {/* Загрузка фото */}
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

      {mintStage !== 'idle' && (
        <div className={styles.statusBox}>
          <div className={styles.statusRow}>
            <span>Статус</span>
            <span className={styles.statusMuted}>{stageText(mintStage)}</span>
          </div>
          {mintIpfsUrl && (
            <div className={styles.statusRow}>
              <span>IPFS</span>
              <a className={styles.statusLink} href={`https://gateway.lighthouse.storage/ipfs/${mintIpfsUrl.replace('ipfs://', '')}`} target="_blank" rel="noopener noreferrer">
                Открыть
              </a>
            </div>
          )}
          {mintTxHash && (
            <div className={styles.statusRow}>
              <span>Tx</span>
              <a className={styles.statusLink} href={`https://basescan.org/tx/${mintTxHash}`} target="_blank" rel="noopener noreferrer">
                Basescan
              </a>
            </div>
          )}
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {processedImage && (
        <button
          className={styles.mintButton}
          onClick={handleMint}
          disabled={isMinting}
        >
          {isMinting ? '⏳ Минт NFT...' : '🚀 MINT NFT'}
        </button>
      )}
    </div>
  );
}
