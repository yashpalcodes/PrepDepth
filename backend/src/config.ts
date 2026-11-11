import "dotenv/config";

const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 16) {
  throw new Error("JWT_SECRET is missing or too short. Add it to backend/.env");
}

export const JWT_SECRET: string = secret;
