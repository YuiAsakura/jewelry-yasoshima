<script setup>
import { ref, computed, onUnmounted } from 'vue'
import './style.css' // 相方のデザインを読み込む

// --- 画面遷移管理 ---
const currentScreen = ref('title')
const selectedBase = ref('')
const selectedAdditive = ref('')

// --- カウントダウン用データ ---
const countdownValue = ref(3)
let countdownInterval = null

// --- プレイ用データ ---
const currentSpeed = ref(0)
const successTime = ref(0)
const timeLeft = ref(10)
let gameInterval = null

const gemTable = {
  'ダイヤモンド': { range: [9, 11], difficulty: '上級', decay: 0.4 },
  'アメジスト': { range: [6, 8], difficulty: '中級', decay: 0.3 },
  '水晶': { range: [6, 8], difficulty: '中級', decay: 0.3 },
  'ルビー': { range: [2, 5], difficulty: '初級', decay: 0.2 },
  'サファイア': { range: [2, 5], difficulty: '初級', decay: 0.2 }
}

const getGemName = () => {
  if (selectedBase.value === 'C' && selectedAdditive.value === 'Fe') return 'ダイヤモンド'
  if (selectedBase.value === 'SiO2' && selectedAdditive.value === 'Fe') return 'アメジスト'
  if (selectedBase.value === 'SiO2' && !selectedAdditive.value) return '水晶'
  if (selectedBase.value === 'Al2O3' && selectedAdditive.value === 'Cr2O3') return 'ルビー'
  if (selectedBase.value === 'Al2O3' && selectedAdditive.value === 'Fe') return 'サファイア'
  return '謎の石'
}

const currentGemData = computed(() => {
  const name = getGemName()
  return gemTable[name] || { range: [0, 0], difficulty: '不明', decay: 0.2 }
})

// --- 1. カウントダウン開始ロジック ---
const startCountdown = () => {
  currentScreen.value = 'countdown'
  countdownValue.value = 3
  
  countdownInterval = setInterval(() => {
    countdownValue.value--
    if (countdownValue.value === 0) {
      clearInterval(countdownInterval)
      runGame() // 0になったらゲーム本番開始
    }
  }, 1000)
}

// --- 2. ゲーム本番開始ロジック ---
const runGame = () => {
  currentScreen.value = 'process'
  currentSpeed.value = 0; successTime.value = 0; timeLeft.value = 10
  
  gameInterval = setInterval(() => {
    const data = currentGemData.value
    if (currentSpeed.value > 0) currentSpeed.value -= data.decay
    if (currentSpeed.value >= data.range[0] && currentSpeed.value <= data.range[1]) successTime.value += 0.1
    timeLeft.value -= 0.1
    if (timeLeft.value <= 0) { 
      clearInterval(gameInterval)
      currentScreen.value = 'result' 
    }
  }, 100)
}

const addRotation = () => { if (currentScreen.value === 'process') currentSpeed.value += 1.0 }

const getQuality = () => {
  if (successTime.value >= 8.0) return { rank: '極上 (S)', color: 'gold' }
  if (successTime.value >= 5.0) return { rank: '良質 (A)', color: 'silver' }
  return { rank: '並 (B)', color: '#cd7f32' }
}

const resetGame = () => { currentScreen.value = 'title'; selectedBase.value = ''; selectedAdditive.value = '' }

// 後片付け（メモリリーク防止）
onUnmounted(() => {
  clearInterval(gameInterval)
  clearInterval(countdownInterval)
})
</script>

<template>
  <div id="game-app">
    <div v-if="currentScreen === 'title'" class="page">
      <h1>ジュエリーヤソシマ</h1>
      <button class="main-btn" @click="currentScreen = 'select'">開始</button>
    </div>

    <div v-if="currentScreen === 'select'" class="page">
      <div class="section">
        <button v-for="b in ['C', 'Al2O3', 'SiO2']" :key="b" 
                :class="{ active: selectedBase === b }" @click="selectedBase = b; selectedAdditive = ''">{{ b }}</button>
      </div>
      <div v-if="selectedBase" class="section">
        <button v-for="a in ['Fe', 'Cr2O3']" :key="a"
                :disabled="!( (selectedBase==='C' && a==='Fe') || (selectedBase==='Al2O3') || (selectedBase==='SiO2' && a==='Fe') )"
                :class="{ active: selectedAdditive === a }" @click="selectedAdditive = a">{{ a }}</button>
      </div>
      <button v-if="selectedBase==='SiO2' || selectedAdditive" class="next-btn" @click="startCountdown">生成開始</button>
    </div>

    <div v-if="currentScreen === 'countdown'" class="page countdown-screen">
      <p class="countdown-label">準備はいいか？</p>
      <h1 class="countdown-number">{{ countdownValue }}</h1>
    </div>

    <div v-if="currentScreen === 'process'" class="page" @mousedown="addRotation">
      <div class="gauge-container">
        <div class="target-zone" :style="{ left: (currentGemData.range[0] * 5) + '%', width: ((currentGemData.range[1] - currentGemData.range[0]) * 5) + '%' }"></div>
        <div class="speed-bar" :style="{ width: (currentSpeed * 5) + '%' }"></div>
      </div>
      <div class="timer">{{ timeLeft.toFixed(1) }}s</div>
    </div>

    <div v-if="currentScreen === 'result'" class="page">
      <h2>【完成】{{ getGemName() }}</h2>
      <h1 :style="{ color: getQuality().color }">{{ getQuality().rank }}</h1>
      <button class="main-btn" @click="resetGame">タイトルへ</button>
    </div>
  </div>
</template>

<style scoped>
/* 最低限のゲージとカウントダウンの見た目 */
.gauge-container { height: 30px; background: #eee; position: relative; margin: 20px 0; border: 1px solid #000; }
.target-zone { position: absolute; height: 100%; background: rgba(0, 255, 0, 0.5); }
.speed-bar { height: 100%; background: blue; width: 0%; transition: width 0.1s linear; }

/* カウントダウンの文字を見えやすく */
.countdown-number { font-size: 5rem; margin: 20px 0; color: #ff4444; }
.countdown-label { font-size: 1.2rem; }
</style>