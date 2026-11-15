// assets/scripts/ui/uiKit.ts
import { Node, Label, Color, UITransform, Graphics } from 'cc';

export function createLabel(parent: Node, text: string, opts: { fontSize?: number; color?: Color; x?: number; y?: number } = {}): Label {
  const node = new Node('Label');
  node.addComponent(UITransform);
  const label = node.addComponent(Label);
  label.string = text;
  label.fontSize = opts.fontSize ?? 24;
  label.lineHeight = (opts.fontSize ?? 24) + 6;
  label.color = opts.color ?? Color.WHITE;
  parent.addChild(node);
  node.setPosition(opts.x ?? 0, opts.y ?? 0, 0);
  return label;
}

export function createPanel(parent: Node, name: string, width: number, height: number, color: Color): Node {
  const node = new Node(name);
  node.addComponent(UITransform).setContentSize(width, height);
  const g = node.addComponent(Graphics);
  g.fillColor = color;
  g.rect(-width / 2, -height / 2, width, height);
  g.fill();
  parent.addChild(node);
  return node;
}

export function createButton(parent: Node, name: string, text: string, opts: { width?: number; height?: number; x?: number; y?: number; onClick: () => void }): Label {
  const node = createPanel(parent, name, opts.width ?? 160, opts.height ?? 48, new Color(70, 110, 200, 255));
  node.setPosition(opts.x ?? 0, opts.y ?? 0, 0);
  const label = createLabel(node, text, { fontSize: 22 });
  label.node.setPosition(0, 0, 0);
  node.on(Node.EventType.TOUCH_END, opts.onClick);
  return label;
}
