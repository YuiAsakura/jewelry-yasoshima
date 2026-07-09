import { onMounted, onUnmounted, ref, watch } from 'vue';
import { getShakeDelta, getCentrifugal, GEM_CONFIG } from './sensorLogic.js';
import { sendVibration } from './vibrate.js';
import { PROGRESS_MAX } from './useGameState';

export function useGameEngine(gameState, joyCon, pointer) {
  const pressedButtonCount = ref(0);
  const lastButtonState = ref(0);
  let packetCounter = 0;
  let intervalId = null;
  let lastResetButtonState = 0;

  const performAction = (amount) => {
    if (gameState.progress.value < PROGRESS_MAX) {
      gameState.progress.value = Math.min(gameState.progress.value + amount, PROGRESS_MAX);
    }
  };

  const triggerVibrate = () => {
    const config = GEM_CONFIG[gameState.selectedGemKey.value] || GEM_CONFIG.RUBY;
    sendVibration(joyCon.hidDevice.value, packetCounter++, config.vibration);
  };

  const throttle = (ms) => {
    joyCon.canAddProgress.value = false;
    setTimeout(() => joyCon.canAddProgress.value = true, ms);
  };

  // Joy-Conの入力解析
  const handleInputReport = (event) => {
    if (event.reportId !== 0x30 || gameState.currentScreen.value !== 'game') return;
    
    const { data } = event;
    const b2 = data.getUint8(2), b3 = data.getUint8(3), b4 = data.getUint8(4);

    if (gameState.introPhase.value > 0) {
      const anyButtonPressed = (b2 | b3 | b4) !== 0x00;
      if (anyButtonPressed && lastButtonState.value === 0x00) {
        gameState.advanceIntro();
        sendVibration(joyCon.hidDevice.value, packetCounter++, [0x48, 0x01]);
      }
      lastButtonState.value = (b2 | b4);
      return;
    }

    if (gameState.isCountingDown.value || gameState.isStepChanging.value) return;

    const config = GEM_CONFIG[gameState.selectedGemKey.value] || GEM_CONFIG.RUBY;
    const stepId = gameState.currentStep.value?.id || '';

    // 連打
    const currentMashState = b2 | b4; 
    if (stepId.includes('mash') && currentMashState !== 0x00 && lastButtonState.value === 0x00) {
      // 1秒間にn回のペース
      const TARGET_PRESSES_PER_SEC = 5;
      const totalRequiredPresses = gameState.currentStep.value.timeLimit * TARGET_PRESSES_PER_SEC;
      const gain = PROGRESS_MAX / totalRequiredPresses;      

      performAction(gain);
      triggerVibrate();
    }
    lastButtonState.value = currentMashState;

    const currentAccel = { x: data.getInt16(12, true), y: data.getInt16(14, true), z: data.getInt16(16, true) };

    // ポインター
    if (stepId.includes('pointer')) {
      if ((b3 & 0x20) !== 0 && (lastResetButtonState & 0x20) === 0) pointer.resetPointerJudgement();
      lastResetButtonState = b3;

      if (pointer.pointerNeedsCalibration.value && Date.now() - pointer.pointerCalibrationTime.value < pointer.pointerCalibrationDuration) {
        pointer.gyroCalibration.value = { ...currentAccel };
      } else if (pointer.pointerNeedsCalibration.value) {
        pointer.pointerNeedsCalibration.value = false;
      } else {
        pointer.updateGyroCursor(currentAccel);
      }
    }

    // 振る・回す
    if (stepId.includes('shake')) {
      if (getShakeDelta(currentAccel, joyCon.lastAccel.value) > config.shakeThreshold && joyCon.canAddProgress.value) {
        performAction(30); triggerVibrate(); throttle(120);
      }
    }
    if (stepId === 'hpht') {
      if (getShakeDelta(currentAccel, joyCon.lastAccel.value) > config.shakeThreshold && joyCon.canAddProgress.value) {
        gameState.hphtTemp.value = Math.min(100, gameState.hphtTemp.value + 5);
        triggerVibrate(); throttle(100);
      }
    }
    if (stepId.includes('centrifugal')) {
      const centrifugal = getCentrifugal(currentAccel, joyCon.lastAccel.value);
      if (centrifugal > config.rotationThreshold) {
        performAction(Math.min((centrifugal - config.rotationThreshold) / 500, 3));
        if (joyCon.canAddProgress.value) { triggerVibrate(); throttle(100); }
      }
    }
    joyCon.lastAccel.value = currentAccel;

    // 全押し (press_all)
    if (stepId.includes('press_all') || stepId === 'hpht') {
      let aB2 = b2 & 0xFF, aB3 = b3 & 0x3F, aB4 = b4 & 0xFF;
      let count = 0;
      while(aB2 > 0) { count += aB2 & 1; aB2 >>= 1; }
      while(aB3 > 0) { count += aB3 & 1; aB3 >>= 1; }
      while(aB4 > 0) { count += aB4 & 1; aB4 >>= 1; }
      pressedButtonCount.value = count;
    }
  };

  // キーボードデバッグ
  const handleKeyDown = (e) => {
    if (gameState.currentScreen.value !== 'game') return;

    if (gameState.introPhase.value > 0) {
      gameState.advanceIntro();
      return;
    }

    if (gameState.isCountingDown.value || gameState.isStepChanging.value || !joyCon.isSimulated.value) return;

    const key = e.key.toLowerCase(), stepId = gameState.currentStep.value?.id || '';
    if (key === 'r' && stepId.includes('rotate')) performAction(5);
    if (key === 's' && stepId.includes('shake')) performAction(8);
    if (key === 'm' && stepId.includes('mash')) performAction(6);
    //if (key === 'p' && stepId.isncludes('press_all')) performAction(6);
    if (key === 'arrowup' && stepId.includes('pointer')) pointer.gyroCursor.value.y = Math.max(0, pointer.gyroCursor.value.y - 20);
    if (key === 'arrowdown' && stepId.includes('pointer')) pointer.gyroCursor.value.y = Math.min(window.innerHeight, pointer.gyroCursor.value.y + 20);
    if (key === 'c' && stepId.includes('pointer')) pointer.resetPointerJudgement();
    if (key === 's' && stepId === 'hpht') gameState.hphtTemp.value = Math.min(100, gameState.hphtTemp.value + 12);
    if (key === 'p' && stepId === 'hpht') gameState.hphtPressure.value = Math.min(100, gameState.hphtPressure.value + 15);
  };

  // 画面遷移時の演出と設定
  const setupStep = () => {
    if (gameState.currentScreen.value === 'game') {
      if (gameState.currentStep.value?.targets) {
        pointer.setupTemperatureTargets(gameState.currentStep.value.targets.length, ...gameState.currentStep.value.targets);
      }
      gameState.triggerNeonTransition();
    }
  };

  watch(gameState.currentStepIndex, setupStep);
  watch(gameState.isCountingDown, (newVal, oldVal) => { if (!newVal && oldVal) setupStep(); });

  // メインループ (100msごと)
  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown);
    intervalId = setInterval(() => {
      if (gameState.currentScreen.value !== 'game') return;

      // イントロ表示中はタイマーを一時停止
      if (gameState.introPhase.value > 0) return;

      if (gameState.isCountingDown.value) {
        if (gameState.countdown.value > -0.8) gameState.countdown.value = parseFloat((gameState.countdown.value - 0.1).toFixed(1));
        else gameState.isCountingDown.value = false;
        return; 
      }
      if (gameState.isStepChanging.value) return;

      gameState.timeLeft.value = Math.max(0, gameState.timeLeft.value - 0.1);
      const stepId = gameState.currentStep.value?.id || '';

      // ゲームパッドAPI (Rotate)
      const gp = navigator.getGamepads()[0];
      if (gp && stepId.includes('rotate')) {
        const sx = gp.axes[0], sy = gp.axes[1];
        if (Math.sqrt(sx * sx + sy * sy) > 0.3) {
          const curAngle = Math.atan2(sy, sx);
          if (gameState.lastAngle.value !== null) {
            let diff = Math.abs(curAngle - gameState.lastAngle.value);
            if (diff > Math.PI) diff = Math.abs(diff - 2 * Math.PI);
            performAction(diff * 2.5);
          }
          gameState.lastAngle.value = curAngle;
        }
      }

      // 圧力をかける (press_all) の自動加算
      if (stepId.includes('press_all') && pressedButtonCount.value > 0) {
        const gain = (PROGRESS_MAX / (gameState.currentStep.value.timeLimit * 10)) * (Math.min(pressedButtonCount.value, 10) / 10);
        performAction(gain); triggerVibrate();
      }

      if (stepId === 'hpht') {
        gameState.hphtTemp.value = Math.max(0, gameState.hphtTemp.value - 1.5);
        gameState.hphtPressure.value = Math.max(0, gameState.hphtPressure.value - 1.5);
        if (pressedButtonCount.value > 0) {
          gameState.hphtPressure.value = Math.min(100, gameState.hphtPressure.value + (pressedButtonCount.value * 1.2));
        }
        if (gameState.hphtTemp.value >= 50 && gameState.hphtTemp.value <= 80 && gameState.hphtPressure.value >= 50 && gameState.hphtPressure.value <= 80) {
          performAction(PROGRESS_MAX / (gameState.currentStep.value.timeLimit * 10));
          if (Math.random() < 0.2) triggerVibrate();
        }
      }

      // ポインターの当たり判定
      if (stepId.includes('pointer')) pointer.checkPointerLockOn(gameState.progress, PROGRESS_MAX, triggerVibrate);

      if (gameState.timeLeft.value <= 0) gameState.nextStep();
    }, 100);
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown);
    clearInterval(intervalId);
  });

  return { handleInputReport };
}