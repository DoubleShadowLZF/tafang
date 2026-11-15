// assets/scripts/core/cc.d.ts
// Cocos Creator 3.x 类型占位：仅供 vitest/tsc 环境编译通过；
// 真实类型由 Cocos Creator 编辑器打开项目后生成的 temp/declarations/cc.d.ts 提供。
declare module 'cc' {
  export const _decorator: any;
  export const Component: any;
  export const Node: any;
  export const Vec3: any;
  export const Color: any;
  export const director: any;
  export const resources: any;
  export const JsonAsset: any;
  export const Label: any;
  export const Button: any;
  export const Sprite: any;
  export const UITransform: any;
  export const Canvas: any;
  export const Camera: any;
  export const Graphics: any;
  export const Material: any;
  export const MeshRenderer: any;
  export const utils: any;
  export const primitives: any;
  export const input: any;
  export const Input: any;
  export const find: any;
  export const sys: any;
  export const view: any;

  // 以下别名让同名导出同时可用于类型位置（如 `parent: Node`、`waypoints: Vec3[]`、
  // `private goldLabel!: Label`、`private camera!: Camera`）。值仍为 any；类型亦为 any，
  // 避免 tsc 因值-only 声明报 TS2749/TS2304。为覆盖后续任务全部类型位置用法，统一补齐 24 个。
  export type _decorator = any;
  export type Component = any;
  export type Node = any;
  export type Vec3 = any;
  export type Color = any;
  export type director = any;
  export type resources = any;
  export type JsonAsset = any;
  export type Label = any;
  export type Button = any;
  export type Sprite = any;
  export type UITransform = any;
  export type Canvas = any;
  export type Camera = any;
  export type Graphics = any;
  export type Material = any;
  export type MeshRenderer = any;
  export type utils = any;
  export type primitives = any;
  export type input = any;
  export type Input = any;
  export type find = any;
  export type sys = any;
  export type view = any;
}
