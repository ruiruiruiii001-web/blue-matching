import { APP_URL } from "./line.ts";
import { notifyLineLinkCompletion } from "./line-link-completion.ts";

Deno.test("successful linking replies with a permanent website link", async () => {
  let message = "";
  const result = await notifyLineLinkCompletion(
    true,
    text => {
      message = text;
      return Promise.resolve(new Response(null, { status: 200 }));
    },
  );
  if (result !== "completed" || !message.includes(APP_URL)) throw new Error("Missing completion link");
  if (!message.includes("このトークから") || !message.includes("原則1日1回") ||
      !message.includes("パスワードや電話番号は送らない")) {
    throw new Error("Missing inquiry instructions");
  }
});

Deno.test("expired or replayed links do not send a completion message", async () => {
  const result = await notifyLineLinkCompletion(
    false,
    () => { throw new Error("Unexpected reply"); },
  );
  if (result !== "ignored") throw new Error("Invalid link was not ignored");
});

Deno.test("a failed reply is reported", async () => {
  const result = await notifyLineLinkCompletion(
    true,
    () => Promise.resolve(new Response(null, { status: 500 })),
  );
  if (result !== "reply_failed") throw new Error("Reply failure was not reported");
});
