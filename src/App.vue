<script setup>
import { onMounted, ref, computed } from 'vue';
import { useJoyCon } from './composites/useJoyCon';
import { useGameState, PROGRESS_MAX } from './composites/useGameState';
import VisualArea from './components/VisualArea.vue';
import { GEM_DATA } from './constants/gemData';
import Vue3StarRatings from 'vue3-star-ratings';

// --- 追加: 外部ロジックの読込 ---
import { getShakeDelta, getCentrifugal, GEM_CONFIG } from './composites/sensorLogic.js';
import { sendVibration } from './composites/vibrate.js';

const { hidDevice, connect, lastAccel, canAddProgress, isSimulated } = useJoyCon();
const { 
  currentScreen, selectedGemKey, selectedGem, 
  currentStep, currentStepIndex, progress, timeLeft, 
  lastAngle, resetGame, nextStep, isCountingDown, countdown,
  averageProgressRate, gameRank
} = useGameState();

// Pointer ステップ用の状態管理
const pointerTarget = ref({ x: 0, y: 0 });
const gyroCursor = ref({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
const pointerHitCount = ref(0);
const pointerLastHitTime = ref(0);
const pointerCalibrationTime = ref(0); // キャリブレーション開始時刻
const pointerNeedsCalibration = ref(false); // キャリブレーション待機フラグ
const lastResetButtonState = ref(0); // ポインター判定リセット用ボタンの前回状態
const pointerHitThreshold = 80; // ピクセル単位の誤差許容度
const pointerHoldDuration = 600; // ミリ秒（この時間ポインターがターゲット内にいたら判定）
const pointerCalibrationDuration = 200; // キャリブレーション時間（ミリ秒）
const pointerResetButtonMask = 0x20; // ボタンマスク（環境差あり。必要なら調整）

// ジャイロキャリブレーション用
const gyroCalibration = ref({ x: 0, y: 0, z: 0 }); // 初期化時の基準値
const gyroFiltered = ref({ x: 0, y: 0, z: 0 }); // フィルタ済み値
const gyroFilterAlpha = 0.3; // 低パスフィルタの係数（0-1、低いほどスムーズ）
const gyroDeadzone = 800; // デッドゾーン（これより小さい傾きは無視）
const gyroCursorSpeed = 0.6; // カーソル移動速度

const calibrateGyro = (accel) => {
  // 初期化時の加速度を基準値として保存
  gyroCalibration.value = { ...accel };
};

const generatePointerTarget = () => {
  const minX = 120, maxX = window.innerWidth - 120;
  const minY = 200, maxY = window.innerHeight - 100;

  const centerX = window.innerWidth / 2;
  const avoidHalfWidth = Math.min(220, (maxX - minX) / 2 - 20);
  const avoidHalfHeight = Math.min(160, (maxY - minY) / 2 - 20);

  let x = centerX;
  let y = (minY + maxY) / 2;
  let tries = 0;

  // 画面中央の十字（縦帯または横帯）を避けるまで再抽選
  do {
    x = Math.random() * (maxX - minX) + minX;
    y = Math.random() * (maxY - minY) + minY;
    tries++;
  } while (
    tries < 30 &&
    (Math.abs(x - centerX) < avoidHalfWidth || Math.abs(y - (minY + maxY) / 2) < avoidHalfHeight)
  );

  pointerTarget.value = { x, y };
};

const getPointerDistance = () => {
  const dx = gyroCursor.value.x - pointerTarget.value.x;
  const dy = gyroCursor.value.y - pointerTarget.value.y;
  return Math.sqrt(dx * dx + dy * dy);
};

const resetPointerJudgement = () => {
  pointerLastHitTime.value = 0;
  pointerCalibrationTime.value = Date.now();
  pointerNeedsCalibration.value = true;
};

const applyLowPassFilter = (current, previous, alpha) => {
  return previous + alpha * (current - previous);
};

const updateGyroCursor = (accel) => {
  // 低パスフィルタを適用
  gyroFiltered.value.x = applyLowPassFilter(accel.x, gyroFiltered.value.x, gyroFilterAlpha);
  gyroFiltered.value.y = applyLowPassFilter(accel.y, gyroFiltered.value.y, gyroFilterAlpha);
  gyroFiltered.value.z = applyLowPassFilter(accel.z, gyroFiltered.value.z, gyroFilterAlpha);

  // キャリブレーションオフセットを差し引く
  const adjX = gyroFiltered.value.x - gyroCalibration.value.x;
  const adjY = gyroFiltered.value.y - gyroCalibration.value.y;
  const adjZ = gyroFiltered.value.z - gyroCalibration.value.z;

  // デッドゾーンチェック
  const xMagnitude = Math.abs(adjX);
  const yMagnitude = Math.abs(adjY);
  
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;
  
  let newX = gyroCursor.value.x;
  let newY = gyroCursor.value.y;

  // 常に中心基準で計算し、デッドゾーン以下はスケーリングして滑らかに中心へ移動させる
  const factorX = Math.min(1, yMagnitude / gyroDeadzone); // X移動は adjY/adjZ に依存
  const angleX = Math.atan2(adjY, adjZ) * 180 / Math.PI;
  const deltaX = (angleX / 25) * centerX * gyroCursorSpeed * factorX;
  newX = centerX + deltaX;

  const factorY = Math.min(1, xMagnitude / gyroDeadzone); // Y移動は adjX/adjZ に依存
  const angleY = -Math.atan2(adjX, adjZ) * 180 / Math.PI; // 画面座標系に合わせて反転
  const deltaY = (angleY / 25) * centerY * gyroCursorSpeed * factorY;
  newY = centerY + deltaY;
  
  // スクリーン端でクリップ
  gyroCursor.value.x = Math.max(0, Math.min(window.innerWidth, newX));
  gyroCursor.value.y = Math.max(0, Math.min(window.innerHeight, newY));
};

const resetGameWithPointerInit = (key) => {
  resetGame(key);
  if (GEM_DATA[key].steps[0]?.id.includes('pointer')) {
    pointerHitCount.value = 0;
    pointerLastHitTime.value = 0;
    lastResetButtonState.value = 0;
    pointerCalibrationTime.value = Date.now();
    pointerNeedsCalibration.value = true;
    gyroCalibration.value = { x: 0, y: 0, z: 0 };
    gyroFiltered.value = { x: 0, y: 0, z: 0 };
    generatePointerTarget();
  }
};

const rankValue = computed(() => {
  if (gameRank.value === 'S') return 3;
  if (gameRank.value === 'A') return 2;
  if (gameRank.value === 'B') return 1;
  return 0;
});
const resultGemImageSrc = computed(() => {
  const steps = selectedGem.value?.steps || [];
  const found = steps.find((step) => typeof step.image === 'string' && step.image.trim() !== '');
  return found?.image || '';
});

const lastButtonState = ref(0); // 数値(0x00など)で比較するため初期値を変更
let packetCounter = 0; // 振動パケット用

/**
 * 進捗加算のみを行う関数（振動は工程ごとに個別制御）
 */
const performAction = (amount) => {
  if (progress.value < PROGRESS_MAX) {
    progress.value = Math.min(progress.value + amount, PROGRESS_MAX);
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
  const b3 = data.getUint8(3);
  const b4 = data.getUint8(4);
  if (currentStep.value.id.includes('mash') && b4 !== 0x00 && b4 !== lastButtonState.value) {
    performAction(6);
    sendVibration(hidDevice.value, packetCounter++, config.vibration);
  }
  lastButtonState.value = b4;

  // 2. 加速度の取得
  const currentAccel = { 
    x: data.getInt16(12, true), 
    y: data.getInt16(14, true), 
    z: data.getInt16(16, true) 
  };

  // --- Pointer ステップのジャイロ処理 ---
  if (currentStep.value?.id.includes('pointer')) {
    const resetPressed = (b3 & pointerResetButtonMask) !== 0 && (lastResetButtonState.value & pointerResetButtonMask) === 0;
    if (resetPressed) {
      resetPointerJudgement();
    }
    lastResetButtonState.value = b3;

    // キャリブレーション期間中は加速度を累積
    if (pointerNeedsCalibration.value && Date.now() - pointerCalibrationTime.value < pointerCalibrationDuration) {
      calibrateGyro(currentAccel);
    } else if (pointerNeedsCalibration.value) {
      // キャリブレーション完了
      pointerNeedsCalibration.value = false;
    } else {
      // 通常のカーソル移動
      updateGyroCursor(currentAccel);
    }
  }

  // --- DEBUG: inputreport の生データと現在のステップを表示 ---
  try { console.log('[DEBUG] inputreport', { step: currentStep.value, accel: currentAccel, rotationThreshold: config.rotationThreshold }); } catch(e) {}

  // --- Shake工程 (激しく振る) ---
  if (currentStep.value.id.includes('shake')) {
    const delta = getShakeDelta(currentAccel, lastAccel.value);
    if (delta > config.shakeThreshold && canAddProgress.value) {
      performAction(10);
      sendVibration(hidDevice.value, packetCounter++, config.vibration);
      throttle(120);
    }
  }

  // --- centrifugal工程 (NEW: ジョイコン自体をゆっくり回す) ---
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
    // Pointer テスト: 矢印キーでカーソル移動
    if (key === 'arrowup' && currentStep.value.id.includes('pointer')) gyroCursor.value.y = Math.max(0, gyroCursor.value.y - 20);
    if (key === 'arrowdown' && currentStep.value.id.includes('pointer')) gyroCursor.value.y = Math.min(window.innerHeight, gyroCursor.value.y + 20);
    if (key === 'arrowleft' && currentStep.value.id.includes('pointer')) gyroCursor.value.x = Math.max(0, gyroCursor.value.x - 20);
    if (key === 'arrowright' && currentStep.value.id.includes('pointer')) gyroCursor.value.x = Math.min(window.innerWidth, gyroCursor.value.x + 20);
    if (key === 'c' && currentStep.value.id.includes('pointer')) resetPointerJudgement();
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

    // --- Pointer ステップ処理 ---
    if (currentStep.value?.id.includes('pointer')) {
      const distance = getPointerDistance();
      const now = Date.now();
      
      if (distance < pointerHitThreshold) {
        if (pointerLastHitTime.value === 0) {
          pointerLastHitTime.value = now;
        } else if (now - pointerLastHitTime.value >= pointerHoldDuration) {
          pointerHitCount.value++;
          const gain = PROGRESS_MAX / 20; // 20 回で完了
          progress.value = Math.min(progress.value + gain, PROGRESS_MAX);
          const config = GEM_CONFIG[selectedGemKey.value] || GEM_CONFIG.RUBY;
          sendVibration(hidDevice.value, packetCounter++, config.vibration);
          generatePointerTarget();
          pointerLastHitTime.value = 0;
        }
      } else {
        pointerLastHitTime.value = 0;
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
          @click="resetGameWithPointerInit(key)"
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
        <VisualArea v-if="!currentStep?.id.includes('pointer')" :step="currentStep" />
        <div v-if="currentStep?.id.includes('pointer')" class="pointer-area">
          <div class="pointer-target" :style="{ left: pointerTarget.x + 'px', top: pointerTarget.y + 'px' }"></div>
          <div class="pointer-cursor" :style="{ left: gyroCursor.x + 'px', top: gyroCursor.y + 'px' }"></div>
          <div class="pointer-hit-count">{{ pointerHitCount }}</div>
        </div>
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
          テスト操作: [R]回転 [S]振る [M]連打 [矢印キー]ポインター移動 [C]判定リセット
        </p>
      </div>
    </div>

    <!-- 結果画面 -->
    <div v-if="currentScreen === 'result'" class="screen-box">
      <div class="result-panel">
        <p class="result-badge">RESULT</p>
        <Vue3StarRatings
          :model-value="rankValue"
          :number-of-stars="3"
          :star-size="62"
          star-color="#ffd166"
          inactive-color="#244061"
          :disable-click="true"
          class="result-stars"
        />
        <h1 class="glow-text result-title">完成！</h1>
        <p class="result-msg">{{ selectedGem.name }} が出来上がりました。</p>
        <img
          v-if="resultGemImageSrc"
          :src="resultGemImageSrc"
          :alt="`${selectedGem.name}-image`"
          class="result-gem-image"
        />
        <p class="result-rank">RANK {{ gameRank }}</p>
        <p class="result-score">達成率 {{ (averageProgressRate * 100).toFixed(1) }}%</p>
        <button class="blue-btn-main result-retry-btn" @click="currentScreen = 'select'">もう一度作る</button>
      </div>
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
  margin-bottom: 14px;
  color: #ccd6f6;
}

.result-panel {
  width: min(560px, 92vw);
  margin: 0 auto;
  padding: 28px 20px 30px;
  border-radius: 24px;
  border: 1px solid rgba(100, 255, 218, 0.16);
  background: linear-gradient(180deg, rgba(8, 24, 48, 0.92), rgba(12, 33, 66, 0.84));
  box-shadow:
    0 18px 50px rgba(2, 8, 20, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
  text-align: center;
}

.result-badge {
  display: inline-block;
  margin: 0 0 10px;
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(100, 255, 218, 0.12);
  color: #8fb4ff;
  letter-spacing: 0.22em;
  font-size: 0.78rem;
}

.result-title {
  margin-top: 8px;
  margin-bottom: 8px;
}

.result-rank {
  margin: 10px 0 6px;
  font-size: 1.8rem;
  letter-spacing: 0.1em;
  font-weight: 700;
  color: #64ffda;
  text-shadow: 0 0 16px rgba(100, 255, 218, 0.4);
}

.result-stars {
  display: flex;
  width: 100%;
  justify-content: center;
  margin: 4px auto 14px;
  transform: scale(1.1);
  transform-origin: center;
}

.result-gem-image {
  display: block;
  width: min(360px, 74vw);
  max-height: 230px;
  object-fit: contain;
  margin: 10px auto 12px;
  filter: drop-shadow(0 0 14px rgba(143, 180, 255, 0.35));
}

.result-score {
  margin: 0 0 24px;
  font-size: 1rem;
  color: #8fb4ff;
}

.result-retry-btn {
  margin-top: 4px;
}

.pointer-area {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(17, 34, 64, 0.3);
  border-radius: 12px;
  z-index: 20;
}

.pointer-target {
  position: fixed;
  width: 60px;
  height: 60px;
  border: 3px solid #64ffda;
  border-radius: 50%;
  box-shadow: 0 0 20px rgba(100, 255, 218, 0.5), inset 0 0 10px rgba(100, 255, 218, 0.2);
  transform: translate(-50%, -50%);
  pointer-events: none;
  animation: pulse-target 1.5s ease-in-out infinite;
  z-index: 31;
}

.pointer-cursor {
  position: fixed;
  width: 40px;
  height: 40px;
  border: 2px solid #ffd166;
  border-radius: 50%;
  box-shadow: 0 0 16px rgba(255, 209, 102, 0.6);
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 32;
}

.pointer-hit-count {
  position: fixed;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 2.5rem;
  font-weight: 700;
  color: #ffd166;
  text-shadow: 0 0 16px rgba(255, 209, 102, 0.5);
  z-index: 33;
}

@keyframes pulse-target {
  0%, 100% { transform: translate(-50%, -50%) scale(1); }
  50% { transform: translate(-50%, -50%) scale(1.1); }
}
</style>