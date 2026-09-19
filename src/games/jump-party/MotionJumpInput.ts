export const MOTION_JUMP_THRESHOLD = 13;
export const MOTION_JUMP_COOLDOWN_MS = 950;

type PermissionedMotionEvent = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

export class MotionJumpInput {
  private lastTrigger = 0;
  private listening = false;

  constructor(private readonly onJump: () => void) {}

  get supported(): boolean {
    return typeof window !== 'undefined' && 'DeviceMotionEvent' in window;
  }

  get requiresGesturePermission(): boolean {
    return this.supported && typeof (DeviceMotionEvent as PermissionedMotionEvent).requestPermission === 'function';
  }

  async enable(): Promise<'enabled' | 'denied' | 'unsupported' | 'insecure'> {
    if (!window.isSecureContext) return 'insecure';
    if (!this.supported) return 'unsupported';
    const MotionEvent = DeviceMotionEvent as PermissionedMotionEvent;
    try {
      if (typeof MotionEvent.requestPermission === 'function') {
        const permission = await MotionEvent.requestPermission();
        if (permission !== 'granted') return 'denied';
      }
      this.startListening();
      return 'enabled';
    } catch {
      return 'denied';
    }
  }

  enablePreviouslyGranted(): void {
    if (this.supported && window.isSecureContext) this.startListening();
  }

  destroy(): void {
    window.removeEventListener('devicemotion', this.handleMotion);
    this.listening = false;
  }

  private startListening(): void {
    if (this.listening) return;
    window.addEventListener('devicemotion', this.handleMotion);
    this.listening = true;
  }

  private readonly handleMotion = (event: DeviceMotionEvent): void => {
    const acceleration = event.accelerationIncludingGravity ?? event.acceleration;
    if (!acceleration) return;
    const strongestAxis = Math.max(Math.abs(acceleration.x ?? 0), Math.abs(acceleration.y ?? 0), Math.abs(acceleration.z ?? 0));
    const now = performance.now();
    if (strongestAxis >= MOTION_JUMP_THRESHOLD && now - this.lastTrigger >= MOTION_JUMP_COOLDOWN_MS) {
      this.lastTrigger = now;
      this.onJump();
    }
  };
}
