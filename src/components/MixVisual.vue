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
  
  // 完了までに何周ぐるぐるするか
  const totalSpins = 10; 
  const rad = progressRate * totalSpins * 2 * Math.PI;

  // 1. 持ち手が左右に振れる角度（-35度 〜 35度）
  const tiltAngle = Math.sin(rad) * 35;

  // 2. 手前と奥の「奥行き」の計算 (1 = 手前, -1 = 奥)
  const depth = Math.cos(rad);

  // 3. 奥行きに合わせて、棒を上下にずらす（手前を通る時は下、奥を通る時は上）
  const offsetY = depth * 15;

  // 4. 先端もわずかに円を描くようにして、ガチガチに固定されている感を消す
  const offsetX = Math.sin(rad) * 5;

  // ★ 魔法の1行：奥を通る時は棒を少し「短く」見せることで、2D画像が完全に3Dの円軌道になります！
  // 奥にいる時(depth=-1)は 0.8倍、手前にいる時(depth=1)は 1.0倍の長さになる
  const scaleY = 0.9 + 0.1 * depth; 

  return {
    // translate, rotateに加えて、scaleY を使って長さを変える
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
  max-width: 60%;
  max-height: 60%;
  object-fit: contain;
  filter: drop-shadow(0 15px 25px rgba(0, 0, 0, 0.15));
  z-index: 1;
}

.stir-tool-image {
  position: absolute;
  /* 棒の初期位置をすり鉢の中央付近にセット */
  top: 45%;
  left: 50%;
  height: 40%;
  object-fit: contain;
  z-index: 2;
  
  /* 回転の軸を画像の下部（先端）にして、自然に傾くようにする */
  transform-origin: bottom center;
  
  /* 進捗に合わせて滑らかに動くようにする */
  transition: transform 0.1s linear;
}
</style>