import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Privacy, PRIVACY_POLICY_VERSION } from "./Privacy";
import { router } from "../routes";

afterEach(cleanup);

describe("Privacy page", () => {
  it("is registered at /privacy", () => {
    const rootRoute = router.routes.find((route) => route.path === "/");
    const privacyRoute = rootRoute?.children?.find(
      (route) => route.path === "privacy",
    );

    expect(privacyRoute).toBeTruthy();
  });

  it("renders the supplied Privacy Statement content and version", () => {
    render(<Privacy />);

    expect(screen.getByRole("heading", { name: "Privacy Policy" })).toBeTruthy();
    expect(screen.getByText(`Version ${PRIVACY_POLICY_VERSION}`)).toBeTruthy();
    expect(
      screen.getByText(/We keep your account data for up to 15 months/),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "uoastrengthsociety@gmail.com" })
        .getAttribute("href"),
    ).toBe("mailto:uoastrengthsociety@gmail.com");
  });
});
