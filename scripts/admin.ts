import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createInterface } from "node:readline/promises";
const rl = createInterface({ input: process.stdin, output: process.stdout });
const email = (await rl.question("Administrator email: ")).trim().toLowerCase();
const name = (await rl.question("Administrator name: ")).trim();
// Password is accepted from hidden terminal input; never passed as a command argument.
process.stdout.write("Password (12+ characters, hidden): ");
let password = "";
if (!process.stdin.isTTY)
  throw new Error("Run provisioning in an interactive terminal");
rl.close();
process.stdin.setRawMode(true);
process.stdin.resume();
password = await new Promise<string>((resolve) => {
  const listener = (buffer: Buffer) => {
    for (const c of buffer.toString()) {
      if (c === "\u0003") process.exit(1);
      if (c === "\r" || c === "\n") {
        process.stdin.off("data", listener);
        process.stdin.setRawMode(false);
        resolve(password);
        return;
      }
      if (c === "\u007f" || c === "\b") password = password.slice(0, -1);
      else password += c;
    }
  };
  process.stdin.on("data", listener);
});
if (password.length < 12 || !email.includes("@") || !name)
  throw new Error(
    "Valid email, name and password of at least 12 characters required",
  );
const db = new PrismaClient();
await db.user.create({
  data: {
    email,
    name,
    password: await bcrypt.hash(password, 12),
    role: "ADMIN",
  },
});
await db.$disconnect();
password = "";
console.log("\nAdministrator created.");
process.exit(0);
