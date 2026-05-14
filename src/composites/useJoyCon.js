import { ref } from 'vue';

export function useJoyCon() {
  const hidDevice = ref(null);
  const counter = ref(0);
  const lastAccel = ref({ x: 0, y: 0, z: 0 });
  const canAddProgress = ref(true);
  const isSimulated = ref(false);
  const irPointer = ref({ x: 0, y: 0 });

  const connect = async (simulate = false) => {
    if (simulate) {
      isSimulated.value = true;
      return true;
    }
    try {
      const devices = await navigator.hid.requestDevice({ filters: [{ vendorId: 0x057e }] });
      if (!devices.length) return false;
      hidDevice.value = devices[0];
      await hidDevice.value.open();

      const send = (sub) => {
        const cmd = new Uint8Array([counter.value++ & 0x0F, 0x00, 0x01, 0x40, 0x40, 0x00, 0x01, 0x40, 0x40, ...sub]);
        return hidDevice.value.sendReport(0x01, cmd);
      };

      await send([0x48, 0x01]); // 振動有効
      await new Promise(r => setTimeout(r, 200));
      await send([0x40, 0x01]); // センサー有効
      await new Promise(r => setTimeout(r, 200));
      await send([0x03, 0x30]); // フルレポート
      isSimulated.value = false;
      return true;
    } catch (e) { return false; }
  };

  const triggerVibration = async (time = 50) => {
    if (!hidDevice.value || isSimulated.value) return;
    const cmd = new Uint8Array([counter.value++ & 0x0F, 0xb0, 0x01, 0x40, 0x40, 0xb0, 0x01, 0x40, 0x40]);
    await hidDevice.value.sendReport(0x10, cmd);
    setTimeout(async () => {
      const stop = new Uint8Array([counter.value++ & 0x0F, 0x00, 0x01, 0x40, 0x40, 0x00, 0x01, 0x40, 0x40]);
      await hidDevice.value.sendReport(0x10, stop);
    }, time);
  };

  return { hidDevice, connect, triggerVibration, lastAccel, canAddProgress, isSimulated };
}