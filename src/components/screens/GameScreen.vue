<template>
  <div class="game-layout"> 
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

    <div class="game-hud-container">
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
          <div class="gauge-bar-inner-game" :style="{ width: progressPercent + '%' }"></div>
        </div>
      </div>

      <div class="hud-center-view">
        <VisualArea 
          :step="currentStep"
          :accel="joyConAccel" 
          :is-simulated="isSimulated"
          class="main-visual-large"
        />
        
        <div v-if="currentStep?.id.includes('pointer')" class="pointer-overlay-layer">
          <div 
            class="pointer-target" 
            :class="{ 'target-locking': isLockingOn }"
            :style="{ left: fixedX + 'px', top: pointerTarget.y + 'px' }"
          ></div>
          <div class="pointer-cursor" :style="{ left: fixedX + 'px', top: gyroCursor.y + 'px' }"></div>
        </div>
      </div>

      <p v-if="isSimulated" class="debug-hint-game">
        [R]回転 [S]振る [M]連打 [矢印キー]ポインター移動 [C]リセット
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import VisualArea from '../VisualArea.vue';
import { PROGRESS_MAX } from '../../composites/useGameState';

// 親(App.vue)から受け取るデータの定義
const props = defineProps({
  isCountingDown: Boolean,
  countdown: Number,
  isStepChanging: Boolean,
  stepChangeText: String,
  timeLeft: Number,
  currentStepIndex: Number,
  currentStep: Object,
  progress: Number,
  isSimulated: Boolean,
  isLockingOn: Boolean,
  pointerTarget: Object,
  gyroCursor: Object,
  fixedX: Number,
  joyConAccel: Object
});

const progressPercent = computed(() => {
  return Math.min((props.progress / PROGRESS_MAX) * 100, 100);
});
</script>

<style scoped>
/* --- 全体レイアウト --- */
.game-layout {
  position: relative;
  width: 100vw; height: 100vh; overflow: hidden;
  background: #faf9f6; 
  background-image: radial-gradient(circle at center, #ffffff 0%, #f0ede6 100%);
  z-index: 1;
}

.game-hud-container {
  display: grid; grid-template-columns: 1fr; grid-template-rows: auto auto 1fr;
  width: 100%; height: 100%; padding: 15px 40px; box-sizing: border-box;
}

/* --- タイマー周り --- */
.hud-right-top {
  grid-row: 1; display: flex; flex-direction: column; align-items: flex-end;
  z-index: 20; position: absolute; top: 20px; right: 40px;
}
.timer-title {
  font-size: 1.2rem; color: #888888; letter-spacing: 0.2em;
  font-family: "Yu Mincho", "MS PMincho", serif; margin-bottom: 2px;
}
.timer-display-game {
  font-size: 4.8rem; font-weight: normal; font-family: "Yu Mincho", "MS PMincho", serif;
  color: #111111; text-shadow: none; line-height: 1.1;
}
.timer-display-game span {
  font-size: 2rem; margin-left: 4px; color: #666666;
}
.timer-low-game {
  color: #b30000; animation: pulse-timer 1s ease-in-out infinite alternate;
}

/* --- STEPとタイトル --- */
.hud-center-top {
  grid-row: 2; display: flex; flex-direction: column; justify-content: center;
  align-items: center; text-align: center; margin-top: 10px; margin-bottom: 5px; z-index: 10;
}
.step-badge {
  font-size: 1.1rem; color: #666666; letter-spacing: 0.25em;
  font-family: "Yu Mincho", "MS PMincho", serif; margin-bottom: 4px;
}
.step-title-game {
  font-size: 2.5rem; font-weight: normal; color: #111111;
  font-family: "Yu Mincho", "MS PMincho", serif; letter-spacing: 0.1em;
  margin: 0 0 20px 0; text-shadow: none;
}
.gauge-bar-outer-game {
  width: 600px; height: 24px; background: #dcdcdc; border: 1px solid #111111;
  border-radius: 0; overflow: hidden; box-shadow: inset 0 2px 5px rgba(0,0,0,0.1);
}
.gauge-bar-inner-game {
  height: 100%; background: linear-gradient(90deg, #aa822c, #d4af37);
  box-shadow: none; transition: width 0.1s ease-out;
}

/* --- メインビュー --- */
.hud-center-view {
  grid-row: 3; display: flex; justify-content: center; align-items: center;
  position: relative; width: 100%; height: 100%; padding: 0;
}
.main-visual-large {
  width: 100%; height: 60vh; max-height: 60vh; max-width: 1100px; 
  object-fit: contain; z-index: 5;
}

/* --- ポインター（温度計） --- */
.pointer-overlay-layer {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  z-index: 10; pointer-events: none;
}
.pointer-target {
  position: fixed; width: 150px; height: 4px; background-color: #cccccc;
  border-radius: 0; box-shadow: none; transform: translate(-50%, -50%);
  transition: background-color 0.2s, box-shadow 0.2s;
}
.pointer-target.target-locking {
  background-color: #d4af37 !important; box-shadow: 0 0 15px rgba(212, 175, 55, 0.4) !important; 
}
.pointer-cursor {
  position: fixed; width: 130px; height: 2px; background-color: #111111;
  border-radius: 0; box-shadow: none; transform: translate(-50%, -50%);
}

/* --- ステップ切り替え --- */
.step-transition-overlay {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%; 
  background: rgba(255, 255, 255, 0.65); backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px); display: flex; justify-content: center; align-items: center; z-index: 99;
}
.neon-instruction-text {
  font-size: 3.5rem; font-weight: normal; font-family: "Yu Mincho", "MS PMincho", serif;
  color: #111111; text-align: center; padding: 0 30px; letter-spacing: 0.15em; text-shadow: none;
}
.debug-hint-game {
  position: absolute; bottom: 15px; left: 50%; transform: translateX(-50%);
  font-size: 0.8rem; color: #999999; margin: 0;
}

@keyframes pulse-timer {
  0% { opacity: 0.7; }
  100% { opacity: 1; }
}
</style>