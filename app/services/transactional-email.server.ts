import type { WorkerEnv } from "~/config/env.server";

export interface TransactionalEmailMessage {
  to: string;
  subject: string;
  textBody: string;
}

export interface TransactionalEmailService {
  readonly mode: "noop" | "postmark";
  send(message: TransactionalEmailMessage): Promise<void>;
}

class NoopTransactionalEmailService implements TransactionalEmailService {
  readonly mode = "noop" as const;

  async send(_message: TransactionalEmailMessage): Promise<void> {}
}

class PostmarkTransactionalEmailService implements TransactionalEmailService {
  readonly mode = "postmark" as const;

  constructor(
    private readonly token: string,
    private readonly from: string,
  ) {}

  async send(message: TransactionalEmailMessage): Promise<void> {
    const response = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": this.token,
      },
      body: JSON.stringify({
        From: this.from,
        To: message.to,
        Subject: message.subject,
        TextBody: message.textBody,
        MessageStream: "outbound",
      }),
    });
    if (!response.ok) {
      throw new Error("Transactional email delivery failed.");
    }
  }
}

export function createTransactionalEmailService(
  env?: WorkerEnv,
  mode: string = import.meta.env.MODE,
): TransactionalEmailService {
  const token =
    typeof Reflect.get(env ?? {}, "POSTMARK_SERVER_TOKEN") === "string"
      ? String(Reflect.get(env ?? {}, "POSTMARK_SERVER_TOKEN")).trim()
      : "";
  const from =
    typeof Reflect.get(env ?? {}, "TRANSACTIONAL_EMAIL_FROM") === "string"
      ? String(Reflect.get(env ?? {}, "TRANSACTIONAL_EMAIL_FROM")).trim()
      : "";
  if (token && from) {
    return new PostmarkTransactionalEmailService(token, from);
  }
  if (mode === "production") {
    return {
      mode: "noop",
      async send() {
        throw new Error(
          "Transactional email is unconfigured. Set POSTMARK_SERVER_TOKEN and TRANSACTIONAL_EMAIL_FROM.",
        );
      },
    };
  }
  return new NoopTransactionalEmailService();
}
