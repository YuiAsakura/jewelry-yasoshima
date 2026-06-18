<template>
  <div class="title-screen-bg">
    <div class="title-content">
      <h1 class="title-text-luxury">JEWELRY YASOSHIMA</h1>
      <p class="title-sub-text">Lab-Grown Gemstone Simulator</p>
      <p class="title-jp-description"> ～ 人工宝石シミュレーター 〜 </p>
      
      <div class="btn-group-luxury">
        <button class="black-btn-luxury" @click="emitStart(false)">JOY-CON 接続</button>
        <button class="white-btn-luxury" @click="emitStart(true)">JOY-CON なしでテスト</button>
      </div>
    </div>
  </div>
</template>

<script setup>
// 親コンポーネント(App.vue)にイベントを送信するための準備
const emit = defineEmits(['start-game']);

const emitStart = (simulate) => {
  emit('start-game', simulate);
};
</script>

<style scoped>
/* --- タイトル画面 --- */
.title-screen-bg {
  position: absolute;
  top: 0; left: 0;
  width: 100vw; height: 100vh;
  background-color: #faf9f6; 
  background-image: radial-gradient(circle at center, #ffffff 0%, #f0ede6 100%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 100;
}

.title-content {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.title-text-luxury {
  font-family: "Yu Mincho", "MS PMincho", serif;
  font-size: 5rem;
  font-weight: normal;
  color: #111111;
  letter-spacing: 0.15em;
  text-indent: 0.15em;
  margin: 0 0 10px 0;
  text-shadow: 2px 2px 10px rgba(0,0,0,0.03);
}

.title-sub-text {
  font-family: "Yu Mincho", "MS PMincho", serif;
  font-size: 1.5rem;
  color: #666666;
  letter-spacing: 0.4em;
  text-indent: 0.4em;
  margin-bottom: 0px; 
}

.title-jp-description {
  font-family: "Yu Mincho", "MS PMincho", serif;
  font-size: 1.5rem; 
  color: #222222;
  letter-spacing: 0.2em; 
  text-indent: 0.3em; 
  margin-bottom: 100px;
  font-weight: 600;
}

.btn-group-luxury {
  display: flex;
  flex-direction: column;
  gap: 20px;
  align-items: center;
}

.black-btn-luxury {
  background: #111111;
  color: #ffffff;
  border: 1px solid #111111;
  padding: 16px 50px;
  border-radius: 0;
  font-size: 1.2rem;
  font-family: "Yu Mincho", "MS PMincho", serif;
  letter-spacing: 0.2em;
  text-indent: 0.2em;
  transition: all 0.3s ease;
  cursor: pointer;
  min-width: 340px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
}
.black-btn-luxury:hover {
  background: #ffffff;
  color: #111111;
  transform: scale(1.02);
}

.white-btn-luxury {
  background: transparent;
  color: #555555;
  border: 1px solid #cccccc;
  padding: 12px 40px;
  border-radius: 0;
  font-size: 1rem;
  font-family: "Yu Mincho", "MS PMincho", serif;
  letter-spacing: 0.15em;
  text-indent: 0.15em;
  transition: all 0.3s ease;
  cursor: pointer;
  min-width: 280px;
}
.white-btn-luxury:hover {
  background: #ffffff;
  border-color: #999999;
  color: #111111;
}
</style>