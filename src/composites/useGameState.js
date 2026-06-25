import { ref, computed } from 'vue';
import { GEM_DATA } from '../constants/gemData';

export const PROGRESS_MAX = 2000;

export function useGameState() {
  const currentScreen = ref('title');
  const selectedGemKey = ref(null);
  const currentStepIndex = ref(0);
  const progress = ref(0);
  const timeLeft = ref(0);
  const lastAngle = ref(null);
  const stepProgressRates = ref([]);

  const isCountingDown = ref(false);
  const countdown = ref(3);

  // 画面遷移・演出用の状態
  const isStepChanging = ref(false);
  const stepChangeText = ref('');

  const hphtTemp = ref(0);
  const hphtPressure = ref(0);  

  const selectedGem = computed(() => GEM_DATA[selectedGemKey.value]);
  const currentStep = computed(() => selectedGem.value?.steps[currentStepIndex.value]);
  
  const averageProgressRate = computed(() => {
    if (!stepProgressRates.value.length) return 0;
    return stepProgressRates.value.reduce((sum, rate) => sum + rate, 0) / stepProgressRates.value.length;
  });

  const triggerNeonTransition = () => {
    stepChangeText.value = currentStep.value?.hint || '';
    isStepChanging.value = true;
    setTimeout(() => { isStepChanging.value = false; }, 1250); 
  };
  
  const resetGame = (key) => {
    selectedGemKey.value = key;
    currentStepIndex.value = 0;
    progress.value = 0;
    timeLeft.value = GEM_DATA[key].steps[0].timeLimit;
    stepProgressRates.value = [];
    hphtTemp.value = 0;
    hphtPressure.value = 0;
    isCountingDown.value = true;
    countdown.value = 3;
    lastAngle.value = null;
    currentScreen.value = 'game';
  };

  const nextStep = () => {
    stepProgressRates.value.push(Math.min(progress.value / PROGRESS_MAX, 1));
    progress.value = 0;
    lastAngle.value = null;
    hphtTemp.value = 0;
    hphtPressure.value = 0;
    if (currentStepIndex.value < selectedGem.value.steps.length - 1) {
      currentStepIndex.value++;
      timeLeft.value = currentStep.value.timeLimit;
    } else {
      currentScreen.value = 'result';
    }
  };

  return { 
    currentScreen, selectedGemKey, selectedGem, currentStep, currentStepIndex, 
    progress, timeLeft, lastAngle, resetGame, nextStep,
    isCountingDown, countdown, averageProgressRate,
    isStepChanging, stepChangeText, triggerNeonTransition,
    hphtTemp, hphtPressure
  };
}