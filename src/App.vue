<script setup>
import { onMounted, ref } from 'vue';
import { useJoyCon } from './composites/useJoyCon';
import { useGameState, PROGRESS_MAX } from './composites/useGameState';
import VisualArea from './components/VisualArea.vue';
import { GEM_DATA } from './constants/gemData';

// --- 追加: 外部ロジックの読込 ---
import { getShakeDelta, getCentrifugal, GEM_CONFIG } from './composites/sensorLogic.js';
import { sendVibration } from './composites/vibrate.js';

const { hidDevice, connect, triggerVibration, lastAccel, canAddProgress, isSimulated } = useJoyCon();
const { 
  currentScreen, selectedGemKey, selectedGem, 
  currentStep, currentStepIndex, progress, timeLeft, 
  lastAngle, resetGame, nextStep, isCountingDown, countdown 
} = useGameState();

const lastButtonState = ref(0); // 数値(0x00など)で比較するため初期値を変更
let packetCounter = 0; // 振動パケット用

/**
 * 進捗加算と宝石に応じた振動を実行する関数
 */
const performAction = (amount) => {
  if (progress.value < PROGRESS_MAX) {
    progress.value = Math.min(progress.value + amount, PROGRESS_MAX);
    
    // 現在選んでいる宝石の設定を呼び出す
    const config = GEM_CONFIG[selectedGemKey.value] || GEM_CONFIG.RUBY;
    sendVibration(hidDevice.value, packetCounter++, config.vibration);
  }
};

/**
 * Joy-Conの入力レポート解析
 */
/**
 * Joy-Conの入力レポート解析
 */
const handleInputReport = (event) => {
  if (event.reportId !== 0x30 || currentScreen.value !== 'game' || isCountingDown.value) return;
  const { data } = event;

  const config = GEM_CONFIG[selectedGemKey.value] || GEM_CONFIG.RUBY;

  // 1. ボタン入力 (b4) - mash工程用
  const b4 = data.getUint8(4);
  if (currentStep.value.id.includes('mash') && b4 !== 0x00 && b4 !== lastButtonState.value) {
    performAction(6);
  }
  lastButtonState.value = b4;

  // 2. 加速度の取得
  const currentAccel = { 
    x: data.getInt16(12, true), 
    y: data.getInt16(14, true), 
    z: data.getInt16(16, true) 
  };

  // --- DEBUG: inputreport の生データと現在のステップを表示 ---
  try { console.log('[DEBUG] inputreport', { step: currentStep.value, accel: currentAccel, rotationThreshold: config.rotationThreshold }); } catch(e) {}

  // --- Shake工程 (激しく振る) ---
  if (currentStep.value.id.includes('shake')) {
    const delta = getShakeDelta(currentAccel, lastAccel.value);
    if (delta > config.shakeThreshold && canAddProgress.value) {
      performAction(10);
      throttle(120);
    }
  }

  // --- Rotate工程 (NEW: ジョイコン自体をゆっくり回す) ---
  if (currentStep.value.id.includes('centrifugal')) {
    const centrifugal = getCentrifugal(currentAccel, lastAccel.value);
    if (centrifugal > config.rotationThreshold) {
      const rotationGain = Math.min((centrifugal - config.rotationThreshold) / 120, 14);
      progress.value = Math.min(progress.value + rotationGain, PROGRESS_MAX);

      // 閾値を超えているときだけ振動する
      if (canAddProgress.value) {
        const vibrationConfig = config.vibration;
        sendVibration(hidDevice.value, packetCounter++, vibrationConfig);
        throttle(100);
      }
    }
  }

  lastAccel.value = currentAccel;
};

// スロットル関数（再掲：canAddProgressを制御）
const throttle = (ms) => {
  canAddProgress.value = false;
  setTimeout(() => canAddProgress.value = true, ms);
};

/**
 * メインループ (変更なし)
 */
