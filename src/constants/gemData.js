/**
 * 宝石制作工程のマスターデータ
 * actionName: 動作名
 * label: Step名
 * description: 解説文（1ページ目用）
 * introImage: 操作図の画像パス（2ページ目用・後から追加可能）
 */
export const GEM_DATA = {
  ruby: {
    name: 'ルビー',
    method: 'ベルヌーイ法',
    resultImage: "/src/assets/images/ruby.png",
    maxPrice: 50000,
    steps: [
      { id: 'centrifugal', actionName: '原料調合', label: '酸化アルミニウムに酸化クロムを混ぜる', timeLimit: 10, hint: '腕を回して粉を混ぜよう！', description: 'ルビーの主成分は酸化アルミニウム Al₂O₃ です。そこに少量の酸化クロム Cr₂O₃ を混ぜることで、赤い色のもとになります。', introImage: "", image: "", bgImage: "/src/assets/images/mix-bowl.png", toolImage: "/src/assets/images/spoon_tate.png", fgImage: "/src/assets/images/mix-bowl-top.png" },
      { id: 'pointer', actionName: '温度制御', label: '高温でルビー結晶を育てる', timeLimit: 15, hint: '指定の温度にポインターを合わせよう！', description: '高温の炎で原料を溶かすと、酸化アルミニウム Al₂O₃ が冷えながら規則正しく並び、ルビーの結晶が成長します。', introImage: "", image: "/src/assets/images/group.png", targets: [250, 500, 750, 1000, 1250, 1500, 1750, 2000] },
      { id: 'shake', actionName: '結晶研磨', label: '結晶表面を研磨する', timeLimit: 10, hint: '振って削ろう!', description: '最後に表面を研磨すると、光を反射しやすくなり、美しい輝きが生まれます。', introImage: "", image: "", bgImage: "/src/assets/images/ruby.png", toolImage: "/src/assets/images/file.png" }
    ]
  },
  sapphire: {
    name: 'サファイア',
    method: 'ベルヌーイ法',
    resultImage: "/src/assets/images/sapphire.png",
    maxPrice: 20000,
    steps: [
      { id: 'mash', actionName: '原料調合', label: '酸化アルミニウムを投入する', timeLimit: 10, hint: 'ボタンを連打しよう！', description: 'サファイアの主成分は、ルビーと同じ酸化アルミニウム Al₂O₃ です。青いサファイアでは、鉄 Fe やチタン Ti などの成分が色に関係しています。', introImage: "", image: "/src/assets/images/sapphire.png" },
      { id: 'pointer', actionName: '温度制御', label: '高温で結晶を育てる', timeLimit: 15, hint: '指定の温度にポインターを合わせよう！', description: '原料を高温で溶かすと、酸化アルミニウム Al₂O₃ が結晶として成長します。', introImage: "", image: "/src/assets/images/group.png", targets: [250, 500, 750, 1000, 1250, 1500, 1750, 2000] },
      { id: 'shake', actionName: '結晶研磨', label: '結晶表面を研磨する', timeLimit: 10, hint: '振って削ろう！', description: '成長した結晶を削って形を整えることで、宝石らしい見た目に仕上がります。', introImage: "", image: "", bgImage: "/src/assets/images/sapphire.png", toolImage: "/src/assets/images/file.png" }
    ]
  },
  diamond: {
    name: 'ダイヤモンド',
    method: 'HPHT法',
    resultImage: "/src/assets/images/diamond.png",
    maxPrice: 2000000,
    steps: [
      { id: 'hpht', actionName: '炭素を結晶化', label: '炭素を高温高圧で結晶化する', timeLimit: 20, hint: '温度と圧力のバランスを取ろう！　温度：振る / 圧力：全ボタン長押し', description: 'ダイヤモンドは炭素 C だけでできた結晶です。炭素に高い温度と強い圧力を加えると、炭素原子が規則正しく並び、硬いダイヤモンド構造になります。同じ炭素でも、原子の並び方が変わると、黒鉛とはまったく違う性質をもつ物質になります。', introImage: "", image: "/src/assets/images/press_machine.png" }
    ]
  }
};