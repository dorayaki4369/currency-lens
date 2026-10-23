// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

afterEach(cleanup);

describe("Alert", () => {
  it("groups a title and description in an accessible alert", () => {
    render(
      <Alert variant="destructive">
        <AlertTitle>Save failed</AlertTitle>
        <AlertDescription>Try again.</AlertDescription>
      </Alert>,
    );

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Save failed");
    expect(alert.textContent).toContain("Try again.");
  });
});
