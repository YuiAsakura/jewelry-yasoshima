import { ref, computed } from 'vue';

export function usePointer() {
  const pointerTarget = ref({ x: 0, y: 0 });
  const gyroCursor = ref({ x: 0, y: window.innerHeight / 2 });
  const pointerHitCount = ref(0);
  const pointerLastHitTime = ref(0);
  const pointerCalibrationTime = ref(0); 
  const pointerNeedsCalibration = ref(false); 
  const pointerHitThreshold = 10; 
  const pointerCalibrationDuration = 1000; 
  const pointerHoldDuration = 1000; 

  const customTargetRouteY = ref([]);    
  const customRouteIndex = ref(0);       
  const customTargetMaxHits = ref(0);    
  const isLockingOn = ref(false);

  const gyroCalibration = ref({ x: 0, y: 0, z: 0 }); 
  const gyroFiltered = ref({ x: 0, y: 0, z: 0 }); 
  const gyroFilterAlpha = 0.3; 
  const gyroDeadzone = 800; 
  const gyroCursorSpeed = 0.6; 

  // 横位置計算
  const FIXED_X_POSITION = computed(() => (window.innerWidth / 2) - 280);

  // 縦位置計算
  const convertTempToYPosition = (temperature) => {
    const temp = Math.max(0, Math.min(2500, temperature));
    const centerY = window.innerHeight / 2;
    return (centerY + 247) + ((centerY - 130) - (centerY + 247)) * (temp / 2000);
  };

  const setupTemperatureTargets = (hitCount, ...temperatures) => {
    if (!temperatures.length) return;
    pointerHitCount.value = 0;
    customRouteIndex.value = 0;
    customTargetMaxHits.value = hitCount;
    isLockingOn.value = false;
    
    customTargetRouteY.value = temperatures.map(temp => ({
      temperature: temp, y: convertTempToYPosition(temp)
    }));
    
    pointerTarget.value = { x: FIXED_X_POSITION.value, y: customTargetRouteY.value[0].y };
    gyroCursor.value = { x: FIXED_X_POSITION.value, y: convertTempToYPosition(0) };
  };

  const advanceCustomTargetY = (progressRef, maxProgress) => {
    if (pointerHitCount.value >= customTargetMaxHits.value) {
      progressRef.value = maxProgress;
      return;
    }
    customRouteIndex.value = (customRouteIndex.value + 1) % customTargetRouteY.value.length;
    pointerTarget.value = { x: FIXED_X_POSITION.value, y: customTargetRouteY.value[customRouteIndex.value].y };
  };

  const resetPointerJudgement = () => {
    pointerLastHitTime.value = 0;
    pointerCalibrationTime.value = Date.now();
    pointerNeedsCalibration.value = true;
    isLockingOn.value = false;
  };

  const updateGyroCursor = (accel) => {
    const applyFilter = (cur, prev, alpha) => prev + alpha * (cur - prev);
    gyroFiltered.value.x = applyFilter(accel.x, gyroFiltered.value.x, gyroFilterAlpha);
    gyroFiltered.value.z = applyFilter(accel.z, gyroFiltered.value.z, gyroFilterAlpha);

    const adjX = gyroFiltered.value.x - gyroCalibration.value.x;
    const adjZ = gyroFiltered.value.z - gyroCalibration.value.z;
    const factorY = Math.min(1, Math.abs(adjX) / gyroDeadzone); 
    const angleY = -Math.atan2(adjX, adjZ) * 180 / Math.PI; 
    
    const centerY = window.innerHeight / 2;
    const newY = centerY + ((angleY / 25) * centerY * gyroCursorSpeed * factorY);

    const MARGIN = 50;
    const minY = convertTempToYPosition(2000) - MARGIN;
    const maxY = convertTempToYPosition(0) + MARGIN;

    gyroCursor.value.x = FIXED_X_POSITION.value;
    gyroCursor.value.y = Math.max(minY, Math.min(maxY, newY));
  };

  // メインループから呼ばれる当たり判定
  const checkPointerLockOn = (progressRef, maxProgress, triggerVibrate) => {
    const distanceY = Math.abs(gyroCursor.value.y - pointerTarget.value.y);
    if (distanceY < pointerHitThreshold) {
      isLockingOn.value = true;
      const now = Date.now();
      if (pointerLastHitTime.value === 0) {
        pointerLastHitTime.value = now;
      } else if (now - pointerLastHitTime.value >= pointerHoldDuration) {
        pointerHitCount.value++;
        progressRef.value = Math.min(progressRef.value + (maxProgress / customTargetMaxHits.value), maxProgress);
        triggerVibrate();
        isLockingOn.value = false;
        advanceCustomTargetY(progressRef, maxProgress);
        pointerLastHitTime.value = 0;
      }
    } else {
      isLockingOn.value = false;
      pointerLastHitTime.value = 0;
    }
  };

  return {
    pointerTarget, gyroCursor, isLockingOn, FIXED_X_POSITION,
    pointerNeedsCalibration, pointerCalibrationTime, pointerCalibrationDuration, gyroCalibration,
    setupTemperatureTargets, resetPointerJudgement, updateGyroCursor, checkPointerLockOn
  };
}