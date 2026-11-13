/** @jest-environment node */
import { sendContactMessage } from "../actions";
import { contactEmail } from "../../../../lib/contact";

const mockMaybeSingle = jest.fn();
jest.mock("../../../../lib/supabase/server", () => ({
  serviceClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }) }) }),
}));

const valid = { topic: "card", name: "Ash", email: "ash@example.test", reference: "", message: "Can I see the corners?", website: "" };
const env = { ...process.env };

beforeEach(() => {
  process.env = { ...env, RESEND_API_KEY: "re_test", RESEND_FROM_EMAIL: "orders@shop.example.test" };
  mockMaybeSingle.mockResolvedValue({ data: { order_alert_email: "store@example.test" } });
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
});
afterAll(() => {
  process.env = env;
});

describe("contact form", () => {
  it("emails the store inbox with the customer as reply-to", async () => {
    await expect(sendContactMessage(valid)).resolves.toEqual({ ok: true });
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ to: ["store@example.test"], reply_to: "ash@example.test", from: "orders@shop.example.test" });
    expect(body.subject).toBe("Website message: A card I saw — Ash");
  });

  it("returns field errors without sending", async () => {
    const result = await sendContactMessage({ ...valid, email: "nope", message: "hi" });
    expect(result).toMatchObject({ ok: false, fieldErrors: { email: "Enter a valid email address", message: expect.any(String) } });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("pretends to succeed for bots and sends nothing", async () => {
    await expect(sendContactMessage({ ...valid, website: "spam.example" })).resolves.toEqual({ ok: true });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("asks people to email directly when there's no store inbox or the provider fails", async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null });
    await expect(sendContactMessage(valid)).resolves.toMatchObject({ ok: false });
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false });
    await expect(sendContactMessage(valid)).resolves.toMatchObject({ ok: false });
  });

  it("escapes customer text in the HTML email", () => {
    const email = contactEmail({ ...valid, topic: "card", name: "<b>Ash</b>", message: "<script>x</script>" });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;b&gt;Ash&lt;/b&gt;");
    expect(email.text).toContain("<script>x</script>");
  });
});
