import { expect, test } from "bun:test";
import { assertExcerpt } from "./docs-automation-examples.ts";

test("version excerpts name the actual generator and preserve exact output order", () => {
  const excerpt = ["Form loaded", "Form Plan, saved by <rootform-version>"];
  expect(() =>
    assertExcerpt(
      "saved",
      excerpt,
      "Form loaded\nForm Plan, saved by rootform 0.2.0-rc.1\n",
      "rootform 0.2.0-rc.1",
    ),
  ).not.toThrow();
  expect(() =>
    assertExcerpt(
      "saved",
      excerpt,
      "Form loaded\nForm Plan, saved by rootform 0.2.0-rc.2\n",
      "rootform 0.2.0-rc.1",
    ),
  ).toThrow();
  expect(() =>
    assertExcerpt(
      "saved",
      excerpt,
      "Form Plan, saved by rootform 0.2.0-rc.1\nForm loaded\n",
      "rootform 0.2.0-rc.1",
    ),
  ).toThrow();
  expect(() =>
    assertExcerpt(
      "saved",
      excerpt,
      "Form loaded\nForm State, saved by rootform 0.2.0-rc.1\n",
      "rootform 0.2.0-rc.1",
    ),
  ).toThrow();
});
