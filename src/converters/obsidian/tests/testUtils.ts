export function deterministicGenerator() {
  let uid = 0;

  return () => {
    const UIDstr = uid.toString();
    uid++;
    return UIDstr;
  };
}
