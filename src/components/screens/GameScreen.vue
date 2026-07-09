<template>
  <div class="game-layout"> 

    <Transition name="fade-intro">
      <div v-if="introPhase > 0" class="step-intro-overlay" @click="$emit('advance-intro')">
        <div class="step-intro-card">
          
          <div class="intro-header">
            <span class="intro-step-num">STEP {{ currentStepIndex + 1 }}</span>
            <span class="intro-action-badge">{{ currentStep.actionName }}</span>
            <span class="intro-page-indicator">{{ introPhase }} / 2</span>
          </div>
          
          <h1 class="intro-step-title">{{ currentStep.label }}</h1>
          <div class="intro-divider"></div>
          
          <div v-if="introPhase === 1" class="intro-content-page1">
            <div class="intro-subtitle">【 科学知識・解説 】</div>
            <p class="intro-description">{{ currentStep.description }}</p>
          </div>

          <div v-if="introPhase === 2" class="intro-content-page2">
            <div class="intro-subtitle">【 操作方法 】</div>
            
            <div class="intro-hint-box-top">
              <span class="hint-icon">🎮</span>
              <span class="hint-text">{{ currentStep.hint }}</span>
            </div>

            <div class="intro-action-image-wrapper">
              <img 
                v-if="currentStep.introImage" 
                :src="currentStep.introImage" 
                class="intro-action-image" 
                alt="操作の図" 
              />
              <div v-else class="intro-image-placeholder">
                <span class="placeholder-icon-small">🖼️</span>
                <span>ここに「{{ currentStep.hint }}」の動作図が入ります</span>
              </div>
            </div>
          </div>

          <div class="intro-start-prompt">
            <span class="prompt-blink">
              ▼ {{ introPhase === 1 ? '任意のボタンで【操作方法】へ進む' : '任意のボタンで【ゲームスタート！】' }} ▼
            </span>
          </div>

        </div>
      </div>
    </Transition>

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
          :class="{ 'is-ok-glow': currentStep?.id === 'hpht' && isHphtOk }"
        />

        <div v-if="currentStep?.id === 'hpht'" class="hpht-gauges-overlay">
          <div class="vertical-gauge">
            <div class="gauge-label">高温 <span class="sub-label">(Joy-Conを振る)</span></div>
            <div class="gauge-bg">
              <div class="target-zone"></div>
              <div class="gauge-fill temp-fill" :style="{ height: hphtTemp + '%' }"></div>
            </div>
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
  introPhase: Number,
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

defineEmits(['advance-intro']);

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

@keyframes pulse-timer {
  0% { opacity: 0.7; }
  100% { opacity: 1; }
}

