// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { List, ListItem } from "@/components/ui/list";

afterEach(cleanup);

describe("List", () => {
  it("preserves default and ordered-list semantics", () => {
    render(
      <>
        <List aria-label="Default list">
          <ListItem>Default row</ListItem>
        </List>
        <List aria-label="Currencies" as="ol">
          <ListItem as="li" dividerInset="edge" dividerVisibility="visible">
            JPY
          </ListItem>
          <ListItem as="li">EUR</ListItem>
        </List>
      </>,
    );

    expect(screen.getByLabelText("Default list").textContent).toBe("Default row");
    expect(screen.getByRole("list", { name: "Currencies" })).toBeTruthy();
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "JPY",
      "EUR",
    ]);
  });
});
