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

const pressedButtonCount = ref(0); // 押されている対象ボタンの数（0〜11）

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
  const endY = centerY - 130;   // 2000度（上側）のピクセル位置
  
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

/*
const rankValue = computed(() => {
  if (gameRank.value === 'S') return 3;
  if (gameRank.value === 'A') return 2;
  if (gameRank.value === 'B') return 1;
  return 0;
});
*/

const finalPrice = computed(() => {
  const maxPrice = selectedGem.value?.maxPrice || 0;
  return Math.floor(maxPrice * averageProgressRate.value);
});

const resultGemImageSrc = computed(() => {
  return selectedGem.value?.resultImage || '';
});

// 鑑定日（今日の日付）を生成
const appraisalDate = computed(() => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd}`;
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

  const b2 = data.getUint8(2); // 右Joy-Conのボタン
  const b3 = data.getUint8(3); // 共有ボタン
  const b4 = data.getUint8(4); // 左Joy-Conのボタン
  
  // 左右どちらかのボタンが押されていて、前回の状態から変化していれば連打と判定
  const currentMashState = b2 | b4; 
  if (currentStep.value.id.includes('mash') && currentMashState !== 0x00 && currentMashState !== lastButtonState.value) {
    performAction(6);
    sendVibration(hidDevice.value, packetCounter++, config.vibration);
  }
  lastButtonState.value = currentMashState;

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

  // --- 圧力をかける動作（press_all）の判定 ---
  if (currentStep.value.id.includes('press_all')) {
    // 左右すべてのボタン入力状態を抽出
    let activeB2 = b2 & 0xFF; // 右ボタン全部
    let activeB3 = b3 & 0x3F; // 共有ボタン全部（6種類）
    let activeB4 = b4 & 0xFF; // 左ボタン全部
    
    let count = 0;
    // 押されている全ボタンの数をカウント
    while(activeB2 > 0) { count += activeB2 & 1; activeB2 >>= 1; }
    while(activeB3 > 0) { count += activeB3 & 1; activeB3 >>= 1; }
    while(activeB4 > 0) { count += activeB4 & 1; activeB4 >>= 1; }
    
    // 現在押されている数を変数に保存
    pressedButtonCount.value = count;
  }
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
    if (key === 'p' && currentStep.value.id.includes('press_all')) progress.value = Math.min(progress.value + 6, PROGRESS_MAX);
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

    // --- 圧力をかける動作（press_all）のプログレス加算 ---
    if (currentStep.value?.id.includes('press_all')) {
      if (pressedButtonCount.value > 0) {
        // 目標：10個のボタンを押していればMAXスピード
        const REQUIRED_BUTTONS = 10;
        
        // timeLimit（秒）でピッタリ100%になる1ループあたりの最大増加量
        const maxGainPerLoop = PROGRESS_MAX / (currentStep.value.timeLimit * 10);
        
        // 押している数（MAXを10で頭打ちさせる）
        const effectiveCount = Math.min(pressedButtonCount.value, REQUIRED_BUTTONS);
        const gain = maxGainPerLoop * (effectiveCount / REQUIRED_BUTTONS);
        
        progress.value = Math.min(progress.value + gain, PROGRESS_MAX);
        
        // 1個でもボタンを押していれば振動を鳴らす
        const config = GEM_CONFIG[selectedGemKey.value] || GEM_CONFIG.RUBY;
        sendVibration(hidDevice.value, packetCounter++, config.vibration);
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
    <div v-if="currentScreen === 'title'" class="title-screen-bg">
      <div class="title-content">
        <h1 class="title-text-luxury">JEWELRY YASOSHIMA</h1>
        <p class="title-sub-text">Lab-Grown Gemstone Simulator</p>
        
        <div class="btn-group-luxury">
          <button class="black-btn-luxury" @click="startApp(false)">JOY-CON 接続</button>
          <button class="white-btn-luxury" @click="startApp(true)">JOY-CON なしでテスト</button>
        </div>
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

    <div v-if="currentScreen === 'result'" class="result-screen-bg">
      <div class="result-content-container">
        
        <div class="result-left-area">
          <img v-if="resultGemImageSrc" :src="resultGemImageSrc" :alt="`${selectedGem.name}-image`" class="result-gem-image-paper" />
          <p class="gem-name-label">完成品：{{ selectedGem.name }}</p>
        </div>

        <div class="result-right-area">
          <p class="overlay-price">{{ finalPrice.toLocaleString() }}<span class="unit">円</span></p>
          <p class="overlay-score">{{ (averageProgressRate * 100).toFixed(1) }}<span class="unit">%</span></p>
          <p class="overlay-date">{{ appraisalDate }}</p>
        </div>
        
        <button class="black-btn-main result-retry-btn-paper" @click="currentScreen = 'select'">もう一度作る</button>
      
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

.result-price { 
  margin: 10px 0 6px; 
  font-size: 2.2rem; 
  letter-spacing: 0.05em; 
  font-weight: 800; 
  color: #ffd166; 
  text-shadow: 0 0 16px rgba(255, 209, 102, 0.4); 
}

/* --- 紙風リザルト画面のスタイル --- */
/* 外枠：画面全体を覆い、余白を埋める */
.result-screen-bg {
  position: absolute;
  top: 0; left: 0;
  width: 100vw; height: 100vh;
  background-color: #ffffff;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
}

/* ★重要：16:9の比率を保ったまま画面内に最大化するコンテナ */
.result-content-container {
  position: relative;
  /* 16:9のアスペクト比を維持しつつ、画面からはみ出さない設定 */
  width: 100vw;
  height: 56.25vw; /* 100 * 9 / 16 */
  max-height: 100vh;
  max-width: 177.78vh; /* 100 * 16 / 9 */
  
  /* コンテナを基準にした相対サイズ(cqw)を使うための宣言 */
  container-type: inline-size;
  
  /* このコンテナに背景画像を設定する */
  background-image: url('/src/assets/images/result_bg.png');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

/* --- 左側：宝石エリア --- */
.result-gem-image-paper {
  position: absolute;
  top: 63%; 
  left: 25%;
  transform: translate(-50%, -50%);
  width: 26cqw; 
  height: auto;
  filter: drop-shadow(0 15px 25px rgba(0, 0, 0, 0.15));
}

.gem-name-label {
  position: absolute;
  top: 36%; 
  left: 25%;
  transform: translateX(-50%);
  font-size: 2.8cqw;
  font-weight: bold;
  color: #1a1a1a;
  font-family: "Yu Mincho", "MS PMincho", serif;
  letter-spacing: 0.08em;
  margin: 0;
  text-align: center;
  width: 40%;
}

/* --- 右側：調査報告書エリア --- */
.result-right-area {
  position: absolute;
  top: 0; right: 0;
  width: 100%; height: 100%;
  pointer-events: none; /* テキスト上のクリックを透過 */
}
.overlay-price, .overlay-score, .overlay-date {
  position: absolute;
  color: #222;
  font-family: "Yu Mincho", "MS PMincho", serif;
  margin: 0;
  width: 32%; /* テキストエリアの幅 */
  text-align: center;
}

.overlay-price {
  top: 46.5%;
  left: 60%;
  font-size: 4.5cqw;
  font-weight: bold;
}
.overlay-score {
  top: 71%;
  left: 60%;
  font-size: 4.5cqw;
  font-weight: bold;
}
.unit {
  font-size: 3.5cqw;
  margin-left: 1.0cqw;
}

.overlay-date {
  top: 88%;
  left: 75.5%;
  font-size: 2.6cqw;
  font-weight: bold;
  text-align: left;
}

.result-retry-btn-paper {
  position: absolute;
  bottom: 4%;
  left: 50%;
  transform: translateX(-50%);
  background: #111111;
  color: #ffffff;
  border: 1px solid #999999; 
  padding: 1.0cqw 3.5cqw;
  border-radius: 0;
  font-size: 1.8cqw;
  font-family: "Yu Mincho", "MS PMincho", serif;
  letter-spacing: 0.25em;
  text-indent: 0.25em; 
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
  cursor: pointer;
  pointer-events: auto;
}
.result-retry-btn-paper:hover {
  background: #ffffff;
  color: #111111;
  border-color: #111111;
  transform: translateX(-50%) scale(1.03);
}
/* --- タイトル画面（高級感・白ベース） --- */
.title-screen-bg {
  position: absolute;
  top: 0; left: 0;
  width: 100vw; height: 100vh;
  /* 上品なオフホワイトの背景（中央が少し明るいグラデーション） */
  background-color: #faf9f6; 
  background-image: radial-gradient(circle at center, #ffffff 0%, #f0ede6 100%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 100;
}

.title-content {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.title-text-luxury {
  font-family: "Yu Mincho", "MS PMincho", serif;
  font-size: 5rem;
  font-weight: normal;
  color: #111111;
  letter-spacing: 0.15em;
  text-indent: 0.15em; /* 中央ズレ補正 */
  margin: 0 0 10px 0;
  text-shadow: 2px 2px 10px rgba(0,0,0,0.03);
}

.title-sub-text {
  font-family: "Yu Mincho", "MS PMincho", serif;
  font-size: 1.2rem;
  color: #666666;
  letter-spacing: 0.4em;
  text-indent: 0.4em;
  margin-bottom: 80px; /* ボタンとの余白をたっぷりとる */
}

.btn-group-luxury {
  display: flex;
  flex-direction: column;
  gap: 20px;
  align-items: center;
}

/* メインボタン（リザルト画面と同系統の黒） */
.black-btn-luxury {
  background: #111111;
  color: #ffffff;
  border: 1px solid #111111;
  padding: 16px 50px;
  border-radius: 0;
  font-size: 1.2rem;
  font-family: "Yu Mincho", "MS PMincho", serif;
  letter-spacing: 0.2em;
  text-indent: 0.2em;
  transition: all 0.3s ease;
  cursor: pointer;
  min-width: 340px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
}
.black-btn-luxury:hover {
  background: #ffffff;
  color: #111111;
  transform: scale(1.02);
}

/* サブボタン（控えめな白背景・枠線のみ） */
.white-btn-luxury {
  background: transparent;
  color: #555555;
  border: 1px solid #cccccc;
  padding: 12px 40px;
  border-radius: 0;
  font-size: 1rem;
  font-family: "Yu Mincho", "MS PMincho", serif;
  letter-spacing: 0.15em;
  text-indent: 0.15em;
  transition: all 0.3s ease;
  cursor: pointer;
  min-width: 280px;
}
.white-btn-luxury:hover {
  background: #ffffff;
  border-color: #999999;
  color: #111111;
}

@keyframes pulse-timer {
  0% { opacity: 0.7; }
  100% { opacity: 1; }
}
</style>