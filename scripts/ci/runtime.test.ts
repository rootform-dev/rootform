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
