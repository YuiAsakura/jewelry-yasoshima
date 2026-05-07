/**
 * 宝石ごとの物理設定データ
 */
export const GEM_CONFIG = {
  DIAMOND: { shakeThreshold: 22000, rotationThreshold: 1200, vibration: { lowHz: 400, highHz: 800, amp: 0.8, time: 100 } },
  RUBY: { 
    shakeThreshold: 10000, 
    rotationThreshold: 1000, // ツールで調整した「回す力の閾値」
    vibration: { lowHz: 160, highHz: 320, amp: 0.6, time: 80 } 
  },
  SAPPHIRE: { shakeThreshold: 18000, rotationThreshold: 1100, vibration: { lowHz: 140, highHz: 450, amp: 0.5, time: 100 } },
  EMERALD: { shakeThreshold: 12000, rotationThreshold: 900, vibration: { lowHz: 220, highHz: 280, amp: 0.7, time: 120 } },
  TOPAZ: { shakeThreshold: 14000, rotationThreshold: 1000, vibration: { lowHz: 180, highHz: 350, amp: 0.6, time: 100 } },
  AMETHYST: { shakeThreshold: 13000, rotationThreshold: 950, vibration: { lowHz: 200, highHz: 300, amp: 0.6, time: 100 } }
};

/**
 * 振りの計算 (Delta)
 */
export function getShakeDelta(current, last) {
  if (!last) return 0;
  return Math.abs(current.x - last.x) + Math.abs(current.y - last.y) + Math.abs(current.z - last.z);
}

/**
 * 遠心力（合成加速度）の計算
 * - Joy-Con を持っているだけの微振動では値が上がりにくいよう、1G からのズレだけを使う。
 * - ユーザーが提供した実機で動作確認済みの式に寄せる。
 * @param {{x:number,y:number,z:number}} current
 * @returns {number} 遠心力スコア
 */
export function getCentrifugal(current) {
  const accelMag = Math.sqrt(current.x * current.x + current.y * current.y + current.z * current.z);
  return Math.abs(accelMag - 4000);
}