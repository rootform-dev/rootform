import { expect, test } from "bun:test";
import { validateRepository } from "./validate-repository.ts";

test("current repository respects distribution boundary", () => {
  expect(validateRepository).not.toThrow();
});
