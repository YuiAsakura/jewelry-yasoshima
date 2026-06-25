<template>
  <div class="shake-visual-container">
    <img 
      v-if="step.bgImage" 
      :src="step.bgImage" 
      class="gem-base-image" 
      alt="gem-base" 
    />
    
    <img 
      v-if="step.toolImage" 
      :src="step.toolImage" 
      class="tool-image" 
      :style="toolStyle"
      alt="tool" 
    />
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  step: { type: Object, required: true },
  accel: { type: Object, required: true },
  isSimulated: { type: Boolean, required: true }
});

const toolStyle = computed(() => {
  let offset = 0;
  
  if (!props.isSimulated && props.accel) {
    offset = props.accel.y / 120; 
    
    // 画面外に飛び出さないように可動域を制限
    offset = Math.max(-60, Math.min(60, offset));
  } else if (props.isSimulated) {
    // キーボード時の適当な動き
    offset = Math.sin(Date.now() / 50) * 30;
  }

  return {
    // ★ ここがポイント：XとYの「両方」に同じ offset を入れることで、
    // 左上 ⇔ 右下 の斜め軌道で均等にガシガシ往復します！
    // (右上 ⇔ 左下にしたい場合は、片方を -offset にしてください)
    transform: `translate(calc(-50% + 40px + ${offset}px), calc(-50% - 40px + ${offset}px)) rotate(-15deg)`
  };
});
</script>

<style scoped>
.shake-visual-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.gem-base-image {
  max-width: 60%;
  max-height: 60%;
  object-fit: contain;
  filter: drop-shadow(0 15px 25px rgba(0, 0, 0, 0.15));
  z-index: 1;
}

.tool-image {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 40%;
  height: 40%;
  object-fit: contain;
  z-index: 2;
  transform-origin: center;
  filter: drop-shadow(0 10px 15px rgba(0, 0, 0, 0.3));
  transition: transform 0.04s linear; 
  pointer-events: none;
}
</style>