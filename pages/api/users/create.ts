import { PrismaClient } from "@prisma/client";
import { NextApiRequest, NextApiResponse } from "next";
import { ResponseDataType } from "types/request";
import { User, LNBits as LNBitsConfig } from ".prisma/client";
import { Prisma } from "@prisma/client";

const MAIN_DOMAIN = process.env.MAIN_DOMAIN || "hodl.ar";
const LNBITS_ENDPOINT =
  process.env.LNBITS_ENDPOINT || "https://legend.lnbits.com";

import z from "zod";

// Schema
const createUserRequestSchema = z.object({
  username: z.string().min(2),
  provider: z.string(),
});

// External Libraries
import GitHub from "@/lib/external/github";
import LNBits from "@/lib/external/lnbits";
import NextCors from "nextjs-cors";

// Create Prisma Client
const prisma = new PrismaClient();

// export the default function
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseDataType>,
) {
  // CORS
  await NextCors(req, res, {
    // Options
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
    origin: "*",
    optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
  });

  // Only allow POST
  if (req.method !== "POST") {
    res.status(405).json({ success: false, message: "Must be POST" });
    return;
  }

  // Parse for correct Post body
  const result = createUserRequestSchema.safeParse(req.body);

  // Invalid Body Format
  if (!result.success) {
    res.status(400).json({ success: false, message: result.error.message });
    return result;
  }

  // Get body data
  const { username, provider } = result.data;

  // TODO
  const github = username;

  // Wrap any errors in a try/catch
  try {
    if (provider !== "github") {
      throw new Error("Only GitHub is supported");
    }

    const githubProfile = await GitHub.getUserProfile(github);
    const userConfig = await GitHub.getConfigFromUserRepo(github);

    const { name, bio, twitter_username, email } = githubProfile;

    if (!userConfig?.username) {
      throw new Error("No username provided");
    }

    // TODO: Need to handle validation
    const user: User = {
      id: Math.random().toString(36).substring(2, 15),
      // id: userConfig.username,
      name,
      bio,
      twitter: twitter_username,
      email,
      github,
      nostr: userConfig.nostr?.npub || null,
      discord: null,
      lud06: null,
      relayIDs: [],
    };

    // Create User on Database
    await createUser(user);

    console.info("** Created User");
    console.dir(user);

    // Success
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (e: any) {
    console.dir(e);
    res.status(500).json({ success: false, message: e.message });
    return;
  }
}

const createUser = async (data: Prisma.UserCreateInput) => {
  const currentDate = new Date();
  const validUntil = new Date(currentDate.getTime() + 15 * 60 * 1000);

  const newUser = await prisma.user.create({
    data: {
      ...data,
      otToken: {
        create: {
          validUntil,
        },
      },
    },
  });

  console.dir(newUser);
  return newUser;
};
