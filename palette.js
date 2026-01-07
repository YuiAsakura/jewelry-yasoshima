let s1 = null;
let s2 = null;

// レシピ
const recipes = [
    { m1: 'C',     m2: 'Fe',    name: 'ダイヤモンド' },
    { m1: 'Al2O3', m2: 'Cr2O3', name: 'ルビー' },
    { m1: 'Al2O3', m2: 'Fe',    name: 'サファイア' },
    { m1: 'SiO2',  m2: 'Fe',    name: 'アメジスト' },
    { m1: 'SiO2',  m2: 'なし',   name: '水晶' }
];

function selectItem(step, value) {
    if (step === 1) {
        s1 = value;
        document.getElementById('slot1').innerText = value;
        document.getElementById('row2').classList.remove('disabled'); // ②を解禁
    } else {
        s2 = value;
        document.getElementById('slot2').innerText = value;
        document.getElementById('decide-btn').disabled = false;
    }
}

function checkCombination() {
    const found = recipes.find(r => r.m1 === s1 && r.m2 === s2);
    if (found) {
        alert("反応を開始するよ！"); /* (`${found.name}の反応を開始するよ！`)でダイヤモンドとか勝手に入る */
    } else {
        alert("組み合わせが違うよ！①から選び直してね。");
        reset();
    }
}

function reset() {
    s1 = null; s2 = null;
    document.getElementById('slot1').innerText = "?";
    document.getElementById('slot2').innerText = "?";
    document.getElementById('row2').classList.add('disabled');
    document.getElementById('decide-btn').disabled = true;
}

function showTable() { alert("【元素記号表】\nC: 炭素\nAl2O3: 酸化アルミニウム\nSiO2: 二酸化ケイ素\nFe: 鉄\nCr2O3: 酸化クロム"); }
function showHint() { alert("ヒント：ダイヤモンドならCとFeを選ぼう！"); }