<script setup>
import { ref } from 'vue'

/**
 * 【JavaScriptセクション】
 * ここでデータの管理と動き（ロジック）を制御します
 */

// 画面の状態管理 ('select' = 素材選択, 'process' = 生成, 'result' = 結果)
const currentScreen = ref('select')

// 選択データの保持
const selectedBase = ref('')
const selectedAdditive = ref('')
const rotationCount = ref(0)
const timer = ref(10)
let intervalId = null

// --- 素材選択ロジック ---
const selectBase = (base) => {
  selectedBase.value = base
  selectedAdditive.value = '' // ベースを変えたら添加物はリセット
}

const selectAdditive = (add) => {
  selectedAdditive.value = add
}

// --- ゲーム進行ロジック ---
const startProcess = () => {
  currentScreen.value = 'process'
  rotationCount.value = 0
  timer.value = 10

  // 1秒ごとにカウントダウン
  intervalId = setInterval(() => {
    timer.value--
    if (timer.value <= 0) {
      clearInterval(intervalId)
      currentScreen.value = 'result'
    }
  }, 1000)
}

const addRotation = () => {
  if (currentScreen.value === 'process') {
    rotationCount.value++
  }
}

const resetGame = () => {
  currentScreen.value = 'select'
  selectedBase.value = ''
  selectedAdditive.value = ''
}
</script>

<template>
  <div id="game-app">
    <div v-if="currentScreen === 'select'" class="page">
      <h1>ジュエリーヤソシマ：素材選択</h1>

      <div class="section">
        <h3>1. ベース素材を選択</h3>
        <button @click="selectBase('C')">C</button>
        <button @click="selectBase('Al2O3')">Al2O3</button>
        <button @click="selectBase('SiO2')">SiO2</button>
      </div>

      <div class="section" v-if="selectedBase">
        <h3>2. 添加物・触媒を選択</h3>
        <button v-if="['C', 'Al2O3', 'SiO2'].includes(selectedBase)" @click="selectAdditive('Fe')">
          Fe
        </button>
        <button v-if="selectedBase === 'Al2O3'" @click="selectAdditive('Cr2O3')">Cr2O3</button>
      </div>

      <div class="section">
        <button v-if="selectedBase === 'SiO2' || selectedAdditive" @click="startProcess">
          生成フェーズへ進む
        </button>
      </div>
    </div>

    <div v-if="currentScreen === 'process'" class="page" @mousedown="addRotation">
      <h1>生成中...（画面を連打！）</h1>
      <div class="timer-display">残り時間: {{ timer }}s</div>
      <div class="count-display">現在の回転数: {{ rotationCount }}</div>
      <p>※マウスで画面内をクリックしてください</p>
    </div>

    <div v-if="currentScreen === 'result'" class="page">
      <h1>生成完了！</h1>
      <div class="result-info">
        <p>ベース: {{ selectedBase }}</p>
        <p>添加物: {{ selectedAdditive || 'なし' }}</p>
        <p>最終回転数: {{ rotationCount }}</p>
      </div>
      <button @click="resetGame">最初に戻る</button>
    </div>
  </div>
</template>

<style scoped>
/**
 * 【デザイン（CSS）セクション】
 * 今回はレイアウトを整える最低限のみ。
 * あとでここにデザインを書き込んでいきます。
 */
#game-app {
  font-family: sans-serif;
  text-align: center;
  padding: 50px;
}
.page {
  border: 2px solid #ccc;
  padding: 20px;
  border-radius: 10px;
}
.section {
  margin: 20px 0;
}
button {
  margin: 5px;
  padding: 10px 20px;
  cursor: pointer;
}
.timer-display {
  font-size: 2em;
  color: red;
}
</style>
