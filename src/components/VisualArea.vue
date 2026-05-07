<template>
  <div class="visual-area">
    <!-- 画像パスがある場合のみ表示 -->
    <img 
      v-if="step.image" 
      :src="step.image" 
      class="step-image" 
      alt="step-visual"
    />
    
    <!-- 画像がない場合のプレースホルダー（ダミー表示） -->
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
  width: 100%;
  height: 250px;
  background: rgba(17, 34, 64, 0.5);
  border: 1px dashed #233554;
  border-radius: 12px;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 25px;
  overflow: hidden;
}

.step-image {
  max-height: 90%;
  max-width: 90%;
  object-fit: contain;
  filter: drop-shadow(0 0 15px rgba(100, 255, 218, 0.3));
}

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