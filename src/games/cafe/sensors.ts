import { CAFE_TUNING } from './tuning.js';
import type { TrayTilt } from './physics.js';

export type MotionEnableResult = 'enabled' | 'denied' | 'unsupported' | 'insecure';

export interface StepDetection {
  at: number;
  confidence: number;
}

export interface CafeMotionCallbacks {
  onStep?: (step: StepDetection) => void;
  onUpdate?: (tilt: TrayTilt) => void;
}

interface Vector3 { x: number; y: number; z: number }

export interface GravityFilterResult {
  gravity: Vector3;
  /** Undefined for the first sample, which establishes gravity without a false pulse. */
  linear?: Vector3;
}

export class GravitySampleFilter {
  private gravity?: Vector3;

  sample(sample: Vector3): GravityFilterResult {
    if (!this.gravity) {
      this.gravity = { ...sample };
      return { gravity: { ...this.gravity } };
    }
    const retain = CAFE_TUNING.gravityFilter;
    this.gravity = {
      x: retain * this.gravity.x + (1 - retain) * sample.x,
      y: retain * this.gravity.y + (1 - retain) * sample.y,
      z: retain * this.gravity.z + (1 - retain) * sample.z,
    };
    return {
      gravity: { ...this.gravity },
      linear: {
        x: sample.x - this.gravity.x,
        y: sample.y - this.gravity.y,
        z: sample.z - this.gravity.z,
      },
    };
  }

  reset(): void { this.gravity = undefined; }
}

type PermissionState = 'granted' | 'denied';
type PermissionedConstructor = {
  requestPermission?: () => Promise<PermissionState>;
};

/** Rotates device-relative x/y into the current screen orientation. */
export function mapTiltToScreen(x: number, y: number, angleDegrees: number): TrayTilt {
  const angle = ((angleDegrees % 360) + 360) % 360;
  if (angle === 90) return { x: -y, y: x };
  if (angle === 180) return { x: -x, y: -y };
  if (angle === 270) return { x: y, y: -x };
  return { x, y };
}

export class TiltCalibrator {
  private startedAt = 0;
  private sumX = 0;
  private sumY = 0;
  private samples = 0;
  private offset: TrayTilt = { x: 0, y: 0 };
  private calibrated = false;

  start(now: number): void {
    this.startedAt = now;
    this.sumX = 0;
    this.sumY = 0;
    this.samples = 0;
    this.calibrated = false;
  }

  sample(tilt: TrayTilt, now: number): TrayTilt {
    if (!this.calibrated) {
      this.sumX += tilt.x;
      this.sumY += tilt.y;
      this.samples += 1;
      if (now - this.startedAt >= CAFE_TUNING.calibrationMs && this.samples > 2) {
        this.offset = { x: this.sumX / this.samples, y: this.sumY / this.samples };
        this.calibrated = true;
      }
    }
    return this.calibrated
      ? { x: applyDeadZone(tilt.x - this.offset.x), y: applyDeadZone(tilt.y - this.offset.y) }
      : { x: 0, y: 0 };
  }

  get ready(): boolean { return this.calibrated; }

  progress(now: number): number {
    return this.calibrated ? 1 : clamp((now - this.startedAt) / CAFE_TUNING.calibrationMs, 0, 1);
  }
}

export class CarefulStepDetector {
  private aboveThreshold = false;
  private peak = 0;
  private lastStepAt = Number.NEGATIVE_INFINITY;
  private lastCandidateAt = Number.NEGATIVE_INFINITY;
  private rejectedUntil = Number.NEGATIVE_INFINITY;

  sample(acceleration: number, rotationRate: number, now: number): StepDetection | undefined {
    if (acceleration >= CAFE_TUNING.step.violentAcceleration || rotationRate > CAFE_TUNING.step.maxRotationRate) {
      this.aboveThreshold = false;
      this.peak = 0;
      this.rejectedUntil = now + CAFE_TUNING.step.shakeCooldownMs;
      return undefined;
    }
    if (now < this.rejectedUntil) return undefined;
    if (acceleration >= CAFE_TUNING.step.enterAcceleration) {
      this.aboveThreshold = true;
      this.peak = Math.max(this.peak, acceleration);
      return undefined;
    }
    if (!this.aboveThreshold || acceleration > CAFE_TUNING.step.exitAcceleration) return undefined;
    this.aboveThreshold = false;
    const peak = this.peak;
    this.peak = 0;
    const interval = now - this.lastStepAt;
    if (interval < CAFE_TUNING.step.refractoryMs) return undefined;
    const candidateInterval = now - this.lastCandidateAt;
    this.lastCandidateAt = now;
    const rhythmic = candidateInterval >= CAFE_TUNING.step.rhythmMinMs
      && candidateInterval <= CAFE_TUNING.step.rhythmMaxMs
      && peak >= CAFE_TUNING.step.enterAcceleration + 0.18;
    const strength = clamp((peak - CAFE_TUNING.step.enterAcceleration) / 2.4, 0, 1);
    const confidence = clamp(0.56 + strength * 0.28 + (rhythmic ? 0.2 : 0), 0, 1);
    if (confidence < CAFE_TUNING.step.minimumConfidence) return undefined;
    const detection = { at: now, confidence };
    this.lastStepAt = now;
    return detection;
  }

