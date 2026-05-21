<template>
  <div class="visual-area">
    <img 
      v-if="step.image" 
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
/**
 * 親(App.vue)から現在のステップデータを受け取ります
 */
defineProps({
  step: {
    type: Object,
    required: true
  }
});
</script>

<style scoped>
.visual-area {
  /* ▼ 修正：固定値 250px を削除し、App.vue側の指示（100%）にそのまま従うようにします */
  width: 100%;
  height: 100%;
  
  /* background: rgba(17, 34, 64, 0.5); */
  background: transparent;
  /* border: 1px dashed #233554; */
  border: none;
  border-radius: 12px;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 25px;
  overflow: hidden;
}

.step-image {
  /* ▼ 修正：90%の制限を外し、枠いっぱいの100%まで拡大できるようにします */
  width: 100%;
  height: 100%;
  
  /* 関係のない元のスタイルはそのまま維持 */
  object-fit: contain;
  filter: drop-shadow(0 0 15px rgba(100, 255, 218, 0.3));
}

/* --- 以降、全く関係のない記述のため一切変更していません --- */
.no-image-placeholder {
  text-align: center;
  color: #8892b0;
}

.placeholder-icon {
  font-size: 3.5rem;
  margin-bottom: 10px;
  opacity: 0.4;
  animation: pulse 2s infinite ease-in-out;
}

.placeholder-text {
  font-size: 0.7rem;
  letter-spacing: 3px;
  color: #64ffda;
  opacity: 0.6;
}

.placeholder-step-name {
  margin-top: 8px;
  font-size: 1.2rem;
  font-weight: bold;
  color: #ccd6f6;
}

@keyframes pulse {
  0% { transform: scale(1); opacity: 0.4; }
  50% { transform: scale(1.1); opacity: 0.6; }
  100% { transform: scale(1); opacity: 0.4; }
}
</style>