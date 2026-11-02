import { createRoot } from "react-dom/client";
import "./styles/app.css";
import { bootChat } from "./app/boot";
import { Chat } from "./app/Chat";
import { Unavailable } from "./app/Unavailable";

async function main(): Promise<void> {
  const node = document.getElementById("app");
  if (!node) throw new Error("the Chat surface has no #app element to mount into");
  const root = createRoot(node);
  const booted = await bootChat();
  if (!booted.ok) {
    root.render(<Unavailable failure={booted.failure} />);
    return;
  }
  root.render(<Chat host={booted.value.host} />);
}

void main();
