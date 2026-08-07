import { z } from 'zod';

// Define the schema for environment variables
const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().optional(),
  // Add more environment variables here
});

// Parse and validate the environment variables
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error(
    "Invalid environment variables:",
    parsedEnv.error.flatten().fieldErrors
  );
  throw new Error("Invalid environment variables");
}

export const env = parsedEnv.data;
