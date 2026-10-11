import { expect, test } from "bun:test";
import { referenceRuntimeTag } from "./runtime.ts";

test("reference asset location remains separate from the original binary version", () => {
  const pin = { repository: "rootform-dev/rootform", version: "0.1.0-pr.999.1" };
  expect(referenceRuntimeTag(pin)).toBe("v0.1.0-pr.999.1");
  expect(referenceRuntimeTag({ ...pin, release_tag: "verification-runtime-0.1.0-pr.999.1" })).toBe(
    "verification-runtime-0.1.0-pr.999.1",
  );
  for (const release_tag of ["v0.1.0", "verification-runtime-0.1.0-pr.999.2", "../fixture"])
    expect(() => referenceRuntimeTag({ ...pin, release_tag })).toThrow(
      "Invalid reference runtime identity",
    );
});

test("a published stable release is located by its own tag", () => {
  const pin = { repository: "rootform-dev/rootform", version: "0.2.0" };
  expect(referenceRuntimeTag(pin)).toBe("v0.2.0");
  for (const version of ["0.2", "v0.2.0", "0.2.0-rc.1", "01.2.0", "../0.2.0"])
    expect(() => referenceRuntimeTag({ ...pin, version })).toThrow(
      "Invalid reference runtime identity",
    );
});
