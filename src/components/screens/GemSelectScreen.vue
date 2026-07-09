<template>
  <div class="select-screen-bg">
    <div class="select-header">
      <h2 class="select-title-luxury">SELECT GEM</h2>
      <p class="select-sub-text">作る宝石を選んでください</p>
    </div>

    <div class="gem-grid-luxury">
      <div 
        v-for="(gem, key) in GEM_DATA" 
        :key="key" 
        class="gem-card-luxury"
        :class="{ 'is-selected': key === selectedGemKey }"
        :aria-selected="key === selectedGemKey"
        role="button"
        tabindex="0"
        @click="selectGem(key)"
      >
        <div class="gem-image-wrapper">
          <img v-if="gem.resultImage" :src="gem.resultImage" :alt="gem.name" class="gem-card-image" />
        </div>
        
        <div class="gem-name-luxury">{{ gem.name }}</div>
        <div class="gem-method-luxury">{{ gem.method }}</div>
      </div>
    </div>

    <div class="joycon-debug-panel">
      <div>reportId: {{ debugReportId }}</div>
      <div>buttons: {{ debugButtonsHex }}</div>
      <div>armed: {{ isJoyConInputArmed ? 'yes' : 'no' }}</div>
      <div>direction: L={{ debugDirection.left ? '1' : '0' }} R={{ debugDirection.right ? '1' : '0' }} U={{ debugDirection.up ? '1' : '0' }}</div>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { GEM_DATA } from '../../constants/gemData';

// 親(App.vue)へ合図を送る準備
const emit = defineEmits(['select-gem']);

const gemKeys = Object.keys(GEM_DATA);
const selectedGemKey = ref(gemKeys[0] ?? null);
const joyConDevices = new Set();
const isJoyConInputArmed = ref(false);
const joyConInputReadyAt = ref(0);
const debugReportId = ref('--');
const debugButtonsHex = ref('0x00000000');
const debugDirection = ref({ left: false, right: false, up: false });

const selectGem = (key) => {
  selectedGemKey.value = key;
  emit('select-gem', key);
};

const moveSelection = (direction) => {
  if (!gemKeys.length) return;

  const currentIndex = Math.max(0, gemKeys.indexOf(selectedGemKey.value));
  const nextIndex = (currentIndex + direction + gemKeys.length) % gemKeys.length;
  selectedGemKey.value = gemKeys[nextIndex];
};

const confirmSelection = () => {
  if (!selectedGemKey.value) return;
  emit('select-gem', selectedGemKey.value);
};

const readDirectionFromReport = (data) => {
  if (!data || data.byteLength < 4) return { left: false, right: false, up: false };

  const buttons = data.byteLength >= 6
    ? data.getUint8(3) | (data.getUint8(4) << 8) | (data.getUint8(5) << 16)
    : data.getUint8(3);
  const upBit = 0x200;
  const rightBit = 0x400;
  const leftBit = 0x800;

  return {
    left: (buttons & leftBit) !== 0,
    right: (buttons & rightBit) !== 0,
    up: (buttons & upBit) !== 0,
  };
};

let previousDirection = { left: false, right: false, up: false };

const handleJoyConInputReport = (event) => {
  debugReportId.value = `0x${event.reportId.toString(16).padStart(2, '0')}`;
  if (event.reportId !== 0x30) return;

  const direction = readDirectionFromReport(event.data);
  const buttons = event.data?.byteLength >= 6
    ? event.data.getUint8(3) | (event.data.getUint8(4) << 8) | (event.data.getUint8(5) << 16)
    : event.data?.byteLength >= 4
      ? event.data.getUint8(3)
      : 0;
  debugButtonsHex.value = `0x${buttons.toString(16).padStart(buttons > 0xff ? 6 : 2, '0')}`;
  debugDirection.value = direction;

  if (Date.now() < joyConInputReadyAt.value) {
    previousDirection = direction;
    return;
  }

  if (!isJoyConInputArmed.value) {
    if (!direction.left && !direction.right && !direction.up) {
      isJoyConInputArmed.value = true;
    }

    previousDirection = direction;
    return;
  }

  if (direction.left && !previousDirection.left) {
    event.preventDefault?.();
    moveSelection(-1);
  }

  if (direction.right && !previousDirection.right) {
    event.preventDefault?.();
    moveSelection(1);
  }

  if (direction.up && !previousDirection.up) {
    event.preventDefault?.();
    confirmSelection();
  }

  previousDirection = direction;
};

const attachJoyConDevice = (device) => {
  if (!device || joyConDevices.has(device)) return;
  if (device.vendorId !== 0x057e) return;

  joyConDevices.add(device);
  device.addEventListener('inputreport', handleJoyConInputReport);
};

