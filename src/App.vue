<script setup>
import { onMounted, ref, computed, watch } from 'vue';
import { useJoyCon } from './composites/useJoyCon';
import { useGameState, PROGRESS_MAX } from './composites/useGameState';
import TitleScreen from './components/screens/TitleScreen.vue';
import GemSelectScreen from './components/screens/GemSelectScreen.vue';
import GameScreen from './components/screens/GameScreen.vue';
import ResultScreen from './components/screens/ResultScreen.vue';
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
  <div class="app-ui-luxury">
    <TitleScreen v-if="currentScreen === 'title'" @start-game="startApp" />

    <GemSelectScreen v-if="currentScreen === 'select'" @select-gem="resetGameWithPointerInit" />

    <GameScreen 
      v-if="currentScreen === 'game'"
      :is-counting-down="isCountingDown"
      :countdown="countdown"
      :is-step-changing="isStepChanging"
      :step-change-text="stepChangeText"
      :time-left="timeLeft"
      :current-step-index="currentStepIndex"
      :current-step="currentStep"
      :progress="progress"
      :is-simulated="isSimulated"
      :is-locking-on="isLockingOn"
      :pointer-target="pointerTarget"
      :gyro-cursor="gyroCursor"
      :fixed-x="FIXED_X_POSITION"
    />

    <ResultScreen 
      v-if="currentScreen === 'result'"
      :result-gem-image-src="resultGemImageSrc"
      :gem-name="selectedGem?.name"
      :final-price="finalPrice"
      :average-progress-rate="averageProgressRate"
      :appraisal-date="appraisalDate"
      @retry="currentScreen = 'select'"
    />

  </div>
</template>