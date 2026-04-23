<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import './style.css'

// --- ゲーム状態管理 ---
const currentScreen = ref('title') 
const selectedGem = ref(null)      
const currentStepIndex = ref(0)    
const progress = ref(0)            
const timeLeft = ref(0)            
const countdownValue = ref(3)      
const lastInputState = ref(false) 
const keys = ref({})
const stepResults = ref([])

// --- WebHID 関連 ---
const hidDevice = ref(null)
const lastG = ref(0)
const SHAKE_THRESHOLD = 600

// --- 全宝石データ ---
const gemData = {
  ruby: { name: 'ルビー', method: 'ベルヌーイ法', steps: [
    { id: 'mash', label: '酸化アルミニウム投入', target: 100, timeLimit: 10, hint: 'Aボタン連打！' },
    { id: 'rotate', label: '台座成形', target: 100, timeLimit: 15, hint: 'スティック回転！' },
    { id: 'shake', label: '表面研磨', target: 100, timeLimit: 10, hint: 'ジョイコンを振れ！' }
  ]},
  sapphire: { name: 'サファイア', method: 'ベルヌーイ法', steps: [
    { id: 'long_press', label: '原料投入', target: 100, timeLimit: 10, hint: 'Aボタン長押し！' },
    { id: 'rotate', label: '台座成形', target: 100, timeLimit: 15, hint: 'スティック回転！' },
    { id: 'shake', label: '研磨', target: 200, timeLimit: 10, hint: '振れ！' }
  ]},
  emerald: { name: 'エメラルド', method: 'フラックス法', steps: [
    { id: 'rotate', label: '原料溶解', target: 100, timeLimit: 15, hint: 'スティック回転！' },
    { id: 'keep_level', label: '徐冷', target: 100, timeLimit: 20, hint: '水平を保て！' },
    { id: 'pointer', label: 'ブラシ洗浄', target: 100, timeLimit: 15, hint: 'スティックでこすれ！' }
  ]},
  crystal: { name: 'クリスタル', method: 'フラックス法', steps: [
    { id: 'rotate', label: '溶解', target: 100, timeLimit: 15, hint: '回転！' },
    { id: 'keep_level', label: '徐冷', target: 100, timeLimit: 20, hint: '水平！' },
    { id: 'pointer', label: '洗浄', target: 100, timeLimit: 15, hint: 'こすれ！' }
  ]},
  amethyst: { name: 'アメジスト', method: 'フラックス法', steps: [
    { id: 'rotate', label: '原料溶解', target: 100, timeLimit: 12, hint: 'スティック回転！' },
    { id: 'keep_level', label: '徐冷', target: 100, timeLimit: 15, hint: '水平を保て！' },
    { id: 'ir_sensor', label: '放射線照射', target: 100, timeLimit: 10, hint: 'A長押し！' }
  ]},
  diamond: { name: 'ダイヤモンド', method: 'HPHT法', steps: [
    { id: 'press_rotate', label: '超高圧印加', target: 100, timeLimit: 20, hint: 'A＋スティック回転！' },
    { id: 'press_shake', label: '超高温加熱', target: 200, timeLimit: 15, hint: 'Aを押しながら振れ！' }
  ]}
}

const currentStep = computed(() => {
  if (!selectedGem.value) return null
  return gemData[selectedGem.value].steps[currentStepIndex.value]
})

// --- WebHID: 加速度データの処理 ---
// --- デバッグ用の変数（画面に表示させると原因がすぐわかります） ---
const debugMessage = ref("未接続");

// --- 判定の連投を防ぐためのフラグ ---
const canAddProgress = ref(true);

