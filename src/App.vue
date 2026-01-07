<script setup>
import { ref, computed, onUnmounted } from 'vue'
import './style.css'

const currentScreen = ref('title') 
const selectedBase = ref(null)
const selectedAdditive = ref(null)
const countdownValue = ref(3)
const currentSpeed = ref(0)
const successTime = ref(0)
const timeLeft = ref(10)
let gameInterval = null
let countdownInterval = null

const recipes = [
  { m1: 'C',     m2: 'Fe',    name: 'ダイヤモンド', range: [9, 11], decay: 0.4, desc: '炭素を鉄触媒で結晶化' },
  { m1: 'Al2O3', m2: 'Cr2O3', name: 'ルビー',       range: [2, 5],  decay: 0.2, desc: '酸化クロムで赤く発色' },
  { m1: 'Al2O3', m2: 'Fe',    name: 'サファイア',   range: [2, 5],  decay: 0.2, desc: '鉄分で深く青い輝きに' },
  { m1: 'SiO2',  m2: 'Fe',    name: 'アメジスト',   range: [6, 8],  decay: 0.3, desc: '二酸化ケイ素に鉄が反応' },
  { m1: 'SiO2',  m2: 'なし',   name: '水晶',         range: [6, 8],  decay: 0.3, desc: '純粋な二酸化ケイ素の結晶' }
]

const currentRecipe = computed(() => recipes.find(r => r.m1 === selectedBase.value && r.m2 === selectedAdditive.value) || null)
const canCreate = computed(() => currentRecipe.value !== null)

const startCountdown = () => {
  currentScreen.value = 'countdown'
  countdownValue.value = 3
  countdownInterval = setInterval(() => {
    countdownValue.value--
    if (countdownValue.value === 0) {
      clearInterval(countdownInterval)
      runGame()
    }
  }, 1000)
}

const runGame = () => {
  currentScreen.value = 'process'
  currentSpeed.value = 0; successTime.value = 0; timeLeft.value = 10
  gameInterval = setInterval(() => {
    const data = currentRecipe.value
    if (currentSpeed.value > 0) currentSpeed.value -= data.decay
    if (currentSpeed.value >= data.range[0] && currentSpeed.value <= data.range[1]) successTime.value += 0.1
    timeLeft.value -= 0.1
    if (timeLeft.value <= 0) { clearInterval(gameInterval); currentScreen.value = 'result' }
  }, 100)
}
const addRotation = () => { if (currentScreen.value === 'process') currentSpeed.value += 1.0 }
const getQuality = () => {
  if (successTime.value >= 8.0) return { rank: '極上 (S)', color: '#FFD700' }
  if (successTime.value >= 5.0) return { rank: '良質 (A)', color: '#FFFFFF' }
  return { rank: '並 (B)', color: '#bdc3c7' }
}
const resetGame = () => { currentScreen.value = 'title'; selectedBase.value = null; selectedAdditive.value = null }
onUnmounted(() => { clearInterval(gameInterval); clearInterval(countdownInterval) })
</script>

<template>
  <div id="game-app">
    <div class="screen-container">
      
      <div v-if="currentScreen === 'title'" class="content title-screen">
        <div class="main-gem-container"><img src="/image.png" alt="宝石" class="main-gem"></div>
        <h1 class="title">ジュエリーヤソシマ</h1>
        <button class="create-button" @click="currentScreen = 'select'">つくる ▶</button>
      </div>

      <div v-if="currentScreen === 'select'" class="palette-screen">
        <div class="main-content">
          <div class="preview-frame">
            <div class="gem-slot">{{ selectedBase || '?' }}</div>
            <div class="plus-text">+</div>
            <div class="gem-slot">{{ selectedAdditive || '?' }}</div>
          </div>
          <div class="palette-center">
            <div class="palette-group">
              <div class="step-label">① 原料</div>
              <div class="btn-list">
                <button v-for="b in ['C', 'Al2O3', 'SiO2']" :key="b" class="block-btn" :class="{ active: selectedBase === b }" @click="selectedBase = b; selectedAdditive = null">{{ b }}</button>
              </div>
            </div>
            <div class="palette-group" :class="{ disabled: !selectedBase }">
              <div class="step-label">② 触媒・発色</div>
              <div class="btn-list">
                <button v-for="a in ['Fe', 'Cr2O3', 'なし']" :key="a" class="block-btn" :class="{ active: selectedAdditive === a }" @click="selectedAdditive = a">{{ a }}</button>
              </div>
            </div>
          </div>
        </div>
        <div class="footer">
          <button class="main-action-btn" :disabled="!canCreate" @click="startCountdown">つくる！</button>
        </div>
      </div>

      <div v-if="currentScreen === 'countdown'" class="overlay-screen countdown-bg">
        <div class="countdown-body">
          <p class="countdown-label">反応開始まで...</p>
          <div class="countdown-number-wrapper">
             <span class="countdown-number">{{ countdownValue }}</span>
          </div>
        </div>
      </div>

      <div v-if="currentScreen === 'process'" class="overlay-screen process-bg" @mousedown="addRotation">
        <h2 class="process-msg">出力を調整せよ！</h2>
        <div class="gauge-outer">
          <div class="target-zone" v-if="currentRecipe" :style="{ left: (currentRecipe.range[0] * 5) + '%', width: ((currentRecipe.range[1] - currentRecipe.range[0]) * 5) + '%' }"></div>
          <div class="speed-bar" :style="{ width: (currentSpeed * 5) + '%' }"></div>
        </div>
        <div class="timer-box">
          <span class="timer-label">TIME:</span>
          <span class="timer-number">{{ timeLeft.toFixed(1) }}</span>
        </div>
      </div>

      <div v-if="currentScreen === 'result'" class="overlay-screen result-bg">
        <div class="result-box" v-if="currentRecipe">
          <h2>【完成】{{ currentRecipe.name }}</h2>
          <h1 class="rank-text" :style="{ color: getQuality().color }">{{ getQuality().rank }}</h1>
          <button class="main-action-btn" @click="resetGame">タイトルへ</button>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* ゲージの動作に必須なスタイル（ここにあると確実に反映されます） */
.gauge-outer {
    width: 80%;
    height: 50px;
    background: rgba(0, 0, 0, 0.4);
    border: 3px solid white;
    border-radius: 25px;
    position: relative; /* 子要素の起点をここにする */
    overflow: hidden;
    margin: 30px 0;
}

.target-zone {
    position: absolute;
    height: 100%;
    background: rgba(255, 255, 255, 0.3);
    border-left: 2px solid #00ff00; /* 境界線をわかりやすく */
    border-right: 2px solid #00ff00;
    z-index: 1; /* バーより後ろ */
}

.speed-bar {
    height: 100%;
    background: linear-gradient(90deg, #ff6b6b, #e03131);
    transition: width 0.1s linear;
    z-index: 2; /* ターゲットゾーンより前 */
}

/* カウントダウンの文字 */
.countdown-number { font-size: 8rem; color: white; text-shadow: 0 0 20px rgba(255,255,255,0.8); }
.process-msg { color: white; margin-bottom: 10px; }
.timer-display { font-size: 2rem; color: white; font-weight: bold; }
</style>