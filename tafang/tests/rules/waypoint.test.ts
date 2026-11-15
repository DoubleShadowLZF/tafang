// tests/rules/waypoint.test.ts
import { describe, it, expect } from 'vitest';
import { distanceSquared, reachedWaypoint, advanceWaypoint } from '../../assets/scripts/rules/waypoint';
import type { Vec3 } from '../../assets/scripts/data/types';

const path: Vec3[] = [[0, 0, 0], [10, 0, 0], [10, 0, 5]];

describe('waypoint', () => {
  it('distanceSquared 计算距离平方', () => {
    expect(distanceSquared([0, 0, 0], [3, 4, 0])).toBe(25);
  });

  it('reachedWaypoint 在容差内判定到达', () => {
    expect(reachedWaypoint([0.5, 0, 0], [0, 0, 0], 1)).toBe(true);
    expect(reachedWaypoint([2, 0, 0], [0, 0, 0], 1)).toBe(false);
  });

  it('到达当前路点则推进下标', () => {
    expect(advanceWaypoint([0, 0, 0], path, 0, 0.1)).toBe(1);
  });

  it('未到达则保持当前下标', () => {
    expect(advanceWaypoint([1, 0, 0], path, 1, 0.1)).toBe(1);
  });

  it('走完全程返回 waypoints.length', () => {
    expect(advanceWaypoint([10, 0, 5], path, 2, 0.1)).toBe(3);
    expect(advanceWaypoint([0, 0, 0], path, 3, 0.1)).toBe(3);
  });
});