const handleInputReport = (event) => {
  const { data, reportId } = event;

  // ゲーム中かつ宝石が選択されているかチェック
  if (currentScreen.value !== 'game' || !currentStep.value) return;

  // 「振り（shake）」が含まれる工程のみ処理
  if (currentStep.value.id.includes('shake')) {
    try {
      // 1. レポートIDに応じたオフセット設定（0x30:フル, 0x3f:標準）
      const offset = (reportId === 0x30) ? 13 : 1;
      
      // 2. 加速度 Rawデータの取得（16bit Little Endian）
      const x = data.getInt16(offset, true);
      const y = data.getInt16(offset + 2, true);
      const z = data.getInt16(offset + 4, true);
      
      // 3. 加速度の合成ベクトル（大きさ）を計算
      const currentG = Math.sqrt(x*x + y*y + z*z);
      
      if (lastG.value !== 0) {
        // 4. 前回との差分（衝撃の強さ ≒ 振る速度の変化量）を計算
        const deltaG = Math.abs(currentG - lastG.value);

        // 5. 判定ロジック
        // しきい値を 8000 以上に設定し、持ち上げなどの低速な動きをカット
        if (deltaG > 25000 && canAddProgress.value) {
          
          // ダイヤモンド等の「Aボタン＋振り」が必要な場合の追加チェック
          const gp = navigator.getGamepads()[0];
          const actionPressed = (gp && gp.buttons[0].pressed) || keys.value[' '];
          
          if (currentStep.value.id === 'press_shake' && !actionPressed) {
            lastG.value = currentG;
            return;
          }

          // 6. 「速度連動型」の加算量計算
          // 8000を超えた分を「速度ボーナス」として加算
          // (deltaG - 最低しきい値) / 調整値 + 基本値
          const speedGain = (deltaG - 25000) / 6000 + 1.5;
          
          // 1回の一振りでの最大加算量を制限（例：最大12.0まで）
          const finalGain = Math.min(speedGain, 15.0);

          // 進捗を更新
          progress.value = Math.min(progress.value + finalGain, 100);

          // 7. クールタイムの設定（多重カウント防止）
          canAddProgress.value = false;
          setTimeout(() => {
            canAddProgress.value = true;
          }, 150); // 0.12秒間は次の入力を受け付けない
        }
      }
      
      // 8. 判定の成否に関わらず、常に最新の値を保存して次回の比較に備える
      lastG.value = currentG;
      
    } catch (e) {
      console.error("Input Report Error:", e);
    }
  }
};

const connectJoyCon = async () => {
  try {
    const devices = await navigator.hid.requestDevice({ filters: [{ vendorId: 0x057e }] });
    if (devices.length === 0) return;
    hidDevice.value = devices[0];

    if (!hidDevice.value.opened) {
      await hidDevice.value.open();
    }

    // --- 確実に加速度をONにする3ステップのコマンド ---
    
    // 1. 加速度・ジャイロセンサー自体を有効化 (サブコマンド 0x40, 引数 0x01)
    await hidDevice.value.sendReport(0x01, new Uint8Array([0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x40, 0x01]));
    
    // 2. 少し待機（ジョイコン内の処理時間を稼ぐ）
    await new Promise(r => setTimeout(r, 100));

    // 3. レポートモードを 0x30 (フルデータ) に設定 (サブコマンド 0x03, 引数 0x30)
    await hidDevice.value.sendReport(0x01, new Uint8Array([0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x30]));

    hidDevice.value.oninputreport = handleInputReport;
    debugMessage.value = "接続成功・モード切替完";
    
    startCountdown();
  } catch (err) {
    debugMessage.value = "エラー: " + err.message;
    console.error(err);
  }
};

// --- ゲームループ（時間と通常入力） ---
let gameLoopInterval = null
const startLogicLoop = () => {
  if (gameLoopInterval) clearInterval(gameLoopInterval)
  gameLoopInterval = setInterval(() => {
    if (currentScreen.value !== 'game') return
    
    timeLeft.value = Math.max(0, timeLeft.value - 0.1)

    const gp = navigator.getGamepads()[0]
    const actionPressed = (gp && gp.buttons[0].pressed) || keys.value[' ']
    const axisActive = (gp && (Math.abs(gp.axes[0]) > 0.6 || Math.abs(gp.axes[1]) > 0.6)) || 
                     (keys.value['ArrowUp'] || keys.value['ArrowDown'] || keys.value['ArrowLeft'] || keys.value['ArrowRight'])

    if (progress.value < currentStep.value.target) {
      switch (currentStep.value.id) {
        case 'mash':
          if (actionPressed && !lastInputState.value) progress.value += 5; break
        case 'long_press':
        case 'ir_sensor':
          if (actionPressed) progress.value += 0.7; break
        case 'rotate':
        case 'pointer':
          if (axisActive) progress.value += 0.8; break
        case 'keep_level':
          if (!axisActive && !actionPressed) progress.value += 0.5; break
        case 'press_rotate':
          if (actionPressed && axisActive) progress.value += 0.8; break
      }
      lastInputState.value = actionPressed
      
      if (progress.value >= currentStep.value.target) {
        progress.value = currentStep.value.target
      }
    }

    if (timeLeft.value <= 0) {
      nextStep()
    }
  }, 100)
}

