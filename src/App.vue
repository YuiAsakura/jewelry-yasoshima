<script setup>
import { onMounted, ref, computed, watch } from 'vue';
import { useJoyCon } from './composites/useJoyCon';
import { useGameState, PROGRESS_MAX } from './composites/useGameState';
import VisualArea from './components/VisualArea.vue';
import { GEM_DATA } from './constants/gemData';
import Vue3StarRatings from 'vue3-star-ratings';

// --- 外部ロジックの読込 ---
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
const gyroCursor = ref({ x: 0, y: window.innerHeight / 2 });
const pointerHitCount = ref(0);
const pointerLastHitTime = ref(0);
const pointerCalibrationTime = ref(0); 
const pointerNeedsCalibration = ref(false); 
const lastResetButtonState = ref(0); 
const pointerHitThreshold = 10; 
const pointerCalibrationDuration = 1000; 
const pointerResetButtonMask = 0x20; 

// 1秒（1000ミリ秒）キープで判定OK
const pointerHoldDuration = 1000; 

// 温度ターゲットのシーケンス制御用
const customTargetRouteY = ref([]);    
const customRouteIndex = ref(0);       
const customTargetMaxHits = ref(0);    
const currentTargetTemperature = ref(0); 

// ポインターが合っている（ロックオン中）かどうかのフラグ
const isLockingOn = ref(false);

// ジャイロキャリブレーション用
const gyroCalibration = ref({ x: 0, y: 0, z: 0 }); 
const gyroFiltered = ref({ x: 0, y: 0, z: 0 }); 
const gyroFilterAlpha = 0.3; 
const gyroDeadzone = 800; 
const gyroCursorSpeed = 0.6; 

const calibrateGyro = (accel) => {
  gyroCalibration.value = { ...accel };
};

/**
 * ★シンプル位置調整：横位置（X軸）
 * 複雑な自動計算を廃止し、画面の完全中央（centerX）から何ピクセル左に動かすかで指定します。
 * 線が温度計より右にあるなら数値を大きく（例: - 260）、左にあるなら小さく（例: - 220）して調整してください。
 */
const FIXED_X_POSITION = computed(() => {
  const centerX = window.innerWidth / 2;
  return centerX - 280; 
});

/**
 * ★シンプル位置調整：縦位置（Y軸）
 * 画面の完全中央（centerY）から【上下に何ピクセル離れた場所】を目盛りの上限・下限にするかを指定します。
 * 線が目盛りの外側にはみ出るなら数値を小さく（例: 160）、内側に届かないなら数値を大きく（例: 210）してください。
 */
const convertTempToYPosition = (temperature) => {
  const temp = Math.max(0, Math.min(2500, temperature));
  const centerY = window.innerHeight / 2;
  
  const startY = centerY + 247; // 0度（下側）のピクセル位置
  const endY = centerY - 157;   // 2000度（上側）のピクセル位置
  
  return startY + (endY - startY) * (temp / 2000);
};

/**
 * ターゲットの温度と回数を指定してセットアップする関数
 */
const setupTemperatureTargets = (hitCount, ...temperatures) => {
  if (temperatures.length === 0) return;
  
  pointerHitCount.value = 0;
  customRouteIndex.value = 0;
  customTargetMaxHits.value = hitCount;
  isLockingOn.value = false;
  
  customTargetRouteY.value = temperatures.map(temp => ({
    temperature: temp,
    y: convertTempToYPosition(temp)
  }));
  
  const firstTarget = customTargetRouteY.value[0];
  currentTargetTemperature.value = firstTarget.temperature;
  pointerTarget.value = { x: FIXED_X_POSITION.value, y: firstTarget.y };
  
  gyroCursor.value.x = FIXED_X_POSITION.value;
  gyroCursor.value.y = convertTempToYPosition(0); // 0度から開始
};

/**
 * 次の指定された温度ターゲットに更新する内部関数
 */
const advanceCustomTargetY = () => {
  if (pointerHitCount.value >= customTargetMaxHits.value) {
    progress.value = PROGRESS_MAX;
    return;
  }

  customRouteIndex.value = (customRouteIndex.value + 1) % customTargetRouteY.value.length;
  const nextTarget = customTargetRouteY.value[customRouteIndex.value];
  currentTargetTemperature.value = nextTarget.temperature;
  pointerTarget.value = { 
    x: FIXED_X_POSITION.value, 
    y: nextTarget.y 
  };
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
  isLockingOn.value = false;
};

const applyLowPassFilter = (current, previous, alpha) => {
  return previous + alpha * (current - previous);
};