  reset(): void {
    this.aboveThreshold = false;
    this.peak = 0;
    this.lastStepAt = Number.NEGATIVE_INFINITY;
    this.lastCandidateAt = Number.NEGATIVE_INFINITY;
    this.rejectedUntil = Number.NEGATIVE_INFINITY;
  }
}

/**
 * Browser motion adapter. Call enable() directly from a tap handler on iOS, then
 * poll tilt each frame. Desktop scenes can call setDesktopTilt from keys/pointer.
 */
export class CafeMotionInput {
  private listening = false;
  private rawTilt: TrayTilt = { x: 0, y: 0 };
  private currentTilt: TrayTilt = { x: 0, y: 0 };
  private desktopTilt: TrayTilt | undefined;
  private readonly gravityFilter = new GravitySampleFilter();
  private lastOrientationSampleAt?: number;
  private tiltSequence = 0;
  private sampledTiltSequence = 0;
  private lastMotionSampleAt?: number;
  private lastTiltSampleAt?: number;
  private readonly calibrator = new TiltCalibrator();
  private readonly detector = new CarefulStepDetector();

  constructor(private readonly callbacks: CafeMotionCallbacks = {}) {}

  get supported(): boolean {
    return typeof window !== 'undefined' && ('DeviceMotionEvent' in window || 'DeviceOrientationEvent' in window);
  }

  get requiresGesturePermission(): boolean {
    if (!this.supported) return false;
    return typeof (window.DeviceMotionEvent as unknown as PermissionedConstructor | undefined)?.requestPermission === 'function'
      || typeof (window.DeviceOrientationEvent as unknown as PermissionedConstructor | undefined)?.requestPermission === 'function';
  }

  get ready(): boolean { return this.desktopTilt !== undefined || (this.hasTiltSamples && this.calibrator.ready); }
  get tilt(): TrayTilt { return this.currentTilt; }
  get hasMotionSamples(): boolean { return this.lastMotionSampleAt !== undefined; }
  get hasTiltSamples(): boolean { return this.lastTiltSampleAt !== undefined; }

  hasRecentMotion(now = performance.now(), maxAgeMs = CAFE_TUNING.motionSampleTimeoutMs): boolean {
    return this.lastMotionSampleAt !== undefined && now - this.lastMotionSampleAt <= maxAgeMs;
  }

  calibrationProgress(now = performance.now()): number {
    return this.desktopTilt !== undefined ? 1 : this.calibrator.progress(now);
  }

  async enable(): Promise<MotionEnableResult> {
    if (typeof window === 'undefined' || !this.supported) return 'unsupported';
    if (!window.isSecureContext) return 'insecure';
    try {
      // Both calls are made before awaiting: WebKit requires them in the same user gesture.
      const requests: Promise<PermissionState>[] = [];
      const motion = window.DeviceMotionEvent as unknown as PermissionedConstructor | undefined;
      const orientation = window.DeviceOrientationEvent as unknown as PermissionedConstructor | undefined;
      if (typeof motion?.requestPermission === 'function') requests.push(motion.requestPermission());
      if (typeof orientation?.requestPermission === 'function') requests.push(orientation.requestPermission());
      if ((await Promise.all(requests)).some((result) => result !== 'granted')) return 'denied';
      this.startListening();
      return 'enabled';
    } catch {
      return 'denied';
    }
  }

  enablePreviouslyGranted(): void {
    if (this.supported && window.isSecureContext) this.startListening();
  }

  startCalibration(now = performance.now()): void {
    this.desktopTilt = undefined;
    this.currentTilt = { x: 0, y: 0 };
    this.calibrator.start(now);
    this.detector.reset();
    this.gravityFilter.reset();
    this.sampledTiltSequence = this.tiltSequence;
  }

  setDesktopTilt(x: number, y: number): void {
    this.desktopTilt = { x: clamp(x, -1, 1), y: clamp(y, -1, 1) };
    this.currentTilt = this.desktopTilt;
    this.callbacks.onUpdate?.(this.currentTilt);
  }

  clearDesktopTilt(now = performance.now()): void {
    this.desktopTilt = undefined;
    this.calibrator.start(now);
  }

