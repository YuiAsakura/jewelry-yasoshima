<template>
  <div class="visual-area">
    <ShakeVisual 
      v-if="step.id.includes('shake')" 
      :step="step" 
      :accel="accel"
      :is-simulated="isSimulated"
    />

    <img 
      v-else-if="step.image" 
      :src="step.image" 
      class="step-image" 
      alt="step-visual"
    />
    
    <div v-else class="no-image-placeholder">
      <div class="placeholder-icon">💎</div>
      <div class="placeholder-text">NO IMAGE</div>
      <div class="placeholder-step-name">{{ step.label }}</div>
    </div>
  </div>
</template>

<script setup>
import ShakeVisual from './ShakeVisual.vue';
/**
 * 親(App.vue)から現在のステップデータを受け取ります
 */
defineProps({
  step: { type: Object, required: true },
  accel: { type: Object, default: () => ({ x: 0, y: 0, z: 0 }) },
  isSimulated: { type: Boolean, default: false }
});
</script>

<style scoped>
.visual-area {
  width: 100%;
  height: 100%;
  background: transparent;
  border: none;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 25px;
  overflow: hidden;
}

.step-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  /* ★犯人はここでした！青い光を削除し、上品で自然な影に変更しています */
  filter: drop-shadow(0 15px 25px rgba(0, 0, 0, 0.1));
}

/* --- 画像がない場合のプレースホルダーも高級感あるデザインに一新 --- */
.no-image-placeholder {
  text-align: center;
  font-family: "Yu Mincho", "MS PMincho", serif; /* 明朝体に統一 */
}

.placeholder-icon {
  font-size: 3.5rem;
  margin-bottom: 15px;
  opacity: 0.5;
  animation: pulse-luxury 3s infinite ease-in-out; /* ゆったりとした点滅に */
}

.placeholder-text {
  font-size: 0.9rem;
  letter-spacing: 0.3em;
  color: #999999; /* サイバーな青緑から、上品なグレーへ */
  font-weight: bold;
}

.placeholder-step-name {
  margin-top: 10px;
  font-size: 1.5rem;
  color: #111111; /* 薄い青から、シャープな黒へ */
  letter-spacing: 0.1em;
}

@keyframes pulse-luxury {
  0% { transform: scale(1); opacity: 0.3; }
  50% { transform: scale(1.05); opacity: 0.6; }
  100% { transform: scale(1); opacity: 0.3; }
}
</style>