// 一律で gemData.js の hint（指示文）をそのまま取得
const activeInstructionText = computed(() => {
  if (!currentStep.value) return '';
  return currentStep.value.hint;
});

const isStepChanging = ref(false);
const stepChangeText = ref('');

const triggerNeonTransition = () => {
  stepChangeText.value = activeInstructionText.value;
  isStepChanging.value = true;
  setTimeout(() => {
    isStepChanging.value = false;
  }, 1250); 
};

watch(currentStepIndex, (newIdx, oldIdx) => {
  if (newIdx !== oldIdx && currentScreen.value === 'game') {
    if (currentStep.value?.targets) {
      setupTemperatureTargets(currentStep.value.targets.length, ...currentStep.value.targets);
    }
    triggerNeonTransition();
  }
});

watch(isCountingDown, (newCounting, oldCounting) => {
  if (!newCounting && oldCounting && currentScreen.value === 'game') {
    if (currentStep.value?.targets) {
      setupTemperatureTargets(currentStep.value.targets.length, ...currentStep.value.targets);
    }
    triggerNeonTransition();
  }
});

const updateGyroCursor = (accel) => {
  gyroFiltered.value.x = applyLowPassFilter(accel.x, gyroFiltered.value.x, gyroFilterAlpha);
  gyroFiltered.value.z = applyLowPassFilter(accel.z, gyroFiltered.value.z, gyroFilterAlpha);

  const adjX = gyroFiltered.value.x - gyroCalibration.value.x;
  const adjZ = gyroFiltered.value.z - gyroCalibration.value.z;

  const xMagnitude = Math.abs(adjX);
  const centerY = window.innerHeight / 2;
  let newY = gyroCursor.value.y;

  const factorY = Math.min(1, xMagnitude / gyroDeadzone); 
  const angleY = -Math.atan2(adjX, adjZ) * 180 / Math.PI; 
  const deltaY = (angleY / 25) * centerY * gyroCursorSpeed * factorY;
  newY = centerY + deltaY;

  const temp0Y    = convertTempToYPosition(0);    // 0度のY座標
  const temp2000Y = convertTempToYPosition(2000); // 2000度のY座標

  const MARGIN = 50; // 目盛りの外側にどれくらいはみ出して動けるかの余白（px）

  const minY = temp2000Y - MARGIN; // 操作線がいける一番上の限界
  const maxY = temp0Y + MARGIN;    // 操作線がいける一番下の限界

  gyroCursor.value.x = FIXED_X_POSITION.value;
  gyroCursor.value.y = Math.max(minY, Math.min(maxY, newY));
};

const resetGameWithPointerInit = (key) => {
  resetGame(key);
  const firstStep = GEM_DATA[key]?.steps?.[0];
  if (firstStep && firstStep.id.includes('pointer') && firstStep.targets) {
    setupTemperatureTargets(firstStep.targets.length, ...firstStep.targets);
  }
};

const rankValue = computed(() => {
  if (gameRank.value === 'S') return 3;
  if (gameRank.value === 'A') return 2;
  if (gameRank.value === 'B') return 1;
  return 0;
});
const resultGemImageSrc = computed(() => {
  return selectedGem.value?.resultImage || '';
});

const lastButtonState = ref(0); 
let packetCounter = 0; 

const performAction = (amount) => {
  if (progress.value < PROGRESS_MAX) {
    progress.value = Math.min(progress.value + amount, PROGRESS_MAX);
  }
};

const handleInputReport = (event) => {
  if (event.reportId !== 0x30 || currentScreen.value !== 'game' || isCountingDown.value || isStepChanging.value) return;
  const { data } = event;
  const config = GEM_CONFIG[selectedGemKey.value] || GEM_CONFIG.RUBY;

  const b3 = data.getUint8(3);
  const b4 = data.getUint8(4);
  if (currentStep.value.id.includes('mash') && b4 !== 0x00 && b4 !== lastButtonState.value) {
    performAction(6);
    sendVibration(hidDevice.value, packetCounter++, config.vibration);
  }
  lastButtonState.value = b4;

  const currentAccel = { 
    x: data.getInt16(12, true), 
    y: data.getInt16(14, true), 
    z: data.getInt16(16, true) 
  };

  if (currentStep.value?.id.includes('pointer')) {
    const resetPressed = (b3 & pointerResetButtonMask) !== 0 && (lastResetButtonState.value & pointerResetButtonMask) === 0;
    if (resetPressed) {
      resetPointerJudgement();
    }
    lastResetButtonState.value = b3;

    if (pointerNeedsCalibration.value && Date.now() - pointerCalibrationTime.value < pointerCalibrationDuration) {
      calibrateGyro(currentAccel);
    } else if (pointerNeedsCalibration.value) {
      pointerNeedsCalibration.value = false;
    } else {
      updateGyroCursor(currentAccel);
    }
  }

  if (currentStep.value.id.includes('shake')) {
    const delta = getShakeDelta(currentAccel, lastAccel.value);
    if (delta > config.shakeThreshold && canAddProgress.value) {
      performAction(30);
      sendVibration(hidDevice.value, packetCounter++, config.vibration);
      throttle(120);
    }
  }

  if (currentStep.value.id.includes('centrifugal')) {
    const centrifugal = getCentrifugal(currentAccel, lastAccel.value);
    if (centrifugal > config.rotationThreshold) {
      const rotationGain = Math.min((centrifugal - config.rotationThreshold) / 500, 3);
      progress.value = Math.min(progress.value + rotationGain, PROGRESS_MAX);
      if (canAddProgress.value) {
        sendVibration(hidDevice.value, packetCounter++, config.vibration);
        throttle(100);
      }
    }
  }
  lastAccel.value = currentAccel;
};

