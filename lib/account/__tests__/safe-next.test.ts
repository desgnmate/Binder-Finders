import { safeAccountNext } from "../safe-next";

it.each([
  null, undefined, {}, ["/checkout"], "https://example.test", "//example.test",
  "/\\example.test", "/\n/example.test", "/\t/example.test",
  "/%5cexample.test", "/%2fexample.test", "/%0a/example.test",
  "/a/..//example.test",
  "/account/login", "/account/signup?next=/account", "/account/verify/",
])("rejects unsafe return destination %j", (value) => {
  expect(safeAccountNext(value)).toBe("/account");
});

it.each(["/checkout", "/account/orders", "/shop?card=base1#details", "/checkout?note=hello%20world"])(
  "preserves a local return destination %s", (value) => {
    expect(safeAccountNext(value)).toBe(value);
  },
);
