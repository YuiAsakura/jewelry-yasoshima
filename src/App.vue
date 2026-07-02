<script setup>
import { computed } from 'vue';
import { useJoyCon } from './composites/useJoyCon';
import { useGameState } from './composites/useGameState';
import { usePointer } from './composites/usePointer';
import { useGameEngine } from './composites/useGameEngine';

import TitleScreen from './components/screens/TitleScreen.vue';
import GemSelectScreen from './components/screens/GemSelectScreen.vue';
import GameScreen from './components/screens/GameScreen.vue';
import ResultScreen from './components/screens/ResultScreen.vue';

// 各種モジュールの呼び出し
const joyCon = useJoyCon();
const gameState = useGameState();
const pointer = usePointer();

// ゲームエンジンの起動（入力・ループ処理を統合）
const { handleInputReport } = useGameEngine(gameState, joyCon, pointer);

// リザルト用の計算
const finalPrice = computed(() => {
  const rawPrice = (gameState.selectedGem.value?.maxPrice || 0) * gameState.averageProgressRate.value;
  return Math.round(rawPrice / 100) * 100;
});

const appraisalDate = computed(() => {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
});

// ゲーム開始処理
const startApp = async (simulate) => {
  if (await joyCon.connect(simulate)) {
    if (!simulate) joyCon.hidDevice.value.oninputreport = handleInputReport;
    gameState.currentScreen.value = 'select';
  }
};
</script>

<template>
  <div class="app-ui-luxury">
    <TitleScreen v-if="gameState.currentScreen.value === 'title'" @start-game="startApp" />

    <GemSelectScreen v-if="gameState.currentScreen.value === 'select'" @select-gem="gameState.resetGame" />

    <GameScreen 
      v-if="gameState.currentScreen.value === 'game'"
      :is-counting-down="gameState.isCountingDown.value"
      :countdown="gameState.countdown.value"
      :is-step-changing="gameState.isStepChanging.value"
      :step-change-text="gameState.stepChangeText.value"
      :time-left="gameState.timeLeft.value"
      :current-step-index="gameState.currentStepIndex.value"
      :current-step="gameState.currentStep.value"
      :progress="gameState.progress.value"
      :is-simulated="joyCon.isSimulated.value"
      :is-locking-on="pointer.isLockingOn.value"
      :pointer-target="pointer.pointerTarget.value"
      :gyro-cursor="pointer.gyroCursor.value"
      :fixed-x="pointer.FIXED_X_POSITION.value"
      :joy-con-accel="joyCon.lastAccel.value"
      :hpht-temp="gameState.hphtTemp.value"
      :hpht-pressure="gameState.hphtPressure.value"
    />

    <ResultScreen 
      v-if="gameState.currentScreen.value === 'result'"
      :result-gem-image-src="gameState.selectedGem.value?.resultImage || ''"
      :gem-name="gameState.selectedGem.value?.name"
      :final-price="finalPrice"
      :average-progress-rate="gameState.averageProgressRate.value"
      :appraisal-date="appraisalDate"
      @retry="gameState.currentScreen.value = 'select'"
    />
  </div>
</template>