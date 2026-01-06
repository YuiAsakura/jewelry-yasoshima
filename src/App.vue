<script setup>
import { ref, computed, onUnmounted } from 'vue'

// --- 画面遷移管理 ---
const currentScreen = ref('title')
const selectedBase = ref('')
const selectedAdditive = ref('')

// --- プレイ用データ ---
const currentSpeed = ref(0)
const successTime = ref(0)
const timeLeft = ref(10)
let gameInterval = null

// --- 宝石の難易度・設定テーブル ---
const gemTable = {
  'ダイヤモンド': { range: [9, 11], difficulty: '上級', decay: 0.4, desc: 'グラファイトを鉄などの触媒に溶解して生成' },
  'アメジスト': { range: [6, 8], difficulty: '中級', decay: 0.3, desc: '鉄イオンを着色剤として育成' },
  '水晶': { range: [6, 8], difficulty: '中級', decay: 0.3, desc: '350度1000Paの条件下で結晶を育成' },
  'ルビー': { range: [2, 5], difficulty: '初級', decay: 0.2, desc: '2000度以上の高温で再結晶' },
  'サファイア': { range: [2, 5], difficulty: '初級', decay: 0.2, desc: '2000度の火炎で結晶を成長' }
}

// 宝石名を判定
const getGemName = () => {
  if (selectedBase.value === 'C' && selectedAdditive.value === 'Fe') return 'ダイヤモンド'
  if (selectedBase.value === 'SiO2' && selectedAdditive.value === 'Fe') return 'アメジスト'
  if (selectedBase.value === 'SiO2' && !selectedAdditive.value) return '水晶'
  if (selectedBase.value === 'Al2O3' && selectedAdditive.value === 'Cr2O3') return 'ルビー'
  if (selectedBase.value === 'Al2O3' && selectedAdditive.value === 'Fe') return 'サファイア'
  return '謎の石'
}

// 現在の宝石データを取得
const currentGemData = computed(() => {
  const name = getGemName()
  return gemTable[name] || { range: [0, 0], difficulty: '不明', decay: 0.2, desc: '' }
})

// --- ゲーム進行ロジック ---
const startProcess = () => {
  currentScreen.value = 'process'
  currentSpeed.value = 0
  successTime.value = 0
  timeLeft.value = 10

  gameInterval = setInterval(() => {
    const data = currentGemData.value
    if (currentSpeed.value > 0) currentSpeed.value -= data.decay
    if (currentSpeed.value >= data.range[0] && currentSpeed.value <= data.range[1]) {
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
    currentSpeed.value += 1.0
  }
}

const getQuality = () => {
  if (successTime.value >= 8.0) return { rank: '極上 (S)', color: '#FFD700', text: '完璧な職人技です！' }
  if (successTime.value >= 5.0) return { rank: '良質 (A)', color: '#C0C0C0', text: '素晴らしい出来栄えです。' }
  if (successTime.value >= 2.0) return { rank: '並 (B)', color: '#CD7F32', text: 'まずまずの品質です。' }
  return { rank: '失敗 (C)', color: '#808080', text: '生成に失敗しました…' }
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
      <button class="main-btn" @click="currentScreen = 'select'">開始する</button>
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
      <div v-if="selectedBase" class="section">
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
      <h2>速度を維持せよ！</h2>
      <div class="gauge-container">
        <div class="target-zone" :style="{ 
          left: (currentGemData.range[0] * 5) + '%', 
          width: ((currentGemData.range[1] - currentGemData.range[0]) * 5) + '%' 
        }"></div>
        <div class="speed-bar" :style="{ width: (currentSpeed * 5) + '%' }"></div>
      </div>
      <div class="timer">TIME: {{ timeLeft.toFixed(1) }}s</div>
      <p>緑の枠内にバーを維持してください</p>
    </div>

    <div v-if="currentScreen === 'result'" class="page">
      <h2 class="result-gem-name">【完成】{{ getGemName() }}</h2>
      
      <hr class="divider">

      <div class="quality-section">
        <h1 :style="{ color: getQuality().color }" class="rank-text">{{ getQuality().rank }}</h1>
        <p class="quality-comment">{{ getQuality().text }}</p>
      </div>

      <p class="desc">{{ currentGemData.desc }}</p>

      <div class="detail-box">
        <p>素材: {{ selectedBase }} + {{ selectedAdditive || 'なし' }}</p>
      </div>

      <button class="main-btn" @click="resetGame">タイトルへ</button>
    </div>
  </div>
</template>

<style scoped>
#game-app { text-align: center; padding: 20px; font-family: serif; background-color: #1a1a1a; color: #eee; min-height: 100vh; }
.page { border: 2px solid #d4af37; padding: 30px; border-radius: 10px; max-width: 450px; margin: auto; background: #2a2a2a; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
.gold-text { color: #d4af37; font-size: 2.5rem; }

/* ゲージ設定 */
.gauge-container { height: 40px; background: #111; position: relative; margin: 30px 0; border-radius: 5px; overflow: hidden; border: 1px solid #444; }
.target-zone { position: absolute; height: 100%; background: rgba(0, 255, 100, 0.4); border-left: 2px solid #0f0; border-right: 2px solid #0f0; z-index: 1; }
.speed-bar { height: 100%; background: linear-gradient(to right, #f1c40f, #d4af37); transition: width 0.1s linear; z-index: 2; }

/* タイマー */
.timer { font-size: 3rem; color: #ff4444; font-family: monospace; }

/* 結果画面のスタイル */
.result-gem-name { font-size: 2rem; color: #fff; margin-bottom: 10px; text-shadow: 0 0 10px rgba(255,255,255,0.3); }
.divider { border: 0; border-top: 1px solid #555; margin: 20px 0; }
.rank-text { font-size: 3.5rem; margin: 10px 0; font-weight: bold; }
.quality-comment { font-size: 1.2rem; margin-bottom: 20px; }
.desc { font-style: italic; color: #ccc; line-height: 1.4; margin: 15px 0; }
.detail-box { background: #333; padding: 10px; border-radius: 5px; font-size: 0.9rem; color: #bbb; }

/* ボタン設定 */
.active { background: #d4af37; color: #000; font-weight: bold; }
.main-btn, .next-btn { background: #444; color: #d4af37; border: 1px solid #d4af37; padding: 12px 30px; border-radius: 25px; cursor: pointer; margin-top: 20px; font-size: 1rem; transition: 0.2s; }
.main-btn:hover, .next-btn:hover { background: #d4af37; color: #000; }
button:disabled { opacity: 0.2; cursor: not-allowed; }
</style>