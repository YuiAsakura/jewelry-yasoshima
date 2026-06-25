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
          :progress="progress"
          class="main-visual-large"
        />

        <div v-if="currentStep?.id === 'hpht'" class="hpht-container">
          <div class="vertical-gauge">
            <div class="gauge-label">高温 <span class="sub-label">(Joy-Conを振る)</span></div>
            <div class="gauge-bg">
              <div class="target-zone"></div>
              <div class="gauge-fill temp-fill" :style="{ height: hphtTemp + '%' }"></div>
            </div>
          </div>
          <div class="hpht-status">
            <div class="status-icon" :class="{ 'is-ok': isHphtOk }">💎</div>
            <div class="status-text" v-if="isHphtOk">PERFECT!</div>
          </div>
          <div class="vertical-gauge">
            <div class="gauge-label">高圧 <span class="sub-label">(複数ボタン長押し)</span></div>
            <div class="gauge-bg">
              <div class="target-zone"></div>
              <div class="gauge-fill press-fill" :style="{ height: hphtPressure + '%' }"></div>
            </div>
          </div>
        </div>

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
  joyConAccel: Object,
  hphtTemp: Number,
  hphtPressure: Number
});

const progressPercent = computed(() => {
  return Math.min((props.progress / PROGRESS_MAX) * 100, 100);
});

const isHphtOk = computed(() => {
  return props.hphtTemp >= 50 && props.hphtTemp <= 80 && 
         props.hphtPressure >= 50 && props.hphtPressure <= 80;
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

.pointer-overlay-layer {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  z-index: 10; pointer-events: none;
}
.pointer-target {
  position: fixed; width: 150px; height: 8px; background-color: rgba(212, 175, 55, 0); 
  border: 2px solid #aaaaaa; border-radius: 2px; box-shadow: none; 
  transform: translate(-50%, -50%); transition: background-color 0.2s, border-color 0.2s, box-shadow 0.2s;
}
.pointer-target.target-locking {
  background-color: #d4af37 !important; border-color: #d4af37 !important;
  box-shadow: 0 0 15px rgba(212, 175, 55, 0.6) !important; 
  transition: background-color 1s linear, border-color 1s linear, box-shadow 1s linear;
}
.pointer-cursor {
  position: fixed; width: 150px; height: 4px; background-color: #d4af37;
  border-radius: 2px; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2); transform: translate(-50%, -50%);
  transition: top 0.05s linear; 
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

/* --- HPHT 専用UIスタイル --- */
.hpht-container { display: flex; align-items: center; justify-content: center; gap: 70px; width: 100%; height: 100%; }
.vertical-gauge { display: flex; flex-direction: column; align-items: center; gap: 15px; }
.gauge-label { font-size: 1.5rem; font-family: "Yu Mincho", "MS PMincho", serif; font-weight: bold; color: #111; text-align: center; }
.sub-label { font-size: 0.85rem; color: #666; display: block; margin-top: 5px; font-family: sans-serif; }
.gauge-bg { position: relative; width: 80px; height: 380px; background: #e8e8e8; border: 3px solid #333; border-radius: 40px; overflow: hidden; box-shadow: inset 0 5px 15px rgba(0,0,0,0.2); }
.target-zone { position: absolute; bottom: 50%; height: 30%; width: 100%; border-top: 4px solid #d4af37; border-bottom: 4px solid #d4af37; background: rgba(212, 175, 55, 0.2); z-index: 2; }
.gauge-fill { position: absolute; bottom: 0; left: 0; width: 100%; transition: height 0.1s linear; z-index: 1; }
.temp-fill { background: linear-gradient(0deg, #ff4e50, #f9d423); }
.press-fill { background: linear-gradient(0deg, #02aab0, #00cdac); }
.hpht-status { display: flex; flex-direction: column; align-items: center; width: 150px; }
.status-icon { font-size: 5rem; opacity: 0.2; transition: all 0.3s ease; filter: grayscale(1); }
.status-icon.is-ok { opacity: 1; filter: grayscale(0) drop-shadow(0 0 25px rgba(212,175,55,1)); transform: scale(1.15); }
.status-text { font-family: sans-serif; font-weight: 900; color: #d4af37; letter-spacing: 0.1em; margin-top: 15px; font-size: 1.3rem; animation: pulse 1s infinite alternate; }
@keyframes pulse { 0% { opacity: 0.6; transform: scale(0.95); } 100% { opacity: 1; transform: scale(1.05); } }

@keyframes pulse-timer {
  0% { opacity: 0.7; }
  100% { opacity: 1; }
}
</style>