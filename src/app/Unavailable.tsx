import { POKO_NAME } from "../lib/poko";
import type { BootFailure } from "./boot";

export function Unavailable(props: { failure: BootFailure }) {
  const { failure } = props;
  return (
    <div className="unavailable">
      <div className="unavailable-mark" aria-hidden>
        {POKO_NAME}
      </div>
      <h1>{failure.title}</h1>
      <p>{failure.detail}</p>
      <p className="unavailable-recovery">{failure.recovery}</p>
      <p className="unavailable-kind" data-failure-kind={failure.kind}>
        {failure.kind}
      </p>
    </div>
  );
}
