/* @flow */


import {suite, test} from '../../packages/flow-dev-tools/src/test/Tester';

export default suite(({addFile, addFiles, addCode}) => [
  test("any flowing to spreads", [
    addCode(`
      function withoutAny(tup: [1,2], notAny: [3, 4]): [1, 2, 3, 4] {
        return [...tup, ...notAny];
      }
      function withAny(tup: [1,2], any: any): [1, 2, 3, 4] {
        return [...tup, ...any];
      }
    `)
      .noNewErrors()
      .because('Adding any should not cause new errors'),
  ]),
  /* We used to try to "summarize" elements of non-tuple arrays, which would
   * strip away literal information from string and number types. However, this
   * was pretty broken, and Sam found this following example to demonstrate how.
   */
  test("Sam's example of multiple lower bounds and SummarizeT", [
    addCode(`
      function f(b: boolean): [Array<?number>] {
        var x = null;
        if (b) {
          x = 0;
        }
        var [xs] = f(b);
        return [[...xs, x]];
      }
    `).noNewErrors()
      .because(
        'x has multiple lower bounds, so if we unify prematurely we can get ' +
          'an error when figuring out the summarized element type for x',
      ),
  ]),
  test('Avoid infinite recursion due to a loop', [
    addCode(`
      let foo = [0];
      for (let x = 1; x < 3; x++) {
        foo = [...foo, x];
      }
      (foo: [0, 1, 2]);
    `)
      .newErrors(
        `
          test.js:8
            8:       (foo: [0, 1, 2]);
                      ^^^ array literal. Has some incompatible tuple element with
            8:       (foo: [0, 1, 2]);
                           ^^^^^^^^^ tuple type
            The second tuple element is incompatible:
                6:         foo = [...foo, x];
                                          ^ number. Expected number literal \`1\`
                8:       (foo: [0, 1, 2]);
                                   ^ number literal \`1\`

          test.js:8
            8:       (foo: [0, 1, 2]);
                      ^^^ array literal. Has some incompatible tuple element with
            8:       (foo: [0, 1, 2]);
                           ^^^^^^^^^ tuple type
            The third tuple element is incompatible:
                6:         foo = [...foo, x];
                                          ^ number. Expected number literal \`2\`
                8:       (foo: [0, 1, 2]);
                                      ^ number literal \`2\`

          test.js:8
            8:       (foo: [0, 1, 2]);
                      ^^^ array literal. Has some incompatible tuple element with
            8:       (foo: [0, 1, 2]);
                           ^^^^^^^^^ tuple type
            The third tuple element is incompatible:
                6:         foo = [...foo, x];
                                          ^ number. Expected number literal \`2\`, got \`1\` instead
                8:       (foo: [0, 1, 2]);
                                      ^ number literal \`2\`

          test.js:8
            8:       (foo: [0, 1, 2]);
                      ^^^ array literal. Only tuples and array literals with known elements can flow to
            8:       (foo: [0, 1, 2]);
                           ^^^^^^^^^ tuple type

          test.js:8
            8:       (foo: [0, 1, 2]);
                      ^^^ array literal. Tuple arity mismatch. This tuple has 1 elements and cannot flow to the 3 elements of
            8:       (foo: [0, 1, 2]);
                           ^^^^^^^^^ tuple type

          test.js:8
            8:       (foo: [0, 1, 2]);
                      ^^^ array literal. Tuple arity mismatch. This tuple has 2 elements and cannot flow to the 3 elements of
            8:       (foo: [0, 1, 2]);
                           ^^^^^^^^^ tuple type
        `,
      ),
  ]),
  test('Avoid infinite recursion due to polymorphic recursion', [
    addCode(`
      function foo<T: Array<*>>(arr: T) {
        if (arr.length > 10) return arr;
        return foo([...arr, 1]);
      }
      const ret = foo([1]);
    `),
    addCode('(ret: void);')
      .newErrors(
        `
          test.js:11
           11: (ret: void);
                ^^^ Cannot cast \`ret\` to undefined because array type [1] is incompatible with undefined [2].
            References:
              4:       function foo<T: Array<*>>(arr: T) {
                                                      ^ [1]: array type
             11: (ret: void);
                       ^^^^ [2]: undefined
        `,
      )
      .because('The constant folding should turn the tuple into an array'),
    addCode(`
      (ret[5]: 1);
      (ret[5]: 2);
    `)
      .newErrors(
        `
          test.js:15
           15:       (ret[5]: 2);
                      ^^^^^^ number. Expected number literal \`2\`, got \`1\` instead
           15:       (ret[5]: 2);
                              ^ number literal \`2\`
        `,
      )
      .because('The element type should be `1`'),
  ]),
  test('Avoid infinite recursion due to recursion', [
    addCode(`
      function foo(arr) {
        if (arr.length > 10) return arr;
        return foo([...arr, 1]);
      }
      const ret = foo([1]);
    `),
    addCode('(ret: void);')
      .newErrors(
        `
          test.js:11
           11: (ret: void);
                ^^^ Cannot cast \`ret\` to undefined because array literal [1] is incompatible with undefined [2].
            References:
              6:         return foo([...arr, 1]);
                                    ^^^^^^^^^^^ [1]: array literal
             11: (ret: void);
                       ^^^^ [2]: undefined

          test.js:11
           11: (ret: void);
                ^^^ Cannot cast \`ret\` to undefined because array literal [1] is incompatible with undefined [2].
            References:
              8:       const ret = foo([1]);
                                       ^^^ [1]: array literal
             11: (ret: void);
                       ^^^^ [2]: undefined
        `,
      )
      .because('The constant folding should turn the tuple into an array'),
    addCode(`
      (ret[5]: 1);
      (ret[5]: 2);
    `)
      .newErrors(
        `
          test.js:15
           15:       (ret[5]: 2);
                      ^^^^^^ number. Expected number literal \`2\`, got \`1\` instead
           15:       (ret[5]: 2);
                              ^ number literal \`2\`
        `,
      )
      .because('The element type should be `1`'),
  ]),
  test('Spreading in a tuple should produce another tuple', [
    addCode(`
      var a = [2];
      var b = [4, 5];
      var x: [1,20,30,4,5,60] = [1, ...a, 3, ...b, 6];
    `).newErrors(
        `
          test.js:6
            6:       var x: [1,20,30,4,5,60] = [1, ...a, 3, ...b, 6];
                                               ^^^^^^^^^^^^^^^^^^^^^ array literal. Has some incompatible tuple element with
            6:       var x: [1,20,30,4,5,60] = [1, ...a, 3, ...b, 6];
                            ^^^^^^^^^^^^^^^^ tuple type
            The second tuple element is incompatible:
                4:       var a = [2];
                                  ^ number. Expected number literal \`20\`, got \`2\` instead
                6:       var x: [1,20,30,4,5,60] = [1, ...a, 3, ...b, 6];
                                   ^^ number literal \`20\`

          test.js:6
            6:       var x: [1,20,30,4,5,60] = [1, ...a, 3, ...b, 6];
                                               ^^^^^^^^^^^^^^^^^^^^^ array literal. Has some incompatible tuple element with
            6:       var x: [1,20,30,4,5,60] = [1, ...a, 3, ...b, 6];
                            ^^^^^^^^^^^^^^^^ tuple type
            The sixth tuple element is incompatible:
                6:       var x: [1,20,30,4,5,60] = [1, ...a, 3, ...b, 6];
                                                                      ^ number. Expected number literal \`60\`, got \`6\` instead
                6:       var x: [1,20,30,4,5,60] = [1, ...a, 3, ...b, 6];
                                             ^^ number literal \`60\`

          test.js:6
            6:       var x: [1,20,30,4,5,60] = [1, ...a, 3, ...b, 6];
                                               ^^^^^^^^^^^^^^^^^^^^^ array literal. Has some incompatible tuple element with
            6:       var x: [1,20,30,4,5,60] = [1, ...a, 3, ...b, 6];
                            ^^^^^^^^^^^^^^^^ tuple type
            The third tuple element is incompatible:
                6:       var x: [1,20,30,4,5,60] = [1, ...a, 3, ...b, 6];
                                                             ^ number. Expected number literal \`30\`, got \`3\` instead
                6:       var x: [1,20,30,4,5,60] = [1, ...a, 3, ...b, 6];
                                      ^^ number literal \`30\`
        `,
      )
  ]),
  test('Explicit union should become an explicit union', [
    addCode(`
      function test(arr: [1] | [2, 3]): [1, 10] | [2, 3, 10] {
        return [...arr, 10];
      }
    `).noNewErrors(),
  ]),
  test('Non-polymorphic function', [
    addCode(`
      function foo(arr) {
        return [...arr, 1];
      }
      const ret1 = foo([2]);
      const ret2 = foo([3]);
    `)
      .noNewErrors(),
    addCode('(ret1[0]: 2);')
      .newErrors(
        `
          test.js:11
           11: (ret1[0]: 2);
                ^^^^^^^ number. Expected number literal \`2\`, got \`3\` instead
           11: (ret1[0]: 2);
                         ^ number literal \`2\`
        `,
      )
      .because('Flow infers the return type to [2,1] | [3,1]'),
    addCode('(ret2[0]: 3);')
      .newErrors(
        `
          test.js:13
           13: (ret2[0]: 3);
                ^^^^^^^ number. Expected number literal \`3\`, got \`2\` instead
           13: (ret2[0]: 3);
                         ^ number literal \`3\`
        `,
      )
      .because('Flow infers the return type to [2,1] | [3,1]'),
  ]),
  test('Spreading an Array<T> should result in a non-tuple array', [
    addCode(`
      const tup: Array<number> = [1,2,3];
      const nonTup = [...tup];
      (nonTup: [1,2,3]);
    `).newErrors(
        `
          test.js:6
            6:       (nonTup: [1,2,3]);
                      ^^^^^^ array literal. Only tuples and array literals with known elements can flow to
            6:       (nonTup: [1,2,3]);
                              ^^^^^^^ tuple type
        `,
      )
  ]),
  test('Spreading a $ReadOnlyArray should result in a non-tuple array', [
    addCode(`
      const tup: $ReadOnlyArray<number> = [1,2,3];
      const nonTup = [...tup];
      (nonTup: [1,2,3]);
    `).newErrors(
        `
          test.js:6
            6:       (nonTup: [1,2,3]);
                      ^^^^^^ array literal. Only tuples and array literals with known elements can flow to
            6:       (nonTup: [1,2,3]);
                              ^^^^^^^ tuple type
        `,
      )
  ]),
  test('Spreading a string', [
    addCode('const arr: Array<number> = [..."hello"];')
      .newErrors(
        `
          test.js:3
            3: const arr: Array<number> = [..."hello"];
                                          ^^^^^^^^^^^^ Cannot assign array literal to \`arr\` because in type argument \`T\`, string [1] is incompatible with number [2].
            References:
            288:     @@iterator(): Iterator<string>;
                                            ^^^^^^ [1]: string. See lib: [LIB] core.js:288
              3: const arr: Array<number> = [..."hello"];
                                  ^^^^^^ [2]: number
        `,
      )
      .because('String is an Iterable<string>'),
  ]),
  test('Spreading a generator', [
    addCode(`
      function *foo(): Generator<string, void, void> {
        yield "hello";
      }
      const arr: Array<number> = [...foo()];
    `).newErrors(
        `
          test.js:7
            7:       const arr: Array<number> = [...foo()];
                                                ^^^^^^^^^^ Cannot assign array literal to \`arr\` because in type argument \`T\`, string [1] is incompatible with number [2].
            References:
              4:       function *foo(): Generator<string, void, void> {
                                                  ^^^^^^ [1]: string
              7:       const arr: Array<number> = [...foo()];
                                        ^^^^^^ [2]: number
        `,
      )
      .because('Generators are iterables too!'),
  ]),
  test('Spreading an iterator', [
    addCode(`
      function test(iter: Iterable<string>): Array<number> {
        return [...iter];
      }
    `).newErrors(
        `
          test.js:5
            5:         return [...iter];
                              ^^^^^^^^^ Cannot return array literal because in type argument \`T\`, string [1] is incompatible with number [2].
            References:
              4:       function test(iter: Iterable<string>): Array<number> {
                                                    ^^^^^^ [1]: string
              4:       function test(iter: Iterable<string>): Array<number> {
                                                                    ^^^^^^ [2]: number
        `,
      )
      .because('Spec says you can spread iterables')
  ]),
  test('Spreading Object', [
    addCode(`
      function test(iter: Object): string {
        return [...iter];
      }
    `).noNewErrors()
      .because(
        'You can spread Object since it might be an Iterable. It is treated ' +
          'like spreading any, which results in any'
      ),
  ]),
]);
