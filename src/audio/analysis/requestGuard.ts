export function createLatestRequestGuard() {
  let generation = 0;
  return {
    begin() { generation += 1; return generation; },
    isCurrent(request: number) { return request === generation; },
    invalidate() { generation += 1; },
    current() { return generation; },
  };
}