const nextStep = () => {
  stepResults.value.push(progress.value / currentStep.value.target)
  progress.value = 0
  if (currentStepIndex.value < gemData[selectedGem.value].steps.length - 1) {
    currentStepIndex.value++
    timeLeft.value = currentStep.value.timeLimit
  } else {
    currentScreen.value = 'result'
    clearInterval(gameLoopInterval)
  }
}

// --- シーケンス制御 ---
const selectGem = (key) => {
  selectedGem.value = key
  // 既に有効なHID接続があるなら即開始
  if (hidDevice.value && hidDevice.value.opened) {
    startCountdown()
  } else {
    currentScreen.value = 'connect'
  }
}

const startCountdown = () => {
  currentScreen.value = 'countdown'
  countdownValue.value = 3
  
  const cd = setInterval(() => {
    countdownValue.value--
    if (countdownValue.value <= 0) {
      clearInterval(cd)
      currentStepIndex.value = 0
      timeLeft.value = currentStep.value.timeLimit
      currentScreen.value = 'game'
      startLogicLoop()
    }
  }, 1000)
}

onMounted(() => {
  window.addEventListener('keydown', (e) => { keys.value[e.key] = true })
  window.addEventListener('keyup', (e) => { keys.value[e.key] = false })
})

onUnmounted(() => {
  if (gameLoopInterval) clearInterval(gameLoopInterval)
})
</script>

<template>
  <div class="screen-container">
    <div style="position: fixed; bottom: 10px; left: 10px; color: red; font-size: 12px; z-index: 100;">
      Debug: {{ debugMessage }}
    </div>
    
    <div v-if="currentScreen === 'title'" class="title-screen">
      <h1 class="title">ジュエリーヤソシマ</h1>
      <button class="create-button" @click="currentScreen = 'select'">つくる ▶</button>
    </div>

    <div v-if="currentScreen === 'select'" class="palette-screen">
      <div class="main-content">
        <h2 style="color: white;">宝石を選択</h2>
        <div class="gem-list" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 20px;">
          <button v-for="(data, key) in gemData" :key="key" class="block-btn" @click="selectGem(key)" style="width: 200px; height: 60px;">
            {{ data.name }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="currentScreen === 'connect'" class="overlay-screen countdown-bg">
      <div class="result-card-frame" style="text-align: center; padding: 40px;">
        <h2 style="color: white;">ジョイコン接続</h2>
        <p style="color: #a5d8ff; margin: 20px 0;">
          「接続」ボタンを押し、ブラウザのリストから<br>
          ペアリング済みのJoy-Conを選んでください。
        </p>
        <button class="main-action-btn" @click="connectJoyCon">接続を開始</button>
      </div>
    </div>

    <div v-if="currentScreen === 'countdown'" class="overlay-screen countdown-bg">
      <div class="countdown-body">
        <span class="countdown-number">{{ countdownValue }}</span>
      </div>
    </div>

    <div v-if="currentScreen === 'game'" class="overlay-screen" style="background: none;">
      <h2 style="color: white;">{{ currentStep.label }}</h2>
      <div class="gauge-outer" style="width: 70%; height: 30px; background: rgba(0,0,0,0.6); border: 2px solid white; border-radius: 15px; overflow: hidden; margin: 25px 0;">
        <div :style="{ width: (progress / currentStep.target * 100) + '%', height: '100%', background: '#ff6b6b' }"></div>
      </div>
      <div class="timer-box">
        <span class="timer-number">{{ timeLeft.toFixed(1) }}s</span>
      </div>
      <p style="color: #ffd43b;">{{ currentStep.hint }}</p>
    </div>

    <div v-if="currentScreen === 'result'" class="overlay-screen">
      <h2 style="color: white;">完成！</h2>
      <button class="main-action-btn" @click="currentScreen = 'title'">タイトルへ</button>
    </div>

  </div>
</template>