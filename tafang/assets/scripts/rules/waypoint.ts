// assets/scripts/rules/waypoint.ts
import type { Vec3 } from '../data/types';

export function distanceSquared(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return dx * dx + dy * dy + dz * dz;
}

export function reachedWaypoint(pos: Vec3, target: Vec3, tolerance: number): boolean {
  return distanceSquared(pos, target) <= tolerance * tolerance;
}

export function advanceWaypoint(pos: Vec3, waypoints: Vec3[], currentIndex: number, tolerance: number): number {
  if (currentIndex >= waypoints.length) return currentIndex;
  if (reachedWaypoint(pos, waypoints[currentIndex], tolerance)) return currentIndex + 1;
  return currentIndex;
}
