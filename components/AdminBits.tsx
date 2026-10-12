export function Msg({ msg }: { msg?: string }) {
  return msg ? <p className="notice" role="status" style={{ marginBottom: 14 }}>{msg}</p> : null;
}
