<script setup>
import { ref, computed, onUnmounted } from 'vue'

const currentScreen = ref('title')
const selectedBase = ref('')
const selectedAdditive = ref('')

// --- スピードメーター用データ ---
const currentSpeed = ref(0)
const successTime = ref(0)
const timeLeft = ref(10)
let gameInterval = null

// --- 宝石データ ---
const gemTable = {
  'ダイヤモンド': { range: [8, 12], difficulty: '上級', desc: 'グラファイトを鉄などの触媒に溶解して生成' },
  'アメジスト': { range: [5, 8], difficulty: '中級', desc: '鉄イオンを着色剤として育成' },
  '水晶': { range: [5, 8], difficulty: '中級', desc: '350度1000Paの条件下で結晶を育成' },
  'ルビー': { range: [2, 5], difficulty: '初級', desc: '2000度以上の高温で再結晶' },
  'サファイア': { range: [2, 5], difficulty: '初級', desc: '2000度の火炎で結晶を成長' }
}

// 宝石名を判定する関数（これを結果画面で直接使います）
const getGemName = () => {
  if (selectedBase.value === 'C' && selectedAdditive.value === 'Fe') return 'ダイヤモンド'
  if (selectedBase.value === 'SiO2' && selectedAdditive.value === 'Fe') return 'アメジスト'
  if (selectedBase.value === 'SiO2' && !selectedAdditive.value) return '水晶'
  if (selectedBase.value === 'Al2O3' && selectedAdditive.value === 'Cr2O3') return 'ルビー'
  if (selectedBase.value === 'Al2O3' && selectedAdditive.value === 'Fe') return 'サファイア'
  return '謎の石'
}

// 現在の宝石のデータを取得
const currentGemData = computed(() => {
  const name = getGemName()
  return gemTable[name] || { range: [0, 0], difficulty: '不明', desc: '' }
})

// --- ゲームロジック ---
const startProcess = () => {
  currentScreen.value = 'process'
  currentSpeed.value = 0
  successTime.value = 0
  timeLeft.value = 10

  gameInterval = setInterval(() => {
    if (currentSpeed.value > 0) currentSpeed.value -= 0.2
    
    const range = currentGemData.value.range
    if (currentSpeed.value >= range[0] && currentSpeed.value <= range[1]) {
      successTime.value += 0.1
    }

    timeLeft.value -= 0.1
    if (timeLeft.value <= 0) {
      clearInterval(gameInterval)
      currentScreen.value = 'result'
    }
  }, 100)
}

const addRotation = () => {
  if (currentScreen.value === 'process') {
    currentSpeed.value += 1.2
  }
}

const getQuality = () => {
  if (successTime.value >= 8) return { rank: '極上 (S)', color: 'gold' }
  if (successTime.value >= 5) return { rank: '良質 (A)', color: 'silver' }
  if (successTime.value >= 2) return { rank: '並 (B)', color: '#cd7f32' }
  return { rank: '失敗 (C)', color: 'gray' }
}

const resetGame = () => {
  currentScreen.value = 'title'
  selectedBase.value = ''
  selectedAdditive.value = ''
}

onUnmounted(() => clearInterval(gameInterval))
</script>

<template>
  <div id="game-app">
    <div v-if="currentScreen === 'title'" class="page">
      <h1 class="gold-text">ジュエリーヤソシマ</h1>
      <button class="main-btn" @click="currentScreen = 'select'">ゲーム開始</button>
    </div>

    <div v-if="currentScreen === 'select'" class="page">
      <h2>素材選択</h2>
      <div class="section">
        <h3>1. ベース素材</h3>
        <button v-for="b in ['C', 'Al2O3', 'SiO2']" :key="b" 
                :class="{ active: selectedBase === b }" @click="selectedBase = b; selectedAdditive = ''">
          {{ b }}
        </button>
      </div>
      <div class="section" v-if="selectedBase">
        <h3>2. 添加物</h3>
        <button v-for="a in ['Fe', 'Cr2O3']" :key="a"
                :disabled="!( (selectedBase==='C' && a==='Fe') || (selectedBase==='Al2O3') || (selectedBase==='SiO2' && a==='Fe') )"
                :class="{ active: selectedAdditive === a }" @click="selectedAdditive = a">
          {{ a }}
        </button>
      </div>
      <button v-if="selectedBase==='SiO2' || selectedAdditive" class="next-btn" @click="startProcess">
        生成開始 (難易度: {{ currentGemData.difficulty }})
      </button>
    </div>

    <div v-if="currentScreen === 'process'" class="page" @mousedown="addRotation">
      <h2>回転速度を維持せよ！</h2>
      <div class="gauge-container">
        <div class="target-zone" :style="{ 
          left: (currentGemData.range[0] * 5) + '%', 
          width: ((currentGemData.range[1] - currentGemData.range[0]) * 5) + '%' 
        }"></div>
        <div class="speed-bar" :style="{ width: (currentSpeed * 5) + '%' }"></div>
      </div>
      <div class="timer">残り: {{ timeLeft.toFixed(1) }}s</div>
    </div>

    <div v-if="currentScreen === 'result'" class="page">
      <h1 :style="{ color: getQuality().color }">{{ getQuality().rank }}</h1>
      <hr>
      <h2>完成：{{ getGemName() }}</h2>
      <p>{{ currentGemData.desc }}</p>
      <div class="detail">
        <p>成功維持時間: {{ successTime.toFixed(1) }}秒</p>
        <p>素材: {{ selectedBase }} + {{ selectedAdditive || 'なし' }}</p>
      </div>
      <button class="main-btn" @click="resetGame">タイトルへ</button>
    </div>
  </div>
</template>

<style scoped>
#game-app { text-align: center; padding: 20px; font-family: 'Georgia', serif; background-color: #fdfaf0; min-height: 100vh; }
.page { border: 3px solid #d4af37; padding: 20px; border-radius: 15px; max-width: 450px; margin: auto; background: white; }
.gold-text { color: #d4af37; }
.gauge-container { height: 40px; background: #eee; position: relative; margin: 20px 0; border-radius: 20px; overflow: hidden; border: 1px solid #ccc; }
.target-zone { position: absolute; height: 100%; background: rgba(0, 255, 0, 0.4); border-left: 2px solid green; border-right: 2px solid green; }
.speed-bar { height: 100%; background: linear-gradient(to right, #f1c40f, #d4af37); transition: width 0.1s linear; }
.active { background: #d4af37; color: white; border-color: #b8860b; }
.timer { font-size: 2.5rem; color: #e63946; font-weight: bold; }
.main-btn, .next-btn { background: #d4af37; color: white; padding: 12px 25px; border: none; border-radius: 25px; cursor: pointer; font-size: 1.1rem; margin-top: 20px; }
.detail { background: #f9f9f9; padding: 10px; border-radius: 10px; margin: 15px 0; font-size: 0.9rem; }
</style>