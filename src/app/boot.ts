import { applyPalette } from "../lib/palette";
import { Broker } from "../bridge/broker";
import { newRequestId, parentTransport, viewTokenFromLocation } from "../bridge/transport";
import { PROTOCOL_VERSION } from "../contracts/protocol";
import { HostError } from "../contracts/errors";
import { readProtocol, type Host } from "./host";

export interface Booted {
  host: Host;
  view: string;
}

export type BootFailure = {
  kind: "unhosted" | "protocol" | "host";
  title: string;
  detail: string;
  recovery: string;
};

export function unhostedFailure(): BootFailure {
  return {
    kind: "unhosted",
    title: "Chat — a Ponpoko surface",
    detail:
      "Ponpoko loads this page inside its own window and hands it a narrow bridge. Opened on its own there is no host to ask, so there would be no threads to read and no model to reach.",
    recovery:
      "Open Ponpoko and choose Chat from the tab bar. This bundle is installed from its own repository; it holds no database, no key and no Tauri IPC.",
  };
}

export function protocolFailure(said: string): BootFailure {
  return {
    kind: "protocol",
    title: "Chat and Ponpoko disagree about the protocol",
    detail: said,
    recovery:
      "Update the Chat surface from Ponpoko, then reload the tab. Nothing here reads your transcript until both sides speak the same version.",
  };
}

export function hostFailure(error: unknown): BootFailure {
  return {
    kind: "host",
    title: "Ponpoko did not answer",
    detail: error instanceof Error ? error.message : String(error ?? ""),
    recovery:
      error instanceof HostError
        ? error.recovery
        : "Reload the tab; if it stays silent, restart Ponpoko so the control bridge is written again.",
  };
}

export async function bootChat(
  options: { location?: Location | URL; transport?: ReturnType<typeof parentTransport> } = {},
): Promise<{ ok: true; value: Booted } | { ok: false; failure: BootFailure }> {
  const location = options.location ?? window.location;
  const view = viewTokenFromLocation(location);
  if (view.length === 0) return { ok: false, failure: unhostedFailure() };

  const broker = new Broker({
    view,
    transport: options.transport ?? parentTransport(),
    newId: newRequestId,
  });
  broker.onPalette((tokens) => applyPalette(tokens));
  broker.start();

  let hello;
  try {
    hello = await broker.awaitHello();
  } catch (error) {
    broker.stop();
    return { ok: false, failure: hostFailure(error) };
  }

  if (hello.protocol !== PROTOCOL_VERSION) {
    broker.stop();
    return {
      ok: false,
      failure: protocolFailure(
        `this Chat speaks protocol ${PROTOCOL_VERSION} and Ponpoko greeted it with protocol ${hello.protocol || "an unstated one"}`,
      ),
    };
  }

  const host: Host = { broker, protocol: null };
  try {
    host.protocol = await readProtocol(host);
  } catch (error) {
    broker.stop();
    return { ok: false, failure: hostFailure(error) };
  }

  return { ok: true, value: { host, view } };
}
