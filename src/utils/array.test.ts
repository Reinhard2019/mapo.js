import { expect, test } from 'vitest';
import {  multiply } from './array';

test('cross()', () => {
  expect( multiply([1, 2], [3, 4])).toStrictEqual([
    [1, 3],
    [1, 4],
    [2, 3],
    [2, 4],
  ]);
});