const throttle = (ms) => {
  canAddProgress.value = false;
  setTimeout(() => canAddProgress.value = true, ms);
};

onMounted(() => {
  window.addEventListener('keydown', (e) => {
    if (currentScreen.value !== 'game' || isCountingDown.value || isStepChanging.value || !isSimulated.value) return;
    const key = e.key.toLowerCase();
    if (key === 'r' && currentStep.value.id.includes('rotate')) progress.value = Math.min(progress.value + 5, PROGRESS_MAX);
    if (key === 's' && currentStep.value.id.includes('shake')) progress.value = Math.min(progress.value + 8, PROGRESS_MAX);
    if (key === 'm' && currentStep.value.id.includes('mash')) progress.value = Math.min(progress.value + 6, PROGRESS_MAX);
    if (key === 'arrowup' && currentStep.value.id.includes('pointer')) gyroCursor.value.y = Math.max(0, gyroCursor.value.y - 20);
    if (key === 'arrowdown' && currentStep.value.id.includes('pointer')) gyroCursor.value.y = Math.min(window.innerHeight, gyroCursor.value.y + 20);
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

    if (isStepChanging.value) return;

    timeLeft.value = Math.max(0, timeLeft.value - 0.1);

    const gp = navigator.getGamepads()[0];
    if (gp && currentStep.value.id.includes('rotate')) {
      const sx = gp.axes[0]; const sy = gp.axes[1];
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
      const dy = gyroCursor.value.y - pointerTarget.value.y;
      const distanceY = Math.abs(dy); 
      const now = Date.now();
      
      if (distanceY < pointerHitThreshold) {
        isLockingOn.value = true;

        if (pointerLastHitTime.value === 0) {
          pointerLastHitTime.value = now;
        } else if (now - pointerLastHitTime.value >= pointerHoldDuration) {
          pointerHitCount.value++;
          
          const gain = PROGRESS_MAX / customTargetMaxHits.value; 
          progress.value = Math.min(progress.value + gain, PROGRESS_MAX);
          
          const config = GEM_CONFIG[selectedGemKey.value] || GEM_CONFIG.RUBY;
          sendVibration(hidDevice.value, packetCounter++, config.vibration);
          
          isLockingOn.value = false;
          advanceCustomTargetY();
          pointerLastHitTime.value = 0;
        }
      } else {
        isLockingOn.value = false;
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
    <div v-if="currentScreen === 'title'" class="screen-box">
      <h1 class="glow-text">JEWELRY YASOSHIMA</h1>
      <div class="btn-group">
        <button class="blue-btn-main" @click="startApp(false)">JOY-CON 接続</button>
        <button class="blue-btn-sub" @click="startApp(true)">JOY-CON なしでテスト</button>
      </div>
    </div>

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

    <div v-if="currentScreen === 'game'" class="game-layout"> 
      <div v-if="isCountingDown" class="countdown-overlay">
        <div class="countdown-number" :class="{ 'start-text': Math.ceil(countdown) <= 0 }">
          {{ Math.ceil(countdown) > 0 ? Math.ceil(countdown) : 'START!' }}
        </div>
        <div class="countdown-label" v-if="Math.ceil(countdown) > 0">READY</div>
      </div>

      <Transition name="neon-fade">
        <div v-if="isStepChanging" class="step-transition-overlay">
          <div class="neon-instruction-text">{{ stepChangeText }}</div>
        </div>
      </Transition>

    <div class="game-hud-container" :class="{ 'ui-blur': isCountingDown || isStepChanging }">
        
        <div class="hud-right-top">
          <div class="timer-title">TIME</div>
          <div class="timer-display-game" :class="{ 'timer-low-game': timeLeft < 5 }">
            {{ timeLeft.toFixed(1) }}<span>s</span>
          </div>
        </div>

        <div class="hud-center-top">
          <div class="step-badge">STEP {{ currentStepIndex + 1 }}</div>
          <h2 class="step-title-game">{{ currentStep.label }}</h2>
          
          <div class="gauge-bar-outer-game">
            <div class="gauge-bar-inner-game" :style="{ width: Math.min((progress / PROGRESS_MAX) * 100, 100) + '%' }"></div>
          </div>
        </div>

        <div class="hud-center-view">
          
          <VisualArea :step="currentStep" class="main-visual-large" />
          
          <div v-if="currentStep?.id.includes('pointer')" class="pointer-overlay-layer">
            <div 
              class="pointer-target" 
              :class="{ 'target-locking': isLockingOn }"
              :style="{ left: FIXED_X_POSITION + 'px', top: pointerTarget.y + 'px' }"
            ></div>
            
            <div class="pointer-cursor" :style="{ left: FIXED_X_POSITION + 'px', top: gyroCursor.y + 'px' }"></div>
          </div>

        </div>

        <p v-if="isSimulated" class="debug-hint-game">
          [R]回転 [S]振る [M]連打 [矢印キー]ポインター移動 [C]リセット
        </p>
      </div>
    </div>

    <div v-if="currentScreen === 'result'" class="screen-box">
      <div class="result-panel">
        <p class="result-badge">RESULT</p>
        <Vue3StarRatings :model-value="rankValue" :number-of-stars="3" :star-size="62" star-color="#ffd166" inactive-color="#244061" :disable-click="true" class="result-stars" />
        <h1 class="glow-text result-title">完成！</h1>
        <p class="result-msg">{{ selectedGem.name }} が出来上がりました。</p>
        <img v-if="resultGemImageSrc" :src="resultGemImageSrc" :alt="`${selectedGem.name}-image`" class="result-gem-image" />
        <p class="result-rank">RANK {{ gameRank }}</p>
        <p class="result-score">達成率 {{ (averageProgressRate * 100).toFixed(1) }}%</p>
        <button class="blue-btn-main result-retry-btn" @click="currentScreen = 'select'">もう一度作る</button>
      </div>
    </div>
  </div>
</template>

<style>
/* --- 全体レイアウト --- */
.game-layout {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #040d1a;
}

/* 全体構造を3段のグリッドに変更して中央に整列しやすくします */
.game-hud-container {
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: auto auto 1fr; /* タイマー / 中央情報 / 画像 の3段 */
  width: 100%;
  height: 100%;
  padding: 15px 40px;
  box-sizing: border-box;
}

/* タイマーを右上に絶対配置するためのエリア */
.hud-right-top {
  grid-row: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  z-index: 20;
  position: absolute;
  top: 20px;
  right: 40px;
}

/* ★復活＆サイズアップ：タイマーのテキストスタイル */
.timer-title {
  font-size: 1.2rem;
  color: #8fb4ff;
  letter-spacing: 0.2em;
  font-weight: 700;
  margin-bottom: 2px;
}

.timer-display-game {
  font-size: 4.8rem; /* ガツンと大きく */
  font-weight: 800;
  font-family: monospace;
  color: #64ffda;
  text-shadow: 0 0 20px rgba(100, 255, 218, 0.6);
  line-height: 1.1;
}
.timer-display-game span {
  font-size: 2rem;
  margin-left: 4px;
  font-weight: 500;
}
.timer-low-game {
  color: #ff5e7e;
  text-shadow: 0 0 20px rgba(255, 94, 126, 0.6);
  animation: pulse-timer 0.5s ease-in-out infinite alternate;
}

/* ★STEP数、操作名、バーを画面の横中央にガチッと集約するスタイル */
.hud-center-top {
  grid-row: 2;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center; /* 横方向の中央揃え */
  text-align: center;
  margin-top: 10px;
  margin-bottom: 5px;
  z-index: 10;
}

.step-badge {
  font-size: 1rem;
  color: #8fb4ff;
  letter-spacing: 0.15em;
  margin-bottom: 4px;
}

.step-title-game {
  font-size: 2.5rem;
  font-weight: 800;
  color: #ffffff;
  margin: 0 0 14px 0;
  text-shadow: 0 0 15px rgba(255, 255, 255, 0.3);
}

/* 進捗バーの外枠（横幅と縦幅を大きく変更） */
.gauge-bar-outer-game {
  width: 600px;
  height: 24px;
  background: rgba(36, 64, 97, 0.4);
  border: 2px solid rgba(143, 180, 255, 0.4);
  border-radius: 999px;
  overflow: hidden;
  box-shadow: inset 0 3px 6px rgba(0,0,0,0.6);
}

.gauge-bar-inner-game {
  height: 100%;
  background: linear-gradient(90deg, #64ffda, #8fb4ff);
  box-shadow: 0 0 15px #64ffda;
  transition: width 0.1s ease-out;
}

/* 中央：メインビュー（画像表示エリアの縦幅バランスを調整） */
.hud-center-view {
  grid-row: 3;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  width: 100%;
  height: 100%;
  padding: 0;
}

.main-visual-large {
  width: 100%;
  height: 60vh;
  max-height: 60vh;
  max-width: 1100px; 
  object-fit: contain;
  z-index: 5;
}

/* ポインター重ね合わせ用の絶対配置レイヤー */
.pointer-overlay-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 10;
  pointer-events: none;
}

/* 目標温度のライン（横線） */
.pointer-target {
  position: fixed;
  width: 150px; 
  height: 6px;
  background-color: #64ffda;
  box-shadow: 0 0 12px #64ffda;
  border-radius: 3px;
  transform: translate(-50%, -50%);
  transition: background-color 0.2s, box-shadow 0.2s;
}

/* ロックオン（キープ中）のエフェクト */
.pointer-target.target-locking {
  background-color: #ff9e00 !important; 
  box-shadow: 0 0 25px #ff9e00, 0 0 10px #ffffff !important; 
}

/* 現在の操作カーソルライン（横線） */
.pointer-cursor {
  position: fixed;
  width: 130px; 
  height: 4px;
  background-color: #ffd166;
  box-shadow: 0 0 12px #ffd166;
  border-radius: 2px;
  transform: translate(-50%, -50%);
}

/* ステップ切り替えトランジション */
.step-transition-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(3, 10, 20, 0.85);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 99;
}

.neon-instruction-text {
  font-size: 2.8rem;
  font-weight: 800;
  color: #ffffff;
  text-align: center;
  padding: 0 30px;
  letter-spacing: 0.05em;
  text-shadow: 
    0 0 5px #fff,
    0 0 10px #fff,
    0 0 20px #fff,
    0 0 40px rgba(255,255,255,0.6),
    0 0 80px rgba(255,255,255,0.4);
}

.neon-fade-enter-active,
.neon-fade-leave-active {
  transition: all 0.35s cubic-bezier(0.25, 1, 0.5, 1);
}
.neon-fade-enter-from { opacity: 0; transform: scale(1.15); }
.neon-fade-leave-to { opacity: 0; transform: scale(0.92); }

.debug-hint-game {
  position: absolute;
  bottom: 15px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.8rem;
  color: #4a678a;
  margin: 0;
}

@keyframes pulse-timer {
  0% { opacity: 0.7; }
  100% { opacity: 1; }
}

.gauge-value { margin-top: 8px; font-size: 0.95rem; color: #8fb4ff; letter-spacing: 0.04em; }
.result-msg { font-size: 1.5rem; margin-bottom: 14px; color: #ccd6f6; }
.result-panel { width: min(560px, 92vw); margin: 0 auto; padding: 28px 20px 30px; border-radius: 24px; border: 1px solid rgba(100, 255, 218, 0.16); background: linear-gradient(180deg, rgba(8, 24, 48, 0.92), rgba(12, 33, 66, 0.84)); box-shadow: 0 18px 50px rgba(2, 8, 20, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.04); text-align: center; }
.result-badge { display: inline-block; margin: 0 0 10px; padding: 6px 14px; border-radius: 999px; background: rgba(100, 255, 218, 0.12); color: #8fb4ff; letter-spacing: 0.22em; font-size: 0.78rem; }
.result-title { margin-top: 8px; margin-bottom: 8px; }
.result-rank { margin: 10px 0 6px; font-size: 1.8rem; letter-spacing: 0.1em; font-weight: 700; color: #64ffda; text-shadow: 0 0 16px rgba(100, 255, 218, 0.4); }
.result-stars { display: flex; width: 100%; justify-content: center; margin: 4px auto 14px; transform: scale(1.1); transform-origin: center; }
.result-gem-image { display: block; width: min(360px, 74vw); max-height: 230px; object-fit: contain; margin: 10px auto 12px; filter: drop-shadow(0 0 14px rgba(143, 180, 255, 0.35)); }
.result-score { margin: 0 0 24px; font-size: 1rem; color: #8fb4ff; }
.result-retry-btn { margin-top: 4px; }
</style>