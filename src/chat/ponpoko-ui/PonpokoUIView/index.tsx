import { type PonpokoUIAction, type PonpokoUIElement } from "../../../ponpoko-ui/catalog";
import { renderElement } from "./render";

export function PonpokoUIView(props: { tree: PonpokoUIElement; onAction?: (action: PonpokoUIAction) => void }) {
  return (
    <div className="ponpoko-ui-root flex flex-col gap-3 text-xs leading-relaxed text-fg">
      {renderElement(props.tree, props)}
    </div>
  );
}
