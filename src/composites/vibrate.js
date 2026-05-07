export function encodeRumble(lowHz, highHz, amp) {
  const hf = Math.min(Math.max(Math.round((Math.log2(highHz / 10) * 32) - 0x60), 0), 255);
  const lf = Math.min(Math.max(Math.round((Math.log2(lowHz / 10) * 32) - 0x40), 0), 255);
  const ha = Math.round(amp * 100);
  return [hf & 0xFF, ha & 0xFF, lf & 0xFF, ha & 0xFF];
}

export async function sendVibration(device, counter, params) {
  if (!device) return;
  const { lowHz, highHz, amp, time } = params;
  const [b0, b1, b2, b3] = encodeRumble(lowHz, highHz, amp);
  
  // 1. 振動データの「箱」を作る（カウンター + 8バイトの振動レシピ）
  // counter & 0x0F: パケットが何番目かの番号
  // b0, b1, b2, b3: 右モーターの振動（周波数や強さ）
  // b0, b1, b2, b3: 左モーターの振動
  const startReport = new Uint8Array([counter & 0x0F, b0, b1, b2, b3, b0, b1, b2, b3]);
  
  // 2. ブラウザの機能を使ってJoy-Conに「特急便(0x10)」で送る！
  await device.sendReport(0x10, startReport);

  setTimeout(async () => {
    // 指定時間後に振動を止める
    const stopReport = new Uint8Array([(counter + 1) & 0x0F, 0x00, 0x01, 0x40, 0x40, 0x00, 0x01, 0x40, 0x40]);
    await device.sendReport(0x10, stopReport);
  }, time);
}