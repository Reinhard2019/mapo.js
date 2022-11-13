export function multiply<T1, T2>(arr1: T1[], arr2: T2[]) {
  let arr: [T1, T2][] = [];
  for (let v1 of arr1) {
    for (let v2 of arr2) {
      arr.push([v1, v2]);
    }
  }
  return arr;
}
