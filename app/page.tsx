"use client";
import { useEffect } from "react";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import NFTMinter from './components/NFTMinter';
import styles from "./page.module.css";

export default function Home() {
  const { isFrameReady, setFrameReady } = useMiniKit();

  // Initialize the miniapp
  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [setFrameReady, isFrameReady]);

  return (
    <div className={styles.container}>
      <button className={styles.closeButton} type="button">
        ✕
      </button>
      <div className={styles.content}>
        <div className={styles.waitlistForm}>
          <NFTMinter />
        </div>
      </div>
    </div>
  );
}
