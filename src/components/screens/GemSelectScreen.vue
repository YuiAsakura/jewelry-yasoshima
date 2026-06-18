<template>
  <div class="select-screen-bg">
    <div class="select-header">
      <h2 class="select-title-luxury">SELECT GEM</h2>
      <p class="select-sub-text">作る宝石を選んでください</p>
    </div>

    <div class="gem-grid-luxury">
      <div 
        v-for="(gem, key) in GEM_DATA" 
        :key="key" 
        class="gem-card-luxury"
        @click="emitSelect(key)"
      >
        <div class="gem-image-wrapper">
          <img v-if="gem.resultImage" :src="gem.resultImage" :alt="gem.name" class="gem-card-image" />
        </div>
        
        <div class="gem-name-luxury">{{ gem.name }}</div>
        <div class="gem-method-luxury">{{ gem.method }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { GEM_DATA } from '../../constants/gemData';

// 親(App.vue)へ合図を送る準備
const emit = defineEmits(['select-gem']);

const emitSelect = (key) => {
  emit('select-gem', key);
};
</script>

<style scoped>
/* --- 宝石選択画面 --- */
.select-screen-bg {
  position: absolute;
  top: 0; left: 0;
  width: 100vw; height: 100vh;
  background-color: #faf9f6; 
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 10vh;
  z-index: 100;
}

.select-header {
  text-align: center;
  margin-bottom: 50px;
}

.select-title-luxury {
  font-family: "Yu Mincho", "MS PMincho", serif;
  font-size: 3.5rem;
  font-weight: normal;
  color: #111111;
  letter-spacing: 0.15em;
  margin: 0 0 10px 0;
}

.select-sub-text {
  font-family: "Yu Mincho", "MS PMincho", serif;
  font-size: 1.5rem;
  font-weight: bold;
  color: #666666;
  letter-spacing: 0.2em;
  margin-bottom: 25px;
}

/* 宝石を並べるグリッド（ショーケース風） */
.gem-grid-luxury {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 30px;
  max-width: 1000px;
  width: 90%;
}

/* --- 宝石のカードデザイン --- */
.gem-card-luxury {
  background: #ffffff;
  border: 2px solid transparent; 
  padding: 30px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
  position: relative;
}

.gem-card-luxury:hover {
  transform: translateY(-8px);
  box-shadow: 0 15px 30px rgba(0, 0, 0, 0.1);
  border: 2px solid #111111; 
}

.gem-image-wrapper {
  height: 120px;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 20px;
}

.gem-card-image {
  max-width: 100px;
  max-height: 100px;
  object-fit: contain;
  filter: drop-shadow(0 10px 15px rgba(0, 0, 0, 0.1));
  transition: transform 0.3s ease;
}

.gem-card-luxury:hover .gem-card-image {
  transform: scale(1.15);
}

.gem-name-luxury {
  font-family: "Yu Mincho", "MS PMincho", serif;
  font-size: 1.8rem;
  color: #111111;
  font-weight: bold;
  letter-spacing: 0.1em;
  margin-bottom: 10px;
}

.gem-method-luxury {
  font-family: sans-serif;
  font-size: 0.9rem;
  color: #888888;
  letter-spacing: 0.05em;
  font-weight: bold;
}
</style>