  update(now = performance.now()): TrayTilt {
    if (this.desktopTilt) return this.desktopTilt;
    if (this.sampledTiltSequence !== this.tiltSequence) {
      this.currentTilt = limitTilt(this.calibrator.sample(this.rawTilt, now));
      this.sampledTiltSequence = this.tiltSequence;
    }
    this.callbacks.onUpdate?.(this.currentTilt);
    return this.currentTilt;
  }

  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('devicemotion', this.handleMotion);
      window.removeEventListener('deviceorientation', this.handleOrientation);
    }
    this.listening = false;
  }

  private startListening(): void {
    if (this.listening) return;
    window.addEventListener('devicemotion', this.handleMotion);
    window.addEventListener('deviceorientation', this.handleOrientation);
    this.listening = true;
    this.startCalibration();
  }

  private readonly handleOrientation = (event: DeviceOrientationEvent): void => {
    if (!Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
    const now = performance.now();
    this.lastOrientationSampleAt = now;
    const mapped = mapTiltToScreen(
      (event.gamma as number) / CAFE_TUNING.maxTiltDegrees,
      (event.beta as number) / CAFE_TUNING.maxTiltDegrees,
      screenAngle(),
    );
    this.rawTilt = mapped;
    this.lastTiltSampleAt = now;
    this.tiltSequence += 1;
  };

  private readonly handleMotion = (event: DeviceMotionEvent): void => {
    const includingGravity = finiteVector(event.accelerationIncludingGravity);
    const direct = finiteVector(event.acceleration);
    if (includingGravity) {
      const { x: gx, y: gy, z: gz } = includingGravity;
      const filtered = this.gravityFilter.sample({ x: gx, y: gy, z: gz });
      const now = performance.now();
      this.lastMotionSampleAt = now;
      this.lastTiltSampleAt = now;
      const orientationIsFresh = this.lastOrientationSampleAt !== undefined
        && now - this.lastOrientationSampleAt <= CAFE_TUNING.orientationSampleFreshMs;
      if (!orientationIsFresh) {
        this.rawTilt = gravityTilt(filtered.gravity, screenAngle());
        this.tiltSequence += 1;
      }
      if (direct) this.detectStep(direct.x ?? 0, direct.y ?? 0, direct.z ?? 0, event, now);
      else if (filtered.linear) this.detectStep(filtered.linear.x, filtered.linear.y, filtered.linear.z, event, now);
      return;
    }
    if (direct) {
      const now = performance.now();
      this.lastMotionSampleAt = now;
      this.detectStep(direct.x, direct.y, direct.z, event, now);
    }
  };

  private detectStep(x: number, y: number, z: number, event: DeviceMotionEvent, now: number): void {
    const acceleration = Math.hypot(x, y, z);
    const rotation = event.rotationRate;
    const rotationValues = rotation ? [rotation.alpha, rotation.beta, rotation.gamma]
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value)) : [];
    const rotationRate = rotationValues.length > 0 ? Math.max(...rotationValues.map(Math.abs)) : 0;
    const step = this.detector.sample(acceleration, rotationRate, now);
    if (step) this.callbacks.onStep?.(step);
  }
}

function screenAngle(): number {
  const legacy = window as Window & { orientation?: number };
  return window.screen.orientation?.angle ?? legacy.orientation ?? 0;
}

/** Converts gravity to the same degrees/max-angle scale as DeviceOrientation. */
function gravityTilt(gravity: Vector3, angleDegrees: number): TrayTilt {
  const radiansToDegrees = 180 / Math.PI;
  // abs(z) keeps the neutral direction stable whether the device is face-up or face-down.
  const gamma = Math.atan2(gravity.x, Math.hypot(gravity.y, gravity.z)) * radiansToDegrees;
  const beta = Math.atan2(-gravity.y, Math.abs(gravity.z)) * radiansToDegrees;
  return mapTiltToScreen(
    gamma / CAFE_TUNING.maxTiltDegrees,
    beta / CAFE_TUNING.maxTiltDegrees,
    angleDegrees,
  );
}

function finiteVector(vector: DeviceMotionEventAcceleration | null): Vector3 | undefined {
  if (!vector) return undefined;
  const values = [vector.x, vector.y, vector.z];
  if (!values.some((value) => typeof value === 'number' && Number.isFinite(value))) return undefined;
  return {
    x: typeof vector.x === 'number' && Number.isFinite(vector.x) ? vector.x : 0,
    y: typeof vector.y === 'number' && Number.isFinite(vector.y) ? vector.y : 0,
    z: typeof vector.z === 'number' && Number.isFinite(vector.z) ? vector.z : 0,
  };
}

function applyDeadZone(value: number): number {
  const magnitude = Math.abs(value);
  if (magnitude <= CAFE_TUNING.tiltDeadZone) return 0;
  return Math.sign(value) * (magnitude - CAFE_TUNING.tiltDeadZone) / (1 - CAFE_TUNING.tiltDeadZone);
}

function limitTilt(tilt: TrayTilt): TrayTilt {
  return { x: clamp(tilt.x, -1, 1), y: clamp(tilt.y, -1, 1) };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
