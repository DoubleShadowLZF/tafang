// assets/scripts/gameplay/worldKit.ts
import { Node, Color, Vec3, MeshRenderer, Material, utils, primitives } from 'cc';

// 创建纯色占位 3D 立方体。effect 名若在个别版本有差异，仅影响贴色，不影响节点位置/逻辑。
export function createPrimitive(parent: Node, size: number, color: Color): Node {
  const node = new Node('prim');
  const mr = node.addComponent(MeshRenderer);
  mr.mesh = utils.MeshUtils.createMesh(primitives.box({ width: size, height: size, length: size }));
  const mat = new Material();
  mat.initialize({ effectName: 'builtin-standard' });
  mat.setProperty('albedo', color);
  mr.material = mat;
  parent.addChild(node);
  return node;
}

// 地面：一个大的深色平面（放大薄盒）+ 沿路点的路线标记（建造槽位由 BattleScene 单独创建）。
export function createGround(parent: Node, waypoints: Vec3[]): Node {
  const ground = createPrimitive(parent, 24, new Color(40, 60, 40, 255));
  ground.setPosition(0, -0.6, 0);
  ground.setScale(1, 0.05, 1);

  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    const mid: Vec3 = [(a[0] + b[0]) / 2, 0.05, (a[2] + b[2]) / 2];
    const seg = createPrimitive(parent, 0.5, new Color(200, 180, 120, 255));
    const dx = b[0] - a[0];
    const dz = b[2] - a[2];
    const len = Math.sqrt(dx * dx + dz * dz);
    seg.setPosition(mid[0], mid[1], mid[2]);
    seg.setScale(len || 1, 0.1, 1);
    if (len > 0) seg.setRotationFromEuler(0, Math.atan2(dx, dz) * 180 / Math.PI, 0);
  }
  return ground;
}
