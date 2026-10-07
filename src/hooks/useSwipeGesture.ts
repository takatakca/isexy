import { useCallback, useRef } from "react";

export type SwipeDirection = "left" | "right" | "up";

interface Options {
  onSwipe: (direction: SwipeDirection) => void;
  disabled?: boolean;
}

const DISTANCE_THRESHOLD = 110; // px
const FLICK_VELOCITY = 0.55; // px/ms
const SUPER_THRESHOLD = 120; // px upwards
const FLY_MS = 260;

/**
 * Tinder-style card gesture without React re-renders.
 *
 * Pass `attach` as the top card's `ref`. The card is moved directly through
 * its style (60 fps, no page re-render per pointer move). Progress is exposed
 * as CSS variables on the card — --like, --nope, --super (0 → 1) — so
 * indicator badges fade in with pure CSS. Pointer Events with capture (mouse,
 * touch, pen), flick velocity, spring-back, and the click that ends a drag is
 * swallowed so a drag never flips the photo.
 */
export function useSwipeGesture({ onSwipe, disabled = false }: Options) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const detachRef = useRef<(() => void) | null>(null);
  const onSwipeRef = useRef(onSwipe);
  const disabledRef = useRef(disabled);
  onSwipeRef.current = onSwipe;
  disabledRef.current = disabled;

  const s = useRef({
    active: false, pointerId: -1, startX: 0, startY: 0, x: 0, y: 0,
    lastX: 0, lastT: 0, vx: 0, moved: false, flying: false,
  }).current;

  const paint = useCallback((x: number, y: number, transition?: string) => {
    const el = elRef.current;
    if (!el) return;
    el.style.transition = transition ?? "none";
    el.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${x * 0.06}deg)`;
    el.style.setProperty("--like", String(Math.min(1, Math.max(0, x / DISTANCE_THRESHOLD))));
    el.style.setProperty("--nope", String(Math.min(1, Math.max(0, -x / DISTANCE_THRESHOLD))));
    el.style.setProperty("--super", String(Math.abs(x) < 60 ? Math.min(1, Math.max(0, -y / SUPER_THRESHOLD)) : 0));
  }, []);

  const reset = useCallback(() => {
    s.x = 0;
    s.y = 0;
    paint(0, 0, "transform 380ms cubic-bezier(.2,1.4,.4,1)");
  }, [paint, s]);

  /** Animate the card off-screen, then fire onSwipe. Used by gestures, buttons and keys. */
  const flyOut = useCallback((direction: SwipeDirection) => {
    if (s.flying || !elRef.current) return;
    s.flying = true;
    const w = window.innerWidth;
    const target =
      direction === "right" ? { x: w * 1.2, y: s.y + 40 }
      : direction === "left" ? { x: -w * 1.2, y: s.y + 40 }
      : { x: s.x, y: -window.innerHeight };
    paint(target.x, target.y, `transform ${FLY_MS}ms cubic-bezier(.4,0,.2,1)`);
    window.setTimeout(() => onSwipeRef.current(direction), FLY_MS - 40);
  }, [paint, s]);

  const attach = useCallback((el: HTMLDivElement | null) => {
    detachRef.current?.();
    detachRef.current = null;
    elRef.current = el;
    Object.assign(s, { active: false, moved: false, flying: false, x: 0, y: 0, vx: 0 });
    if (!el) return;
    paint(0, 0);

    const down = (e: PointerEvent) => {
      if (disabledRef.current || s.flying || (e.pointerType === "mouse" && e.button !== 0)) return;
      s.active = true;
      s.pointerId = e.pointerId;
      s.startX = e.clientX - s.x;
      s.startY = e.clientY - s.y;
      s.lastX = e.clientX;
      s.lastT = e.timeStamp;
      s.vx = 0;
      s.moved = false;
    };
    const move = (e: PointerEvent) => {
      if (!s.active || e.pointerId !== s.pointerId) return;
      const x = e.clientX - s.startX;
      const y = e.clientY - s.startY;
      if (!s.moved && Math.hypot(x, y) > 6) {
        s.moved = true;
        el.setPointerCapture?.(e.pointerId);
      }
      if (!s.moved) return;
      const dt = Math.max(1, e.timeStamp - s.lastT);
      s.vx = 0.8 * ((e.clientX - s.lastX) / dt) + 0.2 * s.vx;
      s.lastX = e.clientX;
      s.lastT = e.timeStamp;
      s.x = x;
      s.y = y;
      paint(x, y);
    };
    const up = (e: PointerEvent) => {
      if (!s.active || e.pointerId !== s.pointerId) return;
      s.active = false;
      if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
      if (!s.moved) return;
      if (s.x > DISTANCE_THRESHOLD || (s.vx > FLICK_VELOCITY && s.x > 30)) flyOut("right");
      else if (s.x < -DISTANCE_THRESHOLD || (s.vx < -FLICK_VELOCITY && s.x < -30)) flyOut("left");
      else if (s.y < -SUPER_THRESHOLD && Math.abs(s.x) < 60) flyOut("up");
      else reset();
    };
    const click = (e: MouseEvent) => {
      if (s.moved) {
        e.stopPropagation();
        e.preventDefault();
        s.moved = false;
      }
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("click", click, true);
    detachRef.current = () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("click", click, true);
    };
  }, [flyOut, paint, reset, s]);

  return { attach, flyOut, reset };
}
