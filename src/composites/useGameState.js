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

  const selectedGem = computed(() => GEM_DATA[selectedGemKey.value]);
  const currentStep = computed(() => selectedGem.value?.steps[currentStepIndex.value]);
  const averageProgressRate = computed(() => {
    if (!stepProgressRates.value.length) return 0;
    const total = stepProgressRates.value.reduce((sum, rate) => sum + rate, 0);
    return total / stepProgressRates.value.length;
  });
  const gameRank = computed(() => {
    if (averageProgressRate.value >= 0.95) return 'S';
    if (averageProgressRate.value >= 0.8) return 'A';
    if (averageProgressRate.value >= 0.6) return 'B';
    return 'C';
  });

  const isStepCompleted = computed(() => progress.value >= PROGRESS_MAX);
  
  const resetGame = (key) => {
    selectedGemKey.value = key;
    currentStepIndex.value = 0;
    progress.value = 0;
    timeLeft.value = GEM_DATA[key].steps[0].timeLimit;
    stepProgressRates.value = [];

    isCountingDown.value = true;
    countdown.value = 3;
    lastAngle.value = null;
    currentScreen.value = 'game';
  };

  const nextStep = () => {
    const currentRate = Math.min(progress.value / PROGRESS_MAX, 1);
    stepProgressRates.value.push(currentRate);

    progress.value = 0;
    lastAngle.value = null;
    if (currentStepIndex.value < selectedGem.value.steps.length - 1) {
      currentStepIndex.value++;
      timeLeft.value = currentStep.value.timeLimit;

    
    } else {
      currentScreen.value = 'result';
    }
  };

  return { 
    currentScreen, selectedGemKey, selectedGem, 
    currentStep, currentStepIndex, progress, timeLeft, 
    lastAngle, resetGame, nextStep,
    isCountingDown, countdown,
    averageProgressRate, gameRank
  };
}