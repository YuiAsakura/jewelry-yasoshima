/**
 * 宝石制作工程のマスターデータ
 * image: 画像がある場合はパスを記述。ない場合は空文字 "" にしてください。
 */
export const GEM_DATA = {
  ruby: {
    name: 'ルビー',
    method: 'ベルヌーイ法',
    resultImage: "/src/assets/images/ruby.png",
    maxPrice: 50000,
    steps: [
      { id: 'centrifugal', label: '酸化アルミニウム投入', timeLimit: 10, hint: '粉を混ぜよう！', image: "", bgImage: "/src/assets/images/bowl.png", toolImage: "/src/assets/images/spoon_tate.png" },
      { id: 'pointer', label: '温度調整', timeLimit: 15, hint: '電気炉の温度を合わせて！', image: "/src/assets/images/group.png",  targets: [250, 500, 750, 1000, 1250, 1500, 1750, 2000]},
      { id: 'shake', label: '表面研磨', timeLimit: 10, hint: '振って削ろう!', image: "", bgImage: "/src/assets/images/ruby.png", toolImage: "/src/assets/images/file.png" }
    ]
  },
  sapphire: {
    name: 'サファイア',
    method: 'ベルヌーイ法',
    resultImage: "/src/assets/images/sapphire.png",
    maxPrice: 20000,
    steps: [
      { id: 'mash', label: '原料投入', timeLimit: 10, hint: 'ボタン連打！', image: "/src/assets/images/sapphire.png" },
      { id: 'pointer', label: '温度調整', timeLimit: 15, hint: '電気炉の温度を合わせて！', image: "/src/assets/images/group.png",  targets: [250, 500, 750, 1000, 1250, 1500, 1750, 2000] },
      { id: 'shake', label: '表面研磨', timeLimit: 10, hint: '振って削ろう！', image: "", bgImage: "/src/assets/images/sapphire.png", toolImage: "/src/assets/images/file.png" }
    ]
  },
  /*
  emerald: {
    name: 'エメラルド',
    method: 'フラックス法',
    resultImage: "/src/assets/images/emerald.png",
    steps: [
      { id: 'rotate', label: '原料溶解', timeLimit: 15, hint: 'スティック回転！', image: "/src/assets/images/emerald.png" },
      { id: 'keep_level', label: '徐冷', timeLimit: 20, hint: '水平を保て！', image: "/src/assets/images/emerald.png" },
      { id: 'shake', label: '仕上げ', timeLimit: 10, hint: '振れ！', image: "/src/assets/images/emerald.png" }
    ]
  },
  crystal: {
    name: 'クリスタル',
    method: '水熱合成法',
    resultImage: "/src/assets/images/crystal.png",
    steps: [
      { id: 'rotate', label: '溶解', timeLimit: 15, hint: 'スティック回転！', image: "" },
      { id: 'keep_level', label: '育成', timeLimit: 20, hint: '水平を保て！', image: "" },
      { id: 'mash', label: '洗浄', timeLimit: 10, hint: '連打！', image: "" }
    ]
  },
  amethyst: {
    name: 'アメジスト',
    method: '水熱合成法',
    resultImage: "/src/assets/images/amethyst.png",
    steps: [
      { id: 'rotate', label: '熱水循環', timeLimit: 15, hint: 'スティック回転！', image: "" },
      { id: 'long_press', label: '放射線照射', timeLimit: 12, hint: 'Aボタン長押し!', image: "" }
    ]
  },
  */
  diamond: {
    name: 'ダイヤモンド',
    method: 'HPHT法',
    resultImage: "/src/assets/images/diamond.png",
    maxPrice: 2000000,
    steps: [
      { id: 'press_all', label: '超高圧印加', timeLimit: 20, hint: 'スティック回転！', image: "/src/assets/images/press_machine.png" },
      { id: 'press_shake', label: '超高温加熱', timeLimit: 15, hint: 'Aを押しながら振れ!', image: "/src/assets/images/diamond.png" }
    ]
  }
};