const detachJoyConDevice = (device) => {
  if (!device || !joyConDevices.has(device)) return;

  device.removeEventListener('inputreport', handleJoyConInputReport);
  joyConDevices.delete(device);
};

const syncJoyConDevices = async () => {
  if (!navigator.hid?.getDevices) return;

  const devices = await navigator.hid.getDevices();
  devices.forEach(attachJoyConDevice);
};

const handleJoyConConnect = (event) => {
  attachJoyConDevice(event.device);
};

const handleJoyConDisconnect = (event) => {
  detachJoyConDevice(event.device);
};

const handleKeyDown = (event) => {
  const key = event.key.toLowerCase();

  if (key === 'arrowleft' || key === 'left') {
    event.preventDefault();
    moveSelection(-1);
    return;
  }

  if (key === 'arrowright' || key === 'right') {
    event.preventDefault();
    moveSelection(1);
    return;
  }

  if (key === 'arrowup' || key === 'up') {
    event.preventDefault();
    confirmSelection();
  }
};

onMounted(() => {
  isJoyConInputArmed.value = false;
  joyConInputReadyAt.value = Date.now() + 1500;
  void syncJoyConDevices();
  window.addEventListener('keydown', handleKeyDown);

  if (navigator.hid?.addEventListener) {
    navigator.hid.addEventListener('connect', handleJoyConConnect);
    navigator.hid.addEventListener('disconnect', handleJoyConDisconnect);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown);

  if (navigator.hid?.removeEventListener) {
    navigator.hid.removeEventListener('connect', handleJoyConConnect);
    navigator.hid.removeEventListener('disconnect', handleJoyConDisconnect);
  }

  joyConDevices.forEach(detachJoyConDevice);
  previousDirection = { left: false, right: false, up: false };
  isJoyConInputArmed.value = false;
  joyConInputReadyAt.value = 0;
});
</script>

<style scoped>
/* --- 宝石選択画面 --- */
.select-screen-bg {
  position: absolute;
  top: 0; left: 0;
  width: 100vw; height: 100vh;
  background-color: #faf9f6; 
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 10vh;
  z-index: 100;
}

.select-header {
  text-align: center;
  margin-bottom: 50px;
}

.select-title-luxury {
  font-family: "Yu Mincho", "MS PMincho", serif;
  font-size: 3.5rem;
  font-weight: normal;
  color: #111111;
  letter-spacing: 0.15em;
  margin: 0 0 10px 0;
}

.select-sub-text {
  font-family: "Yu Mincho", "MS PMincho", serif;
  font-size: 1.5rem;
  font-weight: bold;
  color: #666666;
  letter-spacing: 0.2em;
  margin-bottom: 25px;
}

/* 宝石を並べるグリッド（ショーケース風） */
.gem-grid-luxury {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 30px;
  max-width: 1000px;
  width: 90%;
}

/* --- 宝石のカードデザイン --- */
.gem-card-luxury {
  background: #ffffff;
  border: 2px solid transparent; 
  padding: 30px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
  position: relative;
}

.gem-card-luxury.is-selected {
  border-color: #111111;
  transform: translateY(-6px);
  box-shadow: 0 15px 30px rgba(0, 0, 0, 0.12);
}

.gem-card-luxury:hover {
  transform: translateY(-8px);
  box-shadow: 0 15px 30px rgba(0, 0, 0, 0.1);
  border: 2px solid #111111; 
}

.gem-card-luxury.is-selected:hover {
  transform: translateY(-10px);
}

.gem-image-wrapper {
  height: 120px;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 20px;
}

.gem-card-image {
  max-width: 100px;
  max-height: 100px;
  object-fit: contain;
  filter: drop-shadow(0 10px 15px rgba(0, 0, 0, 0.1));
  transition: transform 0.3s ease;
}

.gem-card-luxury:hover .gem-card-image {
  transform: scale(1.15);
}

.gem-name-luxury {
  font-family: "Yu Mincho", "MS PMincho", serif;
  font-size: 1.8rem;
  color: #111111;
  font-weight: bold;
  letter-spacing: 0.1em;
  margin-bottom: 10px;
}

.gem-method-luxury {
  font-family: sans-serif;
  font-size: 0.9rem;
  color: #888888;
  letter-spacing: 0.05em;
  font-weight: bold;
}

.joycon-debug-panel {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 200;
  min-width: 220px;
  padding: 12px 14px;
  background: rgba(17, 17, 17, 0.86);
  color: #ffffff;
  font-family: monospace;
  font-size: 12px;
  line-height: 1.5;
  border: 1px solid rgba(255, 255, 255, 0.16);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.2);
  pointer-events: none;
  user-select: none;
}

.gem-card-luxury:focus {
  outline: none;
}

.gem-card-luxury:focus-visible {
  border-color: #111111;
}
</style>