onMounted(() => {
  window.addEventListener('keydown', (e) => {
    if (currentScreen.value !== 'game' || isCountingDown.value || !isSimulated.value) return;
    const key = e.key.toLowerCase();
    if (key === 'r' && currentStep.value.id.includes('rotate')) progress.value = Math.min(progress.value + 5, PROGRESS_MAX);
    if (key === 's' && currentStep.value.id.includes('shake')) progress.value = Math.min(progress.value + 8, PROGRESS_MAX);
    if (key === 'm' && currentStep.value.id.includes('mash')) progress.value = Math.min(progress.value + 6, PROGRESS_MAX);
  });

  setInterval(() => {
    if (currentScreen.value !== 'game') return;

    if (isCountingDown.value) {
      if (countdown.value > -0.8) {
        countdown.value = parseFloat((countdown.value - 0.1).toFixed(1));
      } else {
        isCountingDown.value = false;
      }
      return; 
    }

    timeLeft.value = Math.max(0, timeLeft.value - 0.1);

    const gp = navigator.getGamepads()[0];
    // --- DEBUG: gamepad の軸とステップ情報を定期的に出力 ---
    try { console.log('[DEBUG] gp-loop', { axes: gp ? Array.from(gp.axes).slice(0,4) : null, step: currentStep.value, lastAngle: lastAngle.value }); } catch(e) {}
    if (gp && currentStep.value.id.includes('rotate')) {
      const sx = gp.axes[0]; const sy = gp.axes[1];
      // スティックの有効半径閾値を少し下げて回転検出を緩くする
      if (Math.sqrt(sx * sx + sy * sy) > 0.3) {
        const curAngle = Math.atan2(sy, sx);
        if (lastAngle.value !== null) {
          let diff = Math.abs(curAngle - lastAngle.value);
          if (diff > Math.PI) diff = Math.abs(diff - 2 * Math.PI);
          if (progress.value < PROGRESS_MAX) progress.value = Math.min(progress.value + (diff * 2.5), PROGRESS_MAX);
        }
        lastAngle.value = curAngle;
      }
    }

    if (timeLeft.value <= 0) {
      nextStep();
    }
  }, 100);
});

const startApp = async (simulate) => {
  if (await connect(simulate)) {
    if (!simulate) hidDevice.value.oninputreport = handleInputReport;
    currentScreen.value = 'select';
  }
};
</script>

<template>
  
  <div class="app-ui-blue">
    <!-- タイトル画面 -->
    <div v-if="currentScreen === 'title'" class="screen-box">
      <h1 class="glow-text">JEWELRY YASOSHIMA</h1>
      <div class="btn-group">
        <button class="blue-btn-main" @click="startApp(false)">JOY-CON 接続</button>
        <button class="blue-btn-sub" @click="startApp(true)">JOY-CON なしでテスト</button>
      </div>
    </div>

    <!-- 宝石選択画面 -->
    <div v-if="currentScreen === 'select'" class="screen-box">
      <h2 class="sub-title">SELECT GEM</h2>
      <div class="gem-grid">
        <div 
          v-for="(gem, key) in GEM_DATA" 
          :key="key" 
          class="gem-card"
          @click="resetGame(key)"
        >
          <div class="gem-name">{{ gem.name }}</div>
          <div class="gem-method">{{ gem.method }}</div>
        </div>
      </div>
    </div>

    <!-- ゲームプレイ画面 -->
    <div v-if="currentScreen === 'game'" class="game-layout"> 
      <div v-if="isCountingDown" class="countdown-overlay">
        <div class="countdown-number" :class="{ 'start-text': Math.ceil(countdown) <= 0 }">
          {{ Math.ceil(countdown) > 0 ? Math.ceil(countdown) : 'START!' }}
        </div>
        <div class="countdown-label" v-if="Math.ceil(countdown) > 0">READY</div>
      </div>

      <div :class="{ 'ui-blur': isCountingDown }">
        <VisualArea :step="currentStep" />
        <div class="header-info">
          <div class="step-badge">STEP {{ currentStepIndex + 1 }}</div>
          <h2 class="step-title">{{ currentStep.label }}</h2>
          <p class="step-hint-text">{{ currentStep.hint }}</p>
        </div>

        <div class="gauge-bar-outer">
          <div class="gauge-bar-inner" :style="{ width: Math.min((progress / PROGRESS_MAX) * 100, 100) + '%' }"></div>
        </div>
        <div class="gauge-value">{{ progress.toFixed(1) }} / {{ PROGRESS_MAX }}</div>
        <div class="timer-display" :class="{ 'timer-low': timeLeft < 5 }">
          {{ timeLeft.toFixed(1) }}<span>s</span>
        </div>

        <p v-if="isSimulated" class="debug-hint">
          テスト操作: [R]回転 [S]振る [M]連打
        </p>
      </div>
    </div>

    <!-- 結果画面 -->
    <div v-if="currentScreen === 'result'" class="screen-box">
      <h1 class="glow-text">完成！</h1>
      <p class="result-msg">{{ selectedGem.name }} が出来上がりました。</p>
      <button class="blue-btn-main" @click="currentScreen = 'select'">もう一度作る</button>
    </div>
  </div>
</template>

<style>
.gauge-value {
  margin-top: 8px;
  font-size: 0.95rem;
  color: #8fb4ff;
  letter-spacing: 0.04em;
}

.result-msg {
  font-size: 1.5rem;
  margin-bottom: 40px;
  color: #ccd6f6;
}
</style>