.hpht-gauges-overlay { 
  position: absolute; top: 0; left: 0; width: 100%; height: 100%; 
  display: flex; justify-content: space-between; align-items: center; 
  padding: 0 15%;
  box-sizing: border-box;
  pointer-events: none;
  z-index: 10; 
}
.vertical-gauge { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.gauge-label { font-size: 1.4rem; font-family: "Yu Mincho", "MS PMincho", serif; font-weight: bold; color: #111; text-align: center; text-shadow: 0 0 5px rgba(255,255,255,0.9); }
.sub-label { font-size: 0.85rem; color: #666; display: block; margin-top: 5px; font-family: sans-serif; }

.gauge-bg { 
  position: relative; 
  width: 75px;
  height: 55vh;
  max-height: 480px;
  background: #e8e8e8; border: 3px solid #333; border-radius: 40px; 
  overflow: hidden; box-shadow: inset 0 5px 15px rgba(0,0,0,0.2); 
}
.target-zone { position: absolute; bottom: 50%; height: 30%; width: 100%; border-top: 4px solid #d4af37; border-bottom: 4px solid #d4af37; background: rgba(212, 175, 55, 0.2); z-index: 2; }
.gauge-fill { position: absolute; bottom: 0; left: 0; width: 100%; transition: height 0.1s linear; z-index: 1; }
.temp-fill { background: linear-gradient(0deg, #ff4e50, #f9d423); }
.press-fill { background: linear-gradient(0deg, #02aab0, #00cdac); }

.main-visual-large { transition: all 0.2s ease-out; }
.main-visual-large.is-ok-glow {
  filter: drop-shadow(0 0 45px rgba(212, 175, 55, 1)) brightness(1.15);
  transform: scale(1.03);
}

/* --- イントロ画面 --- */
.step-intro-overlay {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(17, 17, 17, 0.85); backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex; justify-content: center; align-items: center;
  z-index: 100; cursor: pointer;
}

.step-intro-card {
  width: 85%; max-width: 850px; background: #faf9f6;
  border: 3px solid #111111; border-radius: 20px; padding: 35px 50px;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5), inset 0 0 0 4px #d4af37;
  display: flex; flex-direction: column; align-items: center; text-align: center;
  animation: intro-pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  box-sizing: border-box;
}

.intro-header {
  display: flex; align-items: center; gap: 15px; margin-bottom: 10px;
}
.intro-step-num {
  font-family: "Yu Mincho", "MS PMincho", serif; font-size: 1.3rem; font-weight: bold;
  color: #d4af37; letter-spacing: 0.2em;
}
.intro-action-badge {
  background: #111111; color: #faf9f6; font-size: 1rem; font-weight: bold;
  padding: 5px 20px; border-radius: 30px; letter-spacing: 0.15em;
  font-family: "Yu Mincho", "MS PMincho", serif;
}
.intro-page-indicator {
  font-size: 0.95rem; font-weight: bold; color: #666; background: #e8e8e8;
  padding: 4px 12px; border-radius: 12px;
}

.intro-step-title {
  font-family: "Yu Mincho", "MS PMincho", serif; font-size: 2.6rem; font-weight: normal;
  color: #111111; letter-spacing: 0.05em; margin: 5px 0; text-shadow: none;
}

.intro-divider {
  width: 150px; height: 3px; background: linear-gradient(90deg, transparent, #d4af37, transparent);
  margin: 15px 0 25px 0;
}

.intro-subtitle {
  font-family: "Yu Mincho", "MS PMincho", serif; font-size: 1.3rem; font-weight: bold;
  color: #886611; margin-bottom: 15px; letter-spacing: 0.1em;
}

/* --- 1ページ目：科学知識 --- */
.intro-content-page1 { width: 100%; display: flex; flex-direction: column; align-items: center; margin-bottom: 30px; }
.intro-description {
  font-family: "Yu Mincho", "MS PMincho", serif; font-size: 1.35rem; line-height: 1.8;
  color: #333333; text-align: left; width: 100%; max-width: 680px;
  background: #f0ede6; padding: 25px 35px; border-radius: 12px; border-left: 5px solid #d4af37; margin: 0;
  box-sizing: border-box;
}

/* --- 2ページ目：操作方法 --- */
.intro-content-page2 { width: 100%; display: flex; flex-direction: column; align-items: center; margin-bottom: 25px; }
.intro-hint-box-top {
  background: #222222; color: #d4af37; padding: 15px 45px; border-radius: 50px;
  font-size: 1.5rem; font-weight: bold; display: flex; align-items: center; gap: 12px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2); margin-bottom: 25px;
}
.intro-action-image-wrapper { width: 100%; max-width: 500px; height: 220px; display: flex; justify-content: center; align-items: center; }
.intro-action-image { max-width: 100%; max-height: 100%; object-fit: contain; filter: drop-shadow(0 10px 15px rgba(0, 0, 0, 0.15)); }
.intro-image-placeholder {
  width: 100%; height: 100%; border: 2px dashed #bbbbbb; border-radius: 15px;
  background: rgba(255, 255, 255, 0.5); display: flex; flex-direction: column;
  justify-content: center; align-items: center; color: #777777; font-weight: bold; gap: 10px;
}
.placeholder-icon-small { font-size: 2.5rem; opacity: 0.6; }

/* フッター・アニメーション */
.intro-start-prompt { font-size: 1rem; color: #555555; font-weight: bold; letter-spacing: 0.15em; }
.prompt-blink { animation: pulse-timer 1.5s infinite ease-in-out; }

@keyframes intro-pop { 0% { transform: scale(0.95); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
.fade-intro-enter-active, .fade-intro-leave-active { transition: opacity 0.3s ease; }
.fade-intro-enter-from, .fade-intro-leave-to { opacity: 0; }

</style>