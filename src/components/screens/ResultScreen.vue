<template>
  <div class="result-screen-bg">
    <div class="result-content-container">
      
      <div class="result-left-area">
        <img v-if="resultGemImageSrc" :src="resultGemImageSrc" :alt="`${gemName}-image`" class="result-gem-image-paper" />
        <p class="gem-name-label">完成品：{{ gemName }}</p>
      </div>

      <div class="result-right-area">
        <p class="overlay-price">{{ finalPrice.toLocaleString() }}<span class="unit">円</span></p>
        <p class="overlay-score">{{ (averageProgressRate * 100).toFixed(1) }}<span class="unit">%</span></p>
        <p class="overlay-date">{{ appraisalDate }}</p>
      </div>
      
      <button class="black-btn-main result-retry-btn-paper" @click="emitRetry">もう一度作る</button>
    
    </div>
  </div>
</template>

<script setup>
// 親から受け取るデータ
defineProps({
  resultGemImageSrc: String,
  gemName: String,
  finalPrice: Number,
  averageProgressRate: Number,
  appraisalDate: String
});

// 親へ送る合図の準備
const emit = defineEmits(['retry']);

const emitRetry = () => {
  emit('retry');
};
</script>

<style scoped>
/* --- 紙風リザルト画面のスタイル --- */
.result-screen-bg {
  position: absolute; top: 0; left: 0;
  width: 100vw; height: 100vh;
  background-color: #ffffff;
  display: flex; justify-content: center; align-items: center; overflow: hidden;
}

.result-content-container {
  position: relative;
  width: 100vw; height: 56.25vw; max-height: 100vh; max-width: 177.78vh; 
  container-type: inline-size;
  background-image: url('../../assets/images/result_bg.png'); /* ★パスを調整しました */
  background-size: cover; background-position: center; background-repeat: no-repeat;
}

/* --- 左側：宝石エリア --- */
.result-gem-image-paper {
  position: absolute; top: 60%; left: 25%; transform: translate(-50%, -50%);
  width: 36cqw; max-height: 60cqh; object-fit: contain;
  filter: drop-shadow(0 15px 25px rgba(0, 0, 0, 0.15));
}

.gem-name-label {
  position: absolute; top: 36%; left: 25%; transform: translateX(-50%);
  font-size: 2.8cqw; font-weight: bold; color: #1a1a1a;
  font-family: "Yu Mincho", "MS PMincho", serif; letter-spacing: 0.08em;
  margin: 0; text-align: center; width: 40%;
}

/* --- 右側：調査報告書エリア --- */
.result-right-area {
  position: absolute; top: 0; right: 0; width: 100%; height: 100%; pointer-events: none; 
}
.overlay-price, .overlay-score, .overlay-date {
  position: absolute; color: #222; font-family: "Yu Mincho", "MS PMincho", serif;
  margin: 0; width: 32%; text-align: center;
}

.overlay-price { top: 46.5%; left: 60%; font-size: 4.5cqw; font-weight: bold; }
.overlay-score { top: 71%; left: 60%; font-size: 4.5cqw; font-weight: bold; }
.unit { font-size: 3.5cqw; margin-left: 1.0cqw; }
.overlay-date { top: 88%; left: 75.5%; font-size: 2.6cqw; font-weight: bold; text-align: left; }

/* --- ボタン --- */
.result-retry-btn-paper {
  position: absolute; bottom: 4%; left: 50%; transform: translateX(-50%);
  background: #111111; color: #ffffff; border: 1px solid #999999; 
  padding: 1.0cqw 3.5cqw; border-radius: 0; font-size: 1.8cqw;
  font-family: "Yu Mincho", "MS PMincho", serif; letter-spacing: 0.25em; text-indent: 0.25em; 
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15); transition: all 0.3s ease;
  cursor: pointer; pointer-events: auto;
}
.result-retry-btn-paper:hover {
  background: #ffffff; color: #111111; border-color: #111111; transform: translateX(-50%) scale(1.03);
}

.result-price { 
  margin: 10px 0 6px; font-size: 2.2rem; letter-spacing: 0.05em; font-weight: 800; 
  color: #ffd166; text-shadow: 0 0 16px rgba(255, 209, 102, 0.4); 
}
</style>