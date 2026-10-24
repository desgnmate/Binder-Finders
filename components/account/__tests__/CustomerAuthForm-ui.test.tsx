import { render, screen } from "@testing-library/react";
import { CustomerAuthForm } from "../CustomerAuthForm";

let mockState: { error?: string; verificationRequired?: boolean } = {};
jest.mock("react", () => ({ ...jest.requireActual("react"), useActionState: () => [mockState, undefined] }));
jest.mock("react-dom", () => ({ ...jest.requireActual("react-dom"), useFormStatus: () => ({ pending: false }) }));
jest.mock("../../../app/account/auth-actions", () => ({ authenticateCustomer: jest.fn() }));
beforeEach(() => { mockState = {}; });

it.each(["login", "signup"] as const)("keeps the normal %s page free of a verification link", mode => {
  render(<CustomerAuthForm mode={mode} />);
  expect(screen.queryByRole("link", { name: /verify|confirmation/i })).not.toBeInTheDocument();
});
it("offers a contextual resend link only after an unverified sign-in attempt", () => {
  mockState = { error: "Please confirm your email.", verificationRequired: true };
  render(<CustomerAuthForm mode="login" next="/checkout" />);
  expect(screen.getByRole("alert")).toHaveTextContent("Please confirm your email.");
  expect(screen.getByRole("link", { name: "Resend confirmation email" })).toHaveAttribute("href", "/account/verify?next=%2Fcheckout");
});
