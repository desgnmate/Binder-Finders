import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthForm } from "../AuthForm";

const mockGetUser = jest.fn();
const mockAuthStateChange = jest.fn();
const mockBrowserClient = jest.fn();

jest.mock("../../../lib/supabase/browser", () => ({
  browserClient: () => mockBrowserClient(),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, ...props }: { children: React.ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}));

beforeEach(() => {
  mockGetUser.mockResolvedValue({
    data: { user: { id: "user-1" } },
    error: null,
  });
  mockAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: jest.fn() } },
  });
  mockBrowserClient.mockReturnValue({
    auth: {
      getUser: mockGetUser,
      onAuthStateChange: mockAuthStateChange,
    },
  });
});

afterEach(() => jest.clearAllMocks());

it("enables Save password after a valid session loads and the password has 12 characters", async () => {
  const user = userEvent.setup();
  render(<AuthForm mode="reset" />);
  const password = await screen.findByLabelText("New password");
  await user.type(password, "correct-horse-battery-staple");
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Save password" })).toBeEnabled(),
  );
});
