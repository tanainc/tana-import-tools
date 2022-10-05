export function deterministicGenerator() {
  let uid = 0;

  return () => {
    const uidStr = uid.toString();
    uid++;
    return uidStr;
  };
}
