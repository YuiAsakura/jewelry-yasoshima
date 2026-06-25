<template>
  <div class="mix-visual-container">
    <img 
      v-if="step.bgImage" 
      :src="step.bgImage" 
      class="bowl-image" 
      alt="bowl" 
    />

    <img 
      v-if="step.toolImage" 
      :src="step.toolImage" 
      class="stir-tool-image" 
      :style="toolStyle"
      alt="stir-tool" 
    />
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  step: { type: Object, required: true },
  progress: { type: Number, default: 0 }
});

// 変更前（toolStyleの部分すべて）をこれに置き換えます
const toolStyle = computed(() => {
  const progressRate = props.progress / 2000;

  const totalSpins = 20; 
  const rad = - (progressRate * totalSpins * 2 * Math.PI);
  const tiltAngle = Math.sin(rad) * 35;
  const depth = Math.cos(rad);
  const offsetY = depth * 15;
  const offsetX = Math.sin(rad) * 5;
  const scaleY = 0.9 + 0.1 * depth; 

  return {
    transform: `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px)) rotate(${tiltAngle}deg) scaleY(${scaleY})`
  };
});
</script>

<style scoped>
.mix-visual-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.bowl-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 15px 25px rgba(0, 0, 0, 0.15));
  z-index: 1;
}

.stir-tool-image {
  position: absolute;
  top: 40%;
  left: 50%;
  height: 80%;
  object-fit: contain;
  z-index: 2;
  transform-origin: bottom center;
  transition: transform 0.1s linear;
